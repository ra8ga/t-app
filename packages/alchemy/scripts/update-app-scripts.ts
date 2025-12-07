#!/usr/bin/env bun
/**
 * Script to update all app package.json files to use Alchemy for deployment
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const APPS_DIR = join(import.meta.dir, '../../../apps');
const NEXTJS_APPS_DIR = join(APPS_DIR, 'nextjs-apps');

// Apps that have wrangler configs (from our index.ts)
const ALCHEMY_APPS = [
    // TanStack apps
    'zwierzogranie-pl',
    'naprawfure-pl',
    'safemore-pl',
    'jdnet-pl',
    'kompensatormocybiernej-pl',
    'impresja-biz-web',
    'mmarzec-pl',
    'miache-new',
    'mrharu-com',
    'skwdevelopment-com-web',
    // Next.js apps (in nextjs-apps folder)
    'nextjs-apps/zwierzonet-pl-web',
    'nextjs-apps/ubestrefa-pl-web',
    'nextjs-apps/autodokumenty-pl-web',
    'nextjs-apps/tags-and-labels-web',
    'nextjs-apps/stopprzeplacaniu-pl-web',
    'nextjs-apps/szukamandrzeja-pl-web',
    'nextjs-apps/2msys-pl-web',
    'nextjs-apps/miache-web',
    'nextjs-apps/kancelaria-faktury',
];

async function updatePackageJson(appPath: string, appId: string) {
    const pkgPath = join(APPS_DIR, appPath, 'package.json');

    try {
        const content = await readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(content);

        // Determine the path to alchemy package
        const isNextjs = appPath.startsWith('nextjs-apps/');
        const alchemyPath = isNextjs ? '../../../packages/alchemy' : '../../packages/alchemy';

        // Update deploy scripts
        pkg.scripts = pkg.scripts || {};

        // Keep build script as is
        // Update deploy scripts to use Alchemy
        pkg.scripts['deploy:dev'] = `cd ${alchemyPath} && APP=${appId} ENVIRONMENT=dev pnpm deploy`;
        pkg.scripts['deploy:staging'] = `cd ${alchemyPath} && APP=${appId} ENVIRONMENT=staging pnpm deploy`;
        pkg.scripts['deploy:prod'] = `cd ${alchemyPath} && APP=${appId} ENVIRONMENT=prod pnpm deploy`;

        // Update build-deploy to build first then deploy
        if (pkg.scripts.build) {
            pkg.scripts['build-deploy'] = `${pkg.scripts.build.replace('bunx ', 'bun run ').replace('bun run build', 'bun run build')} && cd ${alchemyPath} && APP=${appId} ENVIRONMENT=\${ENVIRONMENT:-prod} pnpm deploy`;
        }

        await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(`✅ Updated ${appPath}`);
    } catch (err) {
        console.error(`❌ Failed to update ${appPath}:`, err);
    }
}

async function main() {
    console.log('Updating app scripts to use Alchemy...\n');

    for (const appPath of ALCHEMY_APPS) {
        const appId = appPath.includes('/') ? appPath.split('/')[1] : appPath;
        await updatePackageJson(appPath, appId);
    }

    console.log('\n✨ Done! All apps updated to use Alchemy.');
}

main();
