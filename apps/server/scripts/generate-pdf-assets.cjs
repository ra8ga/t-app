#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read logo files
const logoLitewkaPath = '/Users/rafalfurmaga/.gemini/antigravity/brain/255e6d86-0246-421c-96b2-e21a7acc42e2/uploaded_image_0_1764249043967.png';
const logoZwierzograniePath = '/Users/rafalfurmaga/.gemini/antigravity/brain/255e6d86-0246-421c-96b2-e21a7acc42e2/uploaded_image_1_1764249043967.png';

const logoLitewka = fs.readFileSync(logoLitewkaPath).toString('base64');
const logoZwierzogranie = fs.readFileSync(logoZwierzograniePath).toString('base64');

// For font, we'll use a simpler approach - download it separately or use a CDN approach
// For now, let's create the logos file

const content = `// Auto-generated file - do not edit manually
export const LOGO_LITEWKA_BASE64 = '${logoLitewka}';
export const LOGO_ZWIERZOGRANIE_BASE64 = '${logoZwierzogranie}';
`;

const outputPath = path.join(__dirname, '../src/pdf-assets.ts');
fs.writeFileSync(outputPath, content);

console.log('✅ PDF assets generated successfully');
console.log(`📁 Output: ${outputPath}`);
console.log(`📊 Logo Litewka size: ${(logoLitewka.length / 1024).toFixed(2)} KB`);
console.log(`📊 Logo Zwierzogranie size: ${(logoZwierzogranie.length / 1024).toFixed(2)} KB`);
