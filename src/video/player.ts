import { createPlayer, liveFeature } from '@videojs/html';
import { videoFeatures } from '@videojs/html/video';

/**
 * `<sleeve-player>`: the video preset's own feature list plus Video.js's live feature. One tag plays on-demand and
 * live media with the same template: on demand it behaves as `<video-player>` does, and a live source also reports
 * `liveEdgeStart` and `targetLiveWindow`, which `<media-live-button>` and `<sleeve-state>` read.
 */
const { PlayerElement } = createPlayer({ features: [...videoFeatures, liveFeature] });

if (!customElements.get('sleeve-player')) customElements.define('sleeve-player', PlayerElement);
