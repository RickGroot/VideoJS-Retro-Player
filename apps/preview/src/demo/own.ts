import { DASH_LIVE_SRC, DASH_SRC, DEMO_LABEL, LIVE_SRC } from './media';

/**
 * PLAY YOUR OWN: a form that puts a visitor's own source in the demo page's main player. Page code only. It picks an
 * element from the address and checks the scheme; Video.js decides HLS or MP4, live or on demand, audio or video.
 *
 * The pasted text is never put in the page URL, storage, a log or a request of ours. It reaches the DOM only through
 * `setAttribute` on an element made with `createElement`, as the parsed `href`. Messages are fixed strings.
 */

/** The elements a pick can play on. `mux-video` is registered with the page; the engines load on demand. */
type Tag = 'mux-video' | 'shaka-video' | 'cloudflare-video' | 'video' | 'audio';
type Engine = 'shaka' | 'cloudflare';

interface Playable {
  tag: Tag;
  src: string;
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
};

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

/** The engine a pasted text would load, found without requesting anything. Used for the "this loads" line. */
export function engineFor(raw: string): Engine | null {
  const pick = pickSource(raw);

  if ('error' in pick) return null;

  return pick.tag === 'cloudflare-video' ? 'cloudflare' : pick.tag === 'shaka-video' ? 'shaka' : null;
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
  /** Replace the main player's media with this element. */
  play: (media: HTMLElement) => void;
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
  const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-example]')];

  if (!form || !input || !play || !reset || !error || !status) return { cleared: () => {} };

  let own = false;
  let listeners: AbortController | null = null;
  let savedCaption = '';
  // Bumped by every start and every reset, so a slow engine load never lands on a newer choice.
  let turn = 0;

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

  function watch(pick: Playable, mine: number, swapped: boolean): void {
    listeners?.abort();
    listeners = new AbortController();

    const { signal } = listeners;
    const media = host.wrapper.querySelector<HTMLElement>('mux-video, shaka-video, cloudflare-video, video, audio');

    if (!media) return;

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
        error!.textContent = swapped ? UNSUPPORTED : HINT;
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
          play!.removeAttribute('aria-busy');
          fail('The player for that kind of address could not be loaded. Check your connection and try again.');
          say('Your source could not be played.');
        }

        return;
      }
    }

    if (mine !== turn) return;

    host.play(buildMedia(pick, swapped));
    watch(pick, mine, swapped);
    syncTour();
    setBusy();

    const media = host.wrapper.querySelector<HTMLMediaElement>('mux-video, shaka-video, cloudflare-video, video, audio');

    // The press was a user gesture, so sound is allowed. A refusal is not an error.
    media?.play?.()?.catch?.(() => say('Press play.'));
  }

  function start(pick: Playable): void {
    own = true;
    turn += 1;
    play!.setAttribute('aria-busy', 'true');
    const engine = pick.tag === 'cloudflare-video' ? 'cloudflare' : null;

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
  input.addEventListener('input', () => showThird(engineFor(input.value) === 'cloudflare' ? 'cloudflare' : null));

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
