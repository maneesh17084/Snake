# Snake — Normal & Mirror

Grid Snake for desktop and mobile browsers, with two modes:

- **Normal Mode**: the snake moves the way you press or swipe.
- **Mirror Mode**: both axes are reversed (Up moves down, Left moves right).

The two modes share the same board, scoring and speed curve. Each mode keeps its own personal best in `localStorage`, and the game still works if storage is blocked.

## Controls
| Input | Normal | Mirror |
|---|---|---|
| ↑ / W / swipe up | up | down |
| ↓ / S / swipe down | down | up |
| ← / A / swipe left | left | right |
| → / D / swipe right | right | left |

Esc or P pauses, M mutes. The game also pauses on its own when the tab is hidden or the window loses focus.

## Develop
```bash
npm install
npm run dev      # local dev server
npm test         # game-logic unit tests (Vitest)
npm run build    # type-check + production build to dist/
```

## Deploy to Vercel
The app is a static Vite build, and `vercel.json` already sets `npm run build` with output in `dist/`.

**Option A: Git.** Push this folder to GitHub, GitLab or Bitbucket, then go to vercel.com, choose **Add New → Project** and import the repo. Vercel picks up the settings, and each branch or PR gets a preview URL.

**Option B: CLI.**
```bash
npx vercel          # preview deployment (log in on first run)
npx vercel --prod   # production deployment
```
