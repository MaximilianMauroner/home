import { getGitModifiedDate } from "./git-modified-date.mjs";

// Leaves lastModified unset when neither frontmatter nor git history gives a
// reliable date, so pages can omit modification metadata instead of guessing.
export function remarkModifiedTime() {
  return function (_, file) {
    const filepath = file.history[0];
    file.data.astro.frontmatter.lastModified ||= getGitModifiedDate(filepath);
  };
}
