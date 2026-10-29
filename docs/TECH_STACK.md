# Technology and stack decisions

Status: first integrated Electron/React/TypeScript source slice with controller, Meta adapter, and Ubuntu/X11 capture/input. Actual account access and desktop execution remain untested. Sources checked 2026-10-29. See [development](DEVELOPMENT.md) for source validation and live gates.

## Selected constraints and observed environment

The project owner selected **Ubuntu/Linux** for the first demo. The application should be written in **JavaScript/TypeScript**. Native libraries or an external model runtime may have other implementation languages; “JS/TS app” does not mean every dependency is written in JavaScript.

Read-only inspection of the current workspace host found:

| Observation | Value | Limit of the observation |
| --- | --- | --- |
| `/etc/os-release` | Ubuntu 26.04 | Describes this host, not every supported Ubuntu release |
| `XDG_SESSION_TYPE` | `wayland` | Full desktop control has not been tested |
| `DISPLAY` | Present | Does not establish that all desktop applications are controllable through X11 |
| `WAYLAND_DISPLAY` | Present | Capture/input permissions remain unverified |
| Initial repository | Original README only before documentation work | Historical baseline; an app scaffold has since been added |
| Development shell | Node 22.23.2, npm 10.9.8 | Node 24 remains the preferred line in `.nvmrc`; CI is configured for it |

## Proposed application stack

| Layer | Proposed choice | Reason and validation condition |
| --- | --- | --- |
| App language | TypeScript with strict checking | Shared action/event contracts; enforce checks in CI |
| Development runtime | Node.js 24 LTS | Supported baseline; test native-module and tooling compatibility |
| Desktop runtime | Electron 45.1.0 | Desktop UI and process boundary; runtime binary/startup remain unverified |
| UI/build | React, Vite, Tailwind CSS, electron-vite | Separate main/preload/renderer builds; versions are recorded in package.json |
| Package manager | npm with a lockfile | Commit the generated lockfile with the scaffold; no commit has been made automatically |
| Capture | Electron desktopCapturer source adapter | Single primary display; hides the Ghost window during observation; live validation pending |
| Mouse/keyboard | External `xdotool` adapter for Ubuntu/X11 | Uses an installed fixed executable with cancellation and argument validation; no native npm binary needed |
| Model transport | `fetch` through a Meta adapter | Small API boundary with cancellation, request limits, and structured error handling |
| Validation | Explicit runtime validators | Run consent/limits and model action shapes are checked before dispatch |
| Local run storage | In-memory run snapshot only | No persistent journal or database is implemented |
| Credentials | Main-process environment; ignored .env.local in development | No renderer exposure or protected settings persistence yet |
| Tests | Vitest for controller/policy; real desktop smoke tests | Fake-driver tests cannot establish OS capture/input compatibility |
| Packaging | `electron-builder`, Linux target first | Validate native assets and launch on a clean matching Ubuntu environment |

Node 20 from the original idea is now EOL according to the [Node.js release table](https://nodejs.org/en/about/previous-releases). Node 24 is a proposed supported baseline, not a requirement to use the newest major version. Freeze the full version matrix only after a working native-driver build.

Electron's [security guide](https://www.electronjs.org/docs/latest/tutorial/security) supports keeping the renderer isolated and privileged operations behind a narrow bridge. Its [desktop capture documentation](https://www.electronjs.org/docs/latest/api/desktop-capturer) documents Linux/PipeWire caveats. Capture support does not establish keyboard/mouse injection support.

## Ubuntu desktop control gate

nut.js documents **Linux with X11**, Node 22 or later, and paid access to its prebuilt packages. Its registry instructions also describe subscription access. See [installation](https://nutjs.dev/docs/installation) and [registry access](https://nutjs.dev/docs/registry-access).

The current Wayland session therefore cannot be assumed compatible with the original plan. A display variable alone is insufficient proof. The proposed fallback is a **disposable Ubuntu environment with a verified X11 desktop**, rather than changing the user's host session during development.

The first source implementation uses **xdotool** instead of nut.js. It is already installed on this host, supports X11 input, and its installed help text confirms stdin typing support. Its [official project](https://github.com/jordansissel/xdotool) explicitly warns about Wayland limitations. No user input was dispatched during inspection. Live behavior and distribution prerequisites remain unverified. nut.js remains an alternative to evaluate if a concrete requirement justifies it.

- [ ] **TECH-001** Pin Node, Electron, native-driver, UI-tooling, and packaging versions after confirming they install and run together. Record architecture and Ubuntu release.
- [ ] **TECH-002** Prove capture plus click, type, scroll, keypress, and stop on the intended Ubuntu desktop. Record X11/Wayland status and scaling. If the host session is unsupported, use a documented isolated X11 environment or explicitly choose a different driver after investigation.
- [ ] **TECH-003** Verify the selected input driver's installation/distribution prerequisites in the packaged environment. The current xdotool adapter expects a system installation; nut.js acquisition is deferred unless selected later. Do not spend Meta API credits on unrelated purchases.
- [ ] **TECH-004** Prove input-process cancellation, coordinate conversion, and capture behavior when the controls are visible. Mocked process tests are implemented, but they are not a live desktop proof.

## Proposed Meta model roles

| Model | Proposed role | Decision rule |
| --- | --- | --- |
| Muse Spark 1.3 | First cloud computer-use baseline | Verify account access and measure task success, cost, and latency |
| Muse Wonder | Comparison if the baseline fails on planning/recovery | Use only if measured improvement justifies its cost for the selected task |
| SAM 3.1 | Optional experiment for target localization/visual explanation | Keep only if it improves target accuracy or recovery enough to justify extra latency/cost |
| Muse Glimmer | Later local-inference experiment | Verify runtime/hardware and whole-pipeline privacy before making local-mode claims |

[Meta's model catalog](https://dev.meta.ai/docs/models) lists Spark/Wonder and SAM as hosted options and Glimmer as self-hosted. SAM returns segmentation geometry; this does not establish GUI semantics or reliable button detection for our workflow.

The [computer-use guide](https://dev.meta.ai/docs/computer-use) documents a native computer tool through the Responses API, with structured actions executed by the application and fresh screenshots returned to the model. It documents Wonder and Spark 1.3 for this loop. Do not use the placeholder endpoint names from the initial idea as working API addresses.

- [ ] **TECH-005** Verify the owner's model entitlement with a harmless synthetic image. Record the successful model ID and endpoint without saving credentials or sensitive content.
- [ ] **TECH-006** Validate the provider response format, error cases, usage fields, history behavior, and retention options against the account's actual API. Never invent an SDK method or claim access from documentation alone.
- [ ] **TECH-007** Compare SAM against the baseline on the same UI targets only after the baseline works. Record missed targets, incorrect targets, latency, and total cost; omit it if there is no material benefit.
- [ ] **TECH-008** Treat Glimmer as deferred until the core release gates pass. Record memory/GPU needs, runtime, inference time, and every remaining cloud dependency before describing a local mode.

## Credentials and data handling

[Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) documents different Linux secret backends and an unprotected fallback. Confirm the backend for the selected Electron version before persisting credentials. If protection is unavailable, keep the credential in memory for the session and explain that it must be entered again.

- [ ] **TECH-009** Verify protected credential storage or adopt the session-only fallback. Never bundle an API key in the desktop build.
- [ ] **TECH-010** Verify what Meta stores for the selected endpoint/mode and document it in onboarding. Do not equate a local executor, disabled local screenshots, or a request flag with fully local processing.

## Explicitly deferred technology

No hosted API server, GraphQL service, Redis, database cluster, distributed queue, multi-agent system, or per-app connector layer is part of the proposed first build. Introduce one only after a concrete requirement demands it. Windows/macOS packaging, voice, multi-monitor operation, and local inference are later milestones rather than hidden prerequisites.
