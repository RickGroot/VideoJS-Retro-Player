/**
 * <sleeve-state>: a helper element with no box and no API of its own. It is a Video.js custom element (a `UIElement`
 * with a `PlayerController`, as in the "Build your own component" guide) that reads one fact from the player, whether
 * the media has a picture, and writes it as `data-media` on the skin root (`.media-skin`) for the CSS:
 *
 *   pending  metadata is not known yet (only before the first value; a new source keeps the last one until its metadata)
 *   audio    metadata is known and videoWidth is 0
 *   video    metadata is known and videoWidth is above 0
 *
 * The player has no state field for this, so the element reads the media the player attached (`store.target.media`)
 * through Video.js's capability guards and listens for the two media events that settle it.
 *
 * The skin's CSS hides the element. The CSS decides the look from `data-media` and the host's `data-mode` on the same root.
 *
 * One thing the CSS cannot do: while the player is in audio mode (`data-mode="audio"`, or `data-media="audio"` unless
 * the host said `data-mode="video"`), the element sets Video.js's own `disabled` attribute on the hotkeys and gestures
 * the template marks with `data-sleeve-picture` (fullscreen, captions, picture in picture), and takes it off again
 * when the player leaves audio mode. An element that was disabled by someone else is left alone.
 *
 * When the media events fire is recorded in docs/spikes.md (s14).
 */
import {
  hasMetadata,
  isMediaSourceCapable,
  isMediaVideoDimensionsCapable,
  PlayerController,
  type PropertyValues,
  playerContext,
  selectSource,
  UIElement,
} from '@videojs/html';

/** What the element needs from the player's media: its event methods. */
type Listenable = {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

const ROOT_SELECTOR = '.media-skin';
// Input that only makes sense with a picture; the template marks it.
const PICTURE_INPUT_SELECTOR = ':is(media-hotkey, media-gesture)[data-sleeve-picture]';

function hasPicture(media: unknown): boolean {
  return isMediaVideoDimensionsCapable(media) && media.videoWidth > 0;
}

class SleeveState extends UIElement {
  // The player's store. `store.target.media` is the media the player attached.
  readonly #store = new PlayerController(this, playerContext);
  // Runs update() when the player's source changes, which is when the media may be new.
  readonly #source = new PlayerController(this, playerContext, selectSource);

  #root: HTMLElement | null = null;
  // The media the listeners are on.
  #media: Listenable | null = null;
  #value: 'pending' | 'audio' | 'video' = 'pending';
  #modeObserver: MutationObserver | null = null;
  // The elements this helper switched off, so it only switches those back on.
  readonly #switchedOff = new Set<Element>();

  override connectedCallback(): void {
    super.connectedCallback();
    this.#root = this.closest<HTMLElement>(ROOT_SELECTOR);

    if (!this.#root) return;

    // The host may change data-mode at any time.
    this.#modeObserver = new MutationObserver(() => this.requestUpdate());
    this.#modeObserver.observe(this.#root, { attributes: true, attributeFilter: ['data-mode'] });
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#modeObserver?.disconnect();
    this.#modeObserver = null;
    this.#listen(null);
    this.#restorePictureInput();
    this.#root = null;
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed);

    const root = this.#root;

    if (!root) return;

    const media = (this.#store.value?.target?.media ?? null) as Listenable | null;

    if (media !== this.#media) {
      this.#listen(media);

      // Metadata may be known already (a media that loaded before this element saw it).
      if (isMediaSourceCapable(media) && hasMetadata(media)) this.#value = hasPicture(media) ? 'video' : 'audio';
    }

    if (root.getAttribute('data-media') !== this.#value) root.setAttribute('data-media', this.#value);

    this.#syncPictureInput(root);
  }

  #listen(media: Listenable | null): void {
    this.#media?.removeEventListener('loadedmetadata', this.#onMetadata);
    this.#media?.removeEventListener('resize', this.#onResize);
    this.#media = media;
    media?.addEventListener('loadedmetadata', this.#onMetadata);
    media?.addEventListener('resize', this.#onResize);
  }

  // A new source keeps the last value, so audio to audio does not flash the video layout. Metadata settles it.
  readonly #onMetadata = (): void => {
    this.#value = hasPicture(this.#media) ? 'video' : 'audio';
    this.requestUpdate();
  };

  // A picture can show up after the metadata (a width above 0): upgrade to video. A width of 0 never downgrades.
  readonly #onResize = (): void => {
    if (!hasPicture(this.#media)) return;

    this.#value = 'video';
    this.requestUpdate();
  };

  /** Audio mode as the CSS sees it: the host's data-mode wins, otherwise what the media turned out to be. */
  #isAudioMode(root: HTMLElement): boolean {
    const mode = root.getAttribute('data-mode');

    if (mode === 'audio') return true;

    return mode !== 'video' && this.#value === 'audio';
  }

  #syncPictureInput(root: HTMLElement): void {
    if (!this.#isAudioMode(root)) return this.#restorePictureInput();

    for (const element of root.querySelectorAll(PICTURE_INPUT_SELECTOR)) {
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
