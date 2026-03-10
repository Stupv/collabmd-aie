# Architecture Boundaries

CollabMD is organized as a modular layered monolith. The goal is to keep
feature code small and easy to move without changing public behavior.

## Layers

- `presentation`: DOM/UI controllers and view-only behavior.
- `application`: workflows, orchestration, state transitions, and use cases.
- `domain`: pure rules, parsing, transformations, and shared value helpers.
- `infrastructure`: browser APIs, HTTP, WebSocket, filesystem, git, and remote services.

## Dependency Direction

Allowed imports should flow inward:

- `presentation` -> `application`, `domain`
- `application` -> `domain`
- `infrastructure` -> `application`, `domain`
- `domain` -> `domain`

Current repo structure is still mid-refactor, so the boundary test enforces the
rules that are already durable today:

- `src/domain/**` must not import `src/client/**` or `src/server/**`.
- `src/client/presentation/**` must not import `src/client/application/**` or
  `src/client/infrastructure/**`.
- `src/client/infrastructure/**` must not import `src/client/application/**` or
  `src/client/presentation/**`.
- `src/client/application/**` should not import client `presentation` or
  `infrastructure`, with temporary exceptions documented below.
- `src/server/domain/**` must not import `src/server/infrastructure/**`.
- `src/server/auth/**` should not import `src/server/infrastructure/**`, with a
  temporary exception documented below.

Bootstrap entrypoints may compose across layers, but should stay thin:

- `src/client/main.js`
- `src/client/bootstrap/**`

## Naming Rules

- Do not place transport or I/O adapters under `domain`.
- If a module depends on `fetch`, `child_process`, filesystem APIs, sockets, or
  browser globals, it belongs in `infrastructure` unless it is a tiny bootstrap
  entrypoint.
- Keep shared pure helpers under `src/domain/`.
- Prefer feature-specific collaborators over expanding a single shell class.

## Temporary Exceptions

These files are legacy composition/orchestration modules and are explicitly
allowlisted in the boundary test until the refactor is complete:

- `src/server/auth/create-auth-service.js`

No new exceptions should be added without updating this note and explaining why
the boundary cannot be enforced yet.
