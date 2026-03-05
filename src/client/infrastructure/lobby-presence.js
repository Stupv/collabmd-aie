import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { createRandomUser } from '../domain/room.js';
import { resolveWsBaseUrl } from './runtime-config.js';

const LOBBY_ROOM_NAME = '__lobby__';

/**
 * Global presence layer.
 *
 * Every client joins a lightweight Yjs "lobby" room whose document is never
 * written to.  Only the awareness channel is used — each client publishes
 * `{ user, currentFile }` so that every other client can see who is online
 * and which file they are editing.
 */
export class LobbyPresence {
  constructor({ preferredUserName, onChange }) {
    this.onChange = onChange;
    this.wsBaseUrl = resolveWsBaseUrl();
    this.ydoc = new Y.Doc();
    this.provider = null;
    this.awareness = null;
    this.localUser = createRandomUser(preferredUserName);
    this.currentFile = null;
    this._connected = false;
  }

  connect() {
    if (this.provider) return;

    this.provider = new WebsocketProvider(
      this.wsBaseUrl,
      LOBBY_ROOM_NAME,
      this.ydoc,
      { disableBc: true, maxBackoffTime: 5000 },
    );

    this.awareness = this.provider.awareness;
    this.awareness.setLocalStateField('user', this.localUser);
    this.awareness.setLocalStateField('currentFile', this.currentFile);

    this.awareness.on('change', () => {
      this._emitChange();
    });

    this.provider.on('status', ({ status }) => {
      this._connected = status === 'connected';
    });
  }

  /** Update which file the local user is currently viewing. */
  setCurrentFile(filePath) {
    this.currentFile = filePath;
    if (this.awareness) {
      this.awareness.setLocalStateField('currentFile', filePath);
    }
  }

  /** Update the local user's display name (after rename). */
  setUserName(name) {
    if (!name) return;
    this.localUser = { ...this.localUser, name };
    if (this.awareness) {
      this.awareness.setLocalStateField('user', this.localUser);
    }
  }

  /** Return the local user object (name + color). */
  getLocalUser() {
    return this.localUser;
  }

  /**
   * Collect all users across the lobby.
   * Returns an array of `{ name, color, clientId, currentFile, isLocal }`.
   */
  getUsers() {
    if (!this.awareness) return [];

    const users = [];
    this.awareness.getStates().forEach((state, clientId) => {
      if (!state.user) return;
      users.push({
        ...state.user,
        clientId,
        currentFile: state.currentFile ?? null,
        isLocal: clientId === this.awareness.clientID,
      });
    });
    return users;
  }

  destroy() {
    this.provider?.disconnect();
    this.provider?.destroy();
    this.provider = null;
    this.awareness = null;
    this.ydoc?.destroy();
    this.ydoc = null;
  }

  _emitChange() {
    this.onChange?.(this.getUsers());
  }
}
