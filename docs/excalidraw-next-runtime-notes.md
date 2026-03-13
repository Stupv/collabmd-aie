# Excalidraw `@next` Runtime Notes

Date: March 13, 2026

Tested package:

- `@excalidraw/excalidraw@0.18.0-816c81c`

Current public API surface confirmed from the installed package types:

- `onMount` / `onInitialize` / `onUnmount` are the main lifecycle props to prefer for host integration.
- `onMount`, `onInitialize`, and `onUnmount` are available on `<Excalidraw />`.
- The imperative API exposes `onEvent(...)` and `onStateChange(...)`.
- Legacy imperative subscriptions such as `api.onScrollChange(...)` and `api.onUserFollow(...)` still exist in this snapshot, but host integrations should prefer `api.onStateChange(...)` / `onEvent(...)` where practical.

CollabMD integration notes:

- The editor now captures the API via `onMount` and defers room synchronization setup until `onInitialize`.
- Remote scene updates are queued until initialization completes so we do not write into the editor before its initial scene is ready.
- Viewport and follow handling now subscribe through `api.onStateChange(...)` for `scrollX` / `scrollY` / `zoom` and `userToFollow`, which matches the new state-observer API surface.
