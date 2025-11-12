import { getMetadata, fetchPlaceholders } from '../../scripts/aem.js';
import { waitForTaxonomyUpdate, getFullTaxonomyData } from '../../scripts/utils.js';

function updateActiveSlide(slide) {
  const block = slide.closest('.slider-lazer');
  const slideIndex = parseInt(slide.dataset.slideIndex, 10);
  block.dataset.activeSlide = slideIndex;

  const slides = block.querySelectorAll('.slider-slide');

  slides.forEach((aSlide, idx) => {
    aSlide.setAttribute('aria-hidden', idx !== slideIndex);
    aSlide.querySelectorAll('a').forEach((link) => {
      if (idx !== slideIndex) {
        link.setAttribute('tabindex', '-1');
      } else {
        link.removeAttribute('tabindex');
      }
    });
  });
}

function getVisibleSlidesCount(block) {
  if (block.classList.contains('desktop-3')) {
    // You can make this dynamic based on screen size if needed
    if (window.innerWidth >= 900) return 3;
    if (window.innerWidth >= 600) return 2;
  }
  return 1;
}

function updateActiveIndicators(block, activeIndex) {
  const indicators = block.querySelectorAll('.slider-slide-indicator button');
  const visibleCount = getVisibleSlidesCount(block);
  indicators.forEach((btn, idx) => {
    if (idx >= activeIndex && idx < activeIndex + visibleCount) {
      btn.setAttribute('disabled', 'true');
      btn.classList.add('active');
    } else {
      btn.removeAttribute('disabled');
      btn.classList.remove('active');
    }
  });
}

export function showSlide(block, slideIndex = 0) {
  const slides = block.querySelectorAll('.slider-slide');
  const visibleCount = getVisibleSlidesCount(block);
  let realSlideIndex = slideIndex;
  if (realSlideIndex < 0) realSlideIndex = 0;
  if (realSlideIndex > slides.length - visibleCount) realSlideIndex = slides.length - visibleCount;
  block.dataset.activeSlide = realSlideIndex;

  const activeSlide = slides[realSlideIndex];
  const sliderContainer = block.querySelector('.slider-slides');

  if (sliderContainer && activeSlide) {
    // Calculate the scroll position based on slide width
    const slideWidth = activeSlide.offsetWidth;
    const scrollPosition = slideWidth * realSlideIndex;

    sliderContainer.scrollTo({
      top: 0,
      left: scrollPosition,
      behavior: 'smooth',
    });
  }

  updateActiveIndicators(block, realSlideIndex);
  updateActiveSlide(activeSlide); // <-- Add this line
}

function bindEvents(block) {
  const slideIndicators = block.querySelector('.slider-slide-indicators');
  if (!slideIndicators) return;

  slideIndicators.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', (e) => {
      const slideIndicator = e.currentTarget.parentElement;
      showSlide(block, parseInt(slideIndicator.dataset.targetSlide, 10));
    });
  });

  block.querySelector('.slide-prev').addEventListener('click', () => {
    const slides = block.querySelectorAll('.slider-slide');
    const visibleCount = getVisibleSlidesCount(block);
    const current = parseInt(block.dataset.activeSlide, 10) || 0;
    // If at the start, loop to the last visible set
    if (current <= 0) {
      showSlide(block, slides.length - visibleCount);
    } else {
      showSlide(block, current - 1);
    }
  });

  block.querySelector('.slide-next').addEventListener('click', () => {
    const slides = block.querySelectorAll('.slider-slide');
    const visibleCount = getVisibleSlidesCount(block);
    const current = parseInt(block.dataset.activeSlide, 10) || 0;
    // If at the end, loop to the start
    if (current >= slides.length - visibleCount) {
      showSlide(block, 0);
    } else {
      showSlide(block, current + 1);
    }
  });

  // Update indicators on resize (for responsive visible count)
  window.addEventListener('resize', () => {
    const current = parseInt(block.dataset.activeSlide, 10) || 0;
    showSlide(block, current);
  });
}

// Batch metadata retrieval for better performance
function getBatchMetadata() {
  // Cache DOM queries to avoid repeated lookups
  const metadataCache = new Map();

  const getCachedMetadata = (key) => {
    if (!metadataCache.has(key)) {
      metadataCache.set(key, getMetadata(key));
    }
    return metadataCache.get(key);
  };
  // split the string by comma and trim each item
  const amenityData = getCachedMetadata('tags-lazer')
    .split(',')
    .map((item) => item.trim());
  return {
    amenityData,
  };
}

// Cache for taxonomy title -> jcr:description mapping
let taxonomyCache = null;

// Function to build and cache taxonomy mapping
async function getTaxonomyMapping() {
  // Return cached mapping if available
  if (taxonomyCache) {
    return taxonomyCache;
  }

  try {
    const taxonomy = await getFullTaxonomyData();
    if (!taxonomy.data || !Array.isArray(taxonomy.data)) {
      // eslint-disable-next-line no-console
      console.warn('slider-lazer: Invalid taxonomy data structure');
      return new Map();
    }

    // Create a Map for O(1) lookups
    taxonomyCache = new Map(
      taxonomy.data
        .filter((item) => item.title && item['jcr:description'])
        .map((item) => [item.title, item['jcr:description']]),
    );
    return taxonomyCache;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('slider-lazer: Error building taxonomy cache:', error);
    return new Map();
  }
}

// Function to get SVG path for an amenity using cached mapping
async function getAmenitySvgPath(amenityTag) {
  const taxonomyMap = await getTaxonomyMapping();
  const svgPath = taxonomyMap.get(amenityTag);
  return svgPath || null;
}

function createSlideFromAmenity(amenityTag, svgPath, slideIndex, sliderId) {
  // Create slide element
  const slide = document.createElement('li');
  slide.dataset.slideIndex = slideIndex;
  slide.setAttribute('id', `slider-${sliderId}-slide-${slideIndex}`);
  slide.classList.add('slider-slide');

  // Create image div
  const imageDiv = document.createElement('div');
  imageDiv.classList.add('slider-slide-image');

  // Create img element directly for SVG
  const img = document.createElement('img');
  img.src = svgPath;
  img.alt = amenityTag;
  img.loading = 'lazy';

  imageDiv.appendChild(img);
  slide.appendChild(imageDiv);

  return slide;
}

function startAutoSlide(block) {
  const interval = 5000; // 5 seconds
  setInterval(() => {
    const slides = block.querySelectorAll('.slider-slide');
    const visibleCount = getVisibleSlidesCount(block);
    const activeSlideIndex = parseInt(block.dataset.activeSlide, 10) || 0;
    // If at the end, loop to the start
    if (activeSlideIndex >= slides.length - visibleCount) {
      showSlide(block, 0);
    } else {
      showSlide(block, activeSlideIndex + 1);
    }
  }, interval);
}

let sliderId = 0;

export default async function decorate(block) {
  sliderId += 1;
  block.setAttribute('id', `slider-${sliderId}`);

  // Wait for taxonomy to be loaded
  await waitForTaxonomyUpdate();

  // Batch metadata retrieval
  const metadata = getBatchMetadata();

  // Get amenities from metadata
  const amenities = metadata.amenityData;

  // Create slides from amenities
  const slides = [];
  for (let i = 0; i < amenities.length; i += 1) {
    const amenityTag = amenities[i];
    // eslint-disable-next-line no-await-in-loop
    const svgPath = await getAmenitySvgPath(amenityTag);

    if (svgPath) {
      const slide = createSlideFromAmenity(amenityTag, svgPath, i, sliderId);
      slides.push(slide);
    }
  }

  // Log the results
  // eslint-disable-next-line no-console
  console.log(`slider-lazer: Created ${slides.length} slides out of ${amenities.length} amenities`);

  const isSingleSlide = slides.length < 2;

  const placeholders = await fetchPlaceholders();

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', placeholders.slider || 'slider');

  const container = document.createElement('div');
  container.classList.add('slider-slides-container');

  const slidesWrapper = document.createElement('ul');
  slidesWrapper.classList.add('slider-slides');
  block.prepend(slidesWrapper);

  let slideIndicators;
  if (!isSingleSlide) {
    const slideIndicatorsNav = document.createElement('nav');
    slideIndicatorsNav.setAttribute('aria-label', placeholders.sliderSlideControls || 'slider Slide Controls');
    slideIndicators = document.createElement('ol');
    slideIndicators.classList.add('slider-slide-indicators');
    slideIndicatorsNav.append(slideIndicators);
    block.append(slideIndicatorsNav);

    const slideNavButtons = document.createElement('div');
    slideNavButtons.classList.add('slider-navigation-buttons');
    slideNavButtons.innerHTML = `
      <button type="button" class= "slide-prev" aria-label="${placeholders.previousSlide || 'Previous Slide'}"></button>
      <button type="button" class="slide-next" aria-label="${placeholders.nextSlide || 'Next Slide'}"></button>
    `;

    container.append(slideNavButtons);
  }

  // Add slides to wrapper
  slides.forEach((slide, idx) => {
    slidesWrapper.append(slide);

    if (slideIndicators) {
      const indicator = document.createElement('li');
      indicator.classList.add('slider-slide-indicator');
      indicator.dataset.targetSlide = idx;
      indicator.innerHTML = `<button type="button" aria-label="${placeholders.showSlide || 'Show Slide'} ${idx + 1} ${placeholders.of || 'of'} ${slides.length}"></button>`;
      slideIndicators.append(indicator);
    }
  });

  container.append(slidesWrapper);
  block.prepend(container);

  if (!isSingleSlide) {
    bindEvents(block);
    showSlide(block, 0); // Ensure indicators are correct on load

    // Enable autoslide only if the "autoslide" class is present
    if (block.classList.contains('autoslide')) {
      startAutoSlide(block);
    }
  }
}
