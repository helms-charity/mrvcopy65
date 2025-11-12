import { prepareResponsivePictures } from '../../scripts/scripts.js';

export default function decorate(block) {
  if (!block.querySelector(':scope > div:first-child picture')) {
    block.classList.add('no-image');
  } else {
    const hasImage = block.querySelector(':scope > div:first-child > div');
    if (hasImage) hasImage.classList.add('bg-images');
  }
  prepareResponsivePictures(block);
}
