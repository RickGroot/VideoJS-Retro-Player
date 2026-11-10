import { createAudioPlayer } from './audio-player';
import { mountPreview } from './mount';

mountPreview(createAudioPlayer, { aspectRatio: false });
