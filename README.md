# Sleeve

A [Video.js](https://videojs.org) v10 skin for video and audio, for HTML, styled with plain CSS. An entry for the Video.js Skins Design Challenge.

The idea: the video is the photograph on a record cover and the player is printed on it. Ink on paper, square corners, condensed capitals, and one flat block of colour that changes size with how much the player needs you. With no picture, the cover itself is the player ("Side B").

> Work in progress. Today both skins are still the Scaffold skin they started from; the design lands over the coming days.

## Develop

Needs Node 22.22 or newer and pnpm.

```sh
pnpm install --ignore-scripts
```

```sh
pnpm dev
```

The workbench opens the video skin in a slimmed-down version of the Video.js sandbox. It plays NASA's Cosmic Dawn trailer from Mux, with chapters. The options panel sets the player's width and aspect ratio, the colour scheme, text direction and language, and playback options such as autoplay, muted, loop and preload. The settings live in the URL, so `/?width=384&ratio=9:16&dir=rtl&locale=ar` opens the workbench in that state.

- `/preview.html#width=384&ratio=9:16` opens the video preview on its own.
- `/audio.html#width=576` opens the audio skin on its own. It takes the same settings, except the aspect ratio.

Change the media in `apps/preview/src/frame/player.ts` (video) and `audio-player.ts` (audio).

```sh
pnpm typecheck
```

```sh
pnpm build
```

## Deploy

A push to `main` builds the workbench and publishes `dist/` to GitHub Pages through `.github/workflows/deploy.yml`. The repository needs Settings → Pages → Source set to "GitHub Actions". The build uses relative URLs, so it works in the `/sleeve/` subfolder.

## Where things live

- `src/`: the skins, and only the skins.
  - `src/video/`: the video skin (template, styles, element imports).
  - `src/audio/`: the audio skin.
  - `src/styles/`: tokens, themes and base styles both skins share, plus a per-preset layer in `video/` and `audio/`.
  - `src/skin.css`: global styles, loaded only in the preview.
- `apps/preview/`: the workbench.
  - `src/shell/`: the workbench shell.
  - `src/frame/`: the pages the shell frames; `player` and `audio-player` mount a skin in a player and set its media.
  - `public/`: files the preview serves, such as the chapters track.
- `skin.json`: what the video skin was created from, including the Video.js version. The audio skin comes from the same command with `--preset audio`.
- `AGENTS.md`: rules for coding agents working on this project.

## Licence

Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). The skins start from the Video.js Scaffold skin (Apache-2.0, Video.js contributors).

## Learn more

- [Build your own skin](https://videojs.org/docs/framework/html/guides/build-your-own-skin)
- [Customize skins](https://videojs.org/docs/framework/html/guides/customize-skins)
- [UI components](https://videojs.org/docs/framework/html/guides/ui-components)
