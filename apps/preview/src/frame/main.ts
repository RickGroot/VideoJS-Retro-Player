import { mountPreview } from './mount';
import { createPlayer } from './player';

mountPreview(createPlayer, { aspectRatio: true });
