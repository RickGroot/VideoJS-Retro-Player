import { DEMO_LABEL, LIVE_SRC } from './media';

/**
 * PLAY YOUR OWN: a form that puts a visitor's own source in the demo page's main player. Page code only. It picks an
 * element from the address and checks the scheme; Video.js decides HLS or MP4, live or on demand, audio or video.
 *
 * The pasted text is never put in the page URL, storage, a log or a request of ours. It reaches the DOM only through
 * `setAttribute` on an element made with `createElement`, as the parsed `href`. Messages are fixed strings.
 */

type Pick = { tag: 'mux-video' | 'video' | 'audio'; src: string } | { error: string };

const VIDEO_EXT = ['webm', 'ogv', 'mov'];
const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac'];

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

  const ext = url.pathname.includes('.') ? (url.pathname.split('.').pop() ?? '').toLowerCase() : '';

  if (ext === 'mpd') return { error: 'DASH needs a player we have not installed. Try HLS (.m3u8) or MP4.' };
  if (AUDIO_EXT.includes(ext)) return { tag: 'audio', src: url.href };
  if (VIDEO_EXT.includes(ext)) return { tag: 'video', src: url.href };

  // .m3u8, .mp4, Mux URLs and anything unknown: <mux-video> lets Video.js decide.
  return { tag: 'mux-video', src: url.href };
}

/** The media element for a pick: no poster, no chapters, so nothing of the demo clip shows on someone else's source. */
function buildMedia(pick: { tag: 'mux-video' | 'video' | 'audio'; src: string }): HTMLElement {
  const media = document.createElement(pick.tag);

  media.setAttribute('src', pick.src);
  media.setAttribute('preload', 'metadata');

  if (pick.tag !== 'audio') media.setAttribute('playsinline', '');
  // hls.js reads the playlist with fetch, so the host has to allow it anyway; a plain element needs no CORS.
  if (pick.tag === 'mux-video') media.setAttribute('crossorigin', '');

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
  const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-example]')];

  if (!form || !input || !play || !reset || !error || !status) return { cleared: () => {} };

  let own = false;
  let listeners: AbortController | null = null;
  let savedCaption = '';

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

  function watch(): void {
    listeners?.abort();
    listeners = new AbortController();

    const { signal } = listeners;
    const media = host.wrapper.querySelector<HTMLElement>('mux-video, video, audio');

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
        play!.removeAttribute('aria-busy');
        error!.textContent = HINT;
        error!.hidden = false;
        say('Your source could not be played.');
      },
      { signal },
    );
  }

  function start(pick: { tag: 'mux-video' | 'video' | 'audio'; src: string }): void {
    own = true;
    play!.setAttribute('aria-busy', 'true');
    say('Loading your source.');
    host.play(buildMedia(pick));
    watch();
    syncTour();
    setBusy();

    const media = host.wrapper.querySelector<HTMLMediaElement>('mux-video, video, audio');

    // The press was a user gesture, so sound is allowed. A refusal is not an error.
    media?.play?.()?.catch?.(() => say('Press play.'));
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

      if (chip.dataset.example === 'live') {
        input.value = LIVE_SRC;
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
