import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const git = (cwd, args) => {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
};

/** @type {Map<string, Set<string>>} */
const shallowCommitsByRepo = new Map();

// In a shallow clone, the boundary commit appears to add every older file, so
// its date says nothing about when such a file last changed.
const getShallowCommits = (cwd) => {
  const repo = git(cwd, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  if (!shallowCommitsByRepo.has(repo)) {
    const shallowFile = path.join(repo, "shallow");
    shallowCommitsByRepo.set(
      repo,
      new Set(
        repo && existsSync(shallowFile)
          ? readFileSync(shallowFile, "utf8").split("\n").filter(Boolean)
          : [],
      ),
    );
  }
  return shallowCommitsByRepo.get(repo);
};

/**
 * Returns the committer date of the last commit that changed `filepath`, or
 * undefined when git history cannot tell (no repository, untracked file, or a
 * shallow-clone boundary commit).
 * @param {string} filepath
 * @returns {string | undefined}
 */
export function getGitModifiedDate(filepath) {
  const cwd = path.dirname(filepath);
  const [hash, date] = git(cwd, [
    "log",
    "-1",
    "--format=%H %cI",
    "--",
    filepath,
  ]).split(" ");
  if (!hash || !date || getShallowCommits(cwd).has(hash)) return undefined;
  return date;
}
