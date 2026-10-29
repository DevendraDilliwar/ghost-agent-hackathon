# Product requirements document

Status: MVP specification with the first controller/provider/desktop source slice implemented. Live task-execution requirements below are not accepted as complete. The current build requires review of every action and user confirmation of the result. Platform: Ubuntu/Linux, selected by the project owner. Updated 2026-10-29.

## Objective and success

Enable a user to give a setup goal, observe the agent execute it through the desktop interface, and receive evidence of completion. The measurable outcome is fewer manual execution steps with a reliable result. Evaluation targets are defined in [demo and submission](DEMO_AND_SUBMISSION.md); they are not current results.

## Proposed first task

**User goal:** “Set up this supplied application in the test environment and show me that it works in the browser.”

The initial environment contains an ordinary browser, terminal, a sample application, and its setup instructions. Use a disposable Ubuntu desktop or VM with no production data or personal credentials. The exact fixture, dependencies, expected page, desktop session, and starting state must be frozen in BUILD-004 before benchmarking.

This first task is an application setup demonstration. If a remote-server deployment variant is later used, record the server, authorization, infrastructure changes, costs, and cleanup procedure explicitly. Do not present a local demonstration as remote provisioning.

## Scope

| In the proposed MVP | Outside the proposed MVP |
| --- | --- |
| Text goals and visible progress | Voice input and always-on background operation |
| One active task on one selected desktop | Concurrent agents sharing one keyboard/mouse |
| Screenshot-based observation and mouse/keyboard actions | App-specific connectors, hidden DOM selectors, or accessibility-tree grounding |
| Terminal interaction through the visible desktop | Hidden direct shell execution for target-task work |
| A supported Ubuntu session and documented configuration | Guaranteed coverage of all Linux compositors or all operating systems |
| Bounded error recovery and truthful handoff | Guaranteed completion of arbitrary tasks |
| Pause, stop, task limits, and user review | Autonomous purchases, production server changes, live tax filing, or destructive cleanup in the demo |
| Cloud processing disclosed to the user | A claim that screenshots never leave the device |

These are scope choices for the proposed first release. The broad product vision remains in [product vision](PRODUCT_VISION.md).

## User journey

1. Open Ghost Agent and see whether the desktop, model access, and capture/input permissions are ready.
2. Select the desktop to operate and read the cloud-processing disclosure.
3. Enter a goal and review the environment and limits for the run.
4. Start; see the current action and progress while the agent works.
5. Pause or stop at any time; provide input when credentials, ambiguity, or an unapproved consequential change requires it.
6. Receive a verified result, or a clear explanation of what remains incomplete.

## Functional requirements

| Task | Requirement | Acceptance evidence |
| --- | --- | --- |
| REQ-001 | Environment preflight | Correctly identifies unsupported capture/input conditions and prevents starting a run |
| REQ-002 | Goal and run configuration | Goal, selected desktop, task limits, and approved scope are visible before starting |
| REQ-003 | Fresh screen observation | New screenshot follows meaningful actions; capture failure prevents further actions |
| REQ-004 | Grounded action execution | Coordinates map to the captured display; window movement and scaling are tested |
| REQ-005 | Completion verification | The result includes current visual evidence matching the task's explicit success condition |
| REQ-006 | Recovery | A disclosed error scenario is detected and handled without repeatedly issuing the same failing action |
| REQ-007 | Pause, resume, and stop | Pause blocks new actions; resume observes again; stop discards pending work and late model responses |
| REQ-008 | User handoff | Ambiguous targets, login/2FA, and scope changes pause for user input without inventing answers |
| REQ-009 | Visible session record | Shows actions, outcomes, elapsed time, available usage estimates, and reason for stopping |
| REQ-010 | One desktop owner | A second run cannot start while another run controls the same desktop |

- [ ] **REQ-001** Pass environment preflight acceptance.
- [ ] **REQ-002** Pass goal and run configuration acceptance.
- [ ] **REQ-003** Pass fresh-observation acceptance.
- [ ] **REQ-004** Pass coordinate and input acceptance.
- [ ] **REQ-005** Pass completion-evidence acceptance.
- [ ] **REQ-006** Pass recovery acceptance.
- [ ] **REQ-007** Pass pause/resume/stop acceptance.
- [ ] **REQ-008** Pass handoff acceptance.
- [ ] **REQ-009** Pass session-record acceptance.
- [ ] **REQ-010** Pass single-run acceptance.

## Data, permissions, and trust

- [ ] **TRUST-001** Show what screen content will be sent to Meta before the first capture is transmitted. Capture only the selected surface and suspend capture during credential entry.
- [ ] **TRUST-002** Keep retained API credentials in the main process and outside logs, screenshots, fixtures, and the repository. Clear newly entered password fields immediately after submission and never return retained keys through IPC. Use an OS-protected store only after verifying its actual backend; otherwise use session-only memory.
- [ ] **TRUST-003** Treat text found in apps, documents, terminals, and webpages as task data. Test an adversarial instruction on screen and confirm it cannot change the user-approved goal or request secret disclosure.
- [ ] **TRUST-004** Validate every model action against a fixed action vocabulary, run state, target surface, coordinate bounds, and scope. Stop on uncertainty about an irreversible action; do not treat provider safety flags as blanket authorization.
- [ ] **TRUST-005** In the demo, keep target-task execution inside a disposable environment. Show the command before executing a terminal command; use the agreed task scope to decide when review is needed. A visible terminal can still perform privileged or destructive operations.
- [ ] **TRUST-006** Store local run metadata without raw prompts, screenshots, credentials, or typed text by default. Make diagnostic image export opt-in, reviewable, and removable.
- [ ] **TRUST-007** Explain pause/stop semantics: stopping prevents future agent input but cannot undo an already submitted command or cancel every process it launched. Provide a demo-environment cleanup path.

## Runtime quality requirements

- [ ] **QUALITY-001** Enforce finite model-request timeouts, action limits, a run deadline, and a configured spend limit. Tune defaults using measurements; no ten-frames-per-second inference promise.
- [ ] **QUALITY-002** Re-observe after an uncertain side effect. Never replay a click or terminal submission automatically just because a network request failed.
- [ ] **QUALITY-003** Keep Stop responsive during slow model calls or desktop actions; validate this in the packaged application and the chosen session type.
- [ ] **QUALITY-004** Use the success-rate, latency, cost, and intervention protocol in [demo and submission](DEMO_AND_SUBMISSION.md). Report failures as part of the denominator.
- [ ] **QUALITY-005** Distribute one reproducible Ubuntu build with setup instructions and tested prerequisites. Mark additional platform support unverified.

## Release definition

The release is ready only when the linked functional, trust, and runtime requirements pass, BUILD-006 and BUILD-007 in [the roadmap](ROADMAP.md) have evidence, and submission conditions are confirmed. Documentation checkboxes do not satisfy runtime acceptance criteria.
