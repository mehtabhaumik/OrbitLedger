#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = join(repoRoot, "artifacts", "browser-responsive-qa");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = join(outputRoot, timestamp);

const targets = [
  { name: "local", url: process.env.ORBIT_LEDGER_LOCAL_URL ?? "http://localhost:3000/login/" },
  { name: "live", url: process.env.ORBIT_LEDGER_LIVE_URL ?? "https://orbit-ledger-f41c2.web.app/login/" },
];

const viewports = [
  { name: "mobile", size: "390,844" },
  { name: "tablet", size: "820,1180" },
  { name: "desktop", size: "1440,900" },
];

function assertSafeUrl(url) {
  if (!url.startsWith("http://localhost:") && !url.startsWith("https://orbit-ledger-f41c2.web.app/")) {
    throw new Error(`Refusing to run browser QA against unexpected URL: ${url}`);
  }
}

async function screenshot(target, viewport) {
  assertSafeUrl(target.url);
  const file = join(outputDir, `${target.name}-${viewport.name}.png`);
  const logFile = join(outputDir, `${target.name}-${viewport.name}.log`);
  const args = [
    "-y",
    "playwright@1.57.0",
    "screenshot",
    `--viewport-size=${viewport.size}`,
    "--wait-for-timeout=1200",
    target.url,
    file,
  ];
  const { stdout, stderr } = await execFileAsync("npx", args, {
    cwd: repoRoot,
    env: process.env,
    maxBuffer: 1024 * 1024 * 4,
  });
  await writeFile(logFile, `${stdout}${stderr}`);
  const bytes = await readFile(file);
  return {
    target: target.name,
    viewport: viewport.name,
    url: target.url,
    file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
}

await mkdir(outputDir, { recursive: true });

const results = [];
for (const target of targets) {
  for (const viewport of viewports) {
    results.push(await screenshot(target, viewport));
  }
}

const localLivePairs = viewports.map((viewport) => {
  const local = results.find((result) => result.target === "local" && result.viewport === viewport.name);
  const live = results.find((result) => result.target === "live" && result.viewport === viewport.name);
  return {
    viewport: viewport.name,
    localMatchesLive: local?.sha256 === live?.sha256,
    localSha256: local?.sha256,
    liveSha256: live?.sha256,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  outputDir,
  results: results.map((result) => ({
    ...result,
    file: result.file.replace(`${repoRoot}/`, ""),
  })),
  localLivePairs,
  notes: [
    "This command captures public login responsive screenshots only.",
    "Signed-in Firebase flow proof still requires an existing browser auth session or dedicated test credentials.",
    "No API keys, secrets, or App Check debug tokens are printed by this command.",
  ],
};

await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(`Browser responsive QA complete: ${outputDir}`);
for (const result of results) {
  console.log(`${result.target}/${result.viewport}: ${basename(result.file)} ${result.sha256}`);
}
for (const pair of localLivePairs) {
  console.log(`${pair.viewport}: local/live match ${pair.localMatchesLive ? "yes" : "no"}`);
}
