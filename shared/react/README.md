# shared_react

Shared React library (hooks, utils, types) for FKS frontend apps.

## Install (as local path)

In consuming app `package.json`:

```json
"dependencies": { "shared_react": "file:../repo/shared/react" }
```

Then:

```bash
npm install
```

## Usage

```tsx
import { useEnv, getRiskThreshold } from 'shared_react';
const risk = getRiskThreshold();
```

`useEnv` reads from `import.meta.env` (Vite) then `process.env` fallback.

## Env Vars

Expose variables at build time via `VITE_` prefix, e.g. `VITE_RISK_MAX_PER_TRADE`.
