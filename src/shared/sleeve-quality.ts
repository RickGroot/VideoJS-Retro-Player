/**
 * <sleeve-quality>: a helper element with no box and no API of its own. It is a Video.js custom element (a `UIElement`
 * with a `PlayerController`, as `sleeve-state.ts` is) that reads the quality feature's state and prints it in the
 * skin's `.sleeve-quality-tag`:
 *
 *   `AUTO 1080P`  more than one rendition and none selected by the viewer (automatic ABR), playing 1080 high
 *   `720P`        the viewer locked a rendition
 *   (hidden)      one rendition or none, no quality feature (audio, plain files), or the active one has no height
 *
 * It also writes the same text as `data-sleeve-quality` on the skin root (`.media-skin`), a hook for the CSS.
 *
 * The tag is `aria-hidden`: the Settings menu's quality group and hint are the accessible source, and Video.js does not
 * announce quality either, so an ABR switch makes no noise. The skin's CSS hides this element.
 */
import { PlayerController, type PropertyValues, playerContext, selectQuality, UIElement } from '@videojs/html';

const ROOT_SELECTOR = '.media-skin';
const TAG_SELECTOR = '.sleeve-quality-tag';

class SleeveQuality extends UIElement {
  // The value is undefined under a player without the quality feature (the audio presets, for one).
  readonly #quality = new PlayerController(this, playerContext, selectQuality);

  #root: HTMLElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#root = this.closest<HTMLElement>(ROOT_SELECTOR);
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#root?.removeAttribute('data-sleeve-quality');
    this.#root = null;
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed);

    const root = this.#root;

    if (!root) return;

    const quality = this.#quality.value;
    const list = quality?.videoRenditionList ?? [];
    const height = quality?.activeVideoRendition?.height;
    let text = '';

    if (list.length > 1 && typeof height === 'number' && height > 0) {
      // Automatic ABR is the state where no rendition is selected.
      text = `${list.some((rendition) => rendition.selected) ? '' : 'AUTO '}${Math.round(height)}P`;
    }

    const tag = root.querySelector<HTMLElement>(TAG_SELECTOR);

    if (tag) {
      if (tag.textContent !== text) tag.textContent = text;
      if (tag.hidden !== (text === '')) tag.hidden = text === '';
    }

    if (text) {
      if (root.getAttribute('data-sleeve-quality') !== text) root.setAttribute('data-sleeve-quality', text);
    } else {
      root.removeAttribute('data-sleeve-quality');
    }
  }
}

if (!customElements.get('sleeve-quality')) customElements.define('sleeve-quality', SleeveQuality);
