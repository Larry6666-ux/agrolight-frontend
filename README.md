# AgroLight OS — Frontend (deployable Next.js app)

This is a **real, standalone Next.js app** — not a Claude.ai artifact. It's built to be pushed to GitHub and deployed on Vercel (or run locally), separately from the `agrolight-os-backend` project.

## Why this exists

The earlier `.jsx` file was built for Claude.ai's in-chat preview, which provides things a real deployed site doesn't: a `window.storage` API for persistence, and Tailwind CSS pre-configured with no build step. Neither of those exist outside Claude.ai, so pasting that file straight into a real project doesn't work — it renders unstyled and throws errors the moment it tries to save a session. This project is the same UI and the same real API calls, rebuilt as an actual Next.js project with:

- `window.storage` → replaced with real `localStorage`
- Tailwind CSS properly configured (`tailwind.config.js`, `postcss.config.js`, `@tailwind` directives in `globals.css`) so the styling actually renders
- A real `package.json` with `lucide-react` as an installable dependency

## Getting started locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` (a different port than the backend — run them side by side, e.g. backend on 3002, frontend on 3000).

## Deploying to Vercel

1. Push this folder to its **own** GitHub repo (separate from `agrolight-os-backend` — don't combine them into one Vercel project, that's part of what went wrong last time)
2. Import it into Vercel as a new project
3. No environment variables are required to deploy — the app asks for your backend URL on first load and remembers it in the browser afterward
4. (Optional) Set `NEXT_PUBLIC_DEFAULT_API_BASE` in Vercel's Environment Variables to pre-fill that field with your backend's URL, e.g. `https://agrolight-os-backend.vercel.app`

## How it connects to the backend

On first load, you'll see a **Connect** screen asking for the backend's URL. Enter your deployed `agrolight-os-backend` URL (e.g. `https://agrolight-os-backend.vercel.app`, no trailing slash needed). It logs in as the seeded demo farmer (phone `08160510275`) and remembers the connection in your browser's `localStorage` — no backend env vars required on this side.

Make sure the backend has:
- A real `DATABASE_URL` (Vercel doesn't provision Postgres automatically — see the backend's own README)
- `npm run db:push` and `npm run db:seed` already run against that database
- CORS enabled (already included in the backend's `middleware.ts`)

## What's in here

- `app/page.jsx` — the entire app (client component: dashboard, marketplace, bookings, wallet, AI Copilot chat, admin view)
- `app/layout.jsx` — root HTML shell, imports the global stylesheet
- `app/globals.css` — Tailwind's base/components/utilities layers
- `tailwind.config.js` / `postcss.config.js` — the build pipeline that makes the Tailwind classes in `page.jsx` actually generate CSS

## Known limitation

Font loading uses a `@import` inside a `<style>` tag pointing at Google Fonts — it works, but for production you'd normally switch to `next/font` for better performance. Left as-is here to keep this a minimal, working first pass.
