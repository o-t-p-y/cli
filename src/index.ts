#!/usr/bin/env node
// otpy CLI — full implementation lands in P4 (framework detection, code
// patching, PR creation, --ai mode). P0 ships the surface only.

const args = process.argv.slice(2);
const command = args[0];

if (command === "--version" || command === "-v") {
  console.log("otpy 0.0.0");
  process.exit(0);
}

if (command === "init") {
  console.log("otpy init — coming online in P4.");
  console.log("Manual integration docs: https://otpy.ir/docs");
  process.exit(0);
}

console.log("usage: otpl init | otpl --version");
process.exit(command ? 1 : 0);
