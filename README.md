# CollabMD

Realtime collaborative Markdown editor with Mermaid support, powered by Yjs and WebSockets.

## Requirements

- Node.js 18+
- npm

## Install

```bash
npm install
```

## Run locally

Start the local server:

```bash
npm start
```

Then open:

```text
http://localhost:1234
```

The same server handles both:

- the frontend
- the collaboration WebSocket server at `ws://localhost:1234`

## Local workflow

1. Run `npm start`
2. Open `http://localhost:1234`
3. Create a room or join one by name
4. Share the URL with another browser tab or another user

## Optional: serve the frontend from another local server

If you want to serve the static frontend separately, keep the WebSocket server running on port `1234`:

```bash
npm start
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

The client will try `ws://localhost:1234` first. If your WebSocket server is on a different address, pass it in the URL:

```text
http://localhost:8080/?server=ws://127.0.0.1:1234
```

## Environment variables

- `PORT`: HTTP + WebSocket port, default `1234`
- `HOST`: bind host, default `0.0.0.0`

Example:

```bash
HOST=127.0.0.1 PORT=4000 npm start
```

If you change the WebSocket port, open the frontend with the matching `?server=` query parameter unless you are also serving the frontend from that same port.
