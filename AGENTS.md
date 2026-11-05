# Agent instructions

## Git workflow

- Always commit **and** push all changes directly to `main`. Do not leave
  changes uncommitted or unpushed, and do not use feature branches or pull
  requests.
- Use a clear commit message: a short summary line, then a brief explanation of
  what changed and why.
- Pushing to `main` deploys the site to GitHub Pages through
  `.github/workflows/deploy.yml`, so check that the build passes
  (`npm run build`) before pushing.

## Project

- Saunatime: an Astro site showing the average cost of a sauna session from
  Finnish spot electricity prices (porssisahko.net and Elering).
- The site is English only, with big text and a simple, mobile-first layout.
- It is a PWA: `src/pages/manifest.webmanifest.ts` generates the manifest and
  `public/sw.js` is the service worker (bump `CACHE` in it when the shell
  changes). Page meta tags and Open Graph tags are in `src/pages/index.astro`.
- Icons and the social share image are generated from the single drawing in
  `design/art.fragment.svg`. After editing it (or the text in
  `scripts/make-icons.mjs`), run `npm run icons` and commit the PNGs in
  `public/`.
- Served from `https://krugou.github.io/saunatime/` (`base: "/saunatime"` in
  `astro.config.mjs`).
