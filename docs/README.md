# Ghost Agent documentation

Updated: 2026-10-30, Asia/Kolkata. Stage: integrated source and UX tranche; live desktop/model validation remains pending.

## Start here

The product addresses a repeated handoff: an AI explains a task, the person performs each step, and the person brings errors and screenshots back to the AI. Ghost Agent is intended to execute that loop and verify the result.

| Document | Purpose | Documentation task |
| --- | --- | --- |
| [Product vision](PRODUCT_VISION.md) | Problem, audience, positioning, and long-term direction | DOC-001 |
| [PRD](PRD.md) | MVP boundaries, user journey, requirements, and acceptance criteria | DOC-002 |
| [Architecture](ARCHITECTURE.md) | Desktop components, execution loop, trust boundaries, and failure handling | DOC-003 |
| [Tech stack](TECH_STACK.md) | Proposed tools, source references, platform constraints, and feasibility checks | DOC-004 |
| [Roadmap](ROADMAP.md) | Ordered build tasks, dependencies, validation, and release gates | DOC-005 |
| [Demo and submission](DEMO_AND_SUBMISSION.md) | Proposed demo, evaluation protocol, budget, and submission preparation | DOC-006 |
| [Backend hardening baseline](TODO_backend-hardening.md) | Evidence of the current repository state and deferred audits | DOC-007 |
| [Initial idea](INITIAL_IDEA.md) | Original README preserved as historical input | DOC-008 |
| [Development](DEVELOPMENT.md) | Actual folder structure, boundaries, commands, and scaffold validation | DOC-009 |

- [x] **DOC-001** Document the idea and product vision.
- [x] **DOC-002** Write the proposed MVP requirements and acceptance criteria.
- [x] **DOC-003** Describe the proposed runtime architecture.
- [x] **DOC-004** Record the technical baseline and unresolved feasibility gates.
- [x] **DOC-005** Create an executable, ordered roadmap.
- [x] **DOC-006** Define a demo, evaluation method, and submission checklist.
- [x] **DOC-007** Record what can and cannot currently be audited.
- [x] **DOC-008** Preserve the original idea without treating its assumptions as verified facts.
- [x] **DOC-009** Document the implemented scaffold and contributor workflow.

## Decision status

| Item | Status | Meaning |
| --- | --- | --- |
| Name and problem | Confirmed by discussion | Ghost Agent; remove the manual relay between advice and execution |
| Interaction principle | Confirmed by discussion | Operate through the visible interface without per-app integrations |
| Audience | Confirmed vision | Developers and everyday computer users |
| First platform | Confirmed by owner | Ubuntu/Linux |
| Implementation language | Existing project constraint | JS/TS application code; no Python application layer |
| Meta credits | Owner-reported | $150 received; balance and expiry unverified. A text-only Spark 1.3 request succeeded; computer-use acceptance remains pending |
| First workflow | Proposed | Set up and run a supplied application in an isolated Ubuntu environment |
| Electron and React | Scaffold created | TypeScript/process boundaries exist; see development validation record |
| Meta cloud loop | Source implemented | One-step adapter and controller are wired; text API access verified, screenshot/action integration unverified |
| X11 demo environment | Proposed fallback | Current host reports Wayland; full desktop input must be demonstrated |
| SAM and Glimmer | Experiments | Keep only if evidence shows benefit within the remaining time and budget |
| Desktop shell | Source implemented | Settings, task input, handoff, recovery, and floating controls are wired; native startup remains unverified |
| Desktop automation | Source implemented, runtime unverified | Single-display X11 adapter uses Electron capture and xdotool; no live end-to-end evidence yet |

## How to use these documents

- [ ] **MAINT-001** Before implementing a milestone, read its linked requirements and complete its prerequisites. A planning document is not evidence of working software.
- [ ] **MAINT-002** Keep each task ID stable. Update the checkbox only after its acceptance condition is met; record evidence with the task.
- [ ] **MAINT-003** Keep requirements authoritative in the PRD, tool decisions in the tech stack, implementation progress in the roadmap, and measurements in demo evaluation records. Link between them instead of copying status.
- [ ] **MAINT-004** When scope changes, update the relevant document and decision status together. Preserve the historical idea as an archive.

Checked documentation tasks mean the documents exist. Unchecked requirements, feasibility checks, build tasks, and release gates remain future work. The owner requested the folder/scaffold tranche before the platform spike; this does not complete BUILD-001 or the full BUILD-002. Proposed defaults can change when measurement or owner input justifies it.

## First implementation gate

The **BUILD-001** acceptance gate in [the roadmap](ROADMAP.md) remains open: prove a supported Ubuntu environment, validate Meta with a harmless image, and test a screenshot-to-action round trip. The owner approved UX source work while the platform gate remains open. Overlay source does not complete native startup or desktop acceptance.
