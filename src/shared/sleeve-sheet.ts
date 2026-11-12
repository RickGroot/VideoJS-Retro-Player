/**
 * What the two sheet helpers (<sleeve-tracklist> and <sleeve-keys>) share. A sheet is a Video.js `<media-dialog>`: the
 * library keeps the rest of the player inert, closes it on Escape and puts focus in and back. These functions only
 * add the two things the library does not know about:
 *
 *  - a settings-menu item that opens a sheet. The item is a plain `<media-menu-item data-sleeve-opens="<dialog id>">`;
 *    its documented, cancelable `select` event (it bubbles) tells us it was pressed. The skin's ids are made unique per
 *    player, and that rename also covers this attribute, so the value always matches the dialog's own id.
 *  - the focus trip back to the settings button when a sheet that was opened from the menu closes. The menu has
 *    closed itself by then, so the library has no opener element to give focus back to.
 *
 * Everything is scoped to one player (its `.media-skin` root); nothing listens on the page.
 */
import type { DialogElement } from '@videojs/html';

export interface Sheet {
  /** The skin root: the `.media-skin` element that holds the player. */
  root: HTMLElement;
  /** The sheet's own `<media-dialog>`. */
  dialog: DialogElement;
}

export function findSheet(host: Element): Sheet | null {
  const root = host.closest<HTMLElement>('.media-skin');
  const dialog = host.closest<DialogElement>('media-dialog');

  return root && dialog ? { root, dialog } : null;
}

/** Opens `dialog` when a settings-menu item marked for it is pressed, and sends focus back to the settings button on close. */
export function listenForMenuOpener({ root, dialog }: Sheet, signal: AbortSignal): void {
  let fromMenu = false;

  root.addEventListener(
    'select',
    (event) => {
      const item = (event.target as Element | null)?.closest?.('[data-sleeve-opens]');

      if (!item || item.getAttribute('data-sleeve-opens') !== dialog.id) return;

      fromMenu = true;
      // The menu closes itself right after this event; opening on the next task keeps its own focus move out of the way.
      setTimeout(() => {
        dialog.open = true;
      }, 0);
    },
    { signal }
  );

  dialog.addEventListener(
    'open-change-complete',
    (event) => {
      if ((event as CustomEvent<{ open: boolean }>).detail.open || !fromMenu) return;

      fromMenu = false;
      // The library's own focus return has run by now and found no opener; put focus on the button that opened the menu.
      requestAnimationFrame(() => root.querySelector<HTMLElement>('.sleeve-settings-button')?.focus({ preventScroll: true }));
    },
    { signal }
  );
}

/** Whether another dialog of this player (the error dialog, the other sheet) is open. */
export function anotherDialogOpen({ root, dialog }: Sheet): boolean {
  for (const popup of root.querySelectorAll('media-dialog-popup[data-open]')) {
    if (!dialog.contains(popup)) return true;
  }

  return false;
}

/** Keystrokes that belong to a text field are never ours. */
export function inTextField(event: KeyboardEvent): boolean {
  const target = event.target as Element | null;

  return Boolean(target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}
