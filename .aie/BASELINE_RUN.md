# CollabMD — AIE Baseline Run (Pre-Gap-Fill)

> Date: 2026-03-20
> AIE version: 0.1.0 (current)
> Run ID: run-003 (plan stage)
> Purpose: First AIE run against an external JS project to identify AIE gaps

## Metrics Collected

| Metric              | Value   | Target | Status                   |
| ------------------- | ------- | ------ | ------------------------ |
| eslint_violations   | 1       | 0      | NOT MET                  |
| prettier_violations | 129     | 0      | NOT MET                  |
| dockerfile_issues   | 1       | 0      | NOT MET                  |
| secrets_detected    | 5       | 0      | NOT MET                  |
| code_size (scc)     | SKIPPED | —      | scc binary not available |

## Tasks Generated (5)

1. **T-001** — Run Prettier auto-format (129 violations)
2. **T-002** — Pin apk versions in Dockerfile (DL3018)
3. **T-003** — Audit 5 detected secrets — rotate or annotate false positives
4. **T-004** — Invert Cloudflare Quick Tunnel default from opt-out to opt-in
5. **T-005** — Emit actionable remediation hints for 3 known startup failures

1 proposal discarded (P-003 referenced non-existent `.secrets.baseline`).

## AIE Gaps Identified

Filed as Epic 8 (E8-1 to E8-5) in AIE BACKLOG.md:

- **E8-1 (P1):** JS/TS AST parser — all 80+ JS files hit `ast_parse_failed`
- **E8-2 (P2):** `init` misidentified project as TypeScript
- **E8-3 (P2):** No `direction: neutral` for informational metrics
- **E8-4 (P3):** `init` doesn't check tool binary availability
- **E8-5 (P2):** Misleading "pip install scc" suggestion for missing binary

Also relevant: Epic 9 (context depth) — LLM received no file content, only file tree.

## Re-Run Plan

After implementing E8-1, E8-2, E9-1/E9-2, re-run `aie plan /projects/external/collabmd` and compare proposal quality against this baseline.

## Full Data

- Run snapshot: `.aie/runs/run-003/run_snapshot.json`
- Metrics config: `aie-metrics.yaml`
