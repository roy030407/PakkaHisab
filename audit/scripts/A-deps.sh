#!/usr/bin/env bash
# Session A: dependency audit (high/critical) and outdated check for key packages.
cd "$(dirname "$0")/../.."
OUT=audit/scripts/A-out; mkdir -p "$OUT"
npm audit --json > "$OUT/npm-audit.json" 2>/dev/null
node -e '
const a=require("./'"$OUT"'/npm-audit.json"); const v=a.vulnerabilities||{};
console.log("metadata:", JSON.stringify(a.metadata&&a.metadata.vulnerabilities));
for (const [n,x] of Object.entries(v)) if (x.severity==="high"||x.severity==="critical") {
  const via=(x.via||[]).map(y=>typeof y==="string"?y:(y.title+" "+(y.url||""))).join(" | ");
  console.log([x.severity,n,x.isDirect?"direct":"transitive",x.range,"fix:"+(x.fixAvailable===true?"yes":(x.fixAvailable&&x.fixAvailable.name?x.fixAvailable.name+"@"+x.fixAvailable.version+(x.fixAvailable.isSemVerMajor?" (major)":""):"none")),via].join("\t"));
}' > "$OUT/npm-audit-high.txt"
npm outdated next @supabase/supabase-js @supabase/ssr @google/genai prisma @prisma/client eslint-config-next xlsx > "$OUT/npm-outdated.txt" 2>&1
