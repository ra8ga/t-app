const fs = require('fs');
const path = require('path');

const assetsPath = path.join(__dirname, '../src/pdf-assets.ts');
const fontPath = path.join(__dirname, '../node_modules/roboto-fontface/fonts/roboto/Roboto-Regular.woff2');
const fontBoldPath = path.join(__dirname, '../node_modules/roboto-fontface/fonts/roboto/Roboto-Bold.woff2');

const currentContent = fs.readFileSync(assetsPath, 'utf8');
const fontBase64 = fs.readFileSync(fontPath).toString('base64');
const fontBoldBase64 = fs.readFileSync(fontBoldPath).toString('base64');

// Extract logos
const logoLitewkaMatch = currentContent.match(/export const LOGO_LITEWKA_BASE64 = '(.*?)';/);
const logoZwierzogranieMatch = currentContent.match(/export const LOGO_ZWIERZOGRANIE_BASE64 = '(.*?)';/);

if (!logoLitewkaMatch || !logoZwierzogranieMatch) {
    console.error('Could not find logos in existing file');
    process.exit(1);
}

const newContent = `// Auto-generated file - do not edit manually
export const LOGO_LITEWKA_BASE64 = '${logoLitewkaMatch[1]}';
export const LOGO_ZWIERZOGRANIE_BASE64 = '${logoZwierzogranieMatch[1]}';
export const ROBOTO_REGULAR_BASE64 = '${fontBase64}';
export const ROBOTO_BOLD_BASE64 = '${fontBoldBase64}';
`;

fs.writeFileSync(assetsPath, newContent);
console.log('Updated pdf-assets.ts with font data');
