import '@videojs/html/i18n';
import '@/skin.css';
import './preview.css';
import { playerStyles, type WorkbenchParams } from '../shell/params';
import { applyMediaParams, initialParams, onParamsChange } from './frame';

interface MountOptions {
  /** Audio skins have no picture, so the workbench's aspect ratio does not apply to them. */
  aspectRatio: boolean;
}

/** Put a player on the preview page and keep it in step with the workbench settings. */
export function mountPreview(createPlayer: () => HTMLElement, { aspectRatio }: MountOptions): void {
  const root = document.getElementById('root');

  if (!root) throw new Error('The preview page has no #root element to mount the player in.');

  // The i18n provider follows the page's `lang` and loads Video.js's built-in translations for it.
  const i18n = document.createElement('media-i18n');
  const wrapper = document.createElement('div');

  wrapper.className = 'preview-player';
  i18n.append(createPlayer());
  wrapper.append(i18n);
  root.append(wrapper);

  function render(params: WorkbenchParams): void {
    wrapper.removeAttribute('style');

    for (const [name, value] of Object.entries(playerStyles(params))) {
      if (!aspectRatio && name === '--preview-player-ratio') continue;

      wrapper.style.setProperty(name, value);
    }

    applyMediaParams(params);
  }

  render(initialParams());
  onParamsChange(render);
}
