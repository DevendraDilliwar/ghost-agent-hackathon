# Initial idea - historical record

- [x] **HIST-001** Preserve the original `Readme.md` exactly below this notice. Archived on 2026-10-29.

This is historical input, not the current specification. Its model roles, privacy claims, performance numbers, universal-app claims, MCP explanation, runtime version, and submission assumptions remain subject to correction. Read [the documentation index](README.md) for the current plan.

---

GHOST AGENT - The Invisible AI That Operates Your Computer
Meta Global AI Developer Hackathon 2026 - Final Idea
Tagline: No APIs. No MCPs. No Connectors. Just Vision.

1. Problem
   Tally, Govt portals, old ERPs - No API
   MCP = 1 connector per app, impossible to scale
   Daily 3-4 hours wasted in clicks
2. Solution - GHOST AGENT
   An invisible agent that sees your screen like a human and does your work.

Loop:

SEE (SAM 3): Screenshots 10x/sec, segments every button/input/popup.
THINK (Muse Spark 1.3): Plans 12 steps, handles errors.
ACT (Glimmer): Clicks/types via nut.js (JS). On-device, private.
Why No MCP?
MCP says "Give me API". Ghost Agent says "Screen is enough". One model for ALL apps.

3. Why Judges Will Love It
   Uses SAM 3 as UI engine (not background remover)
   Pushes Frontier in Software + Build for Your World
   Meta's vision: Personal superintelligence for everyone
   Not banned category
4. Tech Stack - 100% JS/TS (For Full Stack Dev)
   User is JS/TS Dev - No Python

Runtime: Node 20 + TypeScript
Desktop: Electron + React + Vite + Tailwind (overlay with colored boxes)
Automation: @nut-tree/nut-js - screenshot, mouse, keyboard in JS
AI: Meta Model API via fetch
SAM 3 API -> UI segmentation
Muse Spark 1.3 -> Planning
Glimmer -> Fast execution
Build: electron-builder for .exe/.dmg
Flow in JS:

screenshot = await nut.screen.capture()
boxes = await fetch(META_SAM3_API, {image: screenshot})
plan = await fetch(META_LLAMA_API, {prompt: intent, ui: boxes})
await nut.mouse.click(plan[0].x, plan[0].y) 5. 10 Day Roadmap
Day 1-2: nut.js screenshot POC
Day 3-4: SAM 3 API integration - colored boxes
Day 5-6: Muse Spark planner
Day 7: 2 demo tasks (GST filing, Downloads cleanup)
Day 8: On-device privacy
Day 9: 3-min video
Day 10: Submit

6. Demo Script (3 min)
   0-20s: Problem - old portal, no API
   20-60s: SAM 3 seeing screen (wow visual)
   60-120s: "File GST" - agent does it live
   120-180s: "Organize desktop" - live + End card: "Ghost Agent - Your computer, operated."

7. Submission Checklist
   Public repo: ghost-agent-hackathon (commits Oct 26 - Nov 4)
   No old WhimCanvas code
   3-min video
   Uses Meta Model API
   README with "What was built during hackathon"
8. Name Final: GHOST AGENT
   Why: Invisible like Ghost, works like Agent. Ghost Rider vibe, easy to remember.

Status: IDEA LOCKED - GHOST AGENT
Next: Create Electron + TS repo
