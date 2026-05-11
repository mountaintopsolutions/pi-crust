# pi-remote-control

Mobile-first, self-hosted web control plane for running many concurrent [Pi coding-agent](https://pi.dev/) sessions from a browser, intended for private remote access over Tailscale.

See [`plan.md`](./plan.md) for the implementation roadmap.

## Development

```bash
npm install
npm run typecheck
npm test
npm run e2e
npm run check
```

## Current status

Phase 0 project skeleton is being established first. Later phases will add the Pi SDK adapter, session registry, WebSocket protocol, and web UI.
