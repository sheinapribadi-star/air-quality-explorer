import { defineConfig } from 'vite';

// GitHub Pages serves this project at https://sheinapribadi-star.github.io/air-quality-explorer/,
// so production builds use that sub-path. `npm run dev` stays at the root (http://localhost:5173/).
// Override with BASE_PATH=/ (e.g. for Netlify/Vercel at a domain root).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.BASE_PATH || '/air-quality-explorer/') : '/',
}));
