# Tally Demo — Frozen Task Script (Phase 4)

Status: frozen 2026-10-31. Do not change the goal text or starting state without
re-running all attempts below.

## Fixed goal (paste exactly)

Change the invoice amount to 75000 and save the voucher.

## Preflight (every recording session)

- `echo $XDG_SESSION_TYPE` must print `x11` (the input driver does not work on Wayland).
- Display scaling 100%, single primary display.
- Meta API key connected in Settings; note remaining credits before starting.
- Know the emergency Stop shortcut shown in the app (Ctrl + Shift + Escape or a fallback).

## Starting state

- Fresh sim window: `npm run demo:tally` (960x640).
  Defaults: Amount `50000`, voucher `INV-2026-089`, table total `₹59,000.00`, no modal.
- Ghost Agent running: `npm run dev`, approval mode Full Autonomous, max steps 15.

## Reset between attempts

- Full reset (preferred): close the sim window, re-run `npm run demo:tally`.
- Quick reset: on the success modal click "Close / New Voucher".
  Voucher number advances (INV-2026-090, ...). Record it in the log.

## Expected agent flow

1. Intent: summary + params `{amount: 75000}`, nothing missing, no questions.
2. Observe the desktop, click the Taxable Amount field.
3. Keypress Ctrl+A, type `75000`.
4. PRISM: timeline shows "typed value confirmed on screen".
5. Click "Accept (Y/N): Save Voucher".
6. Success modal appears, model stops, you press "Goal Verified Complete".

## Completion evidence (all must hold for a pass)

- Modal "VOUCHER ACCEPTED & SAVED" visible.
- Table total reads `₹88,500.00` (75000 + 9% CGST + 9% SGST).
- Timeline shows `verified_success` with "typed value confirmed" on the type step.

## Out of scope for this demo

- Export button: its alert claims a file write that never happens. Do not click it.
- Fresh voucher creation: fields come prefilled by fixture design.
- Any other app, window layout, or goal text.

## Results log (fill EVERY attempt, pass or fail, no cherry-picking)

| # | Date/time | Voucher no. | Outcome | Duration | Interventions | Notes / evidence |
|---|-----------|-------------|---------|----------|---------------|------------------|
| 1 |           |             |         |          |               |                  |
| 2 |           |             |         |          |               |                  |
| 3 |           |             |         |          |               |                  |

## 2-minute video shot list

- 0:00-0:15 Problem: repetitive manual Tally entry. Show the sim, read the goal.
- 0:15-0:30 Paste the goal into Ghost Agent, press Execute. Point at Stop controls.
- 0:30-1:20 The run, real-time (label any speedup): Understood message, amount
  click, Ctrl+A, typing, PRISM confirmed, Save click, modal appears.
- 1:20-1:40 Evidence: modal, `₹88,500.00` total, timeline verdicts, your Confirm click.
- 1:40-2:00 Honest close: one Meta model in three roles (plan, intent, verify),
  3-attempt result, limits (X11 only, demo fixture, cloud screenshots).
