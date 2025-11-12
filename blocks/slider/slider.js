import { fetchPlaceholders } from '../../scripts/aem.js';
// eslint-disable-next-line no-unused-vars
import { moveInstrumentation, prepareResponsivePictures } from '../../scripts/scripts.js';

function updateActiveSlide(slide) {
  const block = slide.closest('.slider');
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
  block.querySelector('.slider-slides').scrollTo({
    top: 0,
    left: activeSlide.offsetLeft,
    behavior: 'smooth',
  });

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

function createSlide(row, slideIndex, sliderId) {
  // Create slide element
  const slide = document.createElement('li');
  slide.dataset.slideIndex = slideIndex;
  slide.setAttribute('id', `slider-${sliderId}-slide-${slideIndex}`);
  slide.classList.add('slider-slide');

  // Helper function to move children from row to target
  const moveChildren = (target) => {
    while (row.firstChild) {
      const child = row.firstChild;
      if (child.nodeType === Node.ELEMENT_NODE && child.innerHTML.trim() !== '') {
        target.appendChild(child);
      } else {
        row.removeChild(child);
      }
    }
  };

  // Helper function to find link element
  const findLinkElement = () => {
    // First try button-container
    const buttonContainer = row.querySelector('.button-container');
    if (buttonContainer) {
      return { element: buttonContainer.querySelector('a'), container: buttonContainer };
    }

    // Fallback: look for link in any paragraph
    const pWithLink = row.querySelector('p a[href]');
    if (pWithLink) {
      return { element: pWithLink, container: pWithLink.parentElement };
    }

    return { element: null, container: null };
  };

  // Find and process link
  const { element: linkElement, container: linkContainer } = findLinkElement();
  const linkHref = linkElement?.getAttribute('href');

  if (linkHref) {
    // Create link wrapper
    const linkWrapper = document.createElement('a');
    linkWrapper.setAttribute('href', linkHref);
    linkWrapper.setAttribute('title', linkElement.getAttribute('title') || '');
    linkWrapper.classList.add('slider-slide-link');

    // Move children to link wrapper
    moveChildren(linkWrapper);
    slide.appendChild(linkWrapper);

    // Clean up link container
    if (linkContainer) {
      linkContainer.remove();
    }
  } else {
    // No link found, move children directly to slide
    moveChildren(slide);
  }

  // Clean up empty divs
  slide.querySelectorAll('div').forEach((div) => {
    if (!div.innerHTML.trim()) {
      div.remove();
    }
  });

  // Get updated divs and assign classes
  const updatedDivs = slide.querySelectorAll('div');

  // Helper function to assign classes based on div count
  const assignClasses = () => {
    const divCount = updatedDivs.length;

    if (divCount === 1) {
      updatedDivs[0].classList.add('slider-slide-image');
    } else if (divCount === 2) {
      updatedDivs[0].classList.add('slider-slide-content');
      updatedDivs[1].classList.add('slider-slide-image');
    } else if (divCount >= 3) {
      // For 3+ divs, first is image, second is content
      if (updatedDivs[0]) updatedDivs[0].classList.add('slider-slide-image', 'bg-images');
      if (updatedDivs[1]) updatedDivs[1].classList.add('slider-slide-content');

      // Additional divs get image class
      for (let i = 2; i < updatedDivs.length; i += 1) {
        if (updatedDivs[i]) updatedDivs[i].classList.add('slider-slide-image', 'bg-images');
      }
    }
  };

  assignClasses();

  // Handle special case: move content div after image div if needed
  if (updatedDivs.length === 2) {
    const [firstDiv, secondDiv] = updatedDivs;
    if (
      firstDiv.children.length === 1
      && firstDiv.firstElementChild.tagName === 'P'
      && secondDiv.querySelector('picture')
    ) {
      secondDiv.after(firstDiv);
    }
  }

  // Set aria-labelledby
  const labeledBy = slide.querySelector('h1, h2, h3, h4, h5, h6');
  if (labeledBy) {
    slide.setAttribute('aria-labelledby', labeledBy.getAttribute('id'));
  }

  // Process title text
  if (updatedDivs.length >= 1) {
    const firstDiv = updatedDivs[0];
    let titleText = '';

    // Extract title text
    const p = firstDiv.querySelector('p');
    if (p && p.textContent.trim()) {
      titleText = p.textContent.trim();
      p.remove();
    } else if (firstDiv.childNodes.length === 1 && firstDiv.textContent.trim()) {
      titleText = firstDiv.textContent.trim();
      firstDiv.textContent = '';
    }

    // Create title element if text found
    if (titleText) {
      const titleEl = document.createElement('div');
      titleEl.className = 'slider-slide-title';
      titleEl.textContent = titleText;
      firstDiv.after(titleEl);

      // Clean up empty content div
      const contentDiv = slide.querySelector('.slider-slide-content');
      if (contentDiv && !contentDiv.textContent.trim()) {
        contentDiv.remove();
      }
    }
  }

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
  const rows = block.querySelectorAll(':scope > div');
  const isSingleSlide = rows.length < 2;

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

  rows.forEach((row, idx) => {
    const slide = createSlide(row, idx, sliderId);
    moveInstrumentation(row, slide);
    slidesWrapper.append(slide);

    if (slideIndicators) {
      const indicator = document.createElement('li');
      indicator.classList.add('slider-slide-indicator');
      indicator.dataset.targetSlide = idx;
      indicator.innerHTML = `<button type="button" aria-label="${placeholders.showSlide || 'Show Slide'} ${idx + 1} ${placeholders.of || 'of'} ${rows.length}"></button>`;
      slideIndicators.append(indicator);
    }
    row.remove();
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

  // Add 'bg-images' class and prepare responsive pictures for each slide image div
  block.querySelectorAll(':scope > div > ul > li > div, :scope > div > ul > li > a > div').forEach((div) => {
    if (div.querySelector('picture')) {
      div.classList.add('bg-images');
      prepareResponsivePictures(div);
    }
  });
}
