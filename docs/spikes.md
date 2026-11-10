# Spikes

Answers to the design spikes, researched in the Video.js v10 source (`@videojs/html` 10.3.0) and docs and checked by a second reader. "Check" is what to look at in the browser to confirm.

## s5 (confirmed)

Confirmed. Triggers use commandfor (src/video/skin.html:173 mute->volume popover, :219 plain button->media-menu, :229 menu-item->submenu; src/audio/skin.html:110 rate button). Core stamps popover:"manual" (core/ui/menu/core.js:76, popover/core.js:49, tooltip/core.js:40). Menu restoreFocus (dom/ui/menu/menu.js:110) skips only imperative-action, group-open, blur, outside-click; Escape (popover.js:17-19) and default close reason "click" (popover.js:135) restore focus to the trigger after the close transition (menu.js:158-163). Volume popover has open-on-hover (video:185, audio:145).

**Decision:** Keep scaffold markup and the base.css @supports-not fallback; style via data-open/data-side/data-starting-style/data-ending-style; no custom popover, z-index or focus code. Test in fullscreen.

**Evidence:** Source lines above. The tryShowPopover cite was at @videojs/utils dist/dom/popover.js (the earlier dist/dev path does not exist, file is dist/dom/popover.js).

**Check:** Open the gear menu, press Escape: document.activeElement is the gear button. menu.matches(':popover-open') is true while open and menu.getAttribute('popover') === 'manual'.

## s6 (corrected)

Mostly confirmed: errorFeature (core dom/store/features/error.js:8-18) sets error on media 'error', clears on 'emptied'; dismissError only sets null; element.js:50 calls dismissError on close, :77 opens when error present; popup role=alertdialog and Escape/close dismiss (docs components/error-dialog.md:57,61). No retry API; docs guides/playback-errors.md:55 warns against same-source retry loops.

**Decision:** Ship dismiss only (default media-dialog-close). Retry would be custom code, post-v1, gated on error.code === 2.

**Evidence:** As cited, all opened and matched. Error: the media element in the preview pages is <mux-video>/<mux-audio> (apps/preview/src/frame/player.ts:20, audio-player.ts:18), not a <video> tag.

**Check:** const m=document.querySelector('mux-video'); m.src='https://example.invalid/x.m3u8' (or a 404 URL); wait: media-dialog-popup gets data-open. Press Escape: it closes, m.error stays non-null. Setting a good src should clear it if 'emptied' fires; verify, do not assume.

**Corrected:** browser_check used document.querySelector('video'), which returns null here. Use 'mux-video'. Whether load() on mux-video emits 'emptied' (clearing the error) is not proven from source.

## hotkeys (confirmed)

Confirmed. media-hotkey registers on the container (element.js #register, createHotkey; target default 'player'). Coordinator skips locked interaction, interactive activations (Space/Enter on buttons), editable fields without modifiers (coordinator.js:#handleEvent). Defaults: seekStep -10 for ArrowLeft/j else 10; volumeStep +/-0.05 (media-action-value.js:8-9); seekToPercent key*10 (actions.js). Scaffold maps match (video skin.html:373-406; audio is the same minus f/c/i, :161-188). Seek buttons set hotkeyValue=seconds (seek-button/element.js:25) and getShortcut filters value strictly equal (coordinator.js:#getActionBindings), so scaffold hotkeys (no value) give seek buttons no aria-keyshortcuts. Other buttons (play, mute, fullscreen, captions, pip, speed) have no value and do get it.

**Decision:** Add value="-10" to ArrowLeft and j, value="10" to ArrowRight and l, matching the buttons' seconds="10". Keep the rest.

**Evidence:** Files above opened and matched. Hotkeys without value also still use the 10s default, so adding value=-10/10 changes nothing functionally.

**Check:** After the edit: document.querySelector('media-seek-button[seconds="10"]').getAttribute('aria-keyshortcuts') is non-null (null before). Focus player, press k, m, ArrowRight, 5, f to confirm behaviour.

## gestures (confirmed)

Confirmed. Scaffold video template has the five gestures (src/video/skin.html:407-416); none in audio. Left seek defaults to -10 (dom/gesture/action-value.js:8), right +10. Tap threshold 250 ms (coordinator.js:6). Regions are resolved per gesture type (getActiveRegions filters by type and pointer): doubletap has left/center/right so thirds; mouse tap has only center, so it covers the whole surface (region.js: size 1 and center). Touch tap toggleControls is claimed in controls.js ~:103 (claimsTap). Presses starting on interactive targets are ignored (coordinator.js isInteractiveTarget).

**Decision:** Keep the scaffold set; optionally add explicit value="-10"/"10". No custom pointer listeners.

**Evidence:** region.js, coordinator.js:60-155 and controls.js ~:97-105 read directly.

**Check:** Device toolbar (touch): tap toggles controls without pausing; double-tap right third seeks +10. Desktop: click anywhere pauses/plays; double-click left/right third seeks, centre third toggles fullscreen.

## menus (confirmed)

Confirmed. Defaults [0.5,0.75,1,1.25,1.5,1.75,2], filtered to the media range (docs api/feature-playback-rate.md:23,73; core ui/utils/playback-rates.js). default-playback-rates (space-separated) on the player; rates on radio group or button overrides (components/playback-rate-button.md:108, playback-rate-radio-group.md:185). Audio skin's media-playback-rate-button has commandfor (audio skin.html:110), and with commandfor it opens the menu instead of cycling (playback-rate-button/element.js:29-33; core.js cycle returns when menuTrigger). Without commandfor it cycles with wraparound.

**Decision:** Set default-playback-rates once on the player element (preview pages and README). For audio keep the menu form, or remove commandfor plus the media-menu for a true cycle button.

**Evidence:** Files above opened and matched. Store field playbackRates is documented at feature-playback-rate.md:31 and the player element exposes a .store getter (player/element.js:92).

**Check:** document.querySelector('audio-player').store.state.playbackRates (accessor path is inferred from docs, confirm it exists) returns the list. Set default-playback-rates="1 1.5 2" and reopen the menu: 3 items. The audio speed button has commandfor and opens a menu.

## s2 (confirmed)

Confirmed. src/video/skin.css:1934 and src/audio/skin.css:1494 set `container: media-root / inline-size` on `.media-container, :scope.media-container`, which is the `<media-container class="media-skin">` element. The skin template's first line confirms this. The scaffold sets `video-player` to `display: contents` (scaffold-skin.css:14), so it cannot be a container. `requestFullscreen(container, media)` in core dom/presentation/fullscreen.js calls `el.requestFullscreen()` on the container after `hideOpenPopovers`. core/ui/tooltip/core.js:40 and popover/core.js:49 use `popover: "manual"`. positioning.js getFixedContainingBlockOrigin returns 0,0 when the popup is in the top layer. preview.css:26 does set aspect-ratio.

**Decision:** Keep the single container on media-container.media-skin (name media-root, inline-size). Write bands as `@container media-root (width >= Xrem)` on descendants, and use cqi only on descendants. Nothing in the source contradicts the no-data-size-fallback decision. Not verified: captions.css:31.

**Evidence:** src/video/skin.css:1934; src/audio/skin.css:1494; html scaffold-skin.css:14; @videojs/core dist/default/dom/presentation/fullscreen.js:30-40; dom/ui/popover/positioning.js:~220-242.

**Check:** Select media-container.media-skin and check Computed: container-type inline-size, container-name media-root. Press F and run `$0.matches(':fullscreen')`. Open Settings and hover a button, then resize the preview and confirm the bands still switch.

## s4 (corrected)

Mostly confirmed. text-track.js:89-95 picks the first track with kind==='chapters', clamps cues at line 106, and re-syncs on addtrack, removetrack, change, loadstart, durationchange and each track element's load event (lines 113-130, including shadow-root tracks). chapters.js update() clones the template root once per range, including gap ranges, and sets --media-slider-chapter-start, -end, -width, -fill and -buffer. It applies data-active and data-highlighted. Gaps get pointer-events:none and no cue. The title element and scaffold markup are as described. Correction: after rendering, the `<template>` stays a child of media-time-slider-chapters, so `children` also lists the template.

**Decision:** Reuse the scaffold chapter markup unchanged and keep the <track kind="chapters"> for both players. Restyle with data-active, data-highlighted and the --media-slider-chapter-* vars, and use :empty on the title.

**Evidence:** core dom/store/features/text-track.js:89-130; html ui/time-slider/chapters.js update() and #getTemplateRoot; docs/reference/components/time-slider.md; src/audio/skin.html:21-44.

**Check:** `[...document.querySelector('media-time-slider-chapters').children].filter(e=>e.tagName==='DIV').map(e=>e.style.cssText+' '+e.dataset.active)` gives one div per chapter or gap with start/end vars. Hover the slider and confirm one div has data-highlighted and media-time-slider-chapter-title has the cue text. `document.querySelector('mux-video').textTracks[0].kind` returns 'chapters'. Repeat on the audio page.

**Corrected:** The browser_check was wrong: `[...$0.children]` includes the retained <template> element (chapters.js #getTemplateRoot keeps it and inserts the clones before the end of the child list). Filter to the cloned divs.

## tooltip (corrected)

Confirmed with one count error. The tooltip element supports a `trigger` attribute (it is read in html ui/tooltip/element.js:75 and 145), alongside the documented `commandfor`. It defaults to a 600 ms delay and to role=presentation, and it carries popover="manual" (core.js:40). data-open, data-side and data-starting-style are documented. tooltip.js:77 returns early for pointerType 'touch', and lines 84-88 ignore focus right after a pointerdown. Correction: skin.html has four statically disabled tooltips (lines 90, 104, 117, and the mute one at 179, which also has delay=0 and sticky). Audio skin.html:139 has one more. The video skin has no fifth.

**Decision:** Keep the scaffold markup. For coarse-pointer hybrids, use `@media (pointer: coarse){.media-tooltip-popup{display:none !important}}` (the !important is needed because `[data-open]` sets display:flex) or a JS matchMedia toggle of `disabled`. Tooltips are visual-only and rely on button aria-labels.

**Evidence:** docs/reference/components/tooltip.md; core dom/ui/tooltip/tooltip.js:70-95; core/ui/tooltip/core.js:40; src/video/skin.html:90,104,117,179; src/video/skin.css:532-560.

**Check:** Hover the fullscreen button for 600 ms and check that `document.querySelector('media-tooltip[data-open]')` exists, matches ':popover-open' and has position-anchor in its style. With device-toolbar touch emulation, tap a button and confirm no media-tooltip gets data-open. After adding the coarse rule, getComputedStyle(tooltip).display is 'none'.

**Corrected:** The claim of five disabled tooltips is wrong for the video skin; it is four (seek -10, center play, seek +10, mute). The audio skin has its own disabled one at line 139.

## title (confirmed)

Confirmed. title.md and html ui/title/element.js:27-28 show the element owns its textContent and sets `hidden` and data-hidden when no title resolves. core dom/store/features/metadata.js maps the `content-title` attribute on the player to the user title. The derived title is `USER_TITLE ?? MEDIA_TITLE ?? ''`, with the media title taken from media.contentData.title. mux-video parses a playbackId from the stream.mux.com .m3u8 src (source.js:35-45), then fetches https://stream.mux.com/{id}/metadata.json and uses titles[0].title, falling back to video_title. The preview sets no content-title, so the Mux title shows. The audio skin has no media-title element and skin.ts does not import ui/title.

**Decision:** Keep <media-title> and style it with data-visible. For a fixed demo title, or for audio, set `content-title` on the player; add <media-title> and the ui/title import to the audio skin if wanted. Aria labelling is the author's job, since the element is plain text.

**Evidence:** core dom/store/features/metadata.js; html ui/title/element.js:27-28; mux-video adapter.js:86-114; mux/metadata.js; mux source.js:35-45; docs/reference/components/title.md.

**Check:** `document.querySelector('media-title').textContent` returns the Mux title once the metadata.json request completes. After `document.querySelector('video-player').setAttribute('content-title','Test')`, the text becomes 'Test'. Unproven: whether removing the attribute restores the Mux title. The code only shows `??` fallthrough for undefined or null, and attribute-removal conversion was not read, so check this rather than assume it.

## state-map (confirmed)

Confirmed against source. Attr maps (core/ui/*/data.js): play-button paused/ended/started; controls visible/userActive; container controlsVisible only (container/element.js update() removes it when no controls feature); mute muted/volumeLevel/availability/hidden with levels off|low|medium|high (mute-button/core.js 60-63); fullscreen fullscreen/availability/disabled/hidden; poster visible/loading/loaded/error; buffering visible only (delay default 500); dialog open/starting-style/ending-style/scope; time-slider = slider attrs + seeking, plus undocumented data-playing. Idle 2000ms (IDLE_DELAY, controls.js:5), docs controls.md:33 says not configurable; controlsVisible stays true while media.paused. Slider vars are set inline on the slider via applyStyles(this) as e.g. '42.000%'.

**Decision:** Keep as stated: no single element carries all phases. Base phase on media-play-button; add buffering-indicator[data-visible], time-slider[data-seeking], error-dialog[data-open]. Fullscreen: the target is the container (requestFullscreen(container, media), fullscreen.js:14), so :fullscreen on the container works; media-fullscreen-button[data-fullscreen] also exists.

**Evidence:** Opened core/dist/default/core/ui/*/data.js, dom/store/features/controls.js (computeVisible), html/dist/default/ui/time-slider/element.js 100-200, dom/ui/slider/css-vars.js:6, mute-button/core.js, html/docs/reference/components/controls.md:33 and time-slider.md 459-467, 79-87.

**Check:** Elements panel: select media-play-button, media-time-slider, media-controls and media-container; press play and watch data-paused/started flip; stop moving the mouse ~2s while playing and media-controls loses data-visible and media-container loses data-controls-visible. Confirm slider inline style shows --media-slider-fill.

## s1 (corrected)

Core claims confirmed: :has() on the play button works. State is set on the button itself (media-button-element.js update(): applyStateDataAttrs(this, state, stateAttrMap)). getState: paused = media.paused && !autoplaying; started = media.started || autoplaying; ended = media.ended. playback.js:71 started = !paused || currentTime>0. Buffering/seeking/error are not on the play button. Skin is light DOM, so global @font-face applies. Wrong detail: media-thumbnail IS used by the skins (video skin.html:143, audio skin.html media-slider-thumbnail) and media-poster by video (skin.html:3). Both have shadow roots (poster/element.js:66, thumbnail/element.js:80) but render a <slot>, so the skin's own <img> children are light DOM and styleable; only the shadow fallback image is not.

**Decision:** Derive phase with :scope:has(media-play-button[data-paused]) etc. inside @scope. Put @font-face at top level of the stylesheet, outside @scope (not valid inside @scope); inside @layer is allowed. Set font-family via a custom property on the container. Style poster/thumbnail through the slotted <img class=...> children, not their shadow content.

**Evidence:** core/ui/play-button/core.js getState; dom/store/features/playback.js 71-76; html/dist/default/ui/media-button-element.js update(); attachShadow hits only poster, thumbnail and presets/skin.js (unused by this light-DOM skin); src/video/skin.html lines 3-5 and 143-145; src/audio/skin.html slider-thumbnail.

**Check:** Console: $0=document.querySelector('media-play-button'); setInterval(()=>console.log([...$0.attributes].map(a=>a.name).join(' ')),500); play, pause, seek to end. Check document.fonts.check('1em "YourFont"') and that media-poster.shadowRoot exists while img.media-poster-image is a light-DOM child.

**Corrected:** Original said media-thumbnail was 'not used by skin' and did not note the shadow roots render a slot. Both elements are used by the skins; slotted light-DOM img children remain styleable, so the conclusion holds. 'Keep it out of @layer-only assumptions' was vague: @font-face is valid inside @layer, only invalid inside @scope.

## s9 (confirmed)

Confirmed. Audio root is media-container with data-preset="audio" (audio/skin.html:1). audioFeatures (dom/store/features/presets.js) lacks controlsFeature, fullscreenFeature, pipFeature, textTrackFeature, so container never gets data-controls-visible and no fullscreen/captions. media-controls visibility="always": selectControls returns undefined without the feature, so ControlsCore.getState takes the !media branch (visible:true, userActive:true) and ControlsElement sets data-visible and data-user-active. Docs controls.md:33 says always 'works without the controls feature'. audio/skin.html has no fullscreen-button or controls-backdrop. It does carry a media-poster (the artwork, s11) and a second, disabled time slider (the flood, s10); it has no slider-thumbnail. time-slider-chapters and the preview plate stay empty without text tracks.

**Decision:** Share phase selectors (play-button based, buffering, seeking, error) between skins; do not rely on data-controls-visible or fullscreen in audio. Treat audio controls as always visible.

**Evidence:** core/dist/default/dom/store/features/presets.js; core/ui/controls/core.js getState; html/dist/default/ui/controls/element.js update(); store core/selector.js:29 (createSelector returns noop when feature missing); src/audio/skin.html.

**Check:** On the audio preview page: media-container has data-preset="audio" and no data-controls-visible; media-controls has data-visible and data-user-active permanently; document.querySelector('media-fullscreen-button') returns null (the audio page does hold one media-poster, in the artwork cell).

## s3 (confirmed)

Confirmed. media-time-slider reads player context only (PlayerController selectors for time/buffer/playback; controls state used via optional ?.requestControlsLock()), so it works outside media-controls and updates while controls are hidden. --media-slider-fill is applied inline on the slider element itself (element.js applyStyles(this, ...)), value like '42.000%', so only its descendants can read it. role=slider and tabIndex come from core/ui/slider/core.js getAttrs (66-67) and are applied only by slider-thumb (thumb.js:35); slider root props have no role/tabindex. Disabled slider: onPointerDown returns early (slider.js isDisabled) and fill still updates. With no thumb and default thumbAlignment 'center', nothing breaks (adjustForAlignment returns state when no thumb).

**Decision:** Use <media-time-slider class="spine" disabled aria-hidden="true"><media-slider-track><media-slider-fill></media-slider-fill></media-slider-track></media-time-slider> as a container child outside media-controls; fill width: var(--media-slider-fill); pointer-events:none. inert is optional. Do not set thumb-alignment="edge".

**Evidence:** html/dist/default/ui/time-slider/element.js 100-215; core/dist/default/dom/ui/slider/slider.js 40-85, 192-200; core/ui/slider/core.js 17, 66-67; html/ui/slider/thumb.js 32-35; time-slider.md 465.

**Check:** Inspect the spine slider: style attribute shows --media-slider-fill changing during playback; no role/tabindex in its subtree; Tab never lands on it; spine stays visible after controls idle out; Accessibility panel shows no slider for it.

## captions cue styling (confirmed in source, not yet in a browser)

The docs only say to style cues with `::cue` (guides/captions.md:105). The video sits in the shadow root of `<mux-video>`, so a document-level `::cue` does not reach it. custom-media-element.js:229 (`@videojs/media` 10.3.0) sets `part` to the tag name on the inner element, so `mux-video::part(video)::cue` is the selector the skin uses (src/video/skin.css, captions block). The `video` part name is library source, not documented.

**Check:** with a subtitle track showing, cues paint on the paper plate. If they do not, the part name or the `::cue`-after-`::part()` form is not accepted in that browser; the cue falls back to the browser default and stays readable.

## s10 (confirmed)

Confirmed in source, as s3 but for a second slider. A disabled `media-time-slider` holding only `media-slider-track` and `media-slider-fill` sets `--media-slider-fill` inline on itself, so only its descendants read it. It has no thumb, so it has no role, no tab stop and no hotkey. The artwork's progress flood is that fill, growing from the left edge. No player API of our own is involved.

**Decision:** The flood is `media-time-slider.sleeve-spine[disabled][inert]` inside the artwork, `aria-hidden`, with `.sleeve-spine-fill { width: var(--media-slider-fill) }` and `mix-blend-mode: multiply`, plus a 2px ink needle (`.sleeve-spine-track::after`, clamped inside the cell so it shows at 0% and 100%). The spine must not create a stacking context (no z-index), or the multiply cannot reach the poster. The artwork cell sits on fixed light print stock (`--sleeve-print-paper`, `--sleeve-print-ink`), not the scheme's paper, so the multiplied field stays visible in the dark scheme. Under forced colours the fill is dropped and only the needle shows, in CanvasText.

**Evidence:** s3; src/audio/skin.html, src/audio/skin.css (`.sleeve-spine*`).

**Check:** During playback the spine's style attribute shows `--media-slider-fill` changing; Tab never lands in the artwork; the accessibility tree has one slider for time, not two.

## s11 (confirmed)

Confirmed. `media-poster` takes its URL from the player's `poster` attribute, then from content data. A light-DOM `img.media-poster-image` child is styleable. The element never hides itself, so the skin must not rely on `:not([data-visible])`. It reports `data-loaded` on success and `data-error` for a URL that fails.

**Decision:** The artwork shows the poster only while `[data-loaded]` is set (`.media-poster:not([data-loaded]) { visibility: hidden }`), so no artwork or a broken URL leaves the default print visible: a second `media-title` (`.sleeve-print`, inside the aria-hidden artwork cell) set as giant cropped ink capitals on the print stock. It is hidden while the poster has loaded and empty (hidden) with no title. The image is greyscale with a little extra contrast, so the pigment flood reads as print.

**Evidence:** media-poster element and docs; src/audio/skin.css (`.media-poster*`); apps/preview/src/frame/audio-player.ts (`?art=none|broken`).

**Check:** `?art=none` and `?art=broken` show the title as giant cropped letters with no broken-image icon; the default page shows the poster in greyscale under the flood.

## s12 (confirmed)

Confirmed. `media-playback-rate-button` cycles through `[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]`, or the player's `default-playback-rates` (space separated), and wraps. It carries the current value as `data-rate`. The speedUp and speedDown hotkeys use the player's list and do not wrap.

**Decision:** Speed is one cell with no menu. CSS prints the rate from `data-rate` (`content: attr(data-rate) "\00D7"`); the button's own label and tooltip name the action.

**Evidence:** playback-rate-button element and docs; src/audio/skin.css (`.sleeve-rate-button`).

**Check:** Click the cell repeatedly: the printed value steps through the list and wraps; `>` and `<` change it without wrapping.

## s13 (confirmed)

Confirmed. `media-error-dialog` is player-scoped (`data-scope="player"`), not document-modal. While it is open, its siblings inside the container go inert, so it has to be a direct child of `media-container`, outside any `aria-hidden` element. An empty `media-dialog-close` prints the localized word. Escape or the close button dismisses it, clears the store error and returns focus.

**Decision:** The dialog is a direct child of the container, covering the whole player (paper sheet, danger head, ink veil); it does not live inside the type panel, because the rest of the player goes inert while it is open. The error is the one state the host colour does not pin: the field shrinks to the play cell, in danger red, the type panel turns to paper and the flood fill is dropped.

**Evidence:** error-dialog and dialog parts; src/audio/skin.html, src/audio/skin.css (`.media-dialog-*`, the `:has(media-error-dialog media-dialog-popup[data-open])` override).

**Check:** Force an error (bad `src`): the dialog opens over the whole player, the strip is inert, Escape closes it and focus returns.

## s14a (confirmed)

Confirmed. `media-title` reads `content-title` on the player (or Mux metadata) and sets `hidden` when empty. `media-time` with `type="remaining"` prints the sign in an `aria-hidden` span (`negative-sign`), so the large numeral can be decorative without losing the strip's own time read-out.

**Decision:** The cover's title and remaining-time numeral sit in a type panel; the numeral is `aria-hidden` and the strip carries the accessible time. `.sleeve-title[hidden]` must be `display: none`, because the title's own `display` would override the attribute. Never use `toggle` on the decorative copy.

**Evidence:** title and time docs; src/audio/skin.html, src/audio/skin.css (`.sleeve-title`, `.sleeve-numeral`); audio-player.ts (`?title=long|none`).

**Check:** `?title=none` (an empty `content-title`, which also keeps the stream metadata title out) leaves no empty gap or stray element; `?title=long` clamps to two lines then an ellipsis in every band, with no overflow.

## s14 (confirmed)

Confirmed in the browser with `mux-video`. A video skin can tell that media has no picture from the media element alone: `videoWidth` is 0 once metadata is known. On a source change the events arrive as `loadstart`, `emptied`, `resize`, `loadedmetadata`, so a state that resets on `loadstart` and `emptied` and settles on `loadedmetadata` is never stale. `resize` fires again if a picture appears later, so a width above 0 upgrades to video and a width of 0 never downgrades. `mux-video` plays only HLS: a WAV fails with "no EXTM3U delimiter", so the audio-only test source is an HLS playlist blob that points at a blob of silent MP3 frames.

**Decision:** A helper element, `<sleeve-state>`, is built the way the "Build your own component" guide builds one: a `UIElement` with a `PlayerController`. It takes the media from the player's store (`store.target.media`, reference/api/media-capabilities.md), reads it through Video.js's guards (`isMediaSourceCapable`, `hasMetadata`, `isMediaVideoDimensionsCapable`), and does its DOM writes in `update()`. The player has no state field for "has a picture", so it still listens for `loadedmetadata` and `resize` on that media; it no longer looks for the media element in the DOM and no longer listens for `loadstart` or `emptied`. It writes only `data-media="pending|audio|video"` on `.media-skin`. The host's `data-mode="audio|video"` on the same root wins in the CSS; absent means automatic. The CSS treats the player as audio when `[data-mode="audio"]` or `[data-media="audio"]:not([data-mode="video"])`. `pending` looks like video, so a normal video never flashes the audio layout. A source change keeps the last value until the new metadata settles it, so a playlist of audio files does not flash the video layout. The element has no API, no methods and no events.

**Added (audio-mode input, numeral, shift):** `media-hotkey` and `media-gesture` both document a `disabled` attribute (reference/components/hotkey.md and gesture.md; `ui/hotkey/element.js` and `ui/gesture/element.js` re-register on every property change). While the player is in audio mode, `<sleeve-state>` sets `disabled` on the hotkeys and the gesture the template marks with `data-sleeve-picture` (`f`, `c`, `i`, double-tap fullscreen) and removes it when the player leaves audio mode; it watches `data-mode` on the root for that and leaves alone an element that was already disabled. With the centre double-tap disabled, Video.js splits the surface between the two remaining double-tap regions (`dom/gesture/region.js`: left and right become halves), so in audio mode a double-tap seeks back on the left half and forward on the right half; kept, because a double-tap that does nothing in the middle third would only be a dead zone. The cover holds a second `media-time`, `type="remaining"`, shown only in audio mode in place of the duration, so the numeral counts down as on the audio skin. From 30rem, where the cover also shows before first play, audio mode uses that cover's width (a 200px floor instead of 160px), so the cover does not resize when detection settles. What still changes on an unpinned player when `pending` becomes `audio`, because the skin cannot know sooner: the picture controls leave the strip, the poster narrows to the area beside the cover, the player takes the 5:2 shape when the host gives no height, and below 30rem the cover appears. A host that knows should pin `data-mode="audio"`.

**Evidence:** src/shared/sleeve-state.ts; src/video/skin.html (`<sleeve-state>`, `.sleeve-print`); src/video/skin.css (the "Audio mode" block); media element events as listed above.

**Check:** With a video source `data-media` ends as `video` and the skin is unchanged. With the silent-audio HLS source it goes `video`, `pending`, `audio` and shows the cover, the poster beside it and a strip that never fades. `data-mode="audio"` forces the layout on a video source, `data-mode="video"` forces it off. Ready, playing, paused and ended read correctly at 640 and 400 wide.
