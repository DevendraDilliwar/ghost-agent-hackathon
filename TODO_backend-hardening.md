# Ghost Agent backend and privileged-runtime hardening

- [x] **STATUS-2.1 — Latest research available.** The [research follow-up](#research-follow-up--2026-11-03) records seven additional open findings, the recommended order of fixes, primary sources, and reproducible probes. Only this TODO changed during that follow-up; the new fixes are not implemented.

Implementation update, 2026-11-03: the user subsequently authorized source fixes. All thirteen source remediations below are applied, and `npm run check` passes with **579 tests across 51 files**, TypeScript, lint, build, and preload validation. Native desktop/keyring acceptance and an actual clean Node 24 CI run remain open under Operations. Finding evidence/line references describe the pre-fix audited working tree, not the current patched source. Checked FINDING/FIX/CODE items mean the source remedy is applied and automated regressions pass; they do not close the separately listed live acceptance tasks.

## Context

- [x] **CONTEXT-1.1 — Audit boundary and snapshot.** Audited the current working tree on 2026-11-03, based on commit `8151e3c`. Ghost Agent / NoMCP is an Electron application with a React UI, TypeScript controller, Meta Responses API adapter, Ubuntu desktop adapters, and local file persistence. It has no hosted REST/GraphQL API, SQL database, shared queue, or independently deployed backend services. The privileged Electron main process is the backend-equivalent trust boundary.
- [x] **CONTEXT-1.2 — Preserve existing work.** Existing edits in `src/desktop/linux/ubuntu-desktop.ts`, `src/desktop/linux/xdotool.ts`, `src/main/index.ts`, and `src/providers/meta/meta-computer-model.ts` were inspected and preserved. Some desktop findings concern these working-tree changes. The initial audit changed only this root-level TODO; the later “ok fix this” instruction authorized the source/test/config/doc changes recorded below. Unrelated existing edits were retained; the unsafe display/Wayland fallbacks and automatic capture-source switch were corrected under FIX-1.5. The older `docs/TODO_backend-hardening.md` remains a historical document.
- [x] **CONTEXT-1.3 — Original architecture inventory.** Renderer → sandboxed preload → sender-checked IPC → `createTaskRuntime` → `TaskController`. The controller calls Meta for intent, planning, extraction, action decisions, and verification; dispatches desktop actions through `UbuntuDesktop` / `xdotool`; and also has a direct `LocalShell` executor. AT-SPI supplies optional accessibility grounding, and Tesseract supplies optional OCR. Credentials use Electron `safeStorage` or a custom fallback. Journals, run history, checkpoints, attachments, skills, and cross-task memory reside in local files under Electron user data.
- [x] **CONTEXT-1.4 — Existing capabilities.** Source includes task limits, approval modes, Pause/Resume/Stop, emergency-shortcut alternatives, manual handoff, phase planning/checkpoints, bill-photo extraction, row-fill planning, run history, and an evaluation runner. These are implementation observations, not a claim that every feature works in a packaged desktop session.
- [x] **CONTEXT-1.5 — Actual pain points and load evidence.** This audit reproduced credential-fallback weakness, omitted screenshot context, false typed-text verification, history read/write incompatibility, overlapping-save reordering, ignored provider warnings, and a step-limit bypass with synthetic local inputs. The original audit test run exposed an uncaught D-Bus failure; this was addressed by FIX-1.6. No production incident dataset, user count, latency profile, growth forecast, provider quota, or database query plans were supplied. One desktop driver per application instance is the intended concurrency model; a distributed rewrite is unjustified.
- [x] **CONTEXT-1.6 — Security requirements available in the repository.** `docs/PRD.md:23-24` excludes hidden shell execution/accessibility grounding from the original screen-only scope; `docs/PRD.md:71-72` requires untrusted-screen handling and action/safety validation. `docs/ARCHITECTURE.md:109-113` requires explicit cloud processing, redacted metadata, disposable OS isolation, and disclosure of broader capabilities. The current source has drifted from parts of that documented boundary. A checkbox acknowledging isolation does not establish an OS sandbox.
- [ ] **CONTEXT-1.7 — Unresolved external requirements.** Establish permitted business-data retention, cloud residency, provider retention, recovery expectations, and any applicable contractual/compliance requirements before wider distribution. HTTPS is configured; negotiated TLS version and native keyring behavior were not measured. No OWASP certification or complete encryption/compliance claim is made.

## Audit Findings

Finding descriptions preserve the original evidence. Source-remediation completion is tracked by the checkboxes and implementation record; remaining external acceptance is tracked separately. Severity reflects this local desktop threat model; there is no demonstrated remote unauthenticated exploit or reported production breach.

- [x] **FINDING-1.1 [High] [Host shell capability and authorization]**:
  - **Issue / evidence:** `src/main/runtime/create-task-runtime.ts:140` always installs `new LocalShell()`. `src/providers/meta/meta-computer-model.ts:20-24,122-127` advertises and encourages `run_shell`. `src/desktop/linux/local-shell.ts:29-31` runs `/bin/bash -c` from the user's home with inherited environment. `src/policy/shell-validation.ts:19-67` uses string splitting and a denylist, not a shell parser or sandbox. A validation-only probe rejected `sudo true` but accepted `bash -c "sudo true"` and a newline-separated second command. No probe executed these commands. Settings consent describes screenshots and a test desktop, without disclosing direct shell/accessibility execution (`SettingsOverlay.tsx:97-98`).
  - **Risk:** An incorrect or injected model command can act with the user's filesystem/network privileges. Environment-configured credentials are inherited by child commands because no restricted `env` is supplied. Autonomy does not enforce the documented screen-only or secret-exclusion boundary. This is a capability/authorization gap, not an assertion that arbitrary shell execution is accidental by itself.
  - **Proposed Fix:** Disable host shell by default and omit its tool/instructions unless explicitly enabled for an isolated session. Require review of each enabled shell command, disclose its host access, and pass a minimal child environment without model credentials. Keep the denylist only as defense in depth; do not claim it enforces isolation. Apply the same boundary to the evaluation runner. Accessibility grounding also needs explicit disclosure or default disablement to match the current documented scope.

- [x] **FINDING-1.2 [High] [Credential encryption fallback]**:
  - **Issue / evidence:** `src/main/config/secure-store.ts:18-43` derives the AES key from hostname + username and a constant salt. Lines 60-69 silently choose that fallback when native encryption is absent or throws. A dummy-key probe with mocked file I/O recovered the saved key using only those machine attributes. The native branch does not reject Linux `basic_text`. Electron documents that this backend uses a hardcoded password and does not protect the stored secret. [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
  - **Risk:** A copied credential file plus public machine metadata permits offline decryption of fallback records. The README's hardware/native encryption claim is broader than the implementation supports. No real key was read during this audit.
  - **Proposed Fix:** Fail closed for remembering keys when a protected OS backend is unavailable or reports `basic_text`; retain session-only use. Do not silently downgrade on encryption errors. Reject automatic loading of legacy mode `0x01`, ask for key re-entry, and replace that file atomically only after protected storage succeeds. Do not delete legacy data before the replacement is verified.

- [x] **FINDING-1.3 [High] [False typed-text verification]**:
  - **Issue / evidence:** `src/agent/vision/prism-verifier.ts:27-48` compares characters of compressed base64 data, not decoded pixels or text. `src/agent/task-controller.ts:606-610` treats any successful visual transition as proof that typed text is visible and skips OCR/model readback. A synthetic controller run used two valid 1×1 PNGs with different colors: neither contains the requested text, yet the type action received `verified_success` and `verifyText` was called zero times.
  - **Risk:** Unrelated animation, focus changes, or a dialog can mark incorrect entry as verified and advance row-fill progress. Final user confirmation remains a separate safeguard; it does not make intermediate verification truthful.
  - **Proposed Fix:** Always perform bounded OCR/readback for typed content regardless of ambient image change. Treat image-byte differences only as a stall heuristic, not perceptual percentages or semantic success. Avoid adding an image-processing subsystem merely to fix this branch.

- [x] **FINDING-1.4 [High] [Stateless decision loses screenshot context]**:
  - **Issue / evidence:** `src/agent/task-controller.ts:802-810` omits an unchanged screenshot because it assumes the model saw the previous request. `src/providers/meta/meta-computer-model.ts:104-141` constructs a new request containing only the current goal/history/image; `meta-request.ts:36-38` sends `store: false` and no previous-response reference. A two-decision controller probe observed screenshot inclusion `[true, false]` for an unchanged screen.
  - **Risk:** The second independent request lacks the visual context needed to choose targets. It can still propose GUI actions, which the controller validates for coordinate bounds against a local frame; bounds validation does not prove the model observed that frame.
  - **Proposed Fix:** Include the current screenshot on every visual decision. Preserve explicit text-only decisions after shell output, but require a fresh screenshot and a new model decision before executing GUI targets chosen without a visual observation. Retain local grounding caches if useful; they do not supply context to the provider.

- [x] **FINDING-1.5 [High] [Desktop adapter fails open]**:
  - **Issue / evidence:** `src/desktop/linux/ubuntu-desktop.ts:20-27` now permits Wayland and multiple displays. `xdotool.ts:60-79` substitutes supplied geometry when X11 geometry lookup fails; lines 99-105 ignore activation failures; lines 136-141 log and suppress dispatch errors on Wayland. `ubuntu-desktop.ts:40` falls back to `sources[0]` when the selected display ID does not match. Capture also substitutes window ID `1` when active-window lookup fails. These are current-source control-flow observations; native Wayland misdelivery was not reproduced.
  - **Risk:** Readiness can pass without a usable input backend; failed input can resolve successfully; an image can come from a different display than the one receiving coordinates; typing may continue in an unconfirmed focus target. These invalidate the original single-display X11 safety assumptions.
  - **Proposed Fix:** Restore the supported single-display X11 boundary for this adapter. Require exact capture-source identity, successful geometry lookup, and confirmed focus for focus-sensitive input. Propagate execution failures. Introduce Wayland/multi-display support only with a separately validated capture/input mapping; do not equate screen capture availability with input support.

- [x] **FINDING-1.6 [High] [Optional AT-SPI can raise uncaught process errors]**:
  - **Issue / evidence:** The full unit run produced seven uncaught `connect EPERM /run/user/1000/bus` errors, all attributed to runtime tests. `src/desktop/linux/atspi-reader.ts:138` creates the initial session bus without an `error` listener; only the second bus gets one at line 151. Promise `try/catch` cannot catch an EventEmitter's unhandled `error`. `src/agent/vision/ui-grounding.ts:4-14,32-34` times out the returned promise without cancelling its underlying detector; `connect()` accepts no cancellation signal. Runtime tests mock the desktop/model but instantiate the real AT-SPI connector.
  - **Risk:** A supposedly optional dependency can crash the process or leave D-Bus operations alive after timeout/Stop. Tests depend on the host session bus instead of proving the fallback in isolation. The observed EPERM is environment-specific; the missing error containment is a source defect.
  - **Proposed Fix:** Attach error handling to every bus immediately, settle pending operations on error/abort, and close both connections in every failure path. Propagate timeout/abort to the connector and tree operations. Mock the connector in runtime unit tests; keep denied/missing-bus cases as explicit isolated tests.

- [x] **FINDING-1.7 [Medium] [Run-history writer/reader contract mismatch]**:
  - **Issue / evidence:** Shared `ActionType` includes `shell`, and the controller saves shell actions, but `src/observability/run-history-store.ts:95` excludes `shell` from accepted persisted action types. The same reader caps both run limits at 1000 (line 216), while admission allows 2000 steps and 480 minutes (`task-validation.ts:63-64`). A source probe with an in-memory filesystem confirmed: ordinary record loads; record containing a shell action returns `null`; record with `maxSteps: 2000` returns `null`.
  - **Risk:** Valid completed runs silently disappear from history. The original files remain present, so this is a read compatibility problem rather than proven file deletion.
  - **Proposed Fix:** Accept every implemented persisted action type and align per-field limits with admission. Add round-trip coverage for shell and boundary values, keeping older records readable. Do not migrate/delete valid existing records merely to accommodate the reader bug.

- [x] **FINDING-1.8 [High] [Overlapping persistence and unobserved durability failures]**:
  - **Issue / evidence:** `create-task-runtime.ts:161-171` fires `history.saveRun` on every snapshot without serialization. Run history, checkpoints, skills, and memory writers all use the same `<target>.tmp` for overlapping saves (`run-history-store.ts:76-81`, `checkpoint-store.ts:105-110`, `skill-store.ts:27-32`, `memory-store.ts:26-31`). Store methods swallow write failures. A controlled source probe delayed the older history write, completed the newer write, then released the older write: the final loaded record contained `message: older`. Runtime disposal (`create-task-runtime.ts:266-273`) neither drains these saves nor calls the journal's existing `drain()`.
  - **Risk:** Older active state can replace terminal state; concurrent writes share/truncate a temp file or race a rename; shutdown can lose final history/checkpoints. Permission or disk failures can appear as successful persistence, leaving resume promises unsupported.
  - **Proposed Fix:** Serialize complete read/modify/write operations per target, use unique temporary files, and make deletion participate in the same ordering. Expose bounded flush and redacted persistence health. Stop dispatch first, capture terminal/interrupted state, then drain queued saves on controlled shutdown with a finite deadline. Coalesce superseded nonterminal history snapshots if needed for queue bounds; never drop terminal writes.

- [x] **FINDING-1.9 [High] [Redaction contract is not enforced]**:
  - **Issue / evidence:** `src/shared/contracts/journal.ts:66-73` removes image URLs/NUL and truncates; it does not redact arbitrary content. The controller journals model-produced intent summaries (`task-controller.ts:1110`), source bill identifiers/totals (lines 492-495), phase success conditions, and handoff/failure text. Shell verification summaries include output excerpts (lines 1000-1010), and `toRunRecord` persists those summaries along with command descriptions (`run-history-store.ts:265-276`). A controller probe confirmed an intent canary in journal events. Thus dropping `action.text` does not ensure shell output or business values are absent from disk.
  - **Risk:** Sensitive business or terminal data can be retained in plaintext journals/history/checkpoints despite the documented metadata-only/redacted defaults. Mode `0600` helps with file access but is not encryption or content redaction. Exposure was demonstrated with dummy canaries only.
  - **Proposed Fix:** Journal fixed event summaries/codes and numeric counters instead of model prose, bill values, commands, and output. Persist metadata-only shell action/verification summaries; keep required transcripts in the active run's memory unless explicit content retention is enabled. Clearly define user-approved goal/chat/checkpoint retention and deletion separately. Inspect all durable stores with canaries before claiming redaction. Update the misleading product/privacy text as part of this exact boundary correction.

- [x] **FINDING-1.10 [High] [Provider safety checks bypass review in autonomous mode]**:
  - **Issue / evidence:** `parse-response.ts:18-26` turns `pending_safety_checks` into ordinary warning strings. `task-controller.ts:895-925` only presents them in the manual approval branch; auto execution ignores them. A source probe parsed one pending safety check, then ran the controller in `full_access`: one action executed, no approval was pending, and the run reached final verification. `docs/PRD.md:72` explicitly excludes blanket authorization for provider safety flags.
  - **Risk:** An action requiring safety review executes solely because the general autonomy setting is enabled. Unknown safety-check shapes can also lose structured identity when flattened to strings.
  - **Proposed Fix:** Preserve typed pending-safety metadata independently of informational warnings. Force explicit matching-run/action review whenever checks are pending, regardless of autonomy setting; invalid/unknown checks must block dispatch. Show the bounded check descriptions and invalidate acknowledgment on pause, stop, or stale observations.

- [x] **FINDING-1.11 [Medium] [Step allowance excludes failed dispatches]**:
  - **Issue / evidence:** `task-controller.ts:890,943` calculates remaining steps from actions with `status === executed`. Failed desktop dispatches therefore consume no allowance. With `maxSteps: 1` and synthetic input failures, the existing controller/recovery path dispatched twice before handing off to the user. A driver can fail after partially submitting input.
  - **Risk:** A user-approved action ceiling can be exceeded during recovery; counting successful outcomes alone understates potentially irreversible attempts. Existing deadline/stall caps still bound the run but do not enforce the stated action allowance.
  - **Proposed Fix:** Track attempted dispatches separately and reserve one step immediately before each driver/shell invocation. Persist and restore this count across pause/recovery; define whether a resumed mission gets a fresh run allowance. Fail before dispatch when exhausted. Preserve success/failure outcome counts for reporting.

- [x] **FINDING-1.12 [Medium] [CI install cannot use the committed lockfile]**:
  - **Issue / evidence:** `.github/workflows/ci.yml:20-25` configures `cache: npm` and runs `npm ci`; `git ls-files '*lock*'` returns only `pnpm-lock.yaml`. README explicitly prescribes pnpm and warns against another lockfile. `npm ci` requires an npm lockfile or shrinkwrap. This is an install-contract defect; no remote Actions run was inspected. [npm ci requirements](https://docs.npmjs.com/cli/v11/commands/npm-ci/)
  - **Risk:** A clean CI runner can fail before typecheck/lint/tests/build, so existing quality gates are not reliably reached.
  - **Proposed Fix:** Pin the existing pnpm toolchain and install using `pnpm install --frozen-lockfile`; use pnpm-compatible caching or initially omit caching. Keep the current `npm run check` scripts. Do not create a competing npm lockfile. Frozen installation preserves the reviewed dependency resolution. [pnpm install](https://pnpm.io/cli/install)

- [x] **FINDING-1.13 [Medium] [Newest-first history is truncated before sorting]**:
  - **Issue / evidence:** `RunHistoryStore.listRuns` stops after 200 valid entries and only then sorts/returns 50 (`run-history-store.ts:51-70`). `CheckpointStore.listMissions` stops after 50 filesystem entries before sorting (`checkpoint-store.ts:79-95`). Filesystem enumeration is not a chronological index, and run IDs are UUID-like values rather than creation timestamps.
  - **Risk:** With more records than the pre-sort limit, a recent run/mission outside that first subset is absent from the supposedly newest-first UI. This is a correctness ceiling at 201 valid histories / 51 missions, not a measured latency bottleneck.
  - **Proposed Fix:** Establish chronological selection before truncation. For the current file layout, scan summaries while keeping a bounded top-N set and return the true newest records; define cursor pagination if the product needs older entries. Do not add a database/cache until profiling justifies it.

## Verified OK (No Action)

These checkboxes mark the stated checks complete, with the limits shown. They do not certify unrelated behavior in the same component.

- [x] **OK-1.1 — Architecture pattern.** Keeping one Electron app with internal ports is appropriate for one controlled desktop. No observed need for microservices, API Gateway, cluster/PM2, Redis, replication, sharding, or distributed queues. Existing controller size alone is not evidence for a rewrite.
- [x] **OK-1.2 — IPC identity and least privilege.** `assert-sender.ts`, `register-task-ipc.ts`, and `register-controls-ipc.ts` validate exact argument count, owning WebContents, main frame, renderer URL, run IDs, and operation payloads. Controls cannot start tasks, configure keys, review actions, or retrieve screenshots. Existing IPC tests passed.
- [x] **OK-1.3 — Renderer isolation.** `secure-window.ts:5-19` sets sandbox/context isolation, disables Node integration/webviews, denies new windows/navigation, and installs restrictive permissions/CSP. Production CSP denies renderer network connections. Keep these protections. This source configuration matches relevant [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security); packaged enforcement remains a live check.
- [x] **OK-1.4 — Provider transport guards.** `meta-request.ts` fixes the HTTPS endpoint, rejects redirects, suppresses raw error bodies, limits responses to 1 MiB, applies a 30-second per-attempt timeout, checks external cancellation, and bounds transient retries to three. No evidence justifies adding a circuit breaker service. HTTPS source configuration does not prove TLS 1.3 negotiation or provider residency.
- [x] **OK-1.5 — Model-output and input shape validation.** The current parsers reject incomplete/failed response statuses, partial tool output, invalid usage, unsupported tools, and multiple tool calls. Admission bounds goals, consents, attachments, time, and steps. Desktop validation checks finite integer bounds, text limits, and allowed action shapes. Safety authorization remains open under FINDING-1.10; shell policy is separately deficient.
- [x] **OK-1.6 — Direct input invocation.** `runXdotool` uses a fixed executable, `shell: false`, timeout, output cap, and stdin for typed content; arbitrary typed text is not shell-interpolated or placed in process arguments. Existing tests passed. Error propagation and surface identity remain open under FINDING-1.5.
- [x] **OK-1.7 — Controller cancellation model.** Run IDs, generation checks, AbortControllers, stale approval rejection, explicit resume, and final user confirmation are implemented and exercised by controller tests. Do not replace this state machine. This does not prove one-second native Stop latency, process-tree cleanup, or every late-result path.
- [x] **OK-1.8 — Single-instance ownership.** `src/main/index.ts:19-41` prevents normal/eval instances from competing within the same Electron single-instance lock. No evidence supports parallelizing desktop drivers against one surface.
- [x] **OK-1.9 — Local persistence access boundaries.** Stores validate run/mission identifiers and sanitize attachment names. Sensitive file creation requests mode `0600`, and read validators reject malformed records. Single-writer rename is already used. Ordering, truthful redaction, shutdown durability, and byte limits are not certified by this check.
- [x] **OK-1.10 — TypeScript and lint enforcement.** Strict settings include `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, covering main/preload/agent/provider/shared and renderer source. Both no-emit target checks and ESLint passed in this audit. CI execution still needs FIX-1.12.
- [x] **OK-1.11 — Existing automated coverage.** The present suite includes 544 tests across 50 files; 535 passed. Preserve the passing policy/parser/controller/IPC checks instead of replacing them. Nine failures and seven uncaught errors mean the overall suite is not green.
- [x] **OK-1.12 — Conditional server/database standards.** REST/GraphQL naming, HTTP error envelopes, public endpoint pagination/rate limits, multi-tenant RBAC, ORM/index/query-plan analysis, SQL migrations/foreign keys, connection pooling, server health probes, CORS/HSTS response headers, replicas and zero-downtime service rollout are **not applicable to nonexistent hosted components**, not “production verified.” Apply the corresponding principles to the actual IPC/local-file/provider boundaries above. Do not invent backend infrastructure to satisfy a checklist.

## Remediation Plan

The same-number source tasks below are implemented. Change/rollback/validation descriptions retain their original requirements; the implementation record distinguishes automated proof from remaining native/CI acceptance. User data was not migrated or deleted.

- [x] **FIX-1.1 [Host capability boundary] — Finding 1.1; first tranche.**
  - **Change:** Gate direct shell/accessibility capability in runtime and eval, omit unavailable provider tools/instructions, disclose enabled capabilities, require shell-command approval, and construct an explicit credential-free child environment. Choose a disposable OS session for enabled host access.
  - **Rollback:** Disable the new capability flag and keep existing data. Reverting disclosure/policy must not silently restore shell access by default.
  - **Validation:** No `run_shell` tool or executor in default sessions; enabled sessions show the exact command before each dispatch; tests inspect child `env` using dummy model credentials. Denylist bypass examples must never be treated as sandbox coverage. Adversarial screen/task-output fixture must not enable capabilities.

- [x] **FIX-1.2 [Protected credential storage] — Finding 1.2; first tranche.**
  - **Change:** Remove automatic weak encryption/writes and reject `basic_text`. Preserve session operation when remembering is unavailable. Handle legacy fallback records through explicit re-entry and protected replacement, using unique temp file + rename.
  - **Rollback:** Keep session-only operation and preserve the previous encrypted file until replacement verification. Do not downgrade to public-metadata encryption.
  - **Validation:** Native unavailable, native throws, Linux `basic_text`, supported native backend, corrupt file, legacy `0x01`, and failed replacement cases. No fallback writes; failed remembering remains an honest UI error. Native keyring behavior needs a real desktop check.

- [x] **FIX-1.3 [Honest typed verification] — Finding 1.3; first tranche.**
  - **Change:** Remove the visual-delta shortcut that skips text checking. Keep OCR-first, bounded model fallback. Reword byte-delta output so it cannot claim perceptual/semantic proof.
  - **Rollback:** Disable automatic typed-success advancement or hand off to the user if readback is unreliable; do not restore false success.
  - **Validation:** Unrelated valid-image changes and window changes must not confirm absent text. OCR/readback canaries must be absent/present as expected. Row progress advances only after the chosen verification condition succeeds.

- [x] **FIX-1.4 [Visual decision context] — Finding 1.4; first tranche.**
  - **Change:** Always supply the current observation on visual requests. If a text-only decision requests GUI input, discard that proposed input, capture, and obtain a visual decision before dispatch.
  - **Rollback:** Use visual requests for every action; avoid provider conversation-state changes as an emergency workaround.
  - **Validation:** Two identical frames still produce two requests with `input_image`; a GUI request after shell output requires another screenshot-informed decision. Record provider request counts/tokens to quantify the corrected behavior; do not trade away context merely to lower cost.

- [x] **FIX-1.5 [Supported desktop boundary] — Finding 1.5; first tranche.**
  - **Change:** Fail preflight for unsupported session/display arrangements; remove ambiguous geometry/source/window fallbacks and error suppression; verify focus for typing/keypresses.
  - **Rollback:** Disable desktop execution on unsupported configurations. Reverting UI support claims does not justify ignoring driver failures.
  - **Validation:** Missing X11 geometry, Wayland, multiple displays, missing display ID, unknown focus, activation failure, resize, and actual dispatch failure all block input. Then test the supported X11 setup, scaling/coordinates, and Stop during slow input in an isolated VM.

- [x] **FIX-1.6 [Optional dependency containment] — Finding 1.6; first tranche.**
  - **Change:** Contain D-Bus events, cancel/close timed-out walks and connections, and inject a mocked detector into runtime unit tests. If grounding is disabled under FIX-1.1, do not open the bus at all.
  - **Rollback:** Disable AT-SPI grounding and fall back to screenshot-based coordinates. Do not add a global uncaught-exception handler that resumes unsafe execution.
  - **Validation:** Bus connection rejection, emitted `error`, root-proxy failure, hung method, timeout, and Stop settle with no uncaught error or live bus handle. Optional failure returns zero tags and the controller remains usable. Existing runtime tests must no longer access `/run/user/1000/bus`.

- [x] **FIX-1.7 [History compatibility] — Finding 1.7; second tranche.**
  - **Change:** Add `shell` to the persisted reader and use separate limits of 2000 steps / 480 minutes, shared with admission where practical.
  - **Rollback:** Reader-only additive change; preserve files. Before any future record-format change, retain a backup and backward reader.
  - **Validation:** Save/load equality for every ActionType and limits 1/2000 steps, 1/480 minutes; values outside admitted ranges reject. Existing historical fixtures remain readable, including records previously hidden by the bug.

- [x] **FIX-1.8 [Ordered durable state] — Finding 1.8; second tranche.**
  - **Change:** Serialize full per-target operations, use unique temp files, order deletes, add flush/health hooks, and integrate bounded graceful shutdown. Distinguish absent/corrupt records from write failures without leaking content. Audit the journal's queued-write lifecycle alongside JSON stores.
  - **Rollback:** Snapshot the user-data directory while the app is closed before implementing. Keep the existing JSON layout and reader compatibility. Restore the prior artifact/data snapshot if validation fails; never replay saved desktop actions automatically.
  - **Validation:** Delayed older save cannot replace terminal state; concurrent checkpoint writes cannot corrupt JSON; delete cannot be undone by a queued save; injected permission/rename/disk failures set redacted storage health; a controlled close flushes terminal/interrupted state. Abrupt kill remains best-effort unless a separately tested stronger durability guarantee is implemented.

- [x] **FIX-1.9 [Content retention boundary] — Finding 1.9; first tranche.**
  - **Change:** Use fixed journal events and metadata-only durable shell summaries. Specify which user chat/goal/checkpoint content is retained and for how long; disclose photo persistence. Bound cleanup to the records covered by that policy. Update existing docs/settings claims to match actual storage and capabilities.
  - **Rollback:** Opt out of durable content retention while retaining safe metadata. Preserve pre-change files until the user chooses cleanup; do not claim a code change erases old backups or exported evidence.
  - **Validation:** Dummy secret/business canaries in intent, errors, handoff, command/output, and bill fields do not appear in metadata-only stores. Retained chat content follows its explicit policy. Inspect raw file bytes, not only renderer fields. Confirm access modes and no raw screenshot retention in history/journal.

- [x] **FIX-1.10 [Safety-check authorization] — Finding 1.10; first tranche.**
  - **Change:** Add structured pending-safety metadata to the internal decision contract and force review of the exact action even in automatic modes. Keep informational warnings separate.
  - **Rollback:** Block actions with pending checks until review works; never fall back to treating checks as display-only strings.
  - **Validation:** Each approval mode receives pending checks; no dispatch before explicit approval; rejection/Stop/pause/expiry invalidates authorization; unknown checks reject. Ordinary unflagged actions preserve their selected mode.

- [x] **FIX-1.11 [Attempt budget] — Finding 1.11; second tranche.**
  - **Change:** Add a dispatch-attempt counter, decrement allowance immediately before execution, persist it with compatible defaults, and report attempted versus successful actions distinctly.
  - **Rollback:** Keep the conservative attempted-action limit. Preserve older checkpoints; if their attempted count is unknown, require explicit confirmation of a fresh budget before resume.
  - **Validation:** With allowance 1, an input failure or partial batch never causes a second dispatch; failed shell commands count too; rejected approvals do not dispatch/count; pause/resume cannot reset the count; boundary 2000 still works.

- [x] **FIX-1.12 [Clean CI install] — Finding 1.12; second tranche.**
  - **Change:** Pin pnpm, use the pnpm lockfile with a frozen install, and retain all existing quality gates. Local installed pnpm is `11.0.9`; verify this pinned version on the project's Node 24 CI target.
  - **Rollback:** Restore the prior CI definition only for diagnosis; keep a known-good artifact for release. Do not merge a knowingly failing install gate or introduce another lockfile.
  - **Validation:** Clean Node 24 runner installs without modifying `pnpm-lock.yaml` and reaches all checks. Run the two process-sensitive tests in an allowed Linux process namespace; investigate their actual failures rather than marking them passed here.

- [x] **FIX-1.13 [Chronological collection selection] — Finding 1.13; second tranche.**
  - **Change:** Select newest history/mission summaries before applying the result limit. Preserve IPC collection caps; expose a cursor only if older-item browsing requires it.
  - **Rollback:** Restore list behavior without changing stored records; keep a direct load path for known run IDs.
  - **Validation:** Use 201+ histories and 51+ missions with shuffled filenames/timestamps and the newest entry last in enumeration. The true newest item must be returned, corrupt records skipped, result count bounded. This is a correctness test; measure scan latency before proposing an index/cache.

- [ ] **PERF-1.1 [Profile before optimization].** Capture per-stage capture/grounding/inference/readback/input/persistence durations, provider requests/tokens, total task time, and interventions on a fixed isolated-desktop task before and after the above corrections. Existing journals have run/phase/action correlation and some timings, but no current end-to-end latency baseline was measured here. Do not propose pooling, sharding, broad caching, or generic load tests without measurements. Target concurrency tests at the demonstrated local persistence race.
- [ ] **OPS-1.1 [Native acceptance and rollback].** In the supported packaged desktop, verify readiness, denied permissions, model timeout/429, Pause/Stop during input/model work, restart after interruption, and retained-data compatibility. Keep the last working executable and a closed-app user-data backup. Desktop app upgrades are not zero-downtime server deployments; no unsupported service rollout strategy is proposed.
- [ ] **OPS-1.2 [Backup/recovery proof].** With synthetic runs only, back up a closed-app user-data directory, restore to a disposable profile, and prove history/checkpoints load without replaying actions. Test corrupted/partial records and interrupted writes. Verify keyring-dependent credentials separately; copying an encrypted key file is not proof it can be decrypted on another machine. No backup/restore drill was performed in this audit.

## Proposed Code Changes

These excerpts preserve the original proposed approach. The actual source changes supersede these illustrative blocks; they are not a combined patch to reapply. Checked CODE tasks indicate implementation in the working tree. Validation and remaining live checks are recorded below.

- [x] **CODE-1.1 [FIX-1.1] — Capability and child-process files.**

```text
src/main/runtime/create-task-runtime.ts
  Default host-shell and accessibility capabilities to disabled.
  Install LocalShell / AT-SPI only when explicitly configured for the session.
  Pass the actual capability set into every MetaComputerModel instance.
  Require explicit shell-command review independently of general autonomy.
src/main/eval/eval-runner.ts
  Apply the same capability boundary; eval is not an undisclosed bypass.
src/agent/ports.ts, src/shared/contracts/task.ts
  Represent enabled capabilities explicitly; validate them at IPC ingress.
src/providers/meta/meta-computer-model.ts
  Add constructor capability configuration; omit run_shell tool and all shell
  instructions when unavailable. Omit accessibility tags when disabled.
src/desktop/linux/local-shell.ts
  Supply a freshly built env allowlist for display/session/path/locale only;
  never spread process.env. Include only session variables required by the
  enabled workflow. Test with dummy META_API_KEY and other unrelated secrets.
src/renderer/src/features/chat/SettingsOverlay.tsx
  Explain host command/file/network access and optional accessibility use.
src/policy/shell-validation.ts
  Retain defensive checks, explicitly document they are not a sandbox.
```

- [x] **CODE-1.2 [FIX-1.2] — `src/main/config/secure-store.ts`.** Replace the complete fallback selection, not just its error message; use this fail-closed gate before protected encryption. Remove fallback writes and handle legacy reads as described in FIX-1.2.

```ts
function assertProtectedStorage(): void {
  if (!safeStorage.isEncryptionAvailable() ||
      (process.platform === 'linux' &&
       safeStorage.getSelectedStorageBackend() === 'basic_text')) {
    throw new Error('Protected key storage is unavailable. Use a session-only key.');
  }
}
// Call before encryptString. Propagate encryption failures without downgrade.
// Write to a unique mode-0600 temp file, verify, then rename over the old file.
```

- [x] **CODE-1.3 [FIX-1.3] — Remove the false readback shortcut.**

```diff
--- a/src/agent/task-controller.ts
+++ b/src/agent/task-controller.ts
@@
-        if (typed.length && delta.status === 'verified_success') {
-          // The screen already shows typed output: skip the paid re-check.
-          progressed = true;
-          verification = { ...delta, summary: 'PRISM: typed value visible on screen (+' + delta.visualDeltaPercent + '% delta); paid re-check skipped.' };
-        } else if (typed.length) {
+        if (typed.length) {
```

```text
src/agent/vision/prism-verifier.ts
  Treat encoded-image differences as a heuristic only. Remove perceptual/pixel
  measurement claims and semantic-success wording from that heuristic.
  Preserve existing bounded stall/recovery flow.
src/agent/vision/prism-verifier.test.ts, src/agent/task-controller.test.ts
  Add valid unrelated PNG-change and wrong-text/window-change fixtures.
```

- [x] **CODE-1.4 [FIX-1.4] — Restore screenshot context.**

```diff
--- a/src/agent/task-controller.ts
+++ b/src/agent/task-controller.ts
@@
-    const frameChanged = !observation || observation.image !== this.lastSentFrame;
-    if (observation && frameChanged) this.lastSentFrame = observation.image;
-    if (observation && !frameChanged) history.push('Screenshot unchanged since the last observation; decide from the executed steps above.');
     const decideInput = {
       goal: this.state.goal, history, signal,
-      ...(observation && frameChanged ? { observation } : {}),
+      ...(observation ? { observation } : {}),
```

```text
src/agent/task-controller.ts
  Remove the now-unused lastSentFrame field/reset and obsolete cache comment.
  On pendingActions from a text-only turn, obtain freshCapture and call
  decideNext with that frame; never dispatch the old unobserved GUI proposal.
src/providers/meta/meta-computer-model.test.ts
  Assert each independent visual request includes input_image, even for equal
  frame bytes; text-only-to-GUI transition requires another visual decision.
```

- [x] **CODE-1.5 [FIX-1.5] — Desktop fail-closed files.**

```text
src/desktop/linux/ubuntu-desktop.ts
  Require the supported X11 session and exactly one display in preflight.
  Remove GHOST_ALLOW_ANY_SESSION bypass for this adapter.
  Require sources.find(display_id match), without sources[0] fallback.
  Do not synthesize activeWindowId '1'; require real identity where needed.
src/desktop/linux/xdotool.ts
  Remove geometry fallbacks from preflight/execute and propagate lookup errors.
  Before type/keypress, verify activation/current-window identity.
  Propagate dispatch/abort errors on every session type; never warn-and-succeed.
  Keep fixed executable, stdin typing, coordinate bounds, and timeout.
src/desktop/linux/ubuntu-desktop.test.ts, src/desktop/linux/xdotool.test.ts
  Add unsupported session, missing identity, failed activation/geometry,
  multiple displays, and Wayland-error cases without touching the real desktop.
```

- [x] **CODE-1.6 [FIX-1.6] — Optional grounding lifecycle files.**

```text
src/desktop/linux/atspi-reader.ts
  Extend connector lifetime to accept cancellation and close partial connects.
  Attach listeners immediately to both sessionBus() results.
  Reject outstanding requests on bus error, disconnect on error/abort, and
  guarantee cleanup if root proxy creation fails before returning a scope.
  Check already-aborted signals before attempting a connection.
src/agent/vision/ui-grounding.ts
  Use a child AbortController tied to parent abort and the detection deadline.
  Abort the underlying detector when the deadline wins; release listeners.
src/main/runtime/create-task-runtime.test.ts
  Mock createAtspiDetector / inject a fake detector in ordinary runtime tests.
src/desktop/linux/atspi-reader.test.ts
  Exercise real connector error-event wiring through fake bus emitters,
  including hung calls; do not depend on the host's session bus.
```

- [x] **CODE-1.7 [FIX-1.7] — History reader compatibility.**

```diff
--- a/src/observability/run-history-store.ts
+++ b/src/observability/run-history-store.ts
@@
-const actionTypes: ActionType[] = ['click', 'double_click', 'type', 'key_press', 'scroll', 'wait', 'verify'];
+const actionTypes: ActionType[] = ['click', 'double_click', 'type', 'key_press', 'scroll', 'wait', 'verify', 'shell'];
@@
   for (const key of ['maxSteps', 'maxMinutes'] as const) {
-    if (typeof data[key] !== 'number' || !Number.isSafeInteger(data[key]) || (data[key] as number) < 1 || (data[key] as number) > 1000) return null;
+    const upper = key === 'maxSteps' ? 2000 : 480;
+    if (typeof data[key] !== 'number' || !Number.isSafeInteger(data[key]) || (data[key] as number) < 1 || (data[key] as number) > upper) return null;
```

- [x] **CODE-1.8 [FIX-1.8] — Ordered storage helper and integration.** The following helper is a proposal for a small shared file, not a new file created by this audit. It orders whole operations, including reads used by `saveRun`; unique temp filenames alone do not prevent stale overwrites.

```ts
// Proposed: src/observability/file-operations.ts
export class FileOperations {
  private readonly tails = new Map<string, Promise<void>>();

  enqueue<T>(target: string, work: () => Promise<T>): Promise<T> {
    const prior = this.tails.get(target) ?? Promise.resolve();
    const result = prior.then(work);
    const tail = result.then(() => undefined, () => undefined);
    this.tails.set(target, tail);
    void tail.then(() => {
      if (this.tails.get(target) === tail) this.tails.delete(target);
    });
    return result;
  }

  async drain(): Promise<void> {
    await Promise.all([...this.tails.values()]);
  }
}
```

```text
src/observability/run-history-store.ts
  Queue saveRun's previous-read + full write as one operation per target.
  Queue deleteRun on the same target. Use randomUUID in temp filenames.
  Save callbacks receive redacted success/failure state; drain before shutdown.
src/observability/checkpoint-store.ts, src/observability/skill-store.ts,
src/observability/memory-store.ts
  Adopt identical per-target ordering and unique-temp cleanup.
src/observability/journal.ts
  Reuse existing drain; remove settled chain entries to avoid retaining all
  historical run paths, and expose write failure health without raw content.
src/main/runtime/create-task-runtime.ts, src/main/windows/create-main-window.ts,
src/main/index.ts
  Add a controlled close/quit path: prevent further dispatch, save an honest
  interrupted/terminal state, await bounded drains, then release windows/quit.
  Avoid a close-loop or waiting forever on a failed disk.
```

- [x] **CODE-1.9 [FIX-1.9] — Durable-content boundary files.**

```text
src/agent/task-controller.ts
  Replace raw intent/bill/handoff/error/success text in journal records with
  fixed summaries and identifiers/counts. Keep operational content in memory.
src/shared/contracts/journal.ts
  Add a fixed event-code/summary vocabulary; truncation remains a safety net,
  not a redaction guarantee. Never rely on a regex to identify every secret.
src/observability/run-history-store.ts
  Store shell action type/status and fixed metadata summary; never raw command
  or output in verification/recoverySuggestion/message by default.
src/observability/checkpoint-store.ts, src/observability/skill-store.ts,
src/observability/memory-store.ts
  Apply the documented retention choice to command strings, extracted fields,
  clarifications, mistakes, and lastVerification. Bound retained content and
  expose cleanup scoped to its user-approved retention policy.
docs/ARCHITECTURE.md, docs/DEVELOPMENT.md, docs/PRD.md, README.md,
src/renderer/src/features/chat/SettingsOverlay.tsx
  Correct only capability, encryption, verification, and retention claims
  affected by the findings. No unrelated documentation rewrite.
```

- [x] **CODE-1.10 [FIX-1.10] — Structured safety review files.**

```text
src/agent/ports.ts
  Add readonly pendingSafetyChecks to ModelDecision with bounded typed records.
src/providers/meta/parse-response.ts
  Validate/preserve check identity and descriptions; reject unsupported shapes.
  Do not flatten safety requirements into informational warnings.
src/agent/task-controller.ts
  Compute auto execution as selectedAutoMode AND no pending safety checks.
  Bind check review to the pending action/observation; reuse stale-review
  invalidation. Never execute a multi-action flagged batch under one review.
src/shared/contracts/task.ts, src/renderer/src/features/run/ApprovalCard.tsx
  Carry/display bounded checks on the exact pending action for user review.
src/providers/meta/meta-computer-model.test.ts, src/agent/task-controller.test.ts
  Cover flagged automatic actions and stale/rejected acknowledgments.
```

- [x] **CODE-1.11 [FIX-1.11] — Attempt accounting files.**

```text
src/agent/task-controller.ts
  Reserve an attempt immediately before each desktop.execute and shell.run.
  Calculate room from attempts, never only status === executed.
  Preserve attempts through pause/recovery and capture in checkpoints.
src/shared/contracts/task.ts, src/shared/contracts/mission.ts,
src/observability/checkpoint-store.ts, src/observability/run-history-store.ts
  Add compatible optional attemptedActions fields, validate bounds, and make
  older checkpoint behavior explicit. Never infer that a failed dispatch had
  no side effects. Keep display counters distinct from successful actions.
```

- [x] **CODE-1.12 [FIX-1.12] — CI install correction.** This uses the existing locally installed pnpm version and omits cache setup initially, keeping the change independent of another action.

```diff
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@
       - uses: actions/setup-node@v7
         with:
           node-version-file: .nvmrc
-          cache: npm
-      - run: npm ci
+      - run: npm install --global pnpm@11.0.9
+      - run: pnpm install --frozen-lockfile
       - run: npm run check
```

```diff
--- a/package.json
+++ b/package.json
@@
   "private": true,
+  "packageManager": "pnpm@11.0.9",
```

- [x] **CODE-1.13 [FIX-1.13] — Chronological collection files.**

```text
src/observability/run-history-store.ts:listRuns
src/observability/checkpoint-store.ts:listMissions
  Remove enumeration-order early breaks.
  For each valid summary, maintain a bounded newest-first top-N collection
  keyed by updatedAt with a stable ID tie-breaker; slice only after selection.
  Keep current response caps. Add shuffled-enumeration tests beyond both caps.
  Do not change JSON files or introduce a storage service for this fix.
```

## Commands

- [x] **CHECK-1.1 — Executed source gates, no emitted build files.** Both TypeScript commands exited 0, ESLint exited 0, and `git diff --check` passed. The audit host uses Node `v22.23.2`, which satisfies `package.json`; CI targets Node 24 via `.nvmrc`.

```bash
./node_modules/.bin/tsc --noEmit --incremental false --composite false -p tsconfig.node.json
./node_modules/.bin/tsc --noEmit --incremental false --composite false -p tsconfig.web.json
npm run lint
git diff --check
```

- [x] **CHECK-1.2 — Executed full unit suite and recorded failure honestly.** Command exited 1: **47 files passed / 3 failed; 535 tests passed / 9 failed, 544 total; 7 uncaught errors**. Seven failed runtime tests waited for approval/final verification while real AT-SPI attempted D-Bus access; the other failures were background-process detection in `local-shell.test.ts` and `eval-tasks.test.ts`. The latter two require validation in an allowed Linux process namespace; this audit does not assign a product root cause from the failed process probes.

```bash
npm run test:unit -- --no-cache
```

- [x] **CHECK-1.3 — Executed isolated source probes without real API/desktop access.** Inline Node/TypeScript-transpilation harnesses loaded the actual source. Controller dependencies, credential backend/file I/O, and history file I/O were mocked where needed. Results: shell denylist bypasses accepted without execution; fallback dummy key independently recovered; typed-text readback skipped on unrelated valid PNG change; screenshot inclusion `[true,false]`; shell/2000-step history round-trips returned null; delayed older save replaced newer state; journal canary retained; flagged action auto-dispatched; one-step failed-input run dispatched twice. No real credentials were loaded and no paid model request or native input was issued.
- [ ] **CHECK-1.4 — Reproduce the pure-policy and journal canary probes.** These exact commands only validate strings / in-memory objects. The TypeScript hook emits into memory.

```bash
node <<'NODE'
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
Module._extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(
  fs.readFileSync(f, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText, f);
const { validateShellCommand } = require('./src/policy/shell-validation.ts');
for (const command of ['sudo true', 'bash -c "sudo true"', 'printf ok\nsudo true']) {
  try { validateShellCommand(command); console.log({ command, accepted: true }); }
  catch { console.log({ command, accepted: false }); }
}
const { createJournalEvent } = require('./src/shared/contracts/journal.ts');
console.log(createJournalEvent({
  missionId: 'audit', runId: 'audit', stage: 'intent', outcome: 'success',
  summary: 'Sensitive AUDIT_CANARY',
}).summary);
NODE
```

- [ ] **CHECK-1.5 — Focused validation after implementing the relevant fixes.** Add the regression cases defined under each FIX to the existing files; keep host D-Bus/desktop/model access mocked. These commands are planned validation, not claims that a patch already passed.

```bash
npm run test:unit -- --no-cache src/policy/shell-validation.test.ts src/main/config/secure-store.test.ts src/providers/meta/meta-computer-model.test.ts src/agent/task-controller.test.ts
npm run test:unit -- --no-cache src/desktop/linux/atspi-reader.test.ts src/desktop/linux/ubuntu-desktop.test.ts src/desktop/linux/xdotool.test.ts src/main/runtime/create-task-runtime.test.ts
npm run test:unit -- --no-cache src/observability/run-history-store.test.ts src/observability/checkpoint-store.test.ts src/observability/skill-store.test.ts src/observability/memory-store.test.ts src/observability/journal.test.ts
```

- [ ] **CHECK-1.6 — Clean CI/install/package gate after remediation.** Run on a clean Node 24 checkout after applying FIX-1.12. The initial audit did not generate build/package artifacts. The subsequent implementation ran the full source check and build; installer packaging and an actual clean Node 24 runner remain unverified. A successful build does not prove native control, Stop, or keyring behavior.

```bash
npm install --global pnpm@11.0.9
pnpm install --frozen-lockfile
npm run check
git diff --exit-code -- pnpm-lock.yaml
npm run package:linux
```

- [ ] **CHECK-1.7 — Targeted process-environment diagnosis.** Run the two process-sensitive suites in a permitted Linux namespace before deciding whether to change their implementation. Do not widen permissions or kill user applications merely to make the audit green.

```bash
npm run test:unit -- --no-cache src/desktop/linux/local-shell.test.ts src/main/eval/eval-tasks.test.ts
```

## Quality Assurance Task Checklist

- [x] **QA-1.1 — Evidence discipline.** Each finding cites current source/control flow, observed test output, or a dummy-data source probe. Native misdelivery, actual breaches, production load, and dependency CVEs are not asserted without evidence.
- [x] **QA-1.2 — Minimal remediation scope.** Each FIX maps to its same-number finding with change, rollback, and validation. No server/database rewrite, preemptive scaling layer, or unrelated UI redesign is proposed.
- [x] **QA-1.3 — Preserve sound components.** Verified items are listed separately with bounded claims. No replacement of working IPC identity, renderer isolation, parser status validation, or fixed-executable/stdin input handling is proposed.
- [x] **QA-1.4 — Security coverage mapped.** Authentication/credential handling: 1.2 and existing Meta auth handling. Authorization/capabilities/safety: 1.1/1.5/1.10. Input/action budgets: 1.5/1.11 and existing validators. Encryption/retention: 1.2/1.9. Public REST RBAC/rate limiting is N/A, not silently skipped. HTTPS configured; TLS version and external retention remain unverified.
- [x] **QA-1.5 — Performance honesty.** No performance optimization is justified by fabricated profiling. FINDING-1.4 corrects missing model context; FINDING-1.13 corrects result selection. Concurrency testing targets demonstrated storage races. Actual profiling remains PERF-1.1.
- [x] **QA-1.6 — Validation accounting.** The initial TypeScript/lint checks were green and the initial test suite was red with counts above; the later complete check now passes with the updated record below. The later source check is green as recorded below. A synthetic local profile backup/restore regression was added and passed. Native/package, actual clean CI, live API, keyring recovery, and performance checks remain unverified.
- [ ] **QA-1.7 — Deployment/rollback acceptance pending.** Complete clean CI and supported-VM package/rollback checks in OPS-1.1. Zero-downtime server rollout is N/A; preserve previous executables and data compatibility.
- [ ] **QA-1.8 — Disaster recovery acceptance pending.** Execute OPS-1.2; a plan or unit-store fixture is not a tested backup/restore procedure.
- [x] **QA-1.9 — Audit and implementation authorization.** The initial audit was TODO-only. The later explicit fix request authorized the implementation recorded below. The historical docs TODO was preserved; source/test/config/documentation changes are now applied, and all numbered source FIX/CODE tasks are implemented.


## Implementation Record — 2026-11-03

- [x] **IMPLEMENT-1.1 [FIX-1.1] — Capability boundaries.** Host shell and AT-SPI default off in application and eval. Provider tools/instructions reflect enabled main-process flags. Every enabled host command requires review, including autonomous mode, and bash receives an environment allowlist excluding provider keys/startup hooks. Settings and `.env.example` disclose capabilities. Eval stops on a required approval instead of granting it automatically.
- [x] **IMPLEMENT-1.2 [FIX-1.2] — Protected credentials.** Removed hostname/username-derived fallback encryption. Native absence/basic_text/encryption failure refuses remembering; session-only usage remains. Weak legacy files are not loaded or deleted automatically. Protected replacement is verified and atomically written; deletion/save operations are serialized. Tests use dummy keys and cover legacy preservation, protected replacement, unavailable backend, and encryption failure.
- [x] **IMPLEMENT-1.3 [FIX-1.3] — Typed verification.** Every type goes through OCR/model readback. Ambient changes cannot bypass checking. Encoded-image comparisons are described as heuristic scores, without a fabricated perceptual percentage or window-change floor.
- [x] **IMPLEMENT-1.4 [FIX-1.4] — Visual context.** Unchanged screenshots are included on every independent visual decision. A text-only GUI proposal is discarded and re-decided with a fresh screenshot. Local grounding reuse remains. Regression coverage preserves the screenshot requirement.
- [x] **IMPLEMENT-1.5 [FIX-1.5] — Desktop fail-closed behavior.** Single-display X11 is checked at preflight/capture/execute. Capture requires the exact display ID and real foreground identity. Geometry/focus/input errors propagate. Removed ambiguous automatic capture selection. Native behavior is still pending in OPS-1.1.
- [x] **IMPLEMENT-1.6 [FIX-1.6] — AT-SPI containment.** Both D-Bus connections have error containment, partial-connection cleanup, abort-aware operations, and bounded detector cancellation. Runtime tests mock the detector; explicit connector tests cover emitted errors, root-proxy failure, hung operations, and cancellation. No uncaught D-Bus errors occur in the final suite.
- [x] **IMPLEMENT-1.7 [FIX-1.7] — History compatibility.** Persisted shell actions and 2000-step / 480-minute boundaries round-trip. Attempt counts use optional fields so old records remain readable. No data migration/deletion was performed.
- [x] **IMPLEMENT-1.8 [FIX-1.8] — Ordered persistence and close.** Added the small `FileOperations` helper with per-target ordering, unique private temp files, failed-write health, and drains. History orders read/modify/write and deletion, while runtime coalesces superseded snapshots. Window close stops dispatch and waits at most five seconds for terminal data/journals. Attachments order save/prune. Tests cover overlapping writes, deletion ordering, write failure, atomic replacement cleanup, stopped-state flush, and late work after disposal. Abrupt power-loss durability is not claimed.
- [x] **IMPLEMENT-1.9 [FIX-1.9] — Explicit retained content.** Journals contain fixed stage/outcome summaries. New default history omits agent prose and raw terminal commands/output/recovery text; user goals/replies, safe action metadata, and attachment names remain as disclosed chat history. Photos/mission/learning content stays in memory unless `GHOST_RETAIN_TASK_CONTENT=1` is explicitly enabled. Restart mission resume therefore requires that flag. Retained mission/learning data has a separate lifecycle from chat deletion. Existing legacy files are preserved as-is. Canary regressions inspect serialized output, including verification/recovery fields.
- [x] **IMPLEMENT-1.10 [FIX-1.10] — Safety review.** Pending checks retain bounded ID/code/message metadata, force exact-action review in all approval modes, and render on the approval card. Unsupported checks reject. Flagged batches review only one action and discard the remainder. Existing stale/pause/Stop approval invalidation remains. Known check structure was checked against [Meta computer-use safety guidance](https://dev.meta.ai/docs/computer-use); live provider protocol acceptance was not exercised.
- [x] **IMPLEMENT-1.11 [FIX-1.11] — Attempt accounting.** Each actual driver/shell invocation reserves one action before dispatch, including failures. Pause/recovery inside a run cannot reset the counter. A newly resumed mission is a new run with a fresh displayed allowance, as documented. Added compatibility fields in history/checkpoints and a regression proving one failed input cannot trigger a second dispatch under allowance one. Late disk/model work cannot restart preparation after Stop.
- [x] **IMPLEMENT-1.12 [FIX-1.12] — CI dependency contract.** CI pins pnpm 11.0.9 and uses the committed frozen pnpm lockfile. The package-manager field is pinned. The local frozen/offline lockfile validation passed and `pnpm-lock.yaml` is unchanged. No remote CI result or clean Node 24 installation is claimed.
- [x] **IMPLEMENT-1.13 [FIX-1.13] — True newest-first lists.** History and mission selection scan valid summaries while keeping a bounded top-N collection. Regression cases exceed the old 200-history and 50-mission enumeration ceilings and put the newest filename last.

- [x] **VALIDATION-1.1 — Complete source gate.** `npm run check` exited 0: both TypeScript targets, ESLint, **579 tests / 51 files**, production main/preload/renderer bundles, and standalone frozen preload bridges. The process-lifecycle suites ran with the required Linux process permissions; restricted sandbox probes had previously returned EPERM. No test was skipped or weakened to hide those failures.
- [x] **VALIDATION-1.2 — Lockfile and diff.** `pnpm install --frozen-lockfile --offline --ignore-scripts --lockfile-only` exited 0 using pnpm 11.0.9. `git diff --exit-code -- pnpm-lock.yaml` and `git diff --check` passed. This validates the existing local lockfile contract, not a network-fresh runner install.
- [x] **VALIDATION-1.3 — Synthetic backup/restore.** `src/observability/file-operations.test.ts` writes only synthetic temporary profiles, drains stores, copies a closed profile to backup and a fresh profile, and verifies history/phase recovery plus damaged-record rejection without any action executor. OS keyring/machine-to-machine recovery and the user's real data were not tested.
- [ ] **VALIDATION-1.4 — Remaining live acceptance.** Run OPS-1.1/OPS-1.2 and PERF-1.1 as applicable: supported X11 input/focus/scaling and Stop latency, protected native keyring behavior, installer startup/rollback, actual Node 24 CI, provider inference/retention/residency, and fixed-task timing. None of those is replaced by the source/test/build results above.

## Research Follow-up — 2026-11-03

### Context

- [x] **CONTEXT-2.1 — Purpose and scope.** Answer the user's follow-up: can this agent become more dependable, and what should improve next? Yes: seven specific remaining defects or integration gaps are evidenced below. This pass changes only this TODO. The earlier thirteen remedies remain applied; these findings refine their coverage rather than undoing that work. All new FIX-2 tasks are proposals, not applied source changes.
- [x] **CONTEXT-2.2 — Evidence standard.** Re-read the current working tree, checked primary provider/OS/library documentation, and ran isolated probes against the actual TypeScript modules. Filesystem writes, subprocess launches, desktop input, D-Bus, and provider responses were mocked in the probes. All seven probes exited successfully and reproduced the stated behavior. Existing focused tests also passed: **199 tests in five files**. No real screenshot, credential, paid API call, office process, or user document was used.
- [x] **CONTEXT-2.3 — Product boundary.** Keep the current Electron/TypeScript architecture, one controlled Ubuntu X11 display, and screen-driven application interaction. Direct shell, accessibility, and content retention remain opt-in. The current action prompt explicitly limits work to local desktop apps; earlier browser-centric product ideas are not grounds to expand that scope. Prioritize correctness of the current workflows.
- [ ] **CONTEXT-2.4 — Outcome still to measure.** No native task-success baseline, failure distribution, per-stage latency profile, or live recovery drill was collected in this follow-up. The earlier 579-test full source gate is the previous implementation result; the 199-test focused gate is the result refreshed now. Neither proves autonomous task completion.

### Audit Findings

- [ ] **FINDING-2.1 [High] [Batch execution and window focus]**:
  - **Issue / evidence:** [task-controller.ts](src/agent/task-controller.ts#L577) sends every action in a batch the same original observation. [xdotool.ts](src/desktop/linux/xdotool.ts#L90) unconditionally activates that observation's window before typing/keypresses. The source probe simulated a click changing focus from window 100 to window 200; the following type was delivered to window **100**. No native input was performed. Existing tests exercise isolated commands, not this transition.
  - **Risk:** A valid click-then-type batch can put text into the previous application, or direct a confirmation key at an obsolete dialog. Matching desktop dimensions and a frame younger than 30 seconds do not establish that later targets are still valid.
  - **Proposed Fix:** Start with one desktop action per fresh observation and reject changed foreground identity before focus-sensitive input. Do not restore an obsolete focus target automatically. Reintroduce narrowly justified batching only after transition tests establish its preconditions. The provider also requires stopping batches when intervening state invalidates later actions. [Meta computer-use guide](https://dev.meta.ai/docs/computer-use), [xdotool window commands](https://github.com/jordansissel/xdotool/blob/main/xdotool.pod)

- [ ] **FINDING-2.2 [High] [Typed-content verification]**:
  - **Issue / evidence:** [task-controller.ts](src/agent/task-controller.ts#L1549) checks case-folded substrings across the entire OCR output. The actual helper returned true for expected **100** when the mocked screen text was **Unrelated invoice total 1000; target field is empty**. This bypasses the model judge and supplies verified success. Separately, [meta-computer-model.ts](src/providers/meta/meta-computer-model.ts#L68) tells the judge to ignore decimal differences and asks only whether text is anywhere on screen. Decimal-loss model behavior was not live-tested.
  - **Risk:** A value in another field, an existing row, or a longer number can confirm a failed entry. Numeric magnitude, letter case, and cell location may matter to the task. [markFillChunk](src/agent/task-controller.ts#L533) then estimates completed rows from tab counts, so a false positive can advance progress.
  - **Proposed Fix:** Treat whole-screen OCR as a hint, not authority to commit row progress. Supply a target-aware judge with the action, expected exact content, and before/after context; treat ambiguous placement as unverified. Match complete values and preserve decimal/sign semantics; apply case/locale normalization only under an explicit field rule. Keep per-cell/row expectations when committing fill progress. This is stronger verification, not a guarantee that a model judge cannot err.

- [ ] **FINDING-2.3 [Medium] [Temporary screenshot privacy]**:
  - **Issue / evidence:** [tesseract-ocr.ts](src/desktop/linux/tesseract-ocr.ts#L20) writes a raw screenshot into the shared temporary directory without permission options. The mocked write received no options; this process has umask 0002, so Node's default new-file mode would yield **0664**. The derived mode was not measured on an actual screenshot file. Node documents a default write mode of 0666. [Node file-write documentation](https://nodejs.org/api/fs.html#fspromiseswritefilefile-data-options)
  - **Risk:** On a shared Linux host, another account may read screenshot bytes while OCR runs, subject to directory/ACL restrictions. Normal finally cleanup does not prevent that exposure, and a crash can leave the file behind. The retention flag does not govern this temporary path.
  - **Proposed Fix:** Create an application-owned private temporary directory and an exclusive 0600 file; include writing inside cleanup scope. Delete only the directory created by this operation. Preserve abort/timeout behavior. Do not claim cleanup after an abrupt process kill; residual files must remain private.

- [ ] **FINDING-2.4 [Medium] [Evaluation scores can certify incomplete work]**:
  - **Issue / evidence:** [eval-tasks.ts](src/main/eval/eval-tasks.ts#L66) passes unreadable office files larger than 2000 bytes. T2 checks only the title, and T5 checks only a SUM substring. Mocked filesystem/ZIP-entry probes passed all three counterexamples: unreadable 2001-byte content, a Writer document lacking the required second line, and Calc content with SUM text but no cells or formula. T4 also matches a generic size rather than comparing the source filesystem size. [eval-runner.ts](src/main/eval/eval-runner.ts#L172) reports artifact verdict as success independently of timeout or handoff.
  - **Risk:** A high score can reflect weak acceptance checks, obscuring the failures that should guide model/prompt changes. Artifact correctness and unattended completion are useful but different metrics.
  - **Proposed Fix:** Fail closed or report an explicit unsupported verdict when inspection is unavailable. Verify all stated task requirements: Writer content/order, Calc cells/formula/result, source-to-report agreement, and file content preservation. Report artifactPass, autonomousPass, timedOut, and interventions separately; retain the original status. Use execution-based evaluation as a method, without claiming an OSWorld score. [OSWorld primary benchmark description](https://osworld-v1.xlang.ai/)

- [ ] **FINDING-2.5 [High] [Evaluation process ownership]**:
  - **Issue / evidence:** [eval-runner.ts](src/main/eval/eval-runner.ts#L81) invokes clearStaleOffice before every task. [eval-tasks.ts](src/main/eval/eval-tasks.ts#L45) defaults to a command-line pattern matching all soffice.bin processes accessible to the user. The subprocess mock recorded **pkill -f soffice.bin** with no run/profile ownership filter. No process was actually terminated.
  - **Risk:** Running eval in a desktop containing unrelated LibreOffice work can close that work, including unsaved documents. The synthetic filename workspace does not isolate processes.
  - **Proposed Fix:** Remove blanket cleanup first. Run native eval in a disposable VM/session and isolate its office profile. Stop only processes whose handles and identity the harness owns; if ownership is unavailable, report a blocked fixture or reset the disposable environment. Never infer ownership from an executable-name match.

- [ ] **FINDING-2.6 [Medium] [Optional AT-SPI wire contract]**:
  - **Issue / evidence:** [atspi-reader.ts](src/desktop/linux/atspi-reader.ts#L130) invokes GetName and GetChildCount as methods. The upstream Accessible interface defines Name and ChildCount as properties. A spec-shaped mock with one child returned **zero elements**, made zero property reads, and never visited the child. Lifecycle tests still pass because their successful tree fixtures bypass this wire adapter. [GNOME Accessible interface](https://raw.githubusercontent.com/GNOME/at-spi2-core/main/xml/Accessible.xml)
  - **Risk:** Enabling accessibility can produce an apparently empty grounding tree even when the service is healthy. Default screenshot operation is unaffected because accessibility remains off.
  - **Proposed Fix:** Read these properties through org.freedesktop.DBus.Properties.Get, validate/unwrap the returned Variant, and retain the existing abort/error containment. Add a successful wire-level fixture rather than only injecting already-wrapped nodes. [D-Bus properties specification](https://dbus.freedesktop.org/doc/dbus-specification.html#standard-interfaces-properties)

- [ ] **FINDING-2.7 [Medium] [Native provider round-trip contract]**:
  - **Issue / evidence:** [parse-response.ts](src/providers/meta/parse-response.ts#L124) drops the computer call identity and replay receipt. [meta-computer-model.ts](src/providers/meta/meta-computer-model.ts#L103) builds each decision as a new user-message request; [meta-request.ts](src/providers/meta/meta-request.ts#L37) forces store false. A two-request mock retained one local safety check but no call ID; request two contained only a user item, no computer-call output or acknowledgement. Meta documents matched call/output continuation and receipt preservation for stateless replay. [Meta response schemas](https://dev.meta.ai/docs/api-reference/responses/schemas)
  - **Risk:** Local approval is implemented, but the native continuation/acknowledgement contract is not. Independent decisions may still work; this evidence does **not** prove a provider rejection, a local approval bypass, or a measured drop in task success.
  - **Proposed Fix:** Make continuation an explicit provider-adapter responsibility, preserve the bounded wire identity, and send only actually reviewed checks on the matching result. Keep replay data in memory and preserve store false by default. Exercise the documented continuation limit and stop safely rather than silently dropping safety history. Compare against the current mode using controlled native tasks before switching defaults. [Meta state-management guidance](https://dev.meta.ai/docs/computer-use#manage-conversation-state)

### Verified OK (No Action)

- [x] **OK-2.1 — Architecture and supported surface.** One Electron main process with typed ports remains appropriate. There is no hosted service/database load evidence for Redis, microservices, API gateways, PM2, or sharding. Keep the single-display X11 boundary and existing display-geometry checks.
- [x] **OK-2.2 — IPC and renderer boundaries.** Re-read owning-WebContents/main-frame/URL validation and sandbox/context-isolation settings. The focused IPC suite passed. Retain these controls; this is not a fresh penetration test or packaged-runtime certification.
- [x] **OK-2.3 — Existing transport and lifecycle safeguards.** Fixed HTTPS endpoint, redirect rejection, bounded response size, request timeouts/retries, cancellation, failed/incomplete-output rejection, and explicit local safety review remain useful. These are distinct from FINDING-2.7. No demonstrated need for a separate circuit-breaker service.
- [x] **OK-2.4 — Earlier source hardening stays in place.** Protected credential storage, ordered private durable writes, attempt counting, default-off optional capabilities, content-retention controls, and bounded shutdown are not being redesigned. FINDING-2.3 concerns the separate OCR temporary file, not the already-protected durable stores.
- [x] **OK-2.5 — Focused automated baseline.** Controller, xdotool, AT-SPI, Meta adapter, and task IPC: 199 tests passed in five files in 7.19 seconds. That duration measures the test suite only. The new probes expose missing behavioral coverage; they do not invalidate passing tests of unrelated guarantees.

### Remediation Plan

- [ ] **FIX-2.1 [Batch/focus] — Finding 2.1; first tranche.**
  - **Change:** Admit one GUI action for each observation initially. Check current foreground identity before typing/keypress dispatch; a mismatch invalidates the action and requests a fresh decision. Preserve correct accounting for the executed prefix and skipped remainder.
  - **Rollback:** Retain single-action mode and fail-closed focus checks if optimization causes regression. Do not restore stale-window activation.
  - **Validation:** Mock window 100 → click → 200; no later input goes to 100. Add same-window field changes, dialog opening, unexpected focus, stale approval, Stop, and partial-failure cases. Confirm behavior in the supported VM before claiming native correctness.

- [ ] **FIX-2.2 [Verification] — Finding 2.2; second tranche after the input regression is covered.**
  - **Change:** Remove whole-screen substring auto-success; pass destination/action context to the readback judge, require complete values, and commit fill rows only when their expected cells are supported by evidence. Unknown placement hands off or stays unverified.
  - **Rollback:** Keep uncertain entries unverified and require user confirmation. Preserve existing records and never replay a saved entry automatically.
  - **Validation:** Negative fixtures: 100 versus 1000, 1.00 versus 100, signs, case-sensitive identifiers, expected text already elsewhere, wrong field, duplicate rows, and partial bulk entry. Positive fixtures cover exact text in the intended destination. A completed row count must not advance from tab count alone.

- [ ] **FIX-2.3 [OCR temporary data] — Finding 2.3; first tranche.**
  - **Change:** Private per-operation directory, exclusive 0600 image creation, and finally cleanup covering write/recognition failures. Preserve local OCR's existing timeout and fallback behavior.
  - **Rollback:** Disable local OCR and use the existing model readback path until private temporary handling passes. Do not restore permissive screenshot writes.
  - **Validation:** Synthetic image only: directory has no group/other access; file has no group/other access under umask 0002 and 0022. Verify abort, write failure, OCR failure, and cleanup paths. Test that cleanup cannot delete a pre-existing path.

- [ ] **FIX-2.4 [Evaluation validity] — Finding 2.4; second tranche.**
  - **Change:** Use bounded structured inspection of office artifacts, fully assert each goal, and separate artifact correctness from autonomous completion. Make missing inspection capability explicit. Cover file contents as well as names/counts.
  - **Rollback:** Mark affected tasks unsupported; do not publish their scores as successes. Keep old scorecards with their original schema/meaning and label the new acceptance version.
  - **Validation:** Every reproduced false pass becomes a failing counterexample. Correct Writer/Calc/report fixtures pass. A timeout or required intervention never counts as unattended success, even if an artifact exists. Update the existing weak fixtures instead of adding exceptions for them.

- [ ] **FIX-2.5 [Eval isolation] — Finding 2.5; first tranche, before any real eval.**
  - **Change:** Remove the default broad process kill. Require an isolated eval environment and unique office profile; cleanup uses owned process identity only, or the harness reports an unresolved fixture.
  - **Rollback:** Disable cleanup/eval when isolation cannot be established. Leave unrelated processes untouched.
  - **Validation:** Use two synthetic process identities, one owned and one unrelated. Only the owned identity may be stopped. Check PID reuse/identity mismatch, unknown ownership, and missing cleanup permission. Do not use actual user office sessions for the test.

- [ ] **FIX-2.6 [AT-SPI contract] — Finding 2.6; optional-capability tranche.**
  - **Change:** Implement bounded property reads and Variant validation at the existing adapter seam. Keep the default flag off and existing caps/deadlines.
  - **Rollback:** Disable AT-SPI; use the current screenshot path.
  - **Validation:** Spec-shaped proxy tests return the real child and label; wrong Variant types reject safely; no bus leaks on error/timeout. Later confirm one known control in a real GTK/LibreOffice window. Do not claim broad grounding accuracy from one control.

- [ ] **FIX-2.7 [Provider continuation] — Finding 2.7; separate integration tranche.**
  - **Change:** Carry validated call IDs, replay receipts, matching results, and explicit safety acknowledgements through the provider adapter. Define abort, partial batch, rejected review, and phase-boundary behavior before enabling continuation. Bound in-memory history; do not enable server storage implicitly.
  - **Rollback:** Gate off the new continuation mode. Block a continuation that cannot be represented safely; never silently acknowledge or discard a pending safety decision.
  - **Validation:** Captured request fixtures preserve call/output pairing and opaque receipts, acknowledge only the exact approved action/check set, and exclude discarded batch actions. Check expiry/unsupported-history failures and Stop. A live provider acceptance run remains necessary; no success-rate improvement is promised in advance.

- [ ] **PLAN-2.1 — Recommended execution order.** First apply FIX-2.1, FIX-2.3, and FIX-2.5: correct input ownership and remove local data/process exposure. Next apply FIX-2.2 and FIX-2.4 so completed work and benchmark scores are trustworthy. Handle FIX-2.7 separately; FIX-2.6 matters only when the optional capability is wanted. Keep each tranche independently reviewable.
- [ ] **PERF-2.1 — Measure after truthful verification.** Extend the existing PERF-1.1 task with a fixed version of the six local eval tasks, identical VM snapshots, model/configuration, and budgets. After FIX-2.4/2.5, propose five repeats per task; report individual failures, artifactPass, autonomousPass, interventions, elapsed time, attempted/executed actions, and tokens. With only 30 runs, report medians/ranges and raw per-task results; do not present a precise p95 or universal success claim.
- [ ] **PERF-2.2 — Optimize only measured costs.** Use existing correlated journals first; add missing stage measurements for capture, OCR, provider attempts, and persistence only where needed to explain the baseline. Examine model selection, observation size, and safe batching after the profile identifies the dominant cost. Do not claim a speedup, replace the model by reputation, or introduce caching while correctness is still failing.
- [ ] **OPS-2.1 — Native acceptance gate.** Reuse OPS-1.1 and VALIDATION-1.4 for packaged X11 input/focus, emergency Stop, keyring, restart, and installer rollback. For a proposed controlled-demo gate, require every deterministic negative regression to pass, no wrong-window input in the adversarial fixture set, and no unreported failed artifact. The acceptable task-success percentage and Stop-latency threshold still need a measured baseline and product requirement.
- [ ] **OPS-2.2 — Preserve data and rollback scope.** No database schema change is required. Use a closed-profile backup and disposable restore before testing any new history/scorecard schema. The earlier synthetic restore passes; actual packaged-profile/keyring recovery is still unverified. Keep previous executable and additive readers; do not erase older data to simplify a migration.

### Proposed Code Changes

These are implementation boundaries and illustrative patches for FIX-2 tasks, not changes applied by this research pass.

- [ ] **CODE-2.1 [FIX-2.1] — Input observation boundary.**
```text
src/agent/task-controller.ts
  Select only the first proposed GUI action for the initial safe path.
  Preserve remaining actions as discarded proposals, never as executed work.
  A fresh captured frame and decision must precede the next dispatch.
src/desktop/linux/xdotool.ts
  Before type/keypress, compare getactivewindow with the observed identity.
  Reject a mismatch instead of calling windowactivate on stale identity.
  Keep geometry checks and fixed-executable/stdin invocation.
src/agent/task-controller.test.ts, src/desktop/linux/xdotool.test.ts
  Add the window-switch batch regression and same-window/dialog cases.
```

- [ ] **CODE-2.2 [FIX-2.2] — Verification contract and row progress.**

```text
src/agent/ports.ts
  Extend typed verification input with expected destination/action context
  and the prior observation when available. Unknown target is explicit.
src/agent/task-controller.ts
  OCR presence must not directly create confirmed=true.
  Correlate accepted row progress with expected fill units and destinations.
  Ambiguous evidence must not advance fillDone.
src/providers/meta/meta-computer-model.ts
  Ask for exact values at the intended destination, with uncertainty explicit.
  Remove blanket permission to ignore decimals and meaningful letter case.
src/agent/task-controller.test.ts, src/providers/meta/meta-computer-model.test.ts
  Cover the numeric, wrong-location, and partial-row counterexamples.
```

- [ ] **CODE-2.3 [FIX-2.3] — Complete temporary-file replacement block.** In TesseractOcr.readText, replace the existing file creation/write/cleanup block; keep payload validation and recognize unchanged. Add mkdtemp, rm, and chmod imports from node:fs/promises; remove unused randomUUID/unlink imports.

```ts
const directory = await mkdtemp(join(tmpdir(), 'ghost-ocr-'));
try {
  await chmod(directory, 0o700);
  const file = join(directory, 'screen.png');
  await writeFile(file, Buffer.from(payload.replace(/\s/g, ''), 'base64'), {
    flag: 'wx',
    mode: 0o600,
    signal,
  });
  signal.throwIfAborted();
  return await this.recognize(file, signal);
} finally {
  await rm(directory, { recursive: true, force: true }).catch(() => undefined);
}
```

- [ ] **CODE-2.4 [FIX-2.4] — Evaluation acceptance boundaries.**

```text
src/main/eval/eval-tasks.ts
  Replace size-only fallback with an unsupported/failed verdict.
  Parse bounded ODF content into paragraphs and addressed table cells;
  disable external entities/network resolution in any XML parser.
  Add an inspection helper returning exact text/cell/formula/value data.
  Assert T2's ordered title/body; T5's A1=10, A2=20, A3=30,
  A4's SUM range and computed 60; compare T4 with its df source.
  Validate T3/T6 moved file bytes and complete manifest entries.
src/main/eval/eval-runner.ts
  Preserve artifactPass; derive autonomousPass from a complete terminal
  run, no timeout, no required human intervention, and artifactPass.
  Label changed score semantics with an acceptance version.
src/main/eval/eval-tasks.test.ts
  Replace title-only/formula-substring passing fixtures with valid documents.
  Add incomplete and unreadable artifacts as negative fixtures.
```

- [ ] **CODE-2.5 [FIX-2.5] — Minimal unsafe-cleanup removal first.**

```diff
--- a/src/main/eval/eval-runner.ts
+++ b/src/main/eval/eval-runner.ts
@@
-import { EVAL_TASKS, clearStaleOffice, type EvalTask } from './eval-tasks';
+import { EVAL_TASKS, type EvalTask } from './eval-tasks';
@@
-    clearStaleOffice();
     task.setup(ctx.root);
```

  Remove the now-unneeded broad helper/test from eval-tasks after checking all callers. Follow-up owned cleanup must track process handle plus identity/profile; no executable-name or PID-only fallback. If the harness cannot own the launch, use disposable-environment reset instead.

- [ ] **CODE-2.6 [FIX-2.6] — Property helper inside wrapNode.** Retain all other node methods and managed-bus wrappers.

```ts
const readProperty = async (name: string, signature: 's' | 'i') => {
  const raw = await call(
    'org.freedesktop.DBus.Properties', 'Get',
    'org.a11y.atspi.Accessible', name,
  );
  if (!raw || typeof raw !== 'object') throw new Error('Invalid AT-SPI property.');
  const variant = raw as { signature?: unknown; value?: unknown };
  if (variant.signature !== signature ||
      (signature === 's' ? typeof variant.value !== 'string'
        : typeof variant.value !== 'number' || !Number.isSafeInteger(variant.value))) {
    throw new Error('Invalid AT-SPI property.');
  }
  return variant.value;
};
// In the returned node:
name: () => readProperty('Name', 's'),
childCount: () => readProperty('ChildCount', 'i'),
```

- [ ] **CODE-2.7 [FIX-2.7] — Native conversation ownership.**

```text
src/agent/ports.ts, src/providers/meta/parse-response.ts
  Add bounded provider-call metadata separate from displayed action text.
  Validate call identity; retain any replay receipt without alteration.
src/providers/meta/meta-computer-model.ts
  Own request/output pairing in a per-run adapter session.
  Expose a result/approval feedback method; send the matched result only once.
  Bound full in-memory replay; fail safely at an unsupported limit.
src/agent/task-controller.ts
  Report what actually executed and which exact checks were approved.
  Do not label discarded or partly executed batches as fully completed.
src/main/runtime/create-task-runtime.ts, src/main/eval/eval-runner.ts
  Keep one provider session per run, clear it on termination, and prevent
  session state leaking across runs. Existing per-call construction must
  be adjusted before adding adapter-local conversation state.
src/providers/meta/meta-computer-model.test.ts
  Assert two-turn request structure, approvals, limits, and cancellation.
```

### Commands

- [x] **CHECK-2.1 — Focused source tests executed.** Exit 0: 199 tests / five files. This command does not run paid inference or native eval.

```bash
npm run test:unit -- --no-cache src/agent/task-controller.test.ts src/desktop/linux/xdotool.test.ts src/desktop/linux/atspi-reader.test.ts src/providers/meta/meta-computer-model.test.ts src/main/ipc/register-task-ipc.test.ts
```

- [x] **CHECK-2.2 — Reproducible in-memory source probes executed.** The following exact command loads actual source, replaces external boundaries, asserts the defects, and writes no test files. It is a pre-remediation reproducer: assertions are expected to change after the corresponding fix. No screenshot files or real office processes are used.

```bash
node <<'NODE'
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
Module._extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, f);

const originalLoad = Module._load;
const files = new Map();
const processCalls = [];
const inputCalls = [];
let activeWindow = '100';
let typedInto = null;
let tempOptions = null;
let removedTemp = false;
let propertyReads = 0;
let childrenRead = 0;
const rootProxy = {
  getInterface: name => name === 'org.freedesktop.DBus.Properties'
    ? { Get: async (_iface, property) => { propertyReads++; return { value: property === 'ChildCount' ? 1 : 'Root' }; } }
    : { GetRoleName: async () => 'desktop frame',
        GetChildAtIndex: async () => { childrenRead++; return [':1.7', '/child']; } }
};
const bus = () => Object.assign(new EventEmitter(), { disconnect() {}, getProxyObject: async () => rootProxy });
let busNumber = 0;
Module._load = function(name, parent, isMain) {
  const p = parent?.filename ?? '';
  if (name === 'node:fs' && p.endsWith('/eval-tasks.ts')) return {
    ...fs, existsSync: path => files.has(path),
    statSync: path => ({ size: Buffer.byteLength(files.get(path) ?? '') }),
    readFileSync: path => files.get(path)
  };
  if (name === 'node:child_process' && p.endsWith('/eval-tasks.ts')) return {
    execFileSync: (file, args) => { processCalls.push([file, ...args]); return Buffer.from(''); }
  };
  if (name === 'node:child_process' && p.endsWith('/xdotool.ts')) return {
    spawn: (_file, args) => {
      inputCalls.push(args);
      const child = Object.assign(new EventEmitter(), {
        stdout: new PassThrough(), stdin: new PassThrough(), kill() {}
      });
      child.stdin.on('data', () => { typedInto = activeWindow; });
      queueMicrotask(() => {
        if (args[0] === 'getdisplaygeometry') child.stdout.write('1920 1080');
        if (args[0] === 'mousemove') activeWindow = '200';
        if (args[0] === 'windowactivate') activeWindow = args[2];
        if (args[0] === 'getactivewindow') child.stdout.write(activeWindow);
        child.emit('close', 0);
      });
      return child;
    }
  };
  if (name === 'node:fs/promises' && p.endsWith('/tesseract-ocr.ts')) return {
    writeFile: async (_path, _data, options) => { tempOptions = options ?? null; },
    unlink: async () => { removedTemp = true; }
  };
  if (name === 'dbus-next' && p.endsWith('/atspi-reader.ts')) return {
    sessionBus: () => {
      if (++busNumber === 1) return Object.assign(new EventEmitter(), {
        disconnect() {}, getProxyObject: async () => ({
          getInterface: () => ({ GetAddress: async () => 'mock-bus-address' })
        })
      });
      return bus();
    }
  };
  return originalLoad.apply(this, arguments);
};

(async () => {
  const { executeX11Command } = require('./src/desktop/linux/xdotool.ts');
  const frame = { image: 'mock', width: 1920, height: 1080, desktopWidth: 1920, desktopHeight: 1080, activeWindowId: '100', capturedAt: Date.now() };
  const signal = new AbortController().signal;
  await executeX11Command({ type: 'click', x: 400, y: 300, button: 'left' }, frame, signal);
  const afterClick = activeWindow;
  await executeX11Command({ type: 'type', text: 'AUDIT_ONLY' }, frame, signal);
  assert.equal(afterClick, '200'); assert.equal(typedInto, '100');
  console.log(JSON.stringify({ probe: 'batch-focus', afterClick, typedInto, realInput: false }));

  const { TaskController } = require('./src/agent/task-controller.ts');
  const target = Object.create(TaskController.prototype);
  target.dependencies = { ocr: { readText: async () => 'Unrelated invoice total 1000; target field is empty' } };
  const ocrFalsePositive = await target.ocrContains(frame, '100', signal);
  assert.equal(ocrFalsePositive, true);
  console.log(JSON.stringify({ probe: 'ocr-substring', expected: '100', seen: 'Unrelated invoice total 1000; target field is empty', accepted: ocrFalsePositive }));

  const { TesseractOcr } = require('./src/desktop/linux/tesseract-ocr.ts');
  const ocr = new TesseractOcr();
  ocr.recognize = async () => 'synthetic';
  await ocr.readText('data:image/png;base64,aGk=', signal);
  console.log(JSON.stringify({ probe: 'ocr-temp-options', options: tempOptions, processUmask: process.umask().toString(8),
    derivedDefaultMode: (0o666 & ~process.umask()).toString(8), cleanupInvoked: removedTemp, realFiles: false }));

  const { EVAL_TASKS, clearStaleOffice } = require('./src/main/eval/eval-tasks.ts');
  const root = '/mock';
  files.set(root + '/t2/note.odt', 'X'.repeat(2001));
  files.set(root + '/t5/sum.ods', 'fake');
  const unreadable = EVAL_TASKS[1].verify(root, { readOdtEntry: () => null });
  const incompleteWriter = EVAL_TASKS[1].verify(root, { readOdtEntry: (_file, entry) =>
    entry === 'content.xml' ? '<text:p>Eval Note</text:p>' : 'application/vnd.oasis.opendocument.text' });
  const invalidCalc = EVAL_TASKS[4].verify(root, { readOdtEntry: (_file, entry) =>
    entry === 'content.xml' ? '<text:p>SUM(</text:p>' : 'application/vnd.oasis.opendocument.spreadsheet' });
  assert.equal(unreadable.pass, true); assert.equal(incompleteWriter.pass, true); assert.equal(invalidCalc.pass, true);
  console.log(JSON.stringify({ probe: 'eval-false-passes', unreadable: unreadable.pass,
    writerMissingSecondLine: incompleteWriter.pass, calcWithoutCellsOrFormula: invalidCalc.pass, realFiles: false }));
  clearStaleOffice();
  assert.deepEqual(processCalls, [['pkill', '-f', 'soffice.bin']]);
  console.log(JSON.stringify({ probe: 'eval-process-scope', commands: processCalls, executed: false }));

  const { createAtspiDetector } = require('./src/desktop/linux/atspi-reader.ts');
  const elements = await createAtspiDetector()(signal);
  assert.equal(propertyReads, 0); assert.equal(childrenRead, 0); assert.equal(elements.length, 0);
  console.log(JSON.stringify({ probe: 'atspi-property-contract', validChildCountProperty: 1,
    propertyReads, childrenRead, elements: elements.length, realDbus: false }));
})().catch(error => { console.error(error); process.exitCode = 1; });
NODE
```

- [x] **CHECK-2.3 — Native-protocol request probe executed.** Two mocked responses, no network access; confirms local checks survive while call identity/acknowledged results do not reach the next request.

```bash
node <<'NODE'
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const assert = require('node:assert/strict');
Module._extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, f);
const { MetaComputerModel } = require('./src/providers/meta/meta-computer-model.ts');
const requests = [];
const fetchStub = async (_url, init) => {
  requests.push(JSON.parse(init.body));
  return new Response(JSON.stringify({ id: 'resp_mock', status: 'completed',
    usage: { input_tokens: 1, output_tokens: 1 }, output: [{
      type: 'computer_call', id: 'cc_mock', call_id: 'call_mock',
      meta_safety_replay_receipt: 'opaque_mock_receipt', status: 'completed',
      actions: [{ type: 'wait' }], pending_safety_checks: [
        { id: 'csc_mock', code: 'sensitive_domain', message: 'Synthetic review check.' }
      ]
    }]
  }), { status: 200 });
};
(async () => {
  const model = new MetaComputerModel({ apiKey: 'DUMMY_ONLY', model: 'muse-spark-1.3' }, fetchStub);
  const input = { goal: 'Synthetic task', history: [], signal: new AbortController().signal,
    observation: { image: 'data:image/png;base64,aGk=', width: 100, height: 100,
      desktopWidth: 100, desktopHeight: 100, activeWindowId: '100', capturedAt: Date.now() } };
  const decision = await model.decide(input);
  await model.decide({ ...input, history: ['executed: wait'] });
  assert.equal(decision.pendingSafetyChecks.length, 1);
  assert.equal(JSON.stringify(decision).includes('call_mock'), false);
  assert.equal(JSON.stringify(requests[1]).includes('computer_call_output'), false);
  console.log(JSON.stringify({ probe: 'provider-round-trip',
    localSafetyChecks: decision.pendingSafetyChecks.length, retainedCallId: false,
    secondRequestStore: requests[1].store, secondRequestItems: requests[1].input.map(x => x.type ?? x.role),
    acknowledgedOutputSent: false, realNetwork: false }));
})().catch(error => { console.error(error); process.exitCode = 1; });
NODE
```

- [ ] **CHECK-2.4 — Source and CI commands after implementation.** Add the negative cases to the named existing suites, then run in the permitted Linux process namespace. The current research pass does not claim this full gate was repeated.

```bash
npm run test:unit -- --no-cache src/agent/task-controller.test.ts src/desktop/linux/xdotool.test.ts src/desktop/linux/atspi-reader.test.ts src/main/eval/eval-tasks.test.ts src/providers/meta/meta-computer-model.test.ts
npm run check
git diff --check
```

- [ ] **CHECK-2.5 — Native benchmark command after FIX-2.4 and FIX-2.5 only.** Run from the repository in an explicitly disposable supported X11 desktop with a configured test credential, budget, and synthetic data. The current evaluator must not be run on a personal desktop while broad cleanup remains. This can incur model charges and creates ordinary eval artifacts; it was not executed by this research pass.

```bash
GHOST_ENABLE_HOST_SHELL=0 GHOST_ENABLE_ACCESSIBILITY=0 GHOST_RETAIN_TASK_CONTENT=0 npm run eval
```

### Quality Assurance Task Checklist

- [x] **QA-2.1 — Evidence attached.** Each new finding has current source references and a reproducible source probe or explicit contract comparison. Native behavior and risks inferred from those observations are labelled.
- [x] **QA-2.2 — Bounded proposals.** Each FIX-2 task maps to one FINDING-2 item with rollback and validation. No unrelated infrastructure, provider switch, UI redesign, data deletion, or database migration is proposed.
- [x] **QA-2.3 — Sound controls preserved.** Revalidated scope-specific protections are listed under Verified OK, with automated/native limits kept separate.
- [x] **QA-2.4 — Security coverage is honest.** Existing credential/IPC authorization and boundary validation stay intact. New proposals address wrong-target input, local screenshot permissions, process ownership, and provider acknowledgement. No full OWASP compliance or universal sandbox claim is made.
- [x] **QA-2.5 — No speculative performance claim.** No latency improvement or cost reduction is claimed without a native profile. The benchmark plan measures correctness before optimization.
- [x] **QA-2.6 — Research-only change.** This pass appends the research/proposals to this file. It does not apply any FIX-2 source patch or create additional audit artifacts.
- [ ] **QA-2.7 — Deployment and recovery acceptance.** Native package/rollback, actual CI, permitted cloud processing, and real closed-profile/keyring restore remain external acceptance items. Server zero-downtime deployment remains N/A.

