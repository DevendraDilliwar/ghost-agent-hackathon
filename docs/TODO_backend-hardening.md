# Backend hardening baseline

Status: initial repository inventory, 2026-10-29, retained as a historical baseline. A desktop scaffold and first controller/provider/input source slice were subsequently added at the owner's request; see [development](DEVELOPMENT.md) for current source checks. There is still no hosted backend/database. This document does not claim that the desktop code has passed a complete hardening audit or live execution acceptance.

## Context

- [x] **AUDIT-001** Inventory Ghost Agent at the start of documentation work. The repository contained `Readme.md` and environment/Git directories; no application source, package manifest, migrations, service definitions, or tests were present. Evidence: root listing, `rg --files`, and `git status --short` showed the untracked original README.
- [x] **AUDIT-002** Record the stated problem: users manually relay AI instructions and computer results. Incidents, production load, endpoint timings, growth projections, and database profiles have not been supplied or measured.
- [x] **AUDIT-003** Separate the proposed design from existing infrastructure. The proposal is a TypeScript/Electron desktop app using Meta cloud inference and local input/capture adapters; no Ghost Agent REST/GraphQL server or database is proposed for the MVP.
- [ ] **AUDIT-004** Before a real deployment, confirm applicable data handling, residency, retention, and compliance requirements. None have been established beyond the product's current privacy/control requirements in [the PRD](PRD.md).

## Audit Findings

- [x] **FINDING-CONNECTION-001 [Medium] [First-run connection UI]**:
  - **Issue**: The user-reported Xubuntu screenshot shows setup indicators above a large task composer while the key field is not clearly visible. `AgentChatView` always reserved a non-shrinking footer for the task form, even before connection readiness, and `ConnectionSetup` placed status tiles before the key input. This crowded the setup form into the remaining scroll area. The status tiles are informational, not checkboxes.
  - **Risk**: A first-time user cannot discover where to enter a key and sees a disabled Start action without a clear setup path, particularly in a short VM window.
  - **Proposed Fix**: Applied a dedicated setup view with the password input and Connect & test action first, automatic status labels below, and a compact setup footer. Keep the task composer hidden until setup is ready and Settings is closed; retain its draft while switching views. Use the available viewport height instead of a separate fixed minimum card height.

- [x] **FINDING-PRELOAD-001 [High] [Sandboxed preload output]**:
  - **Issue**: The approved floating-window implementation initially made the multi-entry build emit a shared `out/preload/chunks/channels-*.cjs` and local chunk imports. Electron sandboxed preloads cannot require these generated local modules.
  - **Risk**: A successful source build can still produce a missing desktop bridge at startup, leaving native UI controls unavailable.
  - **Proposed Fix**: Applied self-contained preload entries with type-checked channel literals for the controls entry and a built-output sandbox gate.

- [x] **FINDING-EDITOR-001 [Medium] [TypeScript editor configuration]**:
  - **Issue**: The root `tsconfig.json` was missing. TypeScript's editor ProjectService placed representative files in `/dev/null/inferredProject1*` even though explicit command-line project checks passed. It reproduced TS1343 for `import.meta` in `create-main-window.ts` and TS2307 for Vite/plugin imports in `vite.config.ts`.
  - **Risk**: VS Code uses inconsistent target/module resolution and reports misleading errors while the CLI remains green.
  - **Proposed Fix**: Applied a root solution referencing Node/web configurations, composite project settings with separate cache paths, Node-project inclusion of `vite.config.ts`, and a project-local workspace SDK setting.

- [x] **AUDIT-005** Record zero confirmed implementation defects at the initial inventory because there was no implementation to inspect then. This is not a security, scalability, or production-readiness clearance for the subsequent scaffold. There were no severity-ranked findings or remediation patches to invent from that inventory.

The Ubuntu Wayland/nut.js mismatch and unknown API entitlement are feasibility gates in [the tech stack](TECH_STACK.md), not defects in an existing backend.

## Verified OK (No Action)

- [x] **OK-CONNECTION-001** The existing named IPC key submission, session-only main-process key handling, immediate password-field clearing, text-only connection probe, and backend readiness enforcement already support in-app connection. Preserve these behaviors; no new secret persistence, model request, desktop action, or broader approval mode is required for this UI correction.

- [x] **OK-UX-001** Preserve context isolation, sandboxing, blocked navigation/new windows/webviews, default-denied permissions, and strict sender/main-frame/URL checks in both windows. Keep action-by-action approval; this tranche does not add autonomous execution or a hosted backend/database.

- [x] **OK-001** Verify that there is no existing service/database migration requiring modification or rollback in this repository snapshot. Preserve this boundary; no architecture rewrite is justified.
- [x] **OK-002** Preserve the original idea in [INITIAL_IDEA.md](INITIAL_IDEA.md). The archived body was checked byte-for-byte against the original before the root README was reorganized.

No authentication flow, encryption implementation, API middleware, backup system, or production monitoring has been verified as adequate. Absence of code is not a passed quality check.

## Remediation Plan

- [x] **FIX-CONNECTION-001 [First-run connection UI]**:
  - **Change**: Update only the renderer app layout, task/setup view selection, and connection form presentation. Keep browser previews disconnected and setup editing unavailable during an active run.
  - **Rollback**: Revert the changes to `src/renderer/src/app/App.tsx`, `src/renderer/src/features/chat/AgentChatView.tsx`, and `src/renderer/src/features/environment/ConnectionSetup.tsx`. No credential or user-data migration is involved.
  - **Validation**: `npm run check` passes with 87 tests, TypeScript, ESLint, production bundles, and both sandboxed preload gates. Local server-rendering assertions pass for initial setup, loading, ready, connection testing, disconnected preview, rejected key, and active-run controls. These are render-state checks, not interactive native UI acceptance. No API credits were used.
- [ ] **FIX-CONNECTION-LIVE-001 [Xubuntu acceptance]**: In the user's VM, verify that the password field and Connect & test button are reachable at the normal window size, enter a real key locally, confirm a failed test permits retry, confirm success reveals task entry, and confirm Settings preserves a typed task draft. No browser/native UI surface is available to this assistant for interactive verification.

- [x] **FIX-PRELOAD-001 [Sandboxed preload output]**:
  - **Change**: Keep both preloads standalone and add `scripts/check-preloads.mjs` to `npm run check`. The controls preload exposes only matching-run pause/resume/stop, minimal state subscription, and task-window return.
  - **Rollback**: Revert the floating-window, its IPC/preload entry, and multi-entry build configuration together to the prior single-window slice. Session and environment keys require no data migration.
  - **Validation**: Both standalone preload bundles pass evaluation with only the permitted Electron import; extra local/Node imports fail the gate. Frozen bridge and controls-method boundaries are checked. Native Electron startup remains pending.

- [x] **FIX-EDITOR-001 [TypeScript editor configuration]**:
  - **Change**: Added `tsconfig.json` and `.vscode/settings.json`, updated Node/web project configuration, and changed `typecheck` to `tsc --build --pretty false`.
  - **Rollback**: Revert these bounded configuration/script changes; no application or user data migration is involved. Reverting also restores the editor discovery gap.
  - **Validation**: Editor ProjectService now assigns the checked files to their intended configured projects with zero diagnostics. Root graph checking and `npm run check` pass, including 58 unit tests and production bundles. VS Code itself may need a TypeScript server restart to discard cached inferred projects.

No fixes are proposed for nonexistent components. The following scoped audits become actionable only when relevant code or infrastructure exists:

- [ ] **AUDIT-NEXT-001 — Desktop/API boundary.** Inspect implemented IPC validation, provider transport, secrets, cancellation, errors, request limits, and structured run logs against PRD requirements. Change: only evidence-backed gaps. Rollback: revert the bounded source change while preserving user data. Validation: focused tests and isolated runtime cases.
- [ ] **AUDIT-NEXT-002 — Performance.** Measure capture, inference, input, and end-to-end durations before proposing optimizations. Change: only the measured bottleneck. Rollback: restore the last working adapter/configuration. Validation: same task/environment before and after, including failures and cost.
- [ ] **AUDIT-NEXT-003 — Release operations.** Audit clean install, dependency packaging, crash handling, stop behavior, run interruption, CI gates, and demo reset when the app exists. Change: only deficient behavior. Rollback: retain the previous artifact and tested environment snapshot. Validation: clean environment launch and failure/recovery exercises.
- [ ] **AUDIT-NEXT-004 — Conditional hosted services.** If a hosted API/database/queue is introduced later, audit API contracts/versioning/pagination, auth/RBAC, input validation/rate limits, indexes/query plans, concurrency, migrations, pooling, dependency resilience, logging/metrics/alerts, health/readiness, deployment rollback, and backup/restore. Until then these server-side checks are not applicable, not verified OK.

## Proposed Code Changes

- [x] **AUDIT-006** Record that no backend patch is proposed in this documentation-only stage. Future confirmed findings must receive a unique FINDING ID, severity, evidence, minimal change, and matching FIX task with rollback and validation before a patch is added here.

## Commands

Run these read-only inventory commands from the repository root:

```bash
pwd
rg --files --hidden -g '!.git' -g '!.agents' -g '!.codex' -g '!.aws' -g '!node_modules'
git status --short
git diff --check
```

- [x] **AUDIT-007** Distinguish the original source inventory from runtime testing. At the initial inventory, no build, lint, application tests, load tests, migrations, or backup restoration could be run. Subsequent scaffold checks are recorded separately in [development](DEVELOPMENT.md); they do not establish agent readiness or production security.

## Quality Assurance Task Checklist

- [x] **AUDIT-QA-001** Support repository observations with inventory evidence; do not label suspected future failures as confirmed findings.
- [x] **AUDIT-QA-002** Keep current work scoped to documentation and preservation of the original idea.
- [x] **AUDIT-QA-003** List verified observations without claiming runtime components are sound.
- [ ] **AUDIT-QA-004** When implemented, verify authentication/access boundaries, authorization, input validation, credential handling, and encryption against actual requirements.
- [ ] **AUDIT-QA-005** Back any future performance fix with a measured bottleneck and comparable before/after results.
- [ ] **AUDIT-QA-006** When deployment exists, validate rollback; evaluate zero-downtime requirements only where relevant to a running service.
- [ ] **AUDIT-QA-007** When persistent user data or hosted storage exists, test backup/restore. The demo VM reset is a different check and does not establish production disaster recovery.
