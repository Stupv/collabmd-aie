# Excalidraw `@next` Runtime Notes

Date: March 10, 2026

Tested package:

- `@excalidraw/excalidraw@0.18.0-c1dbbdf`

Findings from direct inspection of the installed bundle in `node_modules` and runtime probing in the embed harness:

- This snapshot does not yet expose the newer changelog APIs such as `onMount`, `onInitialize`, generic `onEvent(...)`, or `onExcalidrawAPI`.
- The installed bundle still wires the host callback through `excalidrawAPI`.
- During a real drag, the library sets drag-related app state such as `selectedElementsAreBeingDragged`, but the public scene returned by `getSceneElementsIncludingDeleted()` does not move before mouseup.
- The public `onIncrement` / store path does not provide a usable live element-update stream for that drag path in this snapshot.
- Live pointer updates do arrive in real time.

Conclusion:

- In-progress remote drag rendering for this `@next` snapshot requires host-side reconstruction from pointer and selection awareness, or an internal Excalidraw collaboration path that is not exposed through the public package API.
- Because stable `@excalidraw/excalidraw@0.18.0` already provides the expected multiplayer behavior for this app, the repo is being reverted to the stable package instead of carrying custom drag-preview glue for the prerelease snapshot.
