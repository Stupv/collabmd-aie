import test from "node:test";
import assert from "node:assert/strict";

import { ExcalidrawEmbedController } from "../../src/client/presentation/excalidraw-embed-controller.js";

test("replays a queued follow target after the Excalidraw iframe reports ready", async () => {
  const originalWindow = globalThis.window;
  const posts = [];
  const iframeWindow = {};
  const entry = {
    filePath: "sample-excalidraw.excalidraw",
    iframe: { contentWindow: iframeWindow },
    isReady: false,
    wrapper: {},
  };

  globalThis.window = {
    location: { origin: "http://localhost:4173" },
  };

  try {
    const controller = {
      embedEntries: new Map([["sample-excalidraw.excalidraw#0", entry]]),
      followedPeerIdsByFilePath: new Map(),
      getTheme: () => "dark",
      _clearEntryBootTimeout: () => {},
      _findEntryByContentWindow:
        ExcalidrawEmbedController.prototype._findEntryByContentWindow,
      _findEntryByFilePath:
        ExcalidrawEmbedController.prototype._findEntryByFilePath,
      _postMessageToEntry: (_entry, payload) => {
        posts.push(payload);
      },
      _syncEntryFollowState:
        ExcalidrawEmbedController.prototype._syncEntryFollowState,
      _syncEntryUser: () => {},
    };

    const didQueueFollow =
      await ExcalidrawEmbedController.prototype.setFollowedUser.call(
        controller,
        "sample-excalidraw.excalidraw",
        "peer-42",
      );

    assert.equal(didQueueFollow, true);
    assert.equal(entry.followedPeerId, "peer-42");
    assert.deepEqual(posts, []);

    ExcalidrawEmbedController.prototype._onMessage.call(controller, {
      data: {
        source: "excalidraw-editor",
        type: "ready",
      },
      origin: "http://localhost:4173",
      source: iframeWindow,
    });

    assert.deepEqual(posts, [
      {
        source: "collabmd-host",
        type: "set-theme",
        theme: "dark",
      },
      {
        source: "collabmd-host",
        type: "follow-user",
        peerId: "peer-42",
      },
    ]);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("persists follow intent even before the embed entry exists", async () => {
  const controller = {
    embedEntries: new Map(),
    followedPeerIdsByFilePath: new Map(),
    _findEntryByFilePath: () => null,
  };

  const didQueueFollow =
    await ExcalidrawEmbedController.prototype.setFollowedUser.call(
      controller,
      "sample-excalidraw.excalidraw",
      "peer-99",
    );

  assert.equal(didQueueFollow, true);
  assert.equal(
    controller.followedPeerIdsByFilePath.get("sample-excalidraw.excalidraw"),
    "peer-99",
  );
});
