#!/usr/bin/env node

// CollabMD — y-websocket-compatible Collaboration Server
// Usage: node server.js
// Environment: HOST (default: 0.0.0.0), PORT (default: 1234)
//
// Compatible with y-websocket WebsocketProvider.
// Maintains a Y.Doc per room and handles Yjs sync protocol + awareness.

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const host = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '1234', 10);
const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Protocol message types (must match y-websocket client)
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// Room management
const rooms = new Map();

class Room {
  constructor(name) {
    this.name = name;
    this.doc = new Y.Doc({ gc: true });
    this.clients = new Set();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState(null);

    // Listen for doc updates and broadcast to all clients
    this.doc.on('update', (update, origin) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const msg = encoding.toUint8Array(encoder);
      for (const client of this.clients) {
        if (client !== origin && client.readyState === 1) {
          try { client.send(msg); } catch (_) {}
        }
      }
    });

    // Listen for awareness changes and broadcast
    this.awareness.on('update', ({ added, updated, removed }, origin) => {
      const changedClients = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      );
      const msg = encoding.toUint8Array(encoder);
      for (const client of this.clients) {
        if (client.readyState === 1) {
          try { client.send(msg); } catch (_) {}
        }
      }
    });
  }

  addClient(ws) {
    this.clients.add(ws);

    // Send sync step 1 to the new client
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    ws.send(encoding.toUint8Array(encoder));

    // Send current awareness states to the new client
    const awarenessStates = this.awareness.getStates();
    if (awarenessStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          Array.from(awarenessStates.keys())
        )
      );
      ws.send(encoding.toUint8Array(awarenessEncoder));
    }
  }

  removeClient(ws) {
    this.clients.delete(ws);
    if (this.clients.size === 0) {
      this.awareness.destroy();
      this.doc.destroy();
      rooms.delete(this.name);
    }
  }

  handleMessage(ws, data) {
    const msg = data instanceof Buffer ? new Uint8Array(data) : new Uint8Array(data);
    try {
      const decoder = decoding.createDecoder(msg);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MSG_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, this.doc, ws);
          // If the encoder has more than just the message type, send the reply
          if (encoding.length(encoder) > 1) {
            ws.send(encoding.toUint8Array(encoder));
          }
          break;
        }
        case MSG_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(this.awareness, update, ws);
          break;
        }
      }
    } catch (err) {
      console.error(`[!] Message error in "${this.name}":`, err.message);
    }
  }
}

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, new Room(name));
  return rooms.get(name);
}

const staticFiles = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/app.js', 'app.js'],
  ['/base.css', 'base.css'],
  ['/style.css', 'style.css'],
]);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

async function handleHttpRequest(req, res) {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/health') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end('ok');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end('Method Not Allowed');
    return;
  }

  const relativePath = staticFiles.get(requestUrl.pathname);
  if (!relativePath) {
    res.writeHead(404, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end('Not Found');
    return;
  }

  const filePath = join(rootDir, relativePath);

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    res.end(file);
  } catch (err) {
    console.error(`[!] HTTP error for "${requestUrl.pathname}":`, err.message);
    res.writeHead(500, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end('Internal Server Error');
  }
}

const httpServer = createServer((req, res) => {
  handleHttpRequest(req, res).catch((err) => {
    console.error('[!] Unexpected HTTP error:', err.message);
    if (!res.headersSent) {
      res.writeHead(500, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain; charset=utf-8',
      });
    }
    res.end('Internal Server Error');
  });
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  const roomName = req.url?.replace(/^\/+/, '') || 'default';
  const room = getRoom(roomName);
  room.addClient(ws);
  console.log(`[+] "${roomName}": ${room.clients.size} client(s)`);

  ws.on('message', (data) => room.handleMessage(ws, data));

  ws.on('close', () => {
    room.removeClient(ws);
    const remaining = rooms.has(roomName) ? rooms.get(roomName).clients.size : 0;
    console.log(`[-] "${roomName}": ${remaining} client(s)`);
  });

  ws.on('error', (err) => console.error(`[!] "${roomName}":`, err.message));
});

httpServer.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

httpServer.listen(port, host, () => {
  console.log('');
  console.log('  CollabMD Collaboration Server');
  console.log(`  ws://localhost:${port}`);
  console.log(`  http://localhost:${port}`);
  console.log('');
  console.log('  Open the editor in a browser and collaboration will connect automatically.');
  console.log('');
});
