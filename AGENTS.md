# Agent guide

Sleeve is a Video.js **v10** skin for HTML, in two parts: a video skin (`src/video/skin`) and an audio skin (`src/audio/skin`). Both started from the Scaffold skin made by `videojs skin create`; `skin.json` records how. `apps/preview/` is the workbench that previews them and becomes the public demo page. `README.md` describes the rest.

## Video.js API

- The only API source is the v10 documentation: <https://videojs.org/docs/framework/html/llms.txt>. Read the page for an element before using it; do not write its attributes or state from memory.
- Never use Video.js 8 or older APIs: no `videojs()` call, no `data-setup`, no `video-js` class, no `vjs-*` class names, no `player.on(...)` plugins. v10 is custom elements imported from `@videojs/html/ui/<name>`, with state in data attributes and CSS custom properties.
- Use the `videojs-skin` skill when changing a skin. `pnpm dlx @videojs/cli agents skills` prints how to install it.
- Write original code. Do not copy source, names or constants from other players or from any proprietary project.

## Where things live

- `src/video/`: the video skin (`skin.html` template, `skin.css`, `skin.ts` imports and icons).
- `src/audio/`: the audio skin, same three files.
- `src/styles/`: what both skins share. `base.css` and `themes/` (tokens, the `sleeve` theme, user preferences) are common; `video/` and `audio/` hold the per-preset theme layer. Put anything both skins need here, not in one skin's folder.
- `apps/preview/src/frame/`: the preview pages. `player` and `audio-player` set the media each preview plays; `mount` puts a player on the page.
- `apps/preview/src/shell/`: the workbench shell (React, Tailwind). Change it only when asked.

## Rules

- Keep every control keyboard operable, labeled, with a visible focus indicator, at least 44×44px on touch, and in source order that matches its visual order. Keep the error dialog, hotkeys and status announcer unless you replace them.
- State is never shown by colour alone.
- Plain CSS and TypeScript only. No new runtime dependencies; ask before adding a dev dependency.
- pnpm only, always with `--ignore-scripts` on install. `pnpm-workspace.yaml` sets a minimum release age of three days; do not lower it.
- No secrets in the repository. Media URLs in the previews are public playback URLs.
- Run `pnpm typecheck` and `pnpm build` after changes, and check both skins in the workbench with `pnpm dev` (`/` for video, `/audio.html` for audio).
- Commits follow Conventional Commits and carry no "Generated with" line and no AI co-author trailer.
- Deploys happen from `main` through `.github/workflows/deploy.yml` (GitHub Pages). Do not push or deploy unless asked.
