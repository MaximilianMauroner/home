# Personal Website

My personal website and blog, built with Astro. Visit at [mauroner.net](https://www.mauroner.net/)

## 👋 About

This is where I document my journey, share technical insights, and build useful tools. Feel free to explore my:

- Development logs tracking my projects' progress
- Blog posts about tech, programming, and personal experiences
- Tools I've built to solve specific problems

## 🚀 Features

- **Blog Posts**: Technical articles and personal thoughts
- **Dev Logs**: Regular updates about my projects and learnings
- **Tools**:
  - WhatsApp Chat Statistics
  - Spotify Listening History Analysis
  - More coming soon...

## 🛠 Tech Stack

- [Astro](https://astro.build) - Core framework
- [React](https://reactjs.org) - Interactive components
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Chart.js](https://www.chartjs.org) - Data visualization
- [TypeScript](https://www.typescriptlang.org) - Type safety

## 📁 Project Structure

```text
/
├── public/          # Static assets
├── src/
│   ├── assets/      # Images and other assets
│   ├── components/  # React and Astro components
│   ├── content/     # Blog posts and dev logs (MDX)
│   ├── layouts/     # Page layouts
│   ├── pages/       # Routes and pages
│   ├── styles/      # Global styles
│   ├── types/       # TypeScript types
│   └── utils/       # Helper functions
└── package.json
```

## 🧞 Commands

| Command           | Action                               |
| :---------------- | :----------------------------------- |
| `bun install`     | Install dependencies                 |
| `bun run dev`     | Start dev server at `localhost:4321` |
| `bun run test`    | Run the Vitest test suite            |
| `bun run build`   | Build for production to `./dist/`    |
| `bun run preview` | Preview production build locally     |

## 📝 Adding Content

- Blog posts go in `src/content/blog/`
- Dev logs go in `src/content/log/`
- New tools can be added to `src/pages/tools/`

Before publishing content:

- Trim the title and write a specific, standalone description.
- Check spelling, sentence capitalization, and product names.
- Test every link and replace local development URLs with production-relative URLs.
- Confirm the publish flag, release date, tags, and image are intentional.

## 📫 Contact

Feel free to reach out or follow my work:

- Website: [mauroner.net](https://www.mauroner.net)
- GitHub: [@maximilianmauroner](https://github.com/MaximilianMauroner)
