# Sleeve

A [Video.js](https://videojs.org) v10 skin for video and audio, for HTML, styled with plain CSS. An entry for the Video.js Skins Design Challenge. The design note is in [docs/design-note.md](docs/design-note.md).

The idea: the video is the photograph on a record cover and the player is printed on it. Ink on paper, square corners, 2px ink rules, condensed capitals, and one flat block of colour (the field) that changes size with how much the player needs you. With no picture, the cover itself is the player ("Side B"). The poster prints in greyscale on the cover, on wide players the cover's numeral sits slightly out of register, and the pigments get richer on wide-gamut screens.

## Use it

A skin is a light-DOM template plus CSS. Today a host uses it directly from this repository:

1. Put the template, `src/video/skin.html` or `src/audio/skin.html`, inside `video-player` or `audio-player` (`sleeve-player` from `src/video/player.ts` for live support too: under `video-player` the video skin plays on-demand media only), with a media element at the marked slot (`<!-- Add a compatible media component here. -->`).
2. Import `src/video/skin.ts` or `src/audio/skin.ts`, which pulls in the elements, icons and styles.
3. For more than one player on a page, run the template through `uniqueIds(template, suffix)` from `src/shared/unique-ids.ts` first. It suffixes every `id` and every attribute that points at one, so the players do not share ids.
4. The video skin also has an audio look for media without a picture. Set `data-mode="audio"` on the skin root (`media-container`) to force it, `data-mode="video"` to prevent it, or leave it unset to let the skin decide. A host that knows its media has no picture should set `data-mode="audio"`: left to itself the skin can only switch once the metadata is known, so until then it shows the video look (and then the picture controls leave the strip, the poster moves beside the cover and, without a height from the host, the player takes its 5:2 shape). In the audio look the `f`, `c` and `i` shortcuts and double-tap fullscreen are switched off; a double-tap then seeks 10 seconds back on the left half and forward on the right half.
5. Give the video player a shape: the skin fills its parent, so set a width and an `aspect-ratio` (or a height) on the element around it. In the audio look, without a height from the host, the player takes a 5:2 cover.
6. In fullscreen the video skin keeps its controls out of a phone's notch and rounded corners with `env(safe-area-inset-*)`, which is zero unless the host page's viewport meta has `viewport-fit=cover`.
7. Two custom properties set on the player colour it for a brand: `--media-accent-color` pins the field to one colour in every state, and `--sleeve-on-accent` sets the text and glyphs on it. Without the second, the skin picks black or white where the browser has `contrast-color()`.

8. The extras are optional and sit in `src/shared/` and `src/styles/extras/`; the video skin imports all of them, the audio skin only the Press, the registration mark and `<sleeve-session>`. Each is a helper element that writes `data-*` attributes for the CSS or opens a dialog, and none has an API of its own:
   - **Tracks** and **Keys** sheets, two dialogs opened from the settings menu or from a cell in the strip. The tracklist lists the media's chapters and a row seeks the media to that chapter (it uses the time feature's `seek()`, with the owner's approval). `T` opens it while focus is in the player; the Keys sheet lists the player's live hotkeys.
   - **The Press**: state changes print as a short stepped inset on the field, not a fade.
   - **Registration mark**: the crosshair around the play disc while buffering.
   - **Media Session**: `<sleeve-session>` sets the browser's `navigator.mediaSession` (title, artwork, play, pause, seek) so lock screens and media keys can drive the player. It is the one place the skin talks to a browser API outside Video.js.
   - **Caption styles**: a choice in the settings menu (default, large, white on black, yellow on black) that sets `data-caption-style` for `::cue`.
   - **The tour** on the demo page: five steps through Ready, Playing, Paused, Ended and Error. It is page code in `apps/preview/src/demo/` and drives the media element only.

Previews show how the two pieces fit: `apps/preview/src/frame/player.ts` (video) and `audio-player.ts` (audio).

## Pages

- `/` is the demo page: every player on one page, with a colour scheme, field colour and width picker and a language select (English, Deutsch, 日本語, العربية) that sets the language, and for Arabic the direction, of all the players.
- `/workbench.html` is the workbench: a player in a frame with an options panel for width, aspect ratio, colour scheme, text direction, language and playback options. The settings live in the URL, so `/workbench.html?width=384&ratio=9:16&dir=rtl&locale=ar` opens it in that state.
- `/preview.html` is the video skin on its own.
- `/audio.html` is the audio skin on its own.

The single-player pages read their settings from the hash: `width`, `ratio` (video only), `scheme`, `dir`, `locale`, `autoplay`, `muted`, `loop` (`1` for on) and `preload`. For example `/preview.html#width=384&ratio=9:16` or `/audio.html#width=576`.

`/audio.html` also takes query switches for the edge cases: `?art=none` (no artwork), `?art=broken` (an image that fails to load), `?title=long` and `?title=none`.

`/preview.html#live=https://example.com/stream.m3u8` plays an https source of your own in place of the demo clip (anything else in `live` is ignored). The preview uses the `<sleeve-player>` tag from `src/video/player.ts`: Video.js's video features plus its live feature, so one template plays on-demand and live media. A live source gets the LIVE cell described in the design note; `<sleeve-state>` writes `data-live` from Video.js's own live state.

One limit with live DASH (`shaka-video`): while the stream is paused, Video.js does not re-read the moving seek range, so the LIVE cell can stay on after a long pause. The PLAY YOUR OWN box works around it by sending the media element a `progress` event every second while a live DASH stream is paused; a page of your own that plays live DASH needs the same.

Change the media in `apps/preview/src/frame/player.ts` (video) and `audio-player.ts` (audio).

## Sources

The PLAY YOUR OWN box on `/` plays an https HLS, DASH, MP4, WebM or MP3 link, a Mux playback ID, a Cloudflare Stream link, and a single YouTube or Vimeo video link. The DASH, Cloudflare, YouTube and Vimeo engines are dev dependencies loaded on demand (`@videojs/youtube-video`, `@videojs/vimeo-video`): nothing from those services loads until you press Play, and the page says so before you do. A YouTube link is rebuilt from its video id and played from `youtube-nocookie.com`, though YouTube's script still comes from youtube.com; Vimeo is rebuilt from its id. Both show a "Watch on" link to the original page. The skin hides the controls a provider does not report (for example quality, captions, the live cell and, on YouTube, picture-in-picture), and `data-mode="video"` keeps the video look for these embeds. The visitor's link stays in the tab.

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

Check a CSS change against the build as well (`pnpm build`, then `pnpm exec vite preview`): the build splits the CSS into chunks and loads them in a different order from the dev server. That is why every skin stylesheet restates the layer order on its first lines.

## Deploy

A push to `main` builds the pages and publishes `dist/` to GitHub Pages through `.github/workflows/deploy.yml`. The repository needs Settings → Pages → Source set to "GitHub Actions". The build uses relative URLs, so it works under any base path.

## Status

A design-challenge entry and a proof of concept. It is not published to npm and has no automated tests. It has been checked by hand in Chromium, in light and dark, at several widths.

Language: the menu labels, Paused and Playing use Video.js's own translation keys and follow the language of the player's `media-i18n`. Ready, Ended, Buffering and the Error label stay English: Video.js has no key for them, and its docs describe no way to add keys of our own, so the skin does not build a translation layer. The seek button labels, tooltips and error text come from Video.js and follow the language.

The extras add English-only words: the Tracks and Keys sheet titles, key names and actions, the caption style names and the tour copy. They do not follow `media-i18n`.

Not yet checked: Safari, Firefox, real devices (touch, phones), screen readers, the real lock screen for Media Session, and forced-colours rendering of the extras. The Tracks sheet was checked on the video skin only: the audio skin has no tracklist.

## Where things live

- `src/`: the skins, and only the skins.
  - `src/video/`: the video skin (template, styles, element imports).
  - `src/audio/`: the audio skin.
  - `src/styles/`: tokens, themes and base styles both skins share, plus a per-preset layer in `video/` and `audio/`.
  - `src/shared/`: code both skins share, such as the icons, `uniqueIds` and `<sleeve-state>`, the helper element that tells the video skin's CSS whether the media has a picture.
  - `src/shared/sleeve-sheet.ts`, `sleeve-tracklist.ts`, `sleeve-keys.ts`, `sleeve-session.ts` and `sleeve-caption-style.ts`: the extras above.
  - `src/styles/extras/`: `sheet.css`, `press.css`, `registration.css` and `captions.css`.
  - `src/skin.css`: global styles, loaded only in the preview.
- `apps/preview/`: the pages.
  - `src/demo/`: the demo page, its design note and the tour (`tour.ts`, `tour.css`).
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
