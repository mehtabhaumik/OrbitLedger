# Dependency Audit Watch

Orbit Ledger blocks release on high or critical dependency advisories:

```sh
npm run audit:ci
```

That command uses:

```sh
npm audit --audit-level=high
```

Low and moderate advisories are tracked as dependency-watch items unless a compatible patched version is available.

## Current Policy

- Do not run `npm audit fix --force` as a default release step.
- Do not accept fixes that downgrade Expo, Firebase, Next.js, or React compatibility.
- Prefer targeted dependency overrides only when they are compatible with the current dependency graph.
- Revisit low/moderate advisories during dependency refresh work.
- Keep CI strict for high/critical advisories.

## Why

This repo combines Firebase, Expo, Next.js, and browser tooling. Forced audit fixes can replace framework packages with incompatible versions and create larger launch risk than the low/moderate advisory itself.

The release rule is simple:

- high/critical: block and fix before release,
- low/moderate: monitor unless there is a safe compatible patch.
