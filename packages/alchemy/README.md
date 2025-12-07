# @repo/alchemy

Infrastructure as TypeScript using [Alchemy](https://alchemy.run/) to deploy Cloudflare Workers.

## Setup

1. Create a `.env` file with your Cloudflare credentials:
   ```bash
   CLOUDFLARE_API_TOKEN=your_api_token
   CLOUDFLARE_ACCOUNT_ID=your_account_id
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

## Usage

### Deploy All Apps
```bash
# Deploy all apps to dev
pnpm deploy

# Deploy all apps to production
ENVIRONMENT=prod pnpm deploy
```

### Deploy Single App
```bash
# Deploy only zwierzogranie-pl to prod
ENVIRONMENT=prod APP=zwierzogranie-pl pnpm deploy

# Deploy only naprawfure-pl to staging
ENVIRONMENT=staging APP=naprawfure-pl pnpm deploy
```

### Development (local emulation)
```bash
# Dev server for single app
APP=zwierzogranie-pl pnpm dev
```

### Destroy Resources
```bash
pnpm destroy
```

## Supported Apps

### TanStack Start Apps
- `zwierzogranie-pl`
- `naprawfure-pl`
- `safemore-pl`
- `jdnet-pl`
- `kompensatormocybiernej-pl`
- `impresja-biz-web`
- `mmarzec-pl`
- `miache-new`
- `mrharu-com`
- `skwdevelopment-com-web`

### Next.js (OpenNext) Apps
- `zwierzonet-pl-web`
- `ubestrefa-pl-web`
- `autodokumenty-pl-web`
- `tags-and-labels-web`
- `stopprzeplacaniu-pl-web`
- `szukamandrzeja-pl-web`
- `2msys-pl-web`
- `miache-web`
- `kancelaria-faktury`

## Adding New Apps

Edit `src/index.ts` and add your app to either `tanstackApps` or `nextjsApps` array:

```typescript
{
  id: 'my-new-app',
  name: 'my-new-app',
  path: 'apps/my-new-app',
  entrypoint: 'worker.ts',  // or '.open-next/worker.js' for Next.js
  assetsDir: 'dist/client', // or '.open-next/assets' for Next.js
  routes: ['myapp.com/*'],  // production routes
  vars: {                   // optional env vars
    MY_VAR: 'value',
  },
}
```
