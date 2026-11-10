/**
 * <sleeve-caption-style>: a helper element with no box and no API of its own. It wires the "Caption style" group of the
 * video skin's settings menu:
 *
 *   - the chosen preset is written as `data-caption-style` on the skin root (`.media-skin`); the CSS in
 *     styles/extras/captions.css styles the cues through `::cue` from that attribute
 *   - the choice is remembered in localStorage (every access wrapped; the menu works without storage)
 *   - the menu item (`data-unavailable` off) is shown only while the media has caption or subtitle tracks (from the player's `selectTextTrack`)
 *   - the hint on the menu item shows the name of the chosen preset
 *
 * The radio group is Video.js's own `<media-menu-radio-group>`; the helper reads its `value` on `value-change`.
 */
import { PlayerController, type PropertyValues, playerContext, selectSource, selectTextTrack, UIElement } from '@videojs/html';

const PRESETS = ['default', 'large', 'white-on-black', 'yellow-on-black'] as const;
const STORAGE_KEY = 'sleeve:caption-style';
const ROOT_SELECTOR = '.media-skin';

type Preset = (typeof PRESETS)[number];
type TrackLike = { kind?: string };
type TrackListLike = EventTarget & ArrayLike<TrackLike>;
const TRACK_EVENTS = ['addtrack', 'removetrack', 'change'] as const;
const MEDIA_EVENTS = ['loadedmetadata', 'loadeddata', 'emptied'] as const;
// The media is attached to the player a moment after the skin connects; look for it this many times, a frame apart.
const MEDIA_WAIT_FRAMES = 300;

const isPreset = (value: unknown): value is Preset => PRESETS.includes(value as Preset);

function readStored(): Preset {
  try {
    const value = localStorage.getItem(STORAGE_KEY);

    return isPreset(value) ? value : 'default';
  } catch {
    return 'default';
  }
}

function writeStored(value: Preset): void {
  try {
    if (value === 'default') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage is blocked or full: the choice still holds for this page view.
  }
}

class SleeveCaptionStyle extends UIElement {
  readonly #store = new PlayerController(this, playerContext);
  // Runs update() when the player's text track state changes.
  readonly #tracks = new PlayerController(this, playerContext, selectTextTrack);

  // Runs update() when the source loads: the media and its tracks exist from then on.
  readonly #source = new PlayerController(this, playerContext, selectSource);

  #root: HTMLElement | null = null;
  #group: (HTMLElement & { value?: string }) | null = null;
  #item: HTMLElement | null = null;
  #preset: Preset = 'default';
  #trackList: TrackListLike | null = null;
  #media: EventTarget | null = null;
  #wait = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.hidden = true;
    this.#root = this.closest<HTMLElement>(ROOT_SELECTOR);
    this.#preset = readStored();
    this.#apply();
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#listen(null, null);
    this.#group?.removeEventListener('value-change', this.#onChange);
    this.#group = null;
    this.#item = null;
    this.#root = null;
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed);
    

    const root = this.#root;

    if (!root) return;

    if (!this.#group) {
      this.#group = root.querySelector<HTMLElement & { value?: string }>('[data-sleeve-caption-style-group]');
      this.#item = root.querySelector<HTMLElement>('[data-sleeve-caption-style-item]');
      this.#group?.addEventListener('value-change', this.#onChange);
      this.#sync();
    }

    // The player's track list is updated in place, which a selector does not see as a change. So the media's own
    // track list is listened to as well, and read here.
    const media = this.#store.value?.target?.media as { textTracks?: TrackListLike } | null | undefined;

    this.#listen((media as EventTarget | null | undefined) ?? null, media?.textTracks ?? null);

    // Not attached yet: look again next frame (bounded), since nothing tells this element when the media arrives.
    if (!media && this.#wait++ < MEDIA_WAIT_FRAMES) requestAnimationFrame(() => this.isConnected && this.requestUpdate());

    const list: TrackLike[] = this.#trackList ? Array.from(this.#trackList) : [];
    const hasCaptions = list.some((track) => track.kind === 'captions' || track.kind === 'subtitles');

    this.#item?.toggleAttribute('data-unavailable', !hasCaptions);
  }

  #listen(media: EventTarget | null, list: TrackListLike | null): void {
    if (media !== this.#media) {
      if (this.#media) for (const type of MEDIA_EVENTS) this.#media.removeEventListener(type, this.#onTracks);

      this.#media = media;

      if (media) for (const type of MEDIA_EVENTS) media.addEventListener(type, this.#onTracks);
    }

    if (list === this.#trackList) return;

    if (this.#trackList) for (const type of TRACK_EVENTS) this.#trackList.removeEventListener(type, this.#onTracks);

    this.#trackList = list;

    if (list) for (const type of TRACK_EVENTS) list.addEventListener(type, this.#onTracks);
  }

  readonly #onTracks = (): void => this.requestUpdate();

  readonly #onChange = (): void => {
    const value = this.#group?.value;

    if (!isPreset(value) || value === this.#preset) return;

    this.#preset = value;
    writeStored(value);
    this.#apply();
  };

  /** The attribute the CSS reads. */
  #apply(): void {
    this.#root?.setAttribute('data-caption-style', this.#preset);
    this.#sync();
  }

  /** The radio group and the hint show the chosen preset. */
  #sync(): void {
    if (this.#group && this.#group.value !== this.#preset) this.#group.value = this.#preset;

    const label = this.#group?.querySelector(`[value="${this.#preset}"] [data-part="label"]`)?.textContent ?? '';
    const hint = this.#item?.querySelector('[data-sleeve-caption-hint]');

    if (hint) hint.textContent = label.trim();
  }
}

if (!customElements.get('sleeve-caption-style')) customElements.define('sleeve-caption-style', SleeveCaptionStyle);
