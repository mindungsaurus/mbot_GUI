import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage"]);
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".md"]);

const SUSPICIOUS_RANGES = [
  [0xfffd, 0xfffd], // replacement char
  [0xf900, 0xfaff], // CJK Compatibility Ideographs (mojibake common)
];

function isSuspicious(codePoint) {
  for (const [start, end] of SUSPICIOUS_RANGES) {
    if (codePoint >= start && codePoint <= end) return true;
  }
  return false;
}

function walk(dir, out) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!EXTS.has(ext)) continue;
    out.push(full);
  }
}

function scanFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let col = 0;
    for (const ch of line) {
      const code = ch.codePointAt(0);
      if (code !== undefined && isSuspicious(code)) {
        findings.push({
          line: i + 1,
          col: col + 1,
          ch,
        });
      }
      col += 1;
    }
  }
  return findings;
}

const files = [];
walk(ROOT, files);

let hasError = false;
for (const file of files) {
  const hits = scanFile(file);
  if (hits.length === 0) continue;
  hasError = true;
  console.error(`\n[encoding] ${file}`);
  for (const hit of hits) {
    console.error(
      `  line ${hit.line}, col ${hit.col}: "${hit.ch}" (U+${hit.ch
        .codePointAt(0)
        .toString(16)
        .toUpperCase()})`
    );
  }
}

if (hasError) {
  console.error("\nEncoding check failed. Fix suspicious characters above.");
  process.exit(1);
}

console.log("Encoding check passed.");
