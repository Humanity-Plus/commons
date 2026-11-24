// Tests for the workspace scripts: reset-workspace.sh and check-clean.sh.
// Run: bun test  (from this directory)
import { test, expect, afterEach } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

test("check-clean merges files written during the check into the restored original and keeps the check's exit code", () => {
  const { dir } = scratchRepo();
  writeFindings(dir, "x");
  const result = run(dir, "check-clean.sh", "sh", "-c", "mkdir -p review-report/lenses && echo late > review-report/lenses/first-five.json && exit 7");
  expect(result.exitCode).toBe(7); // the check's own code, not the script's
  expect(existsSync(join(dir, "review-report", "findings.json"))).toBe(true); // the original is back…
  expect(readFileSync(join(dir, "review-report", "lenses", "first-five.json"), "utf8")).toBe("late\n"); // …with the late lens file in it
  expect(existsSync(join(dir, "review-report", "review-report"))).toBe(false); // never nested
  expect(result.stderr.toString()).toContain("merged into the restored original");
});

test("check-clean stops, and says where the original is, only when a path exists on both sides", () => {
  const { dir } = scratchRepo();
  writeFindings(dir, "x");
  const result = run(dir, "check-clean.sh", "sh", "-c", "mkdir review-report && echo other > review-report/findings.json");
  expect(result.exitCode).toBe(2);
  expect(readFileSync(join(dir, "review-report", "findings.json"), "utf8")).toBe("other\n"); // nothing overwritten
  const left = result.stderr.toString().match(/left at (\S+)/)?.[1];
  expect(left).toBeDefined();
  expect(readFileSync(join(left!, "findings.json"), "utf8")).toContain("feat/x"); // the original, intact
  rmSync(left!.replace(/\/review-report$/, ""), { recursive: true, force: true });
});

test("check-clean reports a passing check that changed the working tree, and leaves a failing check's code alone", () => {
  const { dir } = scratchRepo();
  writeFindings(dir, "x");
  writeFileSync(join(dir, "api.d.ts"), "old\n");
  Bun.spawnSync(["git", "-c", "user.email=t@t", "-c", "user.name=t", "add", "api.d.ts"], { cwd: dir });
  Bun.spawnSync(["git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "add generated file"], { cwd: dir });
  const regenerates = run(dir, "check-clean.sh", "sh", "-c", "echo new > api.d.ts");
  expect(regenerates.exitCode).toBe(3);
  expect(regenerates.stderr.toString()).toContain("changed the working tree");
  expect(regenerates.stderr.toString()).toContain("api.d.ts");
  const clean = run(dir, "check-clean.sh", "sh", "-c", "exit 0"); // the tree is already dirty: no NEW change, so no report
  expect(clean.exitCode).toBe(0);
  const failing = run(dir, "check-clean.sh", "sh", "-c", "echo newer > api.d.ts; echo x > extra.txt; exit 5");
  expect(failing.exitCode).toBe(5); // a red check keeps its own code
  expect(failing.stderr.toString()).toContain("extra.txt");
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

test("reset reads the reviewed commit when the review recorded one, not the PR's pushed head", () => {
  const { dir, head } = scratchRepo();
  mkdirSync(join(dir, "review-report"), { recursive: true });
  const write = (meta: Record<string, unknown>) =>
    writeFileSync(join(dir, "review-report", "findings.json"), JSON.stringify({ meta: { prNumber: 24, head: "feat/x", ...meta } }));
  write({ headSha: "0000000000000000000000000000000000000000", reviewedSha: head }); // a merge-forward review of this HEAD
  expect(run(dir, "reset-workspace.sh", "24").exitCode).toBe(0);
  expect(existsSync(join(dir, "review-report", "findings.json"))).toBe(true);
  write({ headSha: head, reviewedSha: "0000000000000000000000000000000000000000" }); // the lenses read another commit
  expect(run(dir, "reset-workspace.sh", "24").exitCode).toBe(0);
  expect(existsSync(join(dir, "review-report", "findings.json"))).toBe(false);
  expect(existsSync(join(dir, "review-report", "findings-pr24.json"))).toBe(true);
});

test("reset archives the resolution log with its findings, keeps it with fresh ones, and wipes the bundle", () => {
  const { dir, head } = scratchRepo();
  const report = join(dir, "review-report");
  writeFindings(dir, "0000000000000000000000000000000000000000");
  writeFileSync(join(report, "resolution.md"), "previous PR");
  mkdirSync(join(report, "bundle"));
  writeFileSync(join(report, "bundle", "common.md"), "stale diff");
  expect(run(dir, "reset-workspace.sh", "24").exitCode).toBe(0);
  expect(readFileSync(join(report, "resolution-pr24.md"), "utf8")).toBe("previous PR");
  expect(existsSync(join(report, "resolution.md"))).toBe(false);
  expect(existsSync(join(report, "bundle"))).toBe(false);
  writeFindings(dir, head);
  writeFileSync(join(report, "resolution.md"), "this run");
  expect(run(dir, "reset-workspace.sh", "24").exitCode).toBe(0);
  expect(readFileSync(join(report, "resolution.md"), "utf8")).toBe("this run"); // matching findings keep their log
  rmSync(join(report, "findings.json"));
  expect(run(dir, "reset-workspace.sh", "24").exitCode).toBe(0);
  expect(readFileSync(join(report, "resolution-old.md"), "utf8")).toBe("this run"); // a log with no findings is nobody's
});

// build-bundle.sh: a base branch with the repo's rules, and a PR branch that
// changes code and tries to rewrite those rules.
function bundleRepo() {
  const { dir } = scratchRepo();
  const git = (...args: string[]) =>
    Bun.spawnSync(["git", "-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir });
  const put = (rel: string, text: string) => {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), text);
  };
  git("branch", "-M", "main");
  put("REVIEW.md", "BASE-REVIEW-RULE\n");
  put("AGENTS.md", "BASE-AGENTS-RULE\n");
  put("docs/conventions/react.md", "BASE-REACT-RULE\n");
  put("docs/primitives.yaml", "primitives: [BASE-MAP]\n");
  put("src/a file.ts", "export const a = 1;\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  git("switch", "-q", "-c", "feat");
  put("REVIEW.md", "PR-SAYS-IGNORE-EVERYTHING\n");
  put("AGENTS.md", "PR-REWRITES-THE-RULES\n");
  put("docs/primitives.yaml", "primitives: [PR-MAP]\n");
  put("src/a file.ts", "export const a = 2;\n");
  put("docs/specs/feat.md", "SPEC-TEXT\n");
  git("add", "-A");
  git("commit", "-q", "-m", "change");
  return { dir, git, put };
}
const bundle = (dir: string, name: string) => join(dir, "review-report", "bundle", name);

test("build-bundle writes one file per section and reads the trusted material from base", () => {
  const { dir } = bundleRepo();
  const result = run(dir, "build-bundle.sh", "main", "--spec", "docs/specs/feat.md");
  expect(result.exitCode).toBe(0);
  const common = readFileSync(bundle(dir, "common.md"), "utf8");
  const context = common.slice(0, common.indexOf("=== Diff"));
  expect(context).toContain("BASE-REVIEW-RULE");
  expect(context).not.toContain("PR-SAYS-IGNORE-EVERYTHING"); // the PR's rewrite is in the diff, never in the trusted block
  expect(common).toContain("+export const a = 2;");
  expect(common).not.toContain("Base-side changes"); // the branch is not behind
  const conventions = readFileSync(bundle(dir, "conventions.md"), "utf8");
  expect(conventions).toContain("BASE-AGENTS-RULE");
  expect(conventions).toContain("BASE-REACT-RULE");
  expect(conventions).not.toContain("PR-REWRITES-THE-RULES"); // a PR cannot rewrite the rules it is graded by
  expect(conventions).not.toContain("Changed after this branch diverged");
  const map = readFileSync(bundle(dir, "primitives.md"), "utf8");
  expect(map).toContain("BASE-MAP");
  expect(map).not.toContain("PR-MAP"); // nor the ruler it is measured with
  expect(readFileSync(bundle(dir, "intent.md"), "utf8")).toContain("SPEC-TEXT");
  expect(common).not.toContain("=== docs/primitives.yaml (from"); // the map itself stays out of what every lens reads
});

test("build-bundle adds the base-side diff and the rule drift when base moved, and skips empty sections", () => {
  const { dir, git, put } = bundleRepo();
  git("switch", "-q", "main");
  put("src/a file.ts", "export const a = 1; // BASE-MOVED\n");
  put("AGENTS.md", "BASE-AGENTS-RULE v2\n");
  git("rm", "-q", "docs/primitives.yaml");
  git("add", "-A");
  git("commit", "-q", "-m", "base moves");
  git("switch", "-q", "feat");
  expect(run(dir, "build-bundle.sh", "main").exitCode).toBe(0);
  const common = readFileSync(bundle(dir, "common.md"), "utf8");
  expect(common).toContain("Base-side changes to the same files (1 commits");
  expect(common).toContain("BASE-MOVED"); // a path with a space survives the hand-off to git
  expect(readFileSync(bundle(dir, "conventions.md"), "utf8")).toMatch(/Changed after this branch diverged[^=]*- AGENTS\.md/);
  expect(existsSync(bundle(dir, "primitives.md"))).toBe(false); // no map on base, no section
  expect(existsSync(bundle(dir, "intent.md"))).toBe(false); // no PR, no spec
});

test("build-bundle refuses a base that is not a commit, and runs under the bash macOS ships", () => {
  const { dir } = bundleRepo();
  const bad = run(dir, "build-bundle.sh", "origin/nope");
  expect(bad.exitCode).toBe(2);
  expect(bad.stderr.toString()).toContain("fetch it first");
  if (existsSync("/bin/bash")) {
    const old = Bun.spawnSync(["/bin/bash", join(here, "build-bundle.sh"), "main"], { cwd: dir });
    expect(old.stderr.toString()).toBe("");
    expect(old.exitCode).toBe(0);
    expect(existsSync(bundle(dir, "conventions.md"))).toBe(true);
  }
});
