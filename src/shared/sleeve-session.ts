/**
 * <sleeve-session>: a helper element with no box and no API of its own. It puts the player that most recently started
 * playing on the lock screen and in the OS media controls, through the browser's Media Session
 * (`navigator.mediaSession`):
 *
 *   metadata        the title the skin shows (the player's resolved `title`), the current chapter name, and artwork
 *   actions         play, pause, seekbackward and seekforward (10 seconds, the skin's seek step), and seekto
 *   position state  duration, position and rate, so the lock screen has a scrubber
 *
 * Neither Video.js nor the Mux media elements touch Media Session (searched the installed @videojs packages and their
 * Mux elements for `mediaSession`: no hit; the registry of the browser stayed empty in a test), so nothing is double
 * registered. The element is a Video.js `UIElement` with `PlayerController`s, like <sleeve-state>: the title, the poster
 * and the chapter cues come from the player's store, the rest from the media the player attached (`store.target.media`).
 *
 * The session is one per page, so only one player owns it: the last one that started playing. A player that is
 * removed while it owns the session clears what it set. Handlers call the media's own play, pause and currentTime.
 *
 * Artwork: the poster when the player has one. Otherwise a flat square in the skin's field colour (and an ink rule),
 * drawn once on a canvas, so there is no video frame and no cross-origin problem. The blob URLs are revoked when the
 * element is removed.
 *
 * Every call is feature-checked and wrapped: the API, `MediaMetadata` and each action may be missing or throw.
 */
import {
  PlayerController,
  type PropertyValues,
  playerContext,
  selectMetadata,
  selectTextTrack,
  UIElement,
} from '@videojs/html';

/** What the element needs from the player's media. */
type SessionMedia = EventTarget & {
  play?: () => Promise<void> | void;
  pause?: () => void;
  paused?: boolean;
  currentTime?: number;
  duration?: number;
  playbackRate?: number;
};

type ChapterCue = { text?: string; startTime?: number; endTime?: number };

const ROOT_SELECTOR = '.media-skin';
// Same step as the skin's seek buttons and hotkeys.
const SEEK_STEP = 10;
const ART_SIZES = [96, 192, 256, 512] as const;
const MEDIA_EVENTS = ['play', 'playing', 'pause', 'ended', 'timeupdate', 'durationchange', 'ratechange', 'seeked', 'loadedmetadata'] as const;
const ACTIONS = ['play', 'pause', 'seekbackward', 'seekforward', 'seekto'] as const;

// The session is page-wide, so who owns it is too: the last player that started playing.
let owner: SleeveSession | null = null;

function session(): MediaSession | null {
  try {
    return typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null;
  } catch {
    return null;
  }
}

function attempt(run: () => void): void {
  try {
    run();
  } catch {
    // The API or one of its calls is missing, or the browser refused the value. The player works without it.
  }
}

class SleeveSession extends UIElement {
  readonly #store = new PlayerController(this, playerContext);
  // Runs update() when the title or the poster changes.
  readonly #metadata = new PlayerController(this, playerContext, selectMetadata);
  // Runs update() when the chapter cues change.
  readonly #tracks = new PlayerController(this, playerContext, selectTextTrack);

  #root: HTMLElement | null = null;
  #media: SessionMedia | null = null;
  // Flat artwork for a player without a poster: made on first use, revoked on disconnect.
  #art: { src: string; sizes: string; type: string }[] | null = null;
  #artRequested = false;
  #connected = false;
  // What the metadata was last built from, so a timeupdate does not rebuild it.
  #metaKey = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.hidden = true;
    this.#root = this.closest<HTMLElement>(ROOT_SELECTOR);
    this.#connected = true;
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#connected = false;
    this.#listen(null);
    this.#release();
    this.#revokeArt();
    this.#root = null;
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed);

    if (!this.#connected) return;

    const media = (this.#store.value?.target?.media ?? null) as SessionMedia | null;

    if (media !== this.#media) {
      // The player swapped its media: this player lets go of the session until the new media plays.
      this.#release();
      this.#listen(media);
    }

    if (owner === this) this.#publish();
  }

  #listen(media: SessionMedia | null): void {
    if (this.#media) for (const type of MEDIA_EVENTS) this.#media.removeEventListener(type, this.#onMediaEvent);

    this.#media = media;

    if (media) for (const type of MEDIA_EVENTS) media.addEventListener(type, this.#onMediaEvent);
  }

  readonly #onMediaEvent = (event: Event): void => {
    if (event.type === 'play' || event.type === 'playing') this.#claim();

    if (owner === this) this.#publish();
  };

  /** This player starts playing, so it takes the session over from the one that had it. */
  #claim(): void {
    const api = session();

    if (!api || !this.#media) return;

    if (owner !== this) {
      if (owner) owner.#release();
      owner = this;
      this.#metaKey = '';
      this.#bindActions(api);
    }

    this.#makeArt();
  }

  /** Give the session up, if this player holds it: clear what it set. */
  #release(): void {
    if (owner !== this) return;

    owner = null;
    this.#metaKey = '';

    const api = session();

    if (!api) return;

    attempt(() => {
      api.metadata = null;
    });
    attempt(() => {
      api.playbackState = 'none';
    });
    for (const action of ACTIONS) attempt(() => api.setActionHandler(action, null));
    attempt(() => api.setPositionState());
  }

  #bindActions(api: MediaSession): void {
    const handlers: Record<(typeof ACTIONS)[number], MediaSessionActionHandler> = {
      play: () => {
        // play() may reject (autoplay rules); the player's own error handling reports real failures.
        attempt(() => void Promise.resolve(this.#media?.play?.()).catch(() => {}));
      },
      pause: () => attempt(() => this.#media?.pause?.()),
      seekbackward: () => this.#seekTo((this.#media?.currentTime ?? 0) - SEEK_STEP),
      seekforward: () => this.#seekTo((this.#media?.currentTime ?? 0) + SEEK_STEP),
      seekto: (details) => {
        if (typeof details.seekTime === 'number') this.#seekTo(details.seekTime);
      },
    };

    for (const action of ACTIONS) attempt(() => api.setActionHandler(action, handlers[action]));
  }

  #seekTo(time: number): void {
    const media = this.#media;

    if (!media || !Number.isFinite(time)) return;

    const duration = media.duration;
    const end = typeof duration === 'number' && Number.isFinite(duration) ? duration : Infinity;

    attempt(() => {
      media.currentTime = Math.min(Math.max(time, 0), end);
    });
  }

  /** The chapter that holds the current time, from the chapters track's cues. */
  #chapter(): { text: string; start: number } | null {
    const time = this.#media?.currentTime;
    const cues = (this.#tracks.value as { chaptersCues?: ChapterCue[] } | undefined)?.chaptersCues;

    if (typeof time !== 'number' || !cues?.length) return null;

    for (const cue of cues) {
      const start = cue.startTime ?? 0;
      const end = cue.endTime ?? Infinity;

      if (time >= start && time < end && cue.text) return { text: cue.text, start };
    }

    return null;
  }

  /** Write the metadata (only when it changed), the playback state and the position state. */
  #publish(): void {
    const api = session();
    const media = this.#media;

    if (!api || !media) return;

    this.#publishMetadata(api);

    attempt(() => {
      api.playbackState = media.paused === false ? 'playing' : 'paused';
    });

    attempt(() => {
      const duration = media.duration;
      const position = media.currentTime;

      // A live stream (infinite duration) or media without metadata has no scrubber.
      if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || typeof position !== 'number') {
        api.setPositionState();
        return;
      }

      api.setPositionState({
        duration,
        position: Math.min(Math.max(position, 0), duration),
        playbackRate: media.playbackRate && media.playbackRate > 0 ? media.playbackRate : 1,
      });
    });
  }

  #publishMetadata(api: MediaSession): void {
    if (typeof MediaMetadata === 'undefined') return;

    const meta = this.#metadata.value as { title?: string; poster?: string } | undefined;
    const title = meta?.title || document.title;
    const poster = meta?.poster || '';
    const chapter = this.#chapter();
    // Where the browser supports the chapter list on the metadata (`chapterInfo`) it gets it. Everywhere else the
    // lock screen's second line carries the chapter name.
    const hasChapterInfo = 'chapterInfo' in MediaMetadata.prototype;
    const key = [title, poster, chapter?.text ?? '', chapter?.start ?? '', this.#art ? 'art' : ''].join('\u0000');

    if (key === this.#metaKey) return;

    this.#metaKey = key;

    attempt(() => {
      const artwork: MediaImage[] = poster ? [{ src: poster }] : (this.#art ?? []);
      const init: MediaMetadataInit & { chapterInfo?: unknown[] } = { title, artwork };

      if (chapter) {
        if (hasChapterInfo) init.chapterInfo = [{ title: chapter.text, startTime: chapter.start, artwork }];
        else init.artist = chapter.text;
      }

      api.metadata = new MediaMetadata(init);
    });
  }

  // Flat artwork -----------------------------------------------------------------------------------------------

  /** The skin's field colour, resolved: a probe element takes the custom property, so light-dark() is settled. */
  #resolve(property: string, fallback: string): string {
    const root = this.#root;

    if (!root) return fallback;

    const probe = document.createElement('span');

    probe.style.cssText = `position:absolute;visibility:hidden;color:var(${property})`;
    root.append(probe);

    const value = getComputedStyle(probe).color;

    probe.remove();

    return value || fallback;
  }

  #makeArt(): void {
    // Only for a player that has no poster; the poster is read each time, so a later poster wins.
    if (this.#artRequested || (this.#metadata.value as { poster?: string } | undefined)?.poster) return;

    this.#artRequested = true;

    const field = this.#resolve('--sleeve-field', '#d94a2a');
    const ink = this.#resolve('--sleeve-ink', '#0e0e0f');
    const made: { src: string; sizes: string; type: string }[] = [];
    let pending = ART_SIZES.length;

    const done = (): void => {
      pending -= 1;

      if (pending > 0) return;

      // The element may have been removed while the blobs were made.
      if (!this.#connected) {
        for (const art of made) URL.revokeObjectURL(art.src);
        return;
      }

      this.#art = made;
      this.#metaKey = '';

      if (owner === this) this.#publish();
    };

    for (const size of ART_SIZES) {
      attempt(() => {
        const canvas = document.createElement('canvas');

        canvas.width = size;
        canvas.height = size;

        const context = canvas.getContext('2d');

        if (!context) return done();

        // A flat field square inside a 2px-scaled ink rule: no gradient, no picture.
        const rule = Math.max(2, Math.round(size / 48));

        context.fillStyle = ink;
        context.fillRect(0, 0, size, size);
        context.fillStyle = field;
        context.fillRect(rule, rule, size - rule * 2, size - rule * 2);
        canvas.toBlob((blob) => {
          if (blob) made.push({ src: URL.createObjectURL(blob), sizes: `${size}x${size}`, type: 'image/png' });

          done();
        }, 'image/png');
      });
    }
  }

  #revokeArt(): void {
    for (const art of this.#art ?? []) URL.revokeObjectURL(art.src);

    this.#art = null;
    this.#artRequested = false;
  }
}

if (!customElements.get('sleeve-session')) customElements.define('sleeve-session', SleeveSession);
