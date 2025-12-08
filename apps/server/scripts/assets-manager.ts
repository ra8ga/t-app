import { file, write } from "bun";
import { join } from "path";
import { existsSync } from "fs";

const __dirname = import.meta.dir;
const SRC_DIR = join(__dirname, "../src");
const ASSETS_DIR = join(SRC_DIR, "assets");
const NODE_MODULES_DIR = join(__dirname, "../node_modules");

const LOGO_LITEWKA_PATH = join(ASSETS_DIR, "logo-litewka.png");
const LOGO_ZWIERZOGRANIE_PATH = join(ASSETS_DIR, "logo-zwierzogranie.png");

// Try to find fonts in local node_modules, fallback to root node_modules if needed
const FONT_REGULAR_PATH_LOCAL = join(NODE_MODULES_DIR, "roboto-fontface/fonts/roboto/Roboto-Regular.woff2");
const FONT_BOLD_PATH_LOCAL = join(NODE_MODULES_DIR, "roboto-fontface/fonts/roboto/Roboto-Bold.woff2");

// Fallback paths (in case of hoisting)
const ROOT_NODE_MODULES = join(__dirname, "../../../node_modules");
const FONT_REGULAR_PATH_ROOT = join(ROOT_NODE_MODULES, "roboto-fontface/fonts/roboto/Roboto-Regular.woff2");
const FONT_BOLD_PATH_ROOT = join(ROOT_NODE_MODULES, "roboto-fontface/fonts/roboto/Roboto-Bold.woff2");

const OUTPUT_PATH = join(SRC_DIR, "pdf-assets.ts");

async function readFileAsBase64(path: string, altPath?: string): Promise<string> {
  let finalPath = path;
  if (!existsSync(path) && altPath && existsSync(altPath)) {
    finalPath = altPath;
  }
  
  try {
    const f = file(finalPath);
    if (!(await f.exists())) {
       throw new Error(`File not found: ${finalPath}`);
    }
    const buffer = await f.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch (error) {
    console.error(`Error reading file at ${finalPath}:`, error);
    process.exit(1);
  }
}

async function main() {
  console.log("🔄 Generating PDF assets...");

  const [logoLitewka, logoZwierzogranie, fontRegular, fontBold] = await Promise.all([
    readFileAsBase64(LOGO_LITEWKA_PATH),
    readFileAsBase64(LOGO_ZWIERZOGRANIE_PATH),
    readFileAsBase64(FONT_REGULAR_PATH_LOCAL, FONT_REGULAR_PATH_ROOT),
    readFileAsBase64(FONT_BOLD_PATH_LOCAL, FONT_BOLD_PATH_ROOT),
  ]);

  const content = `// Auto-generated file - do not edit manually
export const LOGO_LITEWKA_BASE64 = '${logoLitewka}';
export const LOGO_ZWIERZOGRANIE_BASE64 = '${logoZwierzogranie}';
export const ROBOTO_REGULAR_BASE64 = '${fontRegular}';
export const ROBOTO_BOLD_BASE64 = '${fontBold}';
`;

  await write(OUTPUT_PATH, content);

  console.log("✅ PDF assets generated successfully!");
  console.log(`📁 Output: ${OUTPUT_PATH}`);
  console.log(`📊 Logo Litewka size: ${(logoLitewka.length / 1024).toFixed(2)} KB`);
  console.log(`📊 Logo Zwierzogranie size: ${(logoZwierzogranie.length / 1024).toFixed(2)} KB`);
}

main();
