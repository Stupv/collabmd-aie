import test from "node:test";
import assert from "node:assert/strict";

import { GitPanelController } from "../../src/client/presentation/git-panel-controller.js";

class FakeElement {
  constructor(attributes = {}, closestMap = {}) {
    this.attributes = attributes;
    this.closestMap = closestMap;
  }

  closest(selector) {
    return this.closestMap[selector] ?? null;
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
}

function createPanelHarness() {
  const listeners = new Map();
  const panel = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    innerHTML: "",
  };

  const previousDocument = globalThis.document;
  const previousElement = globalThis.Element;
  globalThis.document = {
    getElementById(id) {
      return id === "gitPanel" ? panel : null;
    },
  };
  globalThis.Element = FakeElement;

  return {
    panel,
    restore() {
      globalThis.document = previousDocument;
      globalThis.Element = previousElement;
    },
    triggerClick(target) {
      const handler = listeners.get("click");
      handler?.({
        preventDefault() {},
        stopPropagation() {},
        target,
      });
    },
  };
}

test("GitPanelController renders pull backups and opens the summary when selected", async (t) => {
  const harness = createPanelHarness();
  t.after(() => harness.restore());

  const openedPaths = [];
  const controller = new GitPanelController({
    onOpenPullBackup: (filePath) => {
      openedPaths.push(filePath);
    },
  });
  controller.initialize();
  controller.status = {
    branch: {
      ahead: 0,
      behind: 0,
      name: "master",
      upstream: "origin/master",
    },
    isGitRepo: true,
    sections: [],
    summary: {
      changedFiles: 0,
      staged: 0,
    },
  };
  controller.pullBackups = [
    {
      branch: "master",
      createdAt: "2026-03-17T10:00:00.000Z",
      fileCount: 2,
      id: "20260317-100000-abc1234",
      summaryPath: ".collabmd/pull-backups/20260317-100000-abc1234/summary.md",
    },
  ];

  controller.render();

  assert.match(harness.panel.innerHTML, /Pull Backups/);
  assert.match(harness.panel.innerHTML, /20260317-100000-abc1234/);

  const backupButton = new FakeElement(
    {
      "data-git-pull-backup-path":
        ".collabmd/pull-backups/20260317-100000-abc1234/summary.md",
    },
    {
      "[data-git-pull-backup-path]": new FakeElement({
        "data-git-pull-backup-path":
          ".collabmd/pull-backups/20260317-100000-abc1234/summary.md",
      }),
    },
  );
  harness.triggerClick(backupButton);

  assert.deepEqual(openedPaths, [
    ".collabmd/pull-backups/20260317-100000-abc1234/summary.md",
  ]);
});
