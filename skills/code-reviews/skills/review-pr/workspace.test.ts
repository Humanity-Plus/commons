// Tests for the workspace scripts: reset-workspace.sh and check-clean.sh.
// Run: bun test  (from this directory)
import { test, expect, afterEach } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = import.meta.dir;
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    chmodSync(dir, 0o755);
    rmSync(dir, { recursive: true, force: true });
  }
});

function scratchRepo(): { dir: string; head: string } {
  const dir = mkdtempSync(join(tmpdir(), "review-pr-workspace-"));
  dirs.push(dir);
  const git = (...args: string[]) =>
    Bun.spawnSync(["git", "-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir });
  git("init", "-q");
  git("commit", "-q", "--allow-empty", "-m", "init");
  const head = git("rev-parse", "HEAD").stdout.toString().trim();
  return { dir, head };
}

function writeFindings(dir: string, headSha: string) {
  mkdirSync(join(dir, "review-report"), { recursive: true });
  writeFileSync(
    join(dir, "review-report", "findings.json"),
    JSON.stringify({ meta: { prNumber: 24, head: "feat/x", headSha } }),
  );
}

const run = (dir: string, script: string, ...args: string[]) =>
  Bun.spawnSync(["bash", join(here, script), ...args], { cwd: dir });

test("reset keeps findings that describe the checked-out commit", () => {
  const { dir, head } = scratchRepo();
  writeFindings(dir, head);
  expect(run(dir, "reset-workspace.sh", "24").exitCode).toBe(0);
  expect(existsSync(join(dir, "review-report", "findings.json"))).toBe(true);
});

test("reset archives findings for the same PR once new commits land", () => {
  const { dir } = scratchRepo();
  writeFindings(dir, "0000000000000000000000000000000000000000");
  expect(run(dir, "reset-workspace.sh", "24").exitCode).toBe(0);
  expect(existsSync(join(dir, "review-report", "findings.json"))).toBe(false);
  expect(existsSync(join(dir, "review-report", "findings-pr24.json"))).toBe(true);
});

test("reset leaves verify-skill evidence in place when it archives findings", () => {
  const { dir } = scratchRepo();
  writeFindings(dir, "0000000000000000000000000000000000000000");
  const evidence = join(dir, "review-report", "verify", "checkout", "review-0000000");
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, "journey.md"), "passed");
  expect(run(dir, "reset-workspace.sh", "24").exitCode).toBe(0);
  expect(existsSync(join(dir, "review-report", "findings-pr24.json"))).toBe(true);
  expect(existsSync(join(evidence, "journey.md"))).toBe(true);
  expect(existsSync(join(dir, "review-report", "verify-pr24"))).toBe(false);
});

test("check-clean runs the check with review-report/ moved aside, then restores it", () => {
  const { dir } = scratchRepo();
  writeFindings(dir, "x");
  const result = run(dir, "check-clean.sh", "sh", "-c", "test ! -e review-report && exit 7");
  expect(result.exitCode).toBe(7);
  expect(existsSync(join(dir, "review-report", "findings.json"))).toBe(true);
});

// A verify-skill instance records its pids in the git dir (create-verify-skill's
// contract), outside review-report/, so both scripts can tell one is running.
function writePids(dir: string, ...pids: number[]) {
  mkdirSync(join(dir, ".git", "verify"), { recursive: true });
  writeFileSync(join(dir, ".git", "verify", ".pids"), pids.join("\n"));
}

test("check-clean refuses while a verify-skill instance is running", () => {
  const { dir } = scratchRepo();
  writeFindings(dir, "x");
  writePids(dir, process.pid);
  const result = run(dir, "check-clean.sh", "sh", "-c", "echo ran");
  expect(result.exitCode).toBe(2);
  expect(result.stdout.toString()).not.toContain("ran");
  expect(result.stderr.toString()).toContain("Cleanup");
  expect(existsSync(join(dir, "review-report", "findings.json"))).toBe(true);
});

test("check-clean ignores a stale pid file whose processes are gone", () => {
  const { dir } = scratchRepo();
  writeFindings(dir, "x");
  writePids(dir, 2147483646);
  const result = run(dir, "check-clean.sh", "sh", "-c", "echo ran");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("ran");
});

test("check-clean fails loudly instead of nesting when review-report/ reappears during the check", () => {
  const { dir } = scratchRepo();
  writeFindings(dir, "x");
  const result = run(dir, "check-clean.sh", "sh", "-c", "mkdir review-report && echo fresh > review-report/new");
  expect(result.exitCode).toBe(2);
  expect(existsSync(join(dir, "review-report", "review-report"))).toBe(false);
  expect(existsSync(join(dir, "review-report", "new"))).toBe(true);
  const left = result.stderr.toString().match(/left at (\S+)/)?.[1];
  expect(left).toBeDefined();
  expect(existsSync(join(left!, "findings.json"))).toBe(true);
  rmSync(left!.replace(/\/review-report$/, ""), { recursive: true, force: true });
});

test("reset leaves a running instance's state and evidence alone", () => {
  const { dir } = scratchRepo();
  writeFindings(dir, "0000000000000000000000000000000000000000");
  writePids(dir, process.pid);
  const evidence = join(dir, "review-report", "verify", "checkout", "review-0000000");
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, "result.json"), "{}");
  expect(run(dir, "reset-workspace.sh", "24").exitCode).toBe(0);
  expect(existsSync(join(dir, ".git", "verify", ".pids"))).toBe(true);
  expect(existsSync(join(evidence, "result.json"))).toBe(true);
});

test("check-clean refuses to run the check when it can't move review-report/ aside", () => {
  const { dir } = scratchRepo();
  writeFindings(dir, "x");
  chmodSync(dir, 0o555);
  const result = run(dir, "check-clean.sh", "sh", "-c", "echo ran");
  expect(result.exitCode).toBe(2);
  expect(result.stdout.toString()).not.toContain("ran");
});
