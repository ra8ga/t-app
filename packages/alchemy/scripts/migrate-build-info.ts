#!/usr/bin/env bun
import { readdir, readFile, writeFile, rm, stat } from 'fs/promises';
import { join } from 'path';

const APPS_DIR = join(import.meta.dir, '../../../apps');

async function findFiles(dir: string, pattern: RegExp): Promise<string[]> {
    const results: string[] = [];
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== '.next') {
                    results.push(...(await findFiles(fullPath, pattern)));
                }
            } else if (pattern.test(entry.name)) {
                results.push(fullPath);
            }
        }
    } catch (e) {
        // ignore errors
    }
    return results;
}

async function migrateApp(appPath: string) {
    console.log(`Migrating ${appPath}...`);

    // 1. Find files that import BuildInfo
    const tsFiles = await findFiles(appPath, /\.(tsx|ts|jsx|js)$/);

    for (const file of tsFiles) {
        try {
            const content = await readFile(file, 'utf-8');
            if (content.includes('import { BuildInfo }') || content.includes('import BuildInfo')) {
                // Check if it's already using @repo/ui
                if (content.includes('@repo/ui/BuildInfo')) continue;

                console.log(`  Updating import in ${file}`);

                // Replace import
                // Matches: import { BuildInfo } from '@/components/BuildInfo' or similar
                // We want to replace the whole line or just the source

                let newContent = content.replace(
                    /import\s+\{\s*BuildInfo\s*\}\s+from\s+['"]@\/components\/BuildInfo['"]/g,
                    "import { BuildInfo } from '@repo/ui/BuildInfo'"
                );

                newContent = newContent.replace(
                    /import\s+\{\s*BuildInfo\s*\}\s+from\s+['"]\.\.\/components\/BuildInfo['"]/g,
                    "import { BuildInfo } from '@repo/ui/BuildInfo'"
                );

                newContent = newContent.replace(
                    /import\s+\{\s*BuildInfo\s*\}\s+from\s+['"]\.\.\/\.\.\/components\/BuildInfo['"]/g,
                    "import { BuildInfo } from '@repo/ui/BuildInfo'"
                );

                newContent = newContent.replace(
                    /import\s+\{\s*BuildInfo\s*\}\s+from\s+['"]@\/components\/sections\/BuildInfo['"]/g,
                    "import { BuildInfo } from '@repo/ui/BuildInfo'"
                );

                newContent = newContent.replace(
                    /import\s+\{\s*BuildInfo\s*\}\s+from\s+['"]\.\/components\/BuildInfo['"]/g,
                    "import { BuildInfo } from '@repo/ui/BuildInfo'"
                );

                if (newContent !== content) {
                    await writeFile(file, newContent);
                }
            }
        } catch (e) {
            console.error(`  Error processing ${file}:`, e);
        }
    }

    // 2. Delete local BuildInfo components
    const buildInfoPaths = [
        join(appPath, 'components/BuildInfo'),
        join(appPath, 'src/components/BuildInfo'),
        join(appPath, 'src/components/sections/BuildInfo.tsx'),
        join(appPath, 'src/components/BuildInfo.tsx'),
    ];

    for (const p of buildInfoPaths) {
        try {
            await rm(p, { recursive: true, force: true });
            // Check if it existed (rm doesn't throw if force: true)
            // console.log(`  Deleted ${p}`); 
        } catch (e) {
            // ignore
        }
    }
}

async function main() {
    const entries = await readdir(APPS_DIR, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (entry.name === 'nextjs-apps') {
                const nextApps = await readdir(join(APPS_DIR, 'nextjs-apps'), { withFileTypes: true });
                for (const nextApp of nextApps) {
                    if (nextApp.isDirectory()) {
                        await migrateApp(join(APPS_DIR, 'nextjs-apps', nextApp.name));
                    }
                }
            } else {
                await migrateApp(join(APPS_DIR, entry.name));
            }
        }
    }
}

main();
