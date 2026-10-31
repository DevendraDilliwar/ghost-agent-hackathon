# Demo, evaluation, and hackathon submission

Status: Tally-sim demo frozen (see demo/legacy-accounting/DEMO_SCRIPT.md); no recorded video, benchmark, or submission yet. Updated 2026-10-31.

## Frozen demo decision (Phase 4)

The browser/terminal setup-task proposal below (DEMO-001..005) is superseded for
this hackathon entry. The frozen demo is the Tally voucher-entry fixture:
fixed goal, fixed starting state, and a results log live in
demo/legacy-accounting/DEMO_SCRIPT.md. Evaluation is reduced to 3 clean runs
of the frozen task with every attempt recorded; the 10-run protocol below
remains the future bar, not the current claim.

## The story

**People become the hands of their AI assistant. Ghost Agent takes over the execution loop and checks the result.**

The demonstration should show a useful setup task, movement between normal desktop apps, an understandable recovery, and evidence of completion. The viewer should understand both what the user asked for and what the agent actually accomplished.

## Proposed hero workflow

- [ ] **DEMO-001** Freeze a supplied sample application, readable setup instructions, and a clean Ubuntu desktop with a browser and terminal. Record the fixture revision, necessary dependencies, display settings, and starting state.
- [ ] **DEMO-002** Use the goal: “Set up this supplied application in the test environment and show me that it works in the browser.” Define a unique per-run result marker and a simple functional interaction that proves the intended application is running.
- [ ] **DEMO-003** Show decisions grounded in fresh screenshots and actual input events. Keep the driver general; disclose fixture preparation and any manual assistance.
- [ ] **DEMO-004** Introduce one declared recovery case, such as an occupied development port with a permitted alternative, and a separate moved-window case. Do not present a deliberately injected error as an accidental incident.
- [ ] **DEMO-005** Verify the final outcome independently, review the trace for task-specific scripts or fabricated success, and retain a sanitized full recording. Evaluator checks may inspect runtime state for scoring; the agent's execution remains through the screen.

The first proposed demonstration is local application setup. A remote server, deployment, public domain, or provisioned cloud resource is not part of the claim unless explicitly included and demonstrated.

## Suggested video structure

Target approximately three minutes as an editorial choice. The official allowed length and required format still need portal confirmation.

| Time | What to show |
| --- | --- |
| 0:00-0:20 | The manual relay: ask AI, execute steps, bring back errors |
| 0:20-0:40 | User goal, Ubuntu environment, selected desktop, and visible controls |
| 0:40-1:50 | Actual setup across the browser and terminal; label time compression if used |
| 1:50-2:20 | The disclosed recovery case and the agent's response |
| 2:20-2:45 | Working application and the predefined completion check |
| 2:45-3:00 | Measured results, actual Meta model role, and tested limitations |

If the task takes longer, retain an uncut recording alongside the edited video. Do not imply that edited playback time is real execution latency.

## Evaluation protocol

All numbers below are proposed release targets. They are not measurements or official hackathon requirements.

- [ ] **EVAL-001** Freeze the task, model/settings, fixture, allowed actions, starting image, display size, and reset procedure before scoring. Separate prompt tuning runs from evaluation runs.
- [ ] **EVAL-002** Measure at least three manual baseline attempts on the same task and starting state; record experience level and active effort. Avoid claiming general population time savings from this small sample.
- [ ] **EVAL-003** Run ten clean-start agent attempts. Count every attempt, including timeouts, failed verifications, and manual rescues. An autonomous success meets the outcome check without task-solving help beyond initial authorization.
- [ ] **EVAL-004** Run two layout-variation attempts and two disclosed recovery attempts separately. Report their results separately from the ten baseline attempts.
- [ ] **EVAL-005** Test Stop while thinking and while input is queued, pause/resume after screen changes, rejected capture permission, and a misleading instruction on screen. A failure blocks release until corrected and retested.
- [ ] **EVAL-006** Compare any optional SAM/model change on the same frozen cases and report differences in success, latency, and cost. Do not select only favorable runs.

| Metric | Definition | Proposed target |
| --- | --- | --- |
| Autonomous baseline success | Completed and independently verified / all ten baseline attempts | At least 8/10; disclose the small sample |
| Layout robustness | Verified success / two moved-window attempts | 2/2 |
| Recovery | Verified success / two declared error attempts | 2/2 |
| False completion | Reported complete without satisfying the outcome check | Zero in the evaluation set |
| Manual interventions | Count and describe task-solving help per run | Zero on autonomous-success runs; report all others |
| End-to-end duration | Start accepted to terminal state, including waits and approvals | Proposed run cap: five minutes; revise openly if the fixture requires more |
| Stop response | Stop requested to no further new input dispatch | Proposed target: within one second on the tested desktop |
| Cost | Actual reported usage with applicable prices, plus estimate uncertainty | Record every attempt; set the run budget after the first measured trials |

Also record capture, model-request, and input durations separately so optimization has a measured reason. Do not claim broad performance percentiles from ten runs; report individual results and a median.

### Results template

Populate during BUILD-006. “Not run” is not a pass.

| Run ID | Scenario | Build/model | Verified outcome | Duration | Cost/estimate | Human interventions | Evidence/notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pending | Not run | Not recorded | Not evaluated | — | — | — | No runtime evidence yet |

## Credit budget

The owner reports receiving **$150 in Meta credits**. Current remaining balance, expiry, supported models, and billing behavior must be checked in the owner's account before spending. No access token or private billing detail belongs in this repository.

| Proposed allocation | Amount |
| --- | --- |
| Access checks and baseline measurements | $15 |
| Core implementation trials | $65 |
| Frozen evaluation and recovery tests | $40 |
| Final demo/retry reserve | $30 |
| Total planned ceiling if the full balance remains | $150 |

- [ ] **BUDGET-001** Verify remaining credits, expiry, applicable prices/rate limits, and whether additional billing could occur. Reduce this plan to the verified remaining balance.
- [ ] **BUDGET-002** Use early trials to set per-run action, token, time, and estimated spend limits. Keep requests serial in the first implementation and reserve headroom for an in-flight request whose final cost is not yet known.
- [ ] **BUDGET-003** Maintain a cumulative usage record and compare it with the provider dashboard. Pause before starting another run if the remaining budget cannot cover its cap. Other software/hosting purchases are outside this credit allocation.

## Confirmed public event information

The [official event page](https://dev.meta.ai/events/global-hackathon) lists Indie and Startup tracks, the themes Build for Your World and Push the Frontier, and a November 4, 2026, 9:00 PM ET submission deadline. That is **November 5, 2026, 7:30 AM IST**. Dates can change.

The public track description emphasizes creativity, technical ambition, and a working product for Indie entries. The participant's actual track and complete final submission rules remain to be verified. The initial idea's public-repo requirement, three-minute limit, originality/commit-window assumptions, and category eligibility must not be treated as confirmed rules.

## Submission tasks

- [ ] **SUBMIT-001** Confirm the participant's track, accepted official rules, eligible models/categories, team details, and any applicable terms in the participant portal. Record the source/date and relevant requirements here.
- [ ] **SUBMIT-002** Confirm required submission fields, repository visibility, demo/video format and length, permitted pre-existing work, licensing/attribution requirements, and deadline. Resolve these before packaging the final entry.
- [ ] **SUBMIT-003** Prepare the project description: user problem, tested workflow, Meta contribution, architecture, measured results, and limitations. State what was built during the event accurately.
- [ ] **SUBMIT-004** Prepare a reproducible Ubuntu build, clean installation instructions, sanitized screenshots, video, and evidence. Check that the artifact/repo contains no credentials or personal data.
- [ ] **SUBMIT-005** Assemble a reviewable final submission and verify all links/artifacts. Target internal readiness by November 4, 8:00 PM IST, leaving time before the official deadline.
- [ ] **SUBMIT-006** After the owner's instruction to publish/submit, upload the final package, confirm the portal receipt, and record the submitted version and time. Creating these documents does not publish or submit anything.

## Claim checklist

- [ ] **CLAIM-001** Use “no app-specific integrations” and describe the real model/network dependencies.
- [ ] **CLAIM-002** State the exact tested Ubuntu/session configuration and workflow; avoid “works with every app.”
- [ ] **CLAIM-003** Disclose cloud screenshot processing and user control; avoid an unsupported fully-local privacy claim.
- [ ] **CLAIM-004** Report actual completion, recovery, timing, cost, and human help, including failures. Avoid unsupported daily-hours-saved or winning-probability claims.
- [ ] **CLAIM-005** Attribute SAM or Glimmer only if they are actually used in the demonstrated implementation; explain their measured contribution.
