# Build roadmap and validation gates

Status: the folder scaffold and first integrated controller/provider/desktop source slice are implemented. BUILD-001 remains open because Electron startup, live Meta entitlement, and X11 execution have not passed; other milestones are partial source work, not completed runtime gates. See [development](DEVELOPMENT.md) for exact checks and limitations. Planning date: 2026-10-29, Asia/Kolkata. Dates below are proposed work windows, not completed work or delivery guarantees.

The plan preserves the broad [vision](PRODUCT_VISION.md) while testing one [MVP workflow](PRD.md). A failed feasibility gate changes the plan; it must not be hidden by polishing the UI.

## Milestones

| Task | Proposed window, IST | Depends on | Exit condition |
| --- | --- | --- | --- |
| BUILD-001 | Oct 29 | None | Desktop driver and model access proved |
| BUILD-002 | Oct 30 | BUILD-001 | Minimal Electron app can observe, act, and stop |
| BUILD-003 | Oct 31 | BUILD-002 | Bounded model loop with verification and handoff |
| BUILD-004 | Nov 1 | BUILD-003 | First complete setup workflow and frozen evaluation fixture |
| BUILD-005 | Nov 2 | BUILD-004 | Recovery and trust requirements demonstrated |
| BUILD-006 | Nov 3 | BUILD-005 | Packaged Ubuntu build and repeated-run results |
| BUILD-007 | Nov 4 | BUILD-006 | Release evidence, demo recording, and submission material ready |

Official public submission time is November 4, 2026, 9:00 PM ET, which is **November 5, 2026, 7:30 AM IST**. Proposed internal submission target: **November 4, 8:00 PM IST**. Recheck the portal for changes. [Official schedule](https://dev.meta.ai/events/global-hackathon)

## Implementation tasks

- [ ] **BUILD-001 — Prove the environment and model access.**
  - Complete TECH-001 through TECH-003 and TECH-005 in [the tech stack](TECH_STACK.md).
  - Prove capture and input inside the selected isolated Ubuntu desktop; document the current Wayland limitation and chosen X11/other-driver outcome.
  - Send a synthetic, nonsensitive screenshot to the selected Meta model; execute one harmless accepted action and observe the result.
  - Evidence: exact environment/version matrix, package source, API model ID, permissions, successful action, observed latency/usage, and any blocker.
  - Fallback: if input or model access is unresolved, stop building dependent features and record the blocker. Do not claim compatibility from a screenshot-only test.

- [ ] **BUILD-002 — Create the smallest controllable desktop app.**
  - Scaffold TypeScript, Electron, React, and Vite with a lockfile; establish the narrow preload bridge and cancellable input adapter.
  - Implement desktop selection, goal entry, status, Pause, Resume, and Stop before advanced overlay visuals.
  - Cover REQ-001, REQ-002, REQ-004, REQ-007, REQ-010, TRUST-001, TRUST-002, and TECH-004.
  - Evidence: renderer cannot call arbitrary OS operations; unsupported environments fail clearly; Stop works during a deliberately slow operation.

- [ ] **BUILD-003 — Implement the observe/act/verify controller.**
  - Implement the lifecycle, provider adapter, action schema, run/observation IDs, finite limits, and stale-response rejection described in [architecture](ARCHITECTURE.md).
  - Start with one model. Capture after state-changing actions; verify visible progress; handle incomplete or invalid responses.
  - Cover REQ-003, REQ-005, REQ-008, REQ-009, QUALITY-001, QUALITY-002, and TECH-006.
  - Evidence: a small harmless task completes, invalid output causes no input, API failure does not replay side effects, and a stopped run ignores a late response.

- [ ] **BUILD-004 — Complete the first setup journey.**
  - Select the exact sample application and document its starting state, setup instructions, allowed workspace, expected browser result, and reset procedure in [demo and submission](DEMO_AND_SUBMISSION.md).
  - Run the workflow through ordinary browser and terminal UI. Keep product decisions independent of fixture-specific coordinates.
  - Provide fresh completion evidence and record all manual help. Do not label the sample as a real remote-server deployment unless it is one.
  - Evidence: one complete trace, the final working application, an independent outcome check, and the amount of human intervention.

- [ ] **BUILD-005 — Demonstrate recovery and control.**
  - Add one disclosed setup error and one changed window layout; test recovery and fresh targeting.
  - Cover REQ-006, remaining TRUST requirements, QUALITY-003, and ARCH-007 through ARCH-012.
  - Validate pause/resume, permission loss, an untrusted instruction on screen, uncertain completion, worker failure, and exhausted limits.
  - Evidence: expected stopped/handoff states, no new actions after Stop, no credential leakage in exported evidence, and recovery results including failures.

- [ ] **BUILD-006 — Package and measure.**
  - Produce one Ubuntu build with native dependencies included and launch it in a clean matching environment.
  - Execute the full evaluation protocol and proposed release thresholds in [demo and submission](DEMO_AND_SUBMISSION.md).
  - Cover QUALITY-004 and QUALITY-005. Run the source checks and focused runtime tests below.
  - Evidence: reproducible build instructions, environment matrix, run records, success counts, elapsed times, cost estimates/actual usage, and known limitations.

- [ ] **BUILD-007 — Prepare the release and submission.**
  - Complete SUBMIT-001 through SUBMIT-006 in [demo and submission](DEMO_AND_SUBMISSION.md), verify the latest rules, and prepare the final materials.
  - Record what was built during the hackathon, attribution, tested capability, actual results, and visible limitations.
  - Evidence: reviewable submission package and a final validation pass. Public upload and competition submission are separate actions requiring the owner's instruction.

## Optional work after the core path

- [ ] **EXTRA-001** Run the SAM comparison in TECH-007 only if core reliability and submission time permit; keep the winning baseline if the comparison is inconclusive.
- [ ] **EXTRA-002** Improve overlay presentation using actual grounded targets. Label any segmentation visualization accurately; a decorative box is not evidence of SAM use.
- [ ] **EXTRA-003** After the hackathon, evaluate Glimmer local inference, additional Ubuntu sessions, Windows/macOS, broader workflows, and user research from DISCOVERY-001 through DISCOVERY-004.

## Test strategy and planned commands

The application defines the commands below except `test:desktop`, which remains planned until an isolated desktop harness exists. `npm run check` combines typechecking, lint, unit tests, and bundling. Current tests cover controller cancellation/limits/review, Meta parsing/transport, and policy. Live desktop tests remain pending.

| Command | Intended check |
| --- | --- |
| `pnpm install` | Install locked dependencies in a clean environment |
| `npm run typecheck` | Strict TypeScript checking across main, preload, renderer, and shared contracts |
| `npm run lint` | Configured source/style checks |
| `npm run test:unit` | Action validation, state transitions, cancellation, limits, and failure recovery with a fake driver |
| `npm run build` | Build the application assets and Electron entry points |
| `npm run package:linux` | Package the chosen Linux artifact and native modules |
| `npm run test:desktop` (not yet implemented) | Future explicitly invoked integration checks in the disposable desktop |

- [ ] **CHECK-001** Define and pass these scripts in a clean checkout. Ordinary CI must not control a developer's personal desktop or require a production API key.
- [ ] **CHECK-002** Keep live desktop/model evaluation opt-in, isolated, and bounded by credits and run limits. Record failures independently of unit-test status.
- [ ] **CHECK-003** Add source test cases for stale responses after stop, malformed/out-of-bounds actions, no-progress loops, request cancellation, and no side-effect replay. Tests must verify behavior rather than mirror implementation.
- [ ] **CHECK-004** Restore the evaluation environment from a known snapshot or reset procedure between runs and prove that it removes prior task side effects. Preserve any user evidence before reset.

## Rollback and scope control

During development, retain the last working controller/provider/driver combination before trying an optional model or capture change. Revert the bounded change if acceptance regresses. Reverting application code does not undo external input actions; use the disposable environment's tested reset procedure for the demo.

If time becomes constrained, defer SAM, Glimmer, overlay polish, additional platforms, and the second workflow. Keep honest completion reporting, Stop, credential handling, and repeated-run evidence in the release gate.
