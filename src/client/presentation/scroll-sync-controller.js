function getScrollableRange(element) {
  return Math.max(element.scrollHeight - element.clientHeight, 0);
}

function clampScrollTop(value) {
  return Math.max(value, 0);
}

export class ScrollSyncController {
  constructor({ previewContainer }) {
    this.previewContainer = previewContainer;
    this.editorScroller = null;
    this.lockedElements = new Set();
    this.pendingSync = null;
    this.frameId = null;

    this.handleEditorScroll = () => {
      this.scheduleSync(this.editorScroller, this.previewContainer);
    };

    this.handlePreviewScroll = () => {
      this.scheduleSync(this.previewContainer, this.editorScroller);
    };
  }

  initialize() {
    this.previewContainer?.addEventListener('scroll', this.handlePreviewScroll, { passive: true });
  }

  attachEditorScroller(editorScroller) {
    if (this.editorScroller === editorScroller) {
      return;
    }

    this.editorScroller?.removeEventListener('scroll', this.handleEditorScroll);
    this.editorScroller = editorScroller;
    this.editorScroller?.addEventListener('scroll', this.handleEditorScroll, { passive: true });
  }

  syncPreviewToEditor() {
    this.sync(this.editorScroller, this.previewContainer);
  }

  syncEditorToPreview() {
    this.sync(this.previewContainer, this.editorScroller);
  }

  destroy() {
    this.previewContainer?.removeEventListener('scroll', this.handlePreviewScroll);
    this.editorScroller?.removeEventListener('scroll', this.handleEditorScroll);
    this.editorScroller = null;
    this.pendingSync = null;
    this.lockedElements.clear();

    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  scheduleSync(source, target) {
    if (!source || !target || this.lockedElements.has(source)) {
      return;
    }

    this.pendingSync = { source, target };
    if (this.frameId) {
      return;
    }

    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;

      if (!this.pendingSync) {
        return;
      }

      const { source: pendingSource, target: pendingTarget } = this.pendingSync;
      this.pendingSync = null;
      this.sync(pendingSource, pendingTarget);
    });
  }

  sync(source, target) {
    if (!source || !target || this.lockedElements.has(source)) {
      return;
    }

    const sourceRange = getScrollableRange(source);
    const targetRange = getScrollableRange(target);
    const scrollRatio = sourceRange > 0 ? source.scrollTop / sourceRange : 0;
    const nextScrollTop = targetRange > 0 ? targetRange * scrollRatio : 0;

    this.lockedElements.add(target);
    target.scrollTop = clampScrollTop(nextScrollTop);

    requestAnimationFrame(() => {
      this.lockedElements.delete(target);
    });
  }
}
