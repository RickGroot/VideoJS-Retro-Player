import '@/video/player';
import '@videojs/html/media/mux-video';
import '@/video/skin';
import skinTemplate from '@/video/skin.html?raw';

// What the preview plays. Change these to try the skin with your own media; any Mux or HLS URL works.
const SRC = 'https://stream.mux.com/83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s.m3u8';
const POSTER = 'https://image.mux.com/83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s/thumbnail.webp?time=69';
/** Chapters for the time slider, served from `apps/preview/public`. */
const CHAPTERS = './cosmic-dawn-chapters.vtt';

const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';

/**
 * A source to try in place of the demo clip, from the page's hash: `preview.html#live=https://host/stream.m3u8`.
 * Only an https address is accepted. Anything else is ignored and the demo clip plays. The value is never logged.
 */
function liveSource(): string | null {
  const value = new URLSearchParams(window.location.hash.slice(1)).get('live');

  if (!value) return null;

  try {
    const url = new URL(value.trim());

    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function createPlayer(): HTMLElement {
  const player = document.createElement('sleeve-player');
  const own = liveSource();

  // Only constants go through innerHTML. The source below is set with setAttribute.
  player.innerHTML = skinTemplate.replace(MEDIA_PLACEHOLDER, '<mux-video playsinline crossorigin></mux-video>');

  const media = player.querySelector('mux-video');

  if (!media) throw new Error('The skin template has no place for the media.');

  if (own) {
    // A source of the visitor's own: no poster, no chapters, and the manifest is read early so the cover can say Live.
    media.setAttribute('preload', 'metadata');
    media.setAttribute('src', own);
  } else {
    player.setAttribute('poster', POSTER);
    media.setAttribute('src', SRC);

    const chapters = document.createElement('track');

    chapters.setAttribute('kind', 'chapters');
    chapters.setAttribute('label', 'English');
    chapters.setAttribute('srclang', 'en');
    chapters.setAttribute('src', CHAPTERS);
    chapters.setAttribute('default', '');
    media.append(chapters);
  }

  return player;
}
