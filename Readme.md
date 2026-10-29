# Ghost Agent

**Tell Ghost Agent what you want done. It operates your computer and verifies the result.**

Ghost Agent aims to remove the manual relay between AI instructions and completed computer tasks. It observes the screen, chooses actions, uses mouse and keyboard input, and checks the outcome without requiring an integration for each target app.

- [x] **ROOT-001** Establish the project documentation: **[start in docs/README.md](docs/README.md)**.

Current stage: **integrated Electron + React + TypeScript source implementation**. The controller, Meta adapter, in-app session key setup, user handoff, floating controls, action review, and Ubuntu/X11 capture/input adapters are wired. Live desktop/model acceptance and packaging remain unverified. First demo platform: **Ubuntu/Linux**, selected by the project owner.

See [development and folder structure](docs/DEVELOPMENT.md) for module boundaries, commands, and validation status.

```bash
npm ci
npm run dev
```

Use a disposable Ubuntu X11 session with `xdotool`. Connect and test the Meta key in app Settings; `.env.example` is also available for development configuration. The [development guide](docs/DEVELOPMENT.md) covers setup, data flow, current limitations, and validation. Browser preview cannot execute desktop tasks.

Run `npm run check` for typechecking, lint, focused tests, production bundles, and sandboxed-preload checks. Source checks do not establish desktop automation readiness.

The [original idea](docs/INITIAL_IDEA.md) is preserved as historical input. Current requirements, technical choices, feasibility gates, and hackathon preparation live in `docs/`.
