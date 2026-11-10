/**
 * <sleeve-state>: a helper element with no box and no API. It reads one fact from the media element of its player,
 * whether the media has a picture, and writes it as `data-media` on the skin root (`.media-skin`) for the CSS:
 *
 *   pending  metadata is not known yet (only before the first value; a source change keeps the last one until the new metadata)
 *   audio    metadata is known and videoWidth is 0
 *   video    metadata is known and videoWidth is above 0
 *
 * The skin's CSS hides the element. The CSS decides the look from `data-media` and the host's `data-mode` on the same root.
 *
 * One thing the CSS cannot do: while the player is in audio mode (`data-mode="audio"`, or `data-media="audio"` unless
 * the host said `data-mode="video"`), the element sets Video.js's own `disabled` attribute on the hotkeys and gestures
 * the template marks with `data-sleeve-picture` (fullscreen, captions, picture in picture), and takes it off again
 * when the player leaves audio mode. An element that was disabled by someone else is left alone.
 *
 * Which events reach the media element, and when it exists, is recorded in docs/spikes.md (s14).
 */
type MediaElement = HTMLElement & { videoWidth?: number; readyState?: number };

const ROOT_SELECTOR = '.media-skin';
const MEDIA_SELECTOR = ':scope > :is(video, audio, [slot="media"])';
// Input that only makes sense with a picture; the template marks it.
const PICTURE_INPUT_SELECTOR = ':is(media-hotkey, media-gesture)[data-sleeve-picture]';
// Events that return the state to pending, and the ones that settle it.
const RESET_EVENTS = ['loadstart', 'emptied'] as const;

/** The player's media element: a native one, a slotted one, or a custom media element such as mux-video. */
function findMedia(root: Element): MediaElement | null {
  const native = root.querySelector<MediaElement>(MEDIA_SELECTOR);

  if (native) return native;

  for (const child of root.children) {
    if (/-(video|audio)$/.test(child.localName) && !child.localName.startsWith('media-')) return child as MediaElement;
  }

  return null;
}

class SleeveState extends HTMLElement {
  #root: HTMLElement | null = null;
  #media: MediaElement | null = null;
  #observer: MutationObserver | null = null;
  // The elements this helper switched off, so it only switches those back on.
  readonly #switchedOff = new Set<Element>();

  connectedCallback(): void {
    this.#root = this.closest<HTMLElement>(ROOT_SELECTOR);

    if (!this.#root) return;

    this.#attach(findMedia(this.#root));

    // The media element may not be there yet, and a host may swap it later. The host may also change data-mode.
    this.#observer = new MutationObserver(() => {
      const media = this.#root ? findMedia(this.#root) : null;

      if (media !== this.#media) this.#attach(media);

      this.#syncPictureInput();
    });
    this.#observer.observe(this.#root, { childList: true, attributes: true, attributeFilter: ['data-mode'] });
    this.#syncPictureInput();
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#detach();
    this.#restorePictureInput();
    this.#root = null;
  }

  #attach(media: MediaElement | null): void {
    this.#detach();
    this.#media = media;

    if (!media) return this.#write('pending');

    for (const type of RESET_EVENTS) media.addEventListener(type, this.#onReset);
    media.addEventListener('loadedmetadata', this.#onMetadata);
    media.addEventListener('resize', this.#onResize);

    // Metadata may be known already (a media element that loaded before this element connected).
    if ((media.readyState ?? 0) >= 1) this.#onMetadata();
    else this.#write('pending');
  }

  #detach(): void {
    const media = this.#media;

    if (!media) return;

    for (const type of RESET_EVENTS) media.removeEventListener(type, this.#onReset);
    media.removeEventListener('loadedmetadata', this.#onMetadata);
    media.removeEventListener('resize', this.#onResize);
    this.#media = null;
  }

  // A new source keeps the last value, so audio to audio does not flash the video layout. Metadata settles it.
  readonly #onReset = (): void => {
    if (!this.#root?.hasAttribute('data-media')) this.#write('pending');
  };

  readonly #onMetadata = (): void => {
    this.#write((this.#media?.videoWidth ?? 0) > 0 ? 'video' : 'audio');
  };

  // A picture can show up after the metadata (a width above 0): upgrade to video. A width of 0 never downgrades.
  readonly #onResize = (): void => {
    if ((this.#media?.videoWidth ?? 0) > 0) this.#write('video');
  };

  #write(value: 'pending' | 'audio' | 'video'): void {
    if (this.#root && this.#root.getAttribute('data-media') !== value) this.#root.setAttribute('data-media', value);

    this.#syncPictureInput();
  }

  /** Audio mode as the CSS sees it: the host's data-mode wins, otherwise what the media turned out to be. */
  #isAudioMode(): boolean {
    const mode = this.#root?.getAttribute('data-mode');

    if (mode === 'audio') return true;

    return mode !== 'video' && this.#root?.getAttribute('data-media') === 'audio';
  }

  #syncPictureInput(): void {
    if (!this.#root) return;

    if (!this.#isAudioMode()) return this.#restorePictureInput();

    for (const element of this.#root.querySelectorAll(PICTURE_INPUT_SELECTOR)) {
      if (element.hasAttribute('disabled')) continue;

      element.setAttribute('disabled', '');
      this.#switchedOff.add(element);
    }
  }

  #restorePictureInput(): void {
    for (const element of this.#switchedOff) element.removeAttribute('disabled');

    this.#switchedOff.clear();
  }
}

if (!customElements.get('sleeve-state')) customElements.define('sleeve-state', SleeveState);
