# Sleeve

A [Video.js](https://videojs.org) v10 skin for video and audio, for HTML, styled with plain CSS. An entry for the Video.js Skins Design Challenge. The design note is in [docs/design-note.md](docs/design-note.md).

The idea: the video is the photograph on a record cover and the player is printed on it. Ink on paper, square corners, 2px ink rules, condensed capitals, and one flat block of colour (the field) that changes size with how much the player needs you. With no picture, the cover itself is the player ("Side B").

## Use it

A skin is a light-DOM template plus CSS. Today a host uses it directly from this repository:

1. Put the template, `src/video/skin.html` or `src/audio/skin.html`, inside `video-player` or `audio-player`, with a media element at the marked slot (`<!-- Add a compatible media component here. -->`).
2. Import `src/video/skin.ts` or `src/audio/skin.ts`, which pulls in the elements, icons and styles.
3. For more than one player on a page, run the template through `uniqueIds(template, suffix)` from `src/shared/unique-ids.ts` first. It suffixes every `id` and every attribute that points at one, so the players do not share ids.
4. The video skin also has an audio look for media without a picture. Set `data-mode="audio"` on the skin root (`media-container`) to force it, `data-mode="video"` to prevent it, or leave it unset to let the skin decide.
5. Give the video player a shape: the skin fills its parent, so set a width and an `aspect-ratio` (or a height) on the element around it. In the audio look, without a height from the host, the player takes a 5:2 cover.
6. Two custom properties set on the player colour it for a brand: `--media-accent-color` pins the field to one colour in every state, and `--sleeve-on-accent` sets the text and glyphs on it. Without the second, the skin picks black or white where the browser has `contrast-color()`.

Previews show how the two pieces fit: `apps/preview/src/frame/player.ts` (video) and `audio-player.ts` (audio).

## Pages

- `/` is the demo page.
- `/workbench.html` is the workbench: a player in a frame with an options panel for width, aspect ratio, colour scheme, text direction, language and playback options. The settings live in the URL, so `/workbench.html?width=384&ratio=9:16&dir=rtl&locale=ar` opens it in that state.
- `/preview.html` is the video skin on its own.
- `/audio.html` is the audio skin on its own.

The single-player pages read their settings from the hash: `width`, `ratio` (video only), `scheme`, `dir`, `locale`, `autoplay`, `muted`, `loop` (`1` for on) and `preload`. For example `/preview.html#width=384&ratio=9:16` or `/audio.html#width=576`.

`/audio.html` also takes query switches for the edge cases: `?art=none` (no artwork), `?art=broken` (an image that fails to load), `?title=long` and `?title=none`.

Change the media in `apps/preview/src/frame/player.ts` (video) and `audio-player.ts` (audio).

## Develop

Needs Node 22.22 or newer and pnpm.

```sh
pnpm install --ignore-scripts
```

```sh
pnpm dev
```

```sh
pnpm typecheck
```

```sh
pnpm build
```

## Deploy

A push to `main` builds the pages and publishes `dist/` to GitHub Pages through `.github/workflows/deploy.yml`. The repository needs Settings → Pages → Source set to "GitHub Actions". The build uses relative URLs, so it works in the `/sleeve/` subfolder.

## Status

A design-challenge entry and a proof of concept. It is not published to npm and has no automated tests. It has been checked by hand in Chromium, in light and dark, at several widths.

Not yet checked: Safari, Firefox, real devices (touch, phones), and screen readers.

## Where things live

- `src/`: the skins, and only the skins.
  - `src/video/`: the video skin (template, styles, element imports).
  - `src/audio/`: the audio skin.
  - `src/styles/`: tokens, themes and base styles both skins share, plus a per-preset layer in `video/` and `audio/`.
  - `src/shared/`: code both skins share, such as the icons and `uniqueIds`.
  - `src/skin.css`: global styles, loaded only in the preview.
- `apps/preview/`: the pages.
  - `src/demo/`: the demo page and its design note.
  - `src/shell/`: the workbench shell.
  - `src/frame/`: the pages the shell frames; `player` and `audio-player` mount a skin in a player and set its media.
  - `public/`: files the preview serves, such as the chapters track.
- `docs/`: the design note and the spike notes behind the choices.
- `skin.json`: what the video skin was created from, including the Video.js version. The audio skin comes from the same command with `--preset audio`.
- `AGENTS.md`: rules for coding agents working on this project.

## Licence

Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). The skins start from the Video.js Scaffold skin (Apache-2.0, Video.js contributors). Archivo is self-hosted under the SIL OFL 1.1.

## Learn more

- [Build your own skin](https://videojs.org/docs/framework/html/guides/build-your-own-skin)
- [Customize skins](https://videojs.org/docs/framework/html/guides/customize-skins)
- [UI components](https://videojs.org/docs/framework/html/guides/ui-components)
