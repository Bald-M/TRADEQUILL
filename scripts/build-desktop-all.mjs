import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const workflow = "package.yml";
const args = process.argv.slice(2);

if (args.includes("--help")) {
  console.log(`Usage: pnpm desktop:build:all [-- --ref <branch>]

Triggers the Windows and macOS packaging workflow, waits for it to finish,
then downloads every artifact into release/<run-id>/.`);
  process.exit(0);
}

function capture(command, commandArgs) {
  return execFileSync(command, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function option(name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

const unknown = args.filter(
  (arg, index) => arg !== "--ref" && args[index - 1] !== "--ref",
);
if (unknown.length > 0) {
  throw new Error(`Unknown argument: ${unknown[0]}`);
}

capture("gh", ["auth", "status"]);

const ref = option("--ref") ?? capture("git", ["branch", "--show-current"]);
if (!ref)
  throw new Error("A branch is required; detached HEAD is not supported");

console.log(`Starting ${workflow} on ${ref}...`);
const dispatchedAt = Date.now() - 5_000;
const dispatchOutput = capture("gh", [
  "workflow",
  "run",
  workflow,
  "--ref",
  ref,
]);
let runId = dispatchOutput.match(/\/actions\/runs\/(\d+)/)?.[1];

for (let attempt = 0; !runId && attempt < 15; attempt += 1) {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
  const runs = JSON.parse(
    capture("gh", [
      "run",
      "list",
      "--workflow",
      workflow,
      "--branch",
      ref,
      "--event",
      "workflow_dispatch",
      "--limit",
      "5",
      "--json",
      "databaseId,createdAt",
    ]),
  );
  runId = runs
    .find((candidate) => Date.parse(candidate.createdAt) >= dispatchedAt)
    ?.databaseId.toString();
}

if (!runId) throw new Error("Could not identify the dispatched workflow run");
if (dispatchOutput) console.log(dispatchOutput);
run("gh", ["run", "watch", runId, "--compact", "--exit-status"]);

const destination = resolve("release", runId);
mkdirSync(destination, { recursive: true });
run("gh", ["run", "download", runId, "--dir", destination]);
console.log(`Downloaded desktop packages to ${destination}`);
