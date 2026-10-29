# Development and implementation status

Updated: 2026-10-30. Stage: integrated source with the approved UX tranche. The desktop/model loop has not been validated live.

## Folder structure

```text
src/
  main/
    config/                 Environment loading and session-only model connection
    runtime/                Compose controller, Meta, desktop, and emergency Stop
    ipc/                    Sender-validated bridge handlers
    windows/                Task/floating windows, sandbox, and lifecycle
  preload/                  Separate task and restricted floating-control bridges
  renderer/src/
    app/                    App composition only
    features/
      chat/                 Chat header and message feed
      tasks/                Goal, handoff, recovery, controls, and result review
      timeline/             Proposed/executed/rejected actions
      overlay/              Renderer for the separate floating-controls window
      environment/          Connection setup and desktop readiness
    styles/                 Shared styling and Tailwind entry
  agent/
    ports.ts                Model/desktop interfaces
    task-controller.ts      Run lifecycle, limits, approval, cancellation
    task-controller.test.ts Lifecycle behavior with fake dependencies
  desktop/
    linux/                  Electron capture and external xdotool input adapter
    session-info.ts         Read-only session identification
  providers/meta/            Meta request transport and response parsing
  policy/                   Renderer trust, run/action validation
  shared/
    contracts/              Typed application/task/screen contracts
    ipc/                    Channel names
  observability/            Reserved; no persistent journal yet
tests/desktop/               Reserved for live isolated-desktop tests
docs/                        Product specifications and contributor documentation
```

Floating controls now opens a separate frameless, always-on-top Electron window and hides the task window. Open task returns to the workspace. Its own preload receives only a run ID, revision, status, and action counts; it cannot configure credentials, create tasks, review actions, or read screenshots. Both Ghost windows are hidden for capture/input and restored without stealing foreground focus. Native positioning, focus, and compositor behavior remain unverified live.

## Dependency direction

| Layer | Allowed project dependencies |
| --- | --- |
| shared | shared |
| agent | agent, shared; concrete model/desktop implementations are injected |
| policy | policy, shared |
| renderer | renderer, shared; no direct Electron or Node imports |
| preload | preload, shared, and Electron's bridge APIs |
| desktop | desktop, agent, shared, observability |
| providers | providers, agent, shared, policy, observability |
| observability | observability, shared |
| main | Runtime layers; no renderer/preload implementation imports |

ESLint checks restricted static imports. These checks are contributor guardrails, not operating-system isolation. Keep unit tests beside the code as `*.test.ts`; keep live desktop tests separate and opt-in. Add concrete modules when required instead of broad `utils` or speculative service layers.

Electron embeds the React interface in its desktop window. Vite's localhost server is a development asset server. Production assets are bundled locally; only the privileged main process can reach the desktop adapters through validated bridge methods.

## Run the prototype

Use a disposable Ubuntu **X11** desktop with one display and `xdotool` installed at `/usr/bin/xdotool`. The current host reports Wayland; the implemented preflight blocks input there. No host session, package, or permissions were changed automatically.

1. Use the preferred Node 24 line from `.nvmrc`, or a compatible supported version from package.json.
2. Install dependencies with `npm ci`. Electron's official runtime must download successfully before desktop startup.
3. Run `npm run dev`. In Settings, enter the Meta key and choose Connect & test. Alternatively, configure ignored `.env.local` from `.env.example` for development and choose Test configured key.
4. The test sends one short text-only request to Meta. A successful text test does not prove computer-use/image capability. Read the remaining desktop preflight results.
5. Confirm cloud screenshot processing and the isolated environment, enter a simple goal, choose limits if needed, and start.
6. Review the full proposed text/coordinates before each input action. Use Pause/Stop or **Ctrl + Shift + Escape** for emergency Stop.
7. Inspect the final screenshot. Explicitly confirm completion or mark the result incomplete.

The main process loads `.env.local` for development only. Packaged builds can use the in-app session connection or a process-environment key. The password input temporarily holds a newly entered key and clears immediately after submission. Main-process connection metadata never returns the key to any renderer. New in-app keys stay in main-process memory until exit: no credential file, localStorage, or protected persistence has been added. Changing/testing keys is rejected while a task is active. Each app session requires an explicit connection test before starting.

```dotenv
META_API_KEY=your-local-model-api-key
GHOST_META_MODEL=muse-spark-1.3
```

The credential above is a placeholder. The supported comparison model is `muse-wonder-1.0`. Both require actual account entitlement; documentation alone does not establish access.

## Runtime behavior

- [x] **RUNTIME-001** Replace simulated renderer timers and fake executed actions with main-process run snapshots.
- [x] **RUNTIME-002** Validate goals, finite action limits, explicit screenshot consent, and isolated-environment acknowledgement at IPC ingress.
- [x] **RUNTIME-003** Implement a controller with single-run ownership, per-action review, pause/resume, stop, stale-response rejection, five-minute deadline, and reported-token allowances. The Electron entry point also requests a single-instance lock to avoid two app instances controlling the same user session.
- [x] **RUNTIME-004** Add a fixed-endpoint Meta adapter with request timeout, bounded response size, structured parsing, sanitized errors, and no automatic side-effect retry.
- [x] **RUNTIME-005** Add single-display Ubuntu/X11 capture and input source adapters. Restore the observed foreground window before input, map image coordinates to root geometry, and use an external process with cancellation rather than a shell command interpreter.
- [x] **RUNTIME-006** Keep completion in review until the user checks a fresh final screenshot. Disable broader autonomous approval modes in this build.
- [ ] **RUNTIME-007** Validate the complete integration with actual Meta entitlement, Electron runtime, and an isolated X11 environment.
- [ ] **RUNTIME-008** Validate the session credential flow, live integration fixtures, and packaging before end-user distribution; protected persistent storage remains outside this tranche.

The source checklist describes implemented code. RUNTIME-007 is the acceptance gate for a working desktop agent.

Each computer-use model request is an independent one-step decision using the current screenshot, goal, and action summary with `store: false`. Only the first proposed action is considered, and it still needs user approval. This avoids running a long plan across changed screens. Provider retention guarantees must be checked separately; the app does not promise fully local processing.

The input adapter invokes only a fixed `xdotool` executable and supported argument lists. Typed content is supplied through stdin. Terminal commands are entered through visible terminal UI; the agent does not expose a hidden shell executor. This is not an OS sandbox: the test environment itself must be disposable, and input already submitted cannot be undone by Stop.

Screenshots, goals, and action text remain in memory for the current run until replaced or the app closes. Pause and user takeover clear the current screenshot and invalidate pending approvals. The model can call `request_user_help` for verification/login/clarification; recognition is model-assisted and not guaranteed. Take control is also available manually. No new captures/actions/model requests are dispatched while waiting; a request already sent cannot be recalled from Meta. Done — resume takes a fresh screenshot. The five-minute deadline still includes pauses and handoff time. No raw screenshot journal or credential persistence has been added. Export/redaction, detection of arbitrary manual interference, robust visual state-change checks, and broader desktop support remain pending.

## Approved UX source tranche

These checkboxes track source implementation, not live desktop acceptance.

- [x] **UX-001** Add in-app connection setup with a cleared password input, session-only main-process keys, explicit text API test, and separate readiness checks.
- [x] **UX-002** Add structured user handoff, manual Take control, invalidated approvals, no new work while waiting, and fresh observation on explicit resume. Clarification requires a non-secret text answer and carries up to five bounded answers into subsequent decisions; the floating window directs these questions to the task view.
- [x] **UX-003** Add a separate floating-controls window, restricted preload/IPC, task-window return, and capture exclusion for both Ghost windows.
- [x] **UX-004** Preserve the goal/limit after failure or stop; show the reason and setup access, and require inspection before a new attempt. Never automatically replay actions.
- [x] **UX-005** Use plain-language status, persistent run controls, visible next-action review, collapsible activity/token/position details, and final human confirmation. Remove obsolete mode and environment-dialog components.
- [ ] **UX-LIVE-001** Validate both windows, connection setup, focus, capture exclusion, takeover, Stop, and recovery in the isolated X11 test desktop.
- [ ] **UX-LIVE-002** Validate handoff recognition and the combined native computer/function-tool request against live Meta access.

Each action still needs approval. Autonomous approval modes, phone/remote-device control, and Wayland input were not added.

## Commands and validation

The root `tsconfig.json` is a solution entry point referencing the separate Node and renderer projects. Both use composite checking with separate cache files. `vite.config.ts` is included in the Node project. `npm run typecheck` checks this graph with `tsc --build`, so it fails if the solution configuration is missing or invalid.

VS Code is configured to offer the installed workspace TypeScript SDK. After switching from an inferred project, run **TypeScript: Select TypeScript Version → Use Workspace Version**, then **TypeScript: Restart TS Server** if old diagnostics remain. This changes project-local editor configuration; no global VS Code settings were modified.

```bash
npm run check
npm run dev
npm run dev:ui
npm run start
npm run package:linux
```

`check` runs both TypeScript targets, ESLint, unit tests, production bundles, and the sandboxed-preload output gate. The two preload entries must be self-contained because sandboxed Electron cannot require generated shared chunks. The gate evaluates each built preload with only the permitted Electron import and checks its frozen bridge. `check:preloads` can also run separately after build. `dev:ui` is a browser-only layout preview with desktop execution disabled. `start` previews a built desktop app. `package:linux` creates an archive under `release/` without publishing.

- [x] **STRUCTURE-001** Create process/adapter folders, strict configurations, locked dependencies, and developer commands.
- [x] **STRUCTURE-002** Implement the desktop shell and restricted bridge.
- [x] **STRUCTURE-003** Replace agent/provider placeholders with focused modules and keep remaining placeholders explicit.
- [x] **STRUCTURE-004** Pass source checks.
- [ ] **STRUCTURE-005** Pass desktop startup, live workflow, and packaging checks.

Validation on Node 22.23.2 and npm 10.9.8:

| Check | Current result |
| --- | --- |
| Typecheck and lint | Passed |
| Unit tests | 87 passed across lifecycle/handoff/clarification, connection credentials, provider parsing/probes, IPC senders, capture exclusion, input process boundaries, and policy |
| Production build | Main, two standalone CommonJS preloads, and both renderer pages passed; sandboxed-preload output gate passed |
| Native driver CLI | Installed xdotool inspected; stdin typing option verified from its help text; no input dispatched |
| Layer boundaries | Six invalid import probes rejected; a valid shared-contract import accepted |
| Electron launch | Not verified; official runtime download timed out after a bounded retry |
| Browser UI inspection | Not performed; no browser is available through the UI tool |
| Live Meta/desktop requests | A prior text-only Spark 1.3 request returned HTTP 200/completed. Current computer-use, handoff, and desktop integration remain untested live. Automated checks use synthetic screenshots and mocked ports |
| Packaging and GitHub CI | Not executed |

Source checks do not establish task success rate, speed, cost, isolation, or packaged behavior. Those still require the evaluation protocol in [demo and submission](DEMO_AND_SUBMISSION.md).
