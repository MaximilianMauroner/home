# Personal Website

My personal website built with Astro where I share blogs, development logs, and useful tools.

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

| Command           | Action                                    |
| :--------------- | :---------------------------------------- |
| `npm install`    | Install dependencies                      |
| `npm run dev`    | Start dev server at `localhost:4321`      |
| `npm run build`  | Build for production to `./dist/`         |
| `npm run preview`| Preview production build locally          |

## 📝 Adding Content

- Blog posts go in `src/content/blog/`
- Dev logs go in `src/content/log/`
- New tools can be added to `src/pages/tools/`
