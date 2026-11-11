import { DASH_LIVE_SRC, DASH_SRC, DEMO_LABEL, LIVE_SRC, VIMEO_EXAMPLE, YOUTUBE_EXAMPLE } from './media';

/**
 * PLAY YOUR OWN: a form that puts a visitor's own source in the demo page's main player. Page code only. It picks an
 * element from the address and checks the scheme; Video.js decides HLS or MP4, live or on demand, audio or video.
 *
 * The pasted text is never put in the page URL, storage, a log or a request of ours. It reaches the DOM only through
 * `setAttribute` on an element made with `createElement`, as the parsed `href`. Messages are fixed strings.
 */

/** The elements a pick can play on. `mux-video` is registered with the page; the engines load on demand. */
type Tag = 'mux-video' | 'shaka-video' | 'cloudflare-video' | 'youtube-video' | 'vimeo-video' | 'video' | 'audio';
type Engine = 'shaka' | 'cloudflare' | 'youtube' | 'vimeo';

/** A source played by someone else's iframe player. It brings an attribution link and the skin's video look. */
interface Embed {
  /** The text of the "Watch on ..." link, and its address: the provider's own page for this video. */
  label: string;
  watch: string;
  /** Said when the embed reports an error: CORS is not the reason for an iframe player. */
  hint: string;
}

interface Playable {
  tag: Tag;
  src: string;
  embed?: Embed;
  /** Unknown address shape: play it natively first and, if that fails, try this engine once. */
  fallback?: Engine;
}

type Pick = Playable | { error: string };

/**
 * The engines, each its own chunk: kind, dynamic import, tag name, and the documented attributes it is given
 * (reference/components/shaka-video.md and cloudflare-video.md). Nothing here is fetched until a visitor presses Play on a
 * source that needs it. `third` is the line shown when the engine itself brings in someone else's code.
 */
const ENGINES: Record<Engine, { load: () => Promise<unknown>; tag: Tag; attributes: string[]; third?: string }> = {
  shaka: {
    // Shaka Player ships inside the package's own file, so this loads nothing from a third party.
    load: () => import('@videojs/html/media/shaka-video'),
    tag: 'shaka-video',
    attributes: ['src', 'preload', 'playsinline'],
  },
  cloudflare: {
    // The element builds a Cloudflare iframe and loads Cloudflare's SDK script (read in its stream-api.js).
    load: () => import('@videojs/html/media/cloudflare-video'),
    tag: 'cloudflare-video',
    attributes: ['src', 'preload'],
    third: "This loads Cloudflare's player.",
  },
  youtube: {
    // reference/components/youtube-video.md: a youtube-nocookie.com address makes the embed use the privacy-enhanced
    // host (read in the package's source.js). The IFrame API script still comes from www.youtube.com (iframe-api.js).
    load: () => import('@videojs/html/media/youtube-video'),
    tag: 'youtube-video',
    attributes: ['src', 'preload'],
    third:
      "This loads YouTube's player, in its privacy-enhanced mode, but its script still comes from youtube.com. YouTube will see your visit.",
  },
  vimeo: {
    // reference/components/vimeo-video.md: the element builds a Vimeo embed and uses Vimeo's player SDK.
    load: () => import('@videojs/html/media/vimeo-video'),
    tag: 'vimeo-video',
    attributes: ['src', 'preload'],
    third: "This loads Vimeo's player. Vimeo will see your visit.",
  },
};

const MEDIA_SELECTOR = 'mux-video, shaka-video, cloudflare-video, youtube-video, vimeo-video, video, audio';
const EMBED_HINT =
  'That video would not play. It may be private, removed, or its owner may not allow it to be embedded, or the player could not start.';

const VIDEO_EXT = ['webm', 'ogv', 'mov'];
const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac'];

/** A Cloudflare Stream host: exactly videodelivery.net or cloudflarestream.com, or one label in front of either. */
function isCloudflareHost(host: string): boolean {
  return ['videodelivery.net', 'cloudflarestream.com'].some(
    (domain) =>
      host === domain || (host.endsWith(`.${domain}`) && /^[a-z0-9-]+$/.test(host.slice(0, -(domain.length + 1)))),
  );
}

/**
 * The 32-hex video UID of a Cloudflare Stream address, or null. The address is rebuilt from the UID alone, so nothing
 * else from the pasted text (an `ad-url` pre-roll, a token, a start time) reaches the embed.
 */
function cloudflareUid(url: URL): string | null {
  if (!isCloudflareHost(url.hostname)) return null;

  const first = url.pathname.split('/')[1] ?? '';

  return /^[0-9a-f]{32}$/i.test(first) ? first.toLowerCase() : null;
}

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com'];
const VIMEO_HOSTS = ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'];
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const NOT_A_VIDEO = (who: string) =>
  `That ${who} address is a playlist, channel, user or other page, not one video. Paste the link of a single video.`;

/** A YouTube or Vimeo address, by exact hostname. null when the host is neither. The address is rebuilt from the id alone. */
function embedFor(url: URL): Playable | { error: string } | null {
  const host = url.hostname;
  const parts = url.pathname.split('/').filter(Boolean);
  const first = parts[0] ?? '';
  const second = parts[1] ?? '';
  const isYoutube = YOUTUBE_HOSTS.includes(host) || host === 'youtu.be' || host === 'www.youtube-nocookie.com';
  const isVimeo = VIMEO_HOSTS.includes(host);

  if (!isYoutube && !isVimeo) return null;
  if (url.port) return { error: 'That address is not accepted.' };

  if (isYoutube) {
    let id = '';

    if (host === 'youtu.be') id = first;
    else if (host === 'www.youtube-nocookie.com') id = first === 'embed' ? second : '';
    else if (first === 'watch') id = url.searchParams.get('v') ?? '';
    else if (['shorts', 'embed', 'live'].includes(first)) id = second;

    if (!YOUTUBE_ID.test(id)) return { error: NOT_A_VIDEO('YouTube') };

    return {
      tag: 'youtube-video',
      src: `https://www.youtube-nocookie.com/embed/${id}`,
      embed: {
        label: 'Watch on YouTube',
        watch: `https://www.youtube.com/watch?v=${id}`,
        hint: EMBED_HINT,
      },
    };
  }

  // Vimeo: vimeo.com/<id> with an optional unlisted hash segment, or player.vimeo.com/video/<id>?h=<hash>.
  const player = host === 'player.vimeo.com';
  const id = player ? (first === 'video' ? second : '') : first;
  // The query form (?h=) is documented for both hosts and wins; the path segment is the vimeo.com share form.
  const hash = url.searchParams.get('h') || (player ? '' : second);

  if (!/^\d{1,12}$/.test(id) || (hash && !/^[A-Za-z0-9]{6,20}$/.test(hash)) || (!player && parts.length > 2)) {
    return { error: NOT_A_VIDEO('Vimeo') };
  }

  const page = `https://vimeo.com/${id}${hash ? `/${hash}` : ''}`;

  return { tag: 'vimeo-video', src: page, embed: { label: 'Watch on Vimeo', watch: page, hint: EMBED_HINT } };
}

/** The engine whose element plays a tag, if it has one that loads on demand. */
function engineOf(tag: Tag): Engine | null {
  const found = (Object.keys(ENGINES) as Engine[]).find((engine) => ENGINES[engine].tag === tag);

  return found ?? null;
}

/** The engine a pasted text would load, found without requesting anything. Used for the "this loads" line. */
export function engineFor(raw: string): Engine | null {
  const pick = pickSource(raw);

  return 'error' in pick ? null : engineOf(pick.tag);
}

/** Decide what a pasted address plays on, or why it does not. Nothing is requested. */
export function pickSource(raw: string): Pick {
  const text = raw.trim();

  if (!text) return { error: 'Paste an address first.' };
  if (text.length > 2048) return { error: 'That address is not accepted.' };
  // A bare Mux playback ID.
  if (/^[A-Za-z0-9]{20,}$/.test(text)) return { tag: 'mux-video', src: `https://stream.mux.com/${text}.m3u8` };

  let url: URL;

  try {
    url = new URL(text);
  } catch {
    return { error: 'That is not a web address or a Mux playback ID.' };
  }

  if (url.protocol === 'http:') {
    return { error: 'Use an https address. This page is secure, so the browser blocks plain http media.' };
  }

  if (url.protocol !== 'https:') return { error: 'That kind of address is not played here. Paste an https link.' };
  if (url.username || url.password) return { error: 'That address is not accepted.' };

  const embed = embedFor(url);

  if (embed) return embed;

  const uid = cloudflareUid(url);

  if (uid) return { tag: 'cloudflare-video', src: `https://watch.videodelivery.net/${uid}` };

  const ext = url.pathname.includes('.') ? (url.pathname.split('.').pop() ?? '').toLowerCase() : '';

  if (ext === 'mpd') return { tag: 'shaka-video', src: url.href };
  if (AUDIO_EXT.includes(ext)) return { tag: 'audio', src: url.href };
  if (VIDEO_EXT.includes(ext)) return { tag: 'video', src: url.href };

  // .m3u8, .mp4 and Mux addresses stay on <mux-video>. Anything else is tried there first, then on Shaka once.
  const known = ['m3u8', 'mp4', 'm4v'].includes(ext) || url.hostname === 'stream.mux.com';

  return known ? { tag: 'mux-video', src: url.href } : { tag: 'mux-video', src: url.href, fallback: 'shaka' };
}

/** The media element for a pick: no poster, no chapters, so nothing of the demo clip shows on someone else's source. */
function buildMedia(pick: Playable, dashType = false): HTMLElement {
  const media = document.createElement(pick.tag);
  const engine = Object.values(ENGINES).find((e) => e.tag === pick.tag);
  const allowed = engine?.attributes ?? ['src', 'preload', 'playsinline'];

  // Only attributes the element's page documents. Audio has no picture, so no playsinline.
  if (allowed.includes('src') && !dashType) media.setAttribute('src', pick.src);
  if (allowed.includes('preload')) media.setAttribute('preload', 'metadata');
  if (allowed.includes('playsinline') && pick.tag !== 'audio') media.setAttribute('playsinline', '');

  // An address with no extension that native playback refused: name the type so Shaka reads it as DASH
  // (shaka-video.md, "Load a source").
  if (dashType) (media as HTMLElement & { source: unknown }).source = { src: pick.src, type: 'application/dash+xml' };

  // No crossorigin: it would make a plain MP4 load in CORS mode and fail on hosts that do not send the header. hls.js
  // and Shaka fetch their manifests in CORS mode by themselves.

  return media;
}

interface Host {
  /**
   * Replace the main player's media with this element. `video` pins the skin to its video look (data-mode="video"),
   * for an iframe player, which reports no picture size and would otherwise get the audio look.
   */
  play: (media: HTMLElement, options?: { video?: boolean }) => void;
  /** Back to the demo clip. Calls `cleared()` on the way. */
  reset: () => void;
  /** The wrapper of the main player. */
  wrapper: HTMLElement;
}

const HINT =
  'It would not play. The most common reason is that the host does not allow other sites to stream it (CORS), which streaming needs. A plain MP4 or MP3 link often works.';
const UNSUPPORTED =
  'Neither the browser\'s own player nor the DASH player could play that address. Check the link, or try a .m3u8, .mpd or .mp4 address.';

export function initOwn(host: Host): { cleared: () => void } {
  const form = document.getElementById('own-form') as HTMLFormElement | null;
  const input = document.getElementById('own-url') as HTMLInputElement | null;
  const play = document.getElementById('own-play') as HTMLButtonElement | null;
  const reset = document.getElementById('own-reset') as HTMLButtonElement | null;
  const error = document.getElementById('own-error');
  const status = document.getElementById('own-status');
  const tourStart = document.getElementById('tour-start') as HTMLButtonElement | null;
  const tour = document.getElementById('tour');
  const tourCaption = document.getElementById('tour-caption');
  const third = document.getElementById('own-third');
  const watchSlot = document.getElementById('own-watch');
  const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-example]')];

  if (!form || !input || !play || !reset || !error || !status) return { cleared: () => {} };

  let own = false;
  let listeners: AbortController | null = null;
  let savedCaption = '';
  // Bumped by every start and every reset, so a slow engine load never lands on a newer choice.
  let turn = 0;
  // Whether a visitor source was already playing before the latest press of Play, to restore if its engine fails to load.
  let ownBefore = false;
  // Gives up on an iframe player that never reports anything (a Vimeo video that does not exist raises no error).
  let giveUp: ReturnType<typeof setTimeout> | undefined;

  const say = (text: string) => {
    status.textContent = text;
  };

  function fail(message: string): void {
    error!.textContent = `NOT PLAYED: ${message}`;
    error!.hidden = false;
    input!.setAttribute('aria-invalid', 'true');
  }

  function clearError(): void {
    error!.textContent = '';
    error!.hidden = true;
    input!.removeAttribute('aria-invalid');
  }

  /** The tour assumes the demo clip, so it waits while a visitor source plays. */
  function syncTour(): void {
    if (tourStart) tourStart.disabled = own;

    if (!tourCaption) return;

    if (own) {
      savedCaption = tourCaption.textContent ?? '';
      tourCaption.textContent = 'The tour uses the demo clip. Reset to play it.';
    } else if (savedCaption) {
      tourCaption.textContent = savedCaption;
      savedCaption = '';
    }
  }

  function setBusy(): void {
    const running = tour?.hasAttribute('data-running') ?? false;

    for (const button of [play!, reset!, ...chips]) button.disabled = running;

    reset!.disabled = running || !own;
  }

  /** One plain line under the field when playing this would load someone else's code. */
  function showThird(engine: Engine | null): void {
    if (!third) return;

    const text = engine ? (ENGINES[engine].third ?? '') : '';

    third.textContent = text;
    third.hidden = !text;
  }

  /** The provider's attribution link, next to the player and not over the picture. Always removed before it is set. */
  function showWatch(shown: Embed | undefined): void {
    if (!watchSlot) return;

    watchSlot.replaceChildren();
    watchSlot.hidden = !shown;

    if (!shown) return;

    const link = document.createElement('a');
    const hidden = document.createElement('span');

    link.href = shown.watch;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = shown.label;
    hidden.className = 'visually-hidden';
    hidden.textContent = ' (opens in a new tab)';
    link.append(hidden);
    watchSlot.append(link);
  }

  function watch(pick: Playable, mine: number, swapped: boolean): void {
    listeners?.abort();
    listeners = new AbortController();
    clearTimeout(giveUp);

    const { signal } = listeners;
    const settle = () => clearTimeout(giveUp);

    signal.addEventListener('abort', settle);

    const media = host.wrapper.querySelector<HTMLElement>(MEDIA_SELECTOR);

    if (!media) return;

    if (pick.embed) {
      giveUp = setTimeout(() => {
        if (mine !== turn) return;

        play!.removeAttribute('aria-busy');

        error!.textContent = pick.embed!.hint;
        error!.hidden = false;
        say('Your source could not be played.');
      }, 15000);
      for (const name of ['playing', 'loadedmetadata', 'error']) media.addEventListener(name, settle, { signal });

      // An iframe player can drop a play request that arrives while it is still cueing the video: it reports
      // "waiting" and stays on its poster. Ask again, a few times at most, until it plays or the visitor pauses.
      const embed = media as HTMLMediaElement;
      let asks = 0;
      const nudge = setInterval(() => {
        asks += 1;

        if (mine !== turn || asks > 4 || embed.paused || embed.currentTime > 0) {
          clearInterval(nudge);

          return;
        }

        // A second play request alone is ignored in that state; a pause request first clears it.
        embed.pause?.();
        embed.play?.()?.catch?.(() => undefined);
      }, 1500);
      const calm = () => clearInterval(nudge);

      signal.addEventListener('abort', calm);
      for (const name of ['playing', 'pause', 'error']) media.addEventListener(name, calm, { signal });
    }

    // Shaka moves a live stream's seek range with the clock, but its element fires no event of its own as the range
    // moves. While paused the player keeps its last reading and still says "live" after a long pause. A `progress`
    // event only says there is new data to look at, and makes Video.js read the range again. The Mux HLS live stream
    // did not show this when checked in Chromium, so only DASH gets the timer.
    if (media.localName === 'shaka-video') {
      const stream = media as HTMLMediaElement & { targetLiveWindow?: number };
      const refresh = setInterval(() => {
        const live = typeof stream.targetLiveWindow === 'number' && !Number.isNaN(stream.targetLiveWindow);

        if (live && stream.paused) stream.dispatchEvent(new Event('progress'));
      }, 1000);

      signal.addEventListener('abort', () => clearInterval(refresh));
    }

    media.addEventListener(
      'playing',
      () => {
        // sleeve-state writes data-live from Video.js's own live state.
        const live = host.wrapper.querySelector('.media-skin')?.hasAttribute('data-live');

        play!.removeAttribute('aria-busy');
        clearError();
        say(live ? 'Now playing your source. It is live.' : 'Now playing your source.');
      },
      { signal },
    );
    media.addEventListener(
      'error',
      () => {
        if (mine !== turn) return;

        // Unknown address: native playback refused it, so Shaka gets one go.
        if (pick.fallback && !swapped) {
          void mount({ ...pick, tag: ENGINES[pick.fallback].tag, fallback: undefined }, mine, true);

          return;
        }

        play!.removeAttribute('aria-busy');
        error!.textContent = pick.embed ? pick.embed.hint : swapped ? UNSUPPORTED : HINT;
        error!.hidden = false;
        say('Your source could not be played.');
      },
      { signal },
    );
  }

  /** Load the engine if there is one, then put the element in the player. The tag is never defined without its import. */
  async function mount(pick: Playable, mine: number, swapped: boolean): Promise<void> {
    const engine = Object.values(ENGINES).find((e) => e.tag === pick.tag);

    if (engine) {
      try {
        await engine.load();
      } catch {
        if (mine === turn) {
          own = ownBefore;
          syncTour();
          setBusy();
          play!.removeAttribute('aria-busy');
          fail('The player for that kind of address could not be loaded. Check your connection and try again.');
          say('Your source could not be played.');
        }

        return;
      }
    }

    if (mine !== turn) return;

    host.play(buildMedia(pick, swapped), { video: Boolean(pick.embed) || pick.tag === 'cloudflare-video' });
    showWatch(pick.embed);
    watch(pick, mine, swapped);
    syncTour();
    setBusy();

    const media = host.wrapper.querySelector<HTMLMediaElement>(MEDIA_SELECTOR);

    if (!media) return;

    // The press was a user gesture, so sound is allowed. An engine that is still attaching the source interrupts the
    // request (AbortError): ask again when the source can play, a few times at most. Any other refusal is not an error.
    let asks = 0;
    const ask = (): void => {
      asks += 1;
      media.play?.()?.catch?.((reason: unknown) => {
        if (mine !== turn) return;

        if (asks < 4 && reason instanceof DOMException && reason.name === 'AbortError') {
          media.addEventListener('canplay', () => mine === turn && media.paused && ask(), {
            once: true,
            signal: listeners?.signal,
          });

          return;
        }

        say('Press play.');
      });
    };

    ask();
  }

  function start(pick: Playable): void {
    ownBefore = own;
    own = true;
    turn += 1;
    play!.setAttribute('aria-busy', 'true');
    const engine = engineOf(pick.tag);

    // Another source starts: the last one's attribution link goes first.
    showWatch(undefined);

    say(engine && ENGINES[engine].third ? `Loading your source. ${ENGINES[engine].third}` : 'Loading your source.');
    showThird(engine);
    void mount(pick, turn, false);
    syncTour();
    setBusy();
  }

  function submit(): void {
    clearError();

    const pick = pickSource(input!.value);

    if ('error' in pick) {
      fail(pick.error);
      input!.focus();

      return;
    }

    start(pick);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });

  // Say before Play what Play would load, without loading it.
  input.addEventListener('input', () => showThird(engineFor(input.value)));

  reset.addEventListener('click', () => {
    host.reset();
    input.focus();
  });

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      if (chip.dataset.example === 'demo') {
        host.reset();

        return;
      }

      const sources: Record<string, string> = { live: LIVE_SRC, dash: DASH_SRC, 'dash-live': DASH_LIVE_SRC };
      const src = sources[chip.dataset.example ?? ''];
      const embedExamples: Record<string, string> = { youtube: YOUTUBE_EXAMPLE, vimeo: VIMEO_EXAMPLE };
      const example = embedExamples[chip.dataset.example ?? ''];

      // A third-party player is never loaded by a chip: it fills the field, says what Play would load, and waits.
      if (example) {
        const line = engineFor(example);

        clearError();
        input.value = example;
        showThird(line);
        say(line && ENGINES[line].third ? `Example filled in. ${ENGINES[line].third} Press Play to load it.` : '');
        input.focus();

        return;
      }

      if (src) {
        input.value = src;
        submit();
      }
    });
  }

  // Keep the tour and the form out of each other's way.
  if (tour) new MutationObserver(setBusy).observe(tour, { attributes: true, attributeFilter: ['data-running'] });

  return {
    cleared() {
      const was = own;

      own = false;
      turn += 1;
        showWatch(undefined);
      showThird(null);
      listeners?.abort();
      listeners = null;
      input.value = '';
      clearError();
      play.removeAttribute('aria-busy');
      syncTour();
      setBusy();

      if (was) say(`Back to ${DEMO_LABEL}.`);
    },
  };
}
