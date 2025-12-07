/**
 * Alchemy Infrastructure Configuration
 * 
 * This file defines all Cloudflare Workers for the t-app monorepo.
 * Run with: pnpm deploy (or pnpm dev for local development)
 */

import alchemy from 'alchemy';
import { Worker, TanStackStart } from 'alchemy/cloudflare';
import { execSync } from 'child_process';

// Get current git hash
const getGitHash = () => {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return 'unknown';
    }
};

// Get current git branch
const getGitBranch = () => {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    } catch {
        return 'unknown';
    }
};

const GIT_HASH = getGitHash();
const GIT_BRANCH = getGitBranch();
const BUILD_DATE = new Date().toISOString();

// Initialize Alchemy app with environment
const app = await alchemy('t-app', {
    stage: process.env.ENVIRONMENT ?? 'dev',
});

// Helper to get app-specific name
const getName = (baseName: string) =>
    app.stage === 'prod' ? `${baseName}-production` : `${baseName}-${app.stage}`;

// -----------------------------------------------------------------------------
// APPS
// -----------------------------------------------------------------------------

/*
// 1. t-app server
await Worker('server', {
    name: getName('server'),
    entrypoint: '../../apps/server/src/index.ts',
    compatibilityDate: '2024-12-01',
    compatibilityFlags: ['nodejs_compat'],
    bindings: {
        NEXT_PUBLIC_GIT_HASH: GIT_HASH,
        NEXT_PUBLIC_GIT_BRANCH: GIT_BRANCH,
        NEXT_PUBLIC_BUILD_DATE: BUILD_DATE,
    },
});

// 2. t-app web
await TanStackStart('web', {
    name: getName('web'),
    cwd: '../../apps/web',
    bindings: {
        NEXT_PUBLIC_GIT_HASH: GIT_HASH,
        NEXT_PUBLIC_GIT_BRANCH: GIT_BRANCH,
    },
});

// 3. r2-explorer
await Worker('r2-explorer', {
    name: getName('r2-explorer'),
    entrypoint: '../../apps/r2-explorer/src/index.ts',
    compatibilityDate: '2025-10-08',
    bindings: {
        // Add bindings from r2-explorer-template wrangler.json if needed
    }
});

// 4. zwierzogranie-neutering server
await Worker('zwierzogranie-neutering-server', {
    name: getName('zwierzogranie-neutering-server'),
    entrypoint: '../../apps/zwierzogranie-neutering/apps/server/src/index.ts',
    compatibilityDate: '2024-12-01',
    compatibilityFlags: ['nodejs_compat'],
});

// 5. zwierzogranie-neutering web
await TanStackStart('zwierzogranie-neutering-web', {
    name: getName('zwierzogranie-neutering-web'),
    cwd: '../../apps/zwierzogranie-neutering/apps/web',
});
*/

// 6. ricardo
await TanStackStart('ricardo-pl', {
    name: getName('ricardo-pl'),
    cwd: '../../../apps/ricardo-pl',
});

console.log(`\n🚀 Configured apps for ${app.stage}`);
