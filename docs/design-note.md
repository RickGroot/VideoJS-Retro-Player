# Sleeve: design note

### The idea

The video is the photograph on a record cover, and the player is printed on it. Ink on paper, square corners, 2px ink rules, condensed Archivo capitals, and exactly one flat block of colour: the field. The only round shape is the play disc.

Nothing is drawn on bare video. Every control sits on an opaque paper cell, so it reads over white, black or busy footage. Slider parts differ by thickness, not tone: a 2px track, a thicker buffer, a thicker fill and a needle.

### The field

The field changes size with how much the player needs you. Before first play and at the end it is a cover panel beside the picture. While the controls show it is the play cell. While playing with the controls away it shrinks to a thin progress line on the bottom edge.

It changes colour by hard cut, never a fade: orange when ready, yellow playing, blue paused, green ended, red on error.

### Side B

With no picture, the cover is the player. A type panel carries the state word, the title and the remaining time. The artwork prints in greyscale in a square cell, and the progress floods across it in the field colour behind a needle. Without artwork, the title prints as giant cropped letters. Speed is one cell that cycles through the rates when pressed.

The video skin has the same cover, type panel and artwork for media without a picture. Speed stays in its menu, and the fullscreen, picture-in-picture and captions hotkeys still act although their buttons are hidden. Set `data-mode="audio"` on the skin root, or leave it unset and the skin decides.

### Reading it without colour

State is never colour alone. Each state has a word (Ready, Playing, Paused, Ended, Error), the play button swaps its glyph, and the status announcer says it aloud. Buffering is announced as well.

- Every control works from the keyboard and has a label.
- Touch targets are at least 44px, and every surface has a visible focus indicator.
- Source order matches visual order.
- Hotkeys cover play, seek, volume and speed. Captions, fullscreen and picture-in-picture are video only.
- The error dialog names the problem and can be dismissed.
- The skin responds to reduced motion, more contrast, forced colours, and light and dark.

### Using it on your site

It is built from Video.js v10 custom elements, a light-DOM template and plain CSS (`:has()`, container queries, `light-dark()`). The only runtime dependency is `@videojs/html`, and the skin adds no player API of its own.

- Put the template inside `video-player` or `audio-player` and import the skin's script.
- Set `--media-accent-color` to pin the field to a brand colour in every state.
- Set `--sleeve-on-accent` to choose the text colour on the field.
