# Product vision and idea

Status: agreed problem and broad direction; the MVP described here is a proposal. Updated 2026-10-29.

## The problem

A person asks an AI how to set something up. The AI supplies instructions. The person switches between chat, a browser, a terminal, and settings; executes the steps; copies errors back; and repeats. The person becomes the manual link between reasoning and execution.

This problem statement comes from the project owner's experience and discussion. We have not measured its frequency, daily time cost, market size, or willingness to pay. The original claim of several hours saved per day is not an established result.

## The idea

**Ghost Agent takes a goal, operates the visible computer interface, and checks whether the goal was achieved.**

Proposed product promise:

> Tell Ghost Agent what you want done. It operates your computer and verifies the result.

Technical positioning:

> No app-specific APIs. No custom connectors. Work through the screen.

This describes how the target applications are operated. The product still needs a model, operating-system permissions, input/capture tools, and access to the user's authorized accounts. The initial proposal uses a cloud model API, so it is not a fully offline or fully on-device product.

## Who it serves

| Audience | Example goal | Expected benefit |
| --- | --- | --- |
| Developer | Set up an existing application and confirm it runs | Fewer manual transitions between instructions, terminal output, and browser checks |
| Everyday user | Configure a desktop application or complete a repetitive form | Less need to translate instructions into clicks and settings |
| Business operator | Complete an authorized workflow in software without a usable integration | Automation through the interface already available to the person |

The first demonstration should serve the developer setup case. This is a proposed validation target, not a change to the broader audience.

## Product principles

- [ ] **VISION-001** Demonstrate a completed outcome with visible evidence, such as the intended application running in a browser.
- [ ] **VISION-002** Reduce the person's execution work. Measure manual interventions instead of assuming that autonomy improved.
- [ ] **VISION-003** Adapt decisions to fresh screen observations. Avoid task-specific coordinate scripts disguised as general reasoning.
- [ ] **VISION-004** Keep the user in control through visible status, pause, stop, and clear decisions when the task exceeds the agreed scope.
- [ ] **VISION-005** Make capability and privacy claims match the implementation and tested environments.

These are product commitments to validate during the build, not completed capabilities.

## What makes the product worth building

Our intended distinction is the combination of an understandable setup experience, useful cross-application execution, visible recovery, and verified completion. Each element needs evidence.

Computer-use capability already exists, including [Meta's documented computer-use API](https://dev.meta.ai/docs/computer-use). We should compete on a demonstrated user outcome and reliability. We have not inspected other hackathon submissions or established a competitive ranking.

## Vision versus the first release

| Area | Long-term direction | Proposed hackathon scope |
| --- | --- | --- |
| Applications | Broad coverage of visible desktop software | A documented browser/terminal setup workflow |
| Platforms | Multiple desktop operating systems | One verified Ubuntu configuration |
| Goals | Many repetitive computer tasks | Set up a supplied application and verify it works |
| Recovery | Handle a wide variety of interface changes | One documented error scenario and one layout variation |
| Local inference | Explore a practical local mode | Cloud inference with explicit disclosure |
| Autonomy | Complete authorized tasks with little intervention | Bounded runs with step/time/cost limits and handoff |

## Validation questions

- [ ] **DISCOVERY-001** Observe at least three representative users performing a setup task; record where they switch to AI, copy instructions, and recover from errors. This is a proposed research target, not completed research.
- [ ] **DISCOVERY-002** Compare their manual process with Ghost Agent using the evaluation protocol in [demo and submission](DEMO_AND_SUBMISSION.md).
- [ ] **DISCOVERY-003** Record what users need to trust the result: evidence, explanations, control, or repeatability. Use those observations to prioritize the next release.
- [ ] **DISCOVERY-004** Validate whether broader users have the same problem before expanding into business portals, financial workflows, or other domains.
