# Max Mauroner's website

This repository contains my website, blog, development log, and small web tools.
The live site is [mauroner.net](https://www.mauroner.net/).

The tools cover audio tests, data analysis, planning, games, and personal
workflows. Browse the current collection on the
[tools page](https://www.mauroner.net/tools/). The route tree, not this README,
is the tool inventory.

## Stack

- Astro for pages, content, and builds
- React for interactive tools
- Tailwind CSS for styling
- TypeScript for application code
- Vitest for tests

## Commands

| Command | Action |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Start the development server on `localhost:4321` |
| `bun run test` | Run the Vitest suite |
| `bun run build` | Check Astro and build `dist/` |
| `bun run preview` | Preview the production build |

## Content

- Blog posts live in `src/content/blog/`.
- Development logs live in `src/content/log/`.
- Tools live under `src/pages/tools/` and their supporting component folders.

Before you publish content:

- Use a specific title and a standalone description.
- Check spelling, sentence capitalization, and product names.
- Test every link and remove local development URLs.
- Confirm the publish flag, release date, tags, and image.

## Contact

- Website: [mauroner.net](https://www.mauroner.net)
- GitHub: [@MaximilianMauroner](https://github.com/MaximilianMauroner)
