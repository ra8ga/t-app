const fs = require("fs");
const path = require("path");

function readJson(file) {
  const s = fs.readFileSync(file, "utf8");
  const j = JSON.parse(s);
  return { json: j, text: s.split(/\r?\n/) };
}

function isAllowedVersion(v) {
  if (typeof v !== "string") return true;
  if (v === "catalog:") return true;
  if (v.startsWith("workspace:")) return true;
  return false;
}

function findLine(textLines, name, version) {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const v = String(version).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`"${n}"\\s*:\\s*"${v}"`);
  for (let i = 0; i < textLines.length; i++) {
    if (re.test(textLines[i])) return i + 1;
  }
  return null;
}

function scanFile(file) {
  const { json, text } = readJson(file);
  const keys = ["dependencies", "devDependencies", "optionalDependencies"];
  const issues = [];
  for (const k of keys) {
    const deps = json[k];
    if (!deps) continue;
    for (const [name, version] of Object.entries(deps)) {
      if (!isAllowedVersion(version)) {
        const line = findLine(text, name, version) || 0;
        issues.push({ file, line, name, version });
      }
    }
  }
  return issues;
}

function findPackageJsons(root) {
  const targets = [path.join(root, "apps"), path.join(root, "packages")];
  const out = [];
  for (const base of targets) {
    if (!fs.existsSync(base)) continue;
    const stack = [base];
    while (stack.length) {
      const dir = stack.pop();
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          stack.push(p);
        } else if (e.isFile() && e.name === "package.json") {
          out.push(p);
        }
      }
    }
  }
  return out;
}

function main() {
  const root = path.resolve(__dirname, "..");
  const files = findPackageJsons(root);
  const allIssues = [];
  for (const f of files) {
    if (path.resolve(f) === path.join(root, "package.json")) continue;
    allIssues.push(...scanFile(f));
  }
  if (!allIssues.length) {
    console.log("No hard versions found.");
    return;
  }
  for (const i of allIssues) {
    console.log(`${i.file}:${i.line}: ${i.name} -> ${i.version}`);
  }
  process.exitCode = 1;
}

main();

