/* eslint-disable max-classes-per-file */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/extensions */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable prefer-destructuring */
/* eslint-disable import/no-relative-packages */
import { fetchPlaceholders, loadScript, loadCSS } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

// Touch/pinch/pan handling utility for zoomed images
class ZoomPanHandler {
  constructor(element) {
    this.element = element;
    this.isActive = false;
    this.initialDistance = 0;
    this.initialScale = 1;
    this.currentScale = 1;
    this.startX = 0;
    this.startY = 0;
    this.translateX = 0;
    this.translateY = 0;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.isPanning = false;
    this.isPinching = false;

    this.minScale = 1;
    this.maxScale = 4;

    // Detect if this is a mobile OS device (Android, iOS, etc.)
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || ('ontouchstart' in window)
      || (navigator.maxTouchPoints > 0)
      || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    // Detect if this is a Windows touch device (Surface tablets, etc.)
    this.isWindowsTouch = /Windows/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0;

    // Cache bound methods for better performance and cleanup
    this.boundHandleTouchStart = this.handleTouchStart.bind(this);
    this.boundHandleTouchMove = this.handleTouchMove.bind(this);
    this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
    this.boundHandleMouseDown = this.handleMouseDown.bind(this);
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleMouseUp = this.handleMouseUp.bind(this);

    // Cache base image dimensions (captured at scale 1.0)
    this.baseDimensions = null;

    this.init();
  }

  init() {
    // Add touch event listeners on non-mobile devices and Windows touch devices
    // Mobile OS devices (Android, iOS) use native pinch-to-zoom
    // Windows touch devices use custom zoom functionality
    if (!this.isMobile || this.isWindowsTouch) {
      this.element.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
      this.element.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
      this.element.addEventListener('touchend', this.boundHandleTouchEnd, { passive: false });
    }
    this.element.addEventListener('mousedown', this.boundHandleMouseDown, { passive: false });
    document.addEventListener('mousemove', this.boundHandleMouseMove, { passive: false });
    document.addEventListener('mouseup', this.boundHandleMouseUp, { passive: false });
  }

  activate() {
    this.isActive = true;

    // On mobile OS devices, don't interfere with native touch behavior
    // On Windows touch devices, use custom zoom functionality
    if (this.isMobile && !this.isWindowsTouch) {
      this.element.style.touchAction = 'auto';
      // Ensure no custom transforms are applied
      this.element.style.transform = 'none';
      this.element.style.transformOrigin = 'initial';
      return;
    }

    this.element.style.touchAction = 'none';

    // Capture base dimensions when first activated (at scale 1.0)
    this.captureBaseDimensions();

    // Only set initial zoom scale if we're not already zoomed
    if (this.currentScale <= 1) {
      this.currentScale = 2;
      this.updateTransform();
    }
  }

  captureBaseDimensions() {
    const img = this.element.querySelector('img');
    if (img) {
      // Get the container dimensions
      const containerRect = this.element.getBoundingClientRect();

      // Get the image's natural dimensions
      const naturalWidth = img.naturalWidth || img.offsetWidth;
      const naturalHeight = img.naturalHeight || img.offsetHeight;

      // Calculate how the image fits in the container (aspect ratio preservation)
      const containerAspect = containerRect.width / containerRect.height;
      const imageAspect = naturalWidth / naturalHeight;

      let baseWidth;
      let baseHeight;

      if (imageAspect > containerAspect) {
        // Image is wider than container - fit to width
        baseWidth = containerRect.width;
        baseHeight = containerRect.width / imageAspect;
      } else {
        // Image is taller than container - fit to height
        baseHeight = containerRect.height;
        baseWidth = containerRect.height * imageAspect;
      }

      this.baseDimensions = {
        width: baseWidth,
        height: baseHeight,
      };
    }
  }

  deactivate() {
    this.isActive = false;

    // On mobile OS devices, don't interfere with native touch behavior
    // On Windows touch devices, use custom zoom functionality
    if (this.isMobile && !this.isWindowsTouch) {
      this.element.style.touchAction = 'auto';
      // Ensure no custom transforms are applied
      this.element.style.transform = 'none';
      this.element.style.transformOrigin = 'initial';
      return;
    }

    this.element.style.touchAction = '';
    this.reset();
  }

  // Method to handle manual zoom out from button
  manualZoomOut() {
    // On mobile OS devices, just reset state without transforms
    // On Windows touch devices, use custom zoom functionality
    if (this.isMobile && !this.isWindowsTouch) {
      this.currentScale = 1;
      this.translateX = 0;
      this.translateY = 0;
      // Ensure no custom transforms are applied
      this.element.style.transform = 'none';
      this.element.style.transformOrigin = 'initial';
      return;
    }

    this.currentScale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.updateTransform();
  }

  reset() {
    this.currentScale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.updateTransform();
  }

  // Reset zoom when image changes (for dynamic lightbox content)
  resetForNewImage() {
    this.reset();
    this.isActive = false;
    // Clear cached dimensions so they get recaptured for the new image
    this.baseDimensions = null;
  }

  // Method to handle slide changes - reset zoom but keep handler
  handleSlideChange() {
    this.currentScale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.updateTransform();
    this.isActive = false;
    // Don't clear baseDimensions - they'll be recaptured on next activate
  }

  // Method to update handler for new slide container
  updateContainer(newContainer) {
    // Remove old event listeners
    this.destroy();

    // Update element reference and reinitialize
    this.element = newContainer;
    this.init();

    // Reset state for new container
    this.currentScale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.isActive = false;
    this.baseDimensions = null;
  }

  static getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  updateTransform() {
    // Don't cache img element as it changes dynamically in lightbox
    const img = this.element.querySelector('img');
    if (img) {
      const transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.currentScale})`;
      img.style.transform = transform;
      img.style.transformOrigin = 'center center';
    }
  }

  handleTouchStart(e) {
    if (!this.isActive) return;

    // On mobile OS devices, don't handle touch events - let native behavior work
    // On Windows touch devices, use custom zoom functionality
    if (this.isMobile && !this.isWindowsTouch) {
      return;
    }

    e.preventDefault();

    if (e.touches.length === 1) {
      // Single touch - start panning
      this.isPanning = true;
      this.startX = e.touches[0].clientX - this.translateX;
      this.startY = e.touches[0].clientY - this.translateY;
      this.lastTouchX = e.touches[0].clientX;
      this.lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      // Two touches - start pinching
      this.isPinching = true;
      this.isPanning = false;
      this.initialDistance = ZoomPanHandler.getDistance(e.touches[0], e.touches[1]);
      this.initialScale = this.currentScale;
    }
  }

  handleTouchMove(e) {
    if (!this.isActive) return;

    // On mobile OS devices, don't handle touch events - let native behavior work
    // On Windows touch devices, use custom zoom functionality
    if (this.isMobile && !this.isWindowsTouch) {
      return;
    }

    e.preventDefault();

    if (e.touches.length === 1 && this.isPanning && !this.isPinching) {
      // Single touch panning
      this.translateX = e.touches[0].clientX - this.startX;
      this.translateY = e.touches[0].clientY - this.startY;

      // Constrain panning based on zoom level
      if (this.baseDimensions) {
        // Get the lightbox viewport dimensions
        const lightboxViewport = this.element.getBoundingClientRect();

        // Calculate the scaled dimensions using cached base dimensions
        const scaledWidth = this.baseDimensions.width * this.currentScale;
        const scaledHeight = this.baseDimensions.height * this.currentScale;

        // Only apply constraints when zoomed in (scale > 1.0)
        if (this.currentScale > 1.0) {
          // Calculate panning boundaries based on image center and viewport
          // The image should be able to pan so that any part can reach the viewport center
          const maxTranslateX = Math.max(0, (scaledWidth - lightboxViewport.width) / 2);
          const maxTranslateY = Math.max(0, (scaledHeight - lightboxViewport.height) / 2);

          this.translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, this.translateX));
          this.translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, this.translateY));
        } else {
          // At scale 1.0, allow free panning without constraints
          // This enables basic touch panning even when not zoomed
        }
      }

      this.updateTransform();
    } else if (e.touches.length === 2 && this.isPinching) {
      // Two finger pinch/zoom
      const currentDistance = ZoomPanHandler.getDistance(e.touches[0], e.touches[1]);
      const scale = (currentDistance / this.initialDistance) * this.initialScale;

      this.currentScale = Math.max(this.minScale, Math.min(this.maxScale, scale));

      // Reset translation when zooming out to minimum
      if (this.currentScale === this.minScale) {
        this.translateX = 0;
        this.translateY = 0;
      }

      this.updateTransform();
    }
  }

  handleTouchEnd(e) {
    if (!this.isActive) return;

    // On mobile OS devices, don't handle touch events - let native behavior work
    // On Windows touch devices, use custom zoom functionality
    if (this.isMobile && !this.isWindowsTouch) {
      return;
    }

    e.preventDefault();

    if (e.touches.length === 0) {
      this.isPanning = false;
      this.isPinching = false;
    } else if (e.touches.length === 1) {
      this.isPinching = false;
      // Continue panning with remaining touch
      this.startX = e.touches[0].clientX - this.translateX;
      this.startY = e.touches[0].clientY - this.translateY;
    }
  }

  handleMouseDown(e) {
    if (!this.isActive) return;

    e.preventDefault();
    this.isPanning = true;
    this.startX = e.clientX - this.translateX;
    this.startY = e.clientY - this.translateY;
    this.element.style.cursor = 'grabbing';
  }

  handleMouseMove(e) {
    if (!this.isActive || !this.isPanning) return;

    e.preventDefault();
    this.translateX = e.clientX - this.startX;
    this.translateY = e.clientY - this.startY;

    // Constrain panning based on zoom level (same logic as touch)
    if (this.baseDimensions) {
      const lightboxViewport = this.element.getBoundingClientRect();
      const scaledWidth = this.baseDimensions.width * this.currentScale;
      const scaledHeight = this.baseDimensions.height * this.currentScale;

      if (this.currentScale > 1.0) {
        const maxTranslateX = Math.max(0, (scaledWidth - lightboxViewport.width) / 2);
        const maxTranslateY = Math.max(0, (scaledHeight - lightboxViewport.height) / 2);

        this.translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, this.translateX));
        this.translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, this.translateY));
      }
    }

    this.updateTransform();
  }

  handleMouseUp(e) {
    if (!this.isActive) return;

    e.preventDefault();
    this.isPanning = false;
    this.element.style.cursor = 'grab';
  }

  destroy() {
    // Remove touch event listeners if they were added (non-mobile devices and Windows touch)
    if (!this.isMobile || this.isWindowsTouch) {
      this.element.removeEventListener('touchstart', this.boundHandleTouchStart);
      this.element.removeEventListener('touchmove', this.boundHandleTouchMove);
      this.element.removeEventListener('touchend', this.boundHandleTouchEnd);
    }
    this.element.removeEventListener('mousedown', this.boundHandleMouseDown);
    document.removeEventListener('mousemove', this.boundHandleMouseMove);
    document.removeEventListener('mouseup', this.boundHandleMouseUp);
    this.deactivate();
    // Clear references
    this.baseDimensions = null;
    this.element = null;
  }
}

// Dynamically load Swiper from bundled assets using AEM EDS utilities
const loadSwiper = async () => {
  if (window.Swiper) {
    return Promise.resolve();
  }

  try {
    // Load Swiper CSS using AEM EDS loadCSS function
    await loadCSS(`${window.hlx.codeBasePath}/styles/swiper-bundle.min.css`);

    // Load Swiper JS using AEM EDS loadScript function
    await loadScript(`${window.hlx.codeBasePath}/scripts/swiper-bundle.min.js`);

    // Wait for Swiper to be fully initialized with timeout
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 100; // 1 second timeout (100 * 10ms)
      const checkSwiper = () => {
        if (window.Swiper) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Swiper failed to initialize within timeout period'));
        } else {
          attempts += 1;
          setTimeout(checkSwiper, 10);
        }
      };
      checkSwiper();
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load Swiper library:', error);
    throw error;
  }
};

// Cache for downloaded images to avoid duplicates
const downloadedImages = new Set();

// Start downloading image when carousel comes into view
function startImageDownload(src) {
  if (downloadedImages.has(src)) return;
  downloadedImages.add(src);

  // Create a hidden image element to start the download
  const img = new Image();
  img.src = src;
  // Don't append to DOM - just start the download
}

// Download adjacent images (next and previous) when current slide becomes active
function downloadAdjacentImages(block, currentIndex) {
  const slides = block.querySelectorAll('.swiper-slide');
  const totalSlides = slides.length;

  // Calculate next and previous indices with wrapping
  const nextIndex = (currentIndex + 1) % totalSlides;
  const prevIndex = (currentIndex - 1 + totalSlides) % totalSlides;

  // Download next image
  const nextSlide = slides[nextIndex];
  if (nextSlide) {
    const nextImg = nextSlide.querySelector('img[loading="lazy"]');
    if (nextImg && nextImg.src) {
      nextImg.setAttribute('loading', 'eager');
      startImageDownload(nextImg.src);
    }
  }

  // Download previous image (for better backward navigation)
  const prevSlide = slides[prevIndex];
  if (prevSlide && prevIndex !== currentIndex) {
    const prevImg = prevSlide.querySelector('img[loading="lazy"]');
    if (prevImg && prevImg.src) {
      prevImg.setAttribute('loading', 'eager');
      startImageDownload(prevImg.src);
    }
  }
}

function updateActiveSlide(slide) {
  const block = slide.closest('.carousel');
  const slideIndex = parseInt(slide.dataset.slideIndex, 10);
  block.dataset.activeSlide = slideIndex;

  const slides = block.querySelectorAll('.swiper-slide');

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

  // Download adjacent images with a small delay to avoid unnecessary downloads
  setTimeout(() => {
    downloadAdjacentImages(block, slideIndex);
  }, 1000); // Wait 1 second before downloading
}

export function showSlide(block, slideIndex = 0) {
  const swiper = block.swiper;
  if (swiper) {
    swiper.slideTo(slideIndex);
  }
}

function createSlide(row, slideIndex, carouselId) {
  // Create slide element
  const slide = document.createElement('li');
  slide.dataset.slideIndex = slideIndex;
  slide.setAttribute('id', `carousel-${carouselId}-slide-${slideIndex}`);
  slide.classList.add('swiper-slide');

  // Add data attributes for Universal Editor
  slide.setAttribute('data-component', 'carousel-item');
  slide.setAttribute('data-carousel-id', carouselId);
  // Add attribute to help Universal Editor recognize this as a container for images
  slide.setAttribute('data-aue-children', 'image');

  // Helper function to assign classes to divs in the original row
  const assignClassesToRow = () => {
    // Clean up empty divs first
    row.querySelectorAll('div').forEach((div) => {
      if (!div.innerHTML.trim()) {
        div.remove();
      }
    });

    const divs = row.querySelectorAll('div');
    const divCount = divs.length;

    if (divCount === 1) {
      // Single div: check if it contains picture elements
      if (divs[0].querySelector('picture')) {
        divs[0].classList.add('carousel-slide-image', 'bg-images');
      } else {
        divs[0].classList.add('carousel-slide-content');
      }
    } else if (divCount === 2) {
      // Two divs: check each for picture elements
      if (divs[0].querySelector('picture')) {
        divs[0].classList.add('carousel-slide-image', 'bg-images');
        divs[1].classList.add('carousel-slide-content');
      } else if (divs[1].querySelector('picture')) {
        divs[0].classList.add('carousel-slide-content');
        divs[1].classList.add('carousel-slide-image', 'bg-images');
      } else {
        // If neither has picture, first is content, second is image (fallback)
        divs[0].classList.add('carousel-slide-content');
        divs[1].classList.add('carousel-slide-image', 'bg-images');
      }
    } else if (divCount >= 3) {
      // Multiple divs: check each for picture elements
      for (let i = 0; i < divs.length; i += 1) {
        if (divs[i].querySelector('picture')) {
          divs[i].classList.add('carousel-slide-image', 'bg-images');
        } else {
          divs[i].querySelector('carousel-slide-content');
        }
      }
    }
  };

  // Helper function to move children from row to target
  const moveChildren = (target) => {
    while (row.firstChild) {
      const child = row.firstChild;
      if (child.nodeType === Node.ELEMENT_NODE && child.innerHTML.trim() !== '') {
        // Add proper Universal Editor attributes to images
        // (main carousel slides only, not lightbox)
        const pictures = child.querySelectorAll('picture');
        pictures.forEach((picture) => {
          // Only add Universal Editor attributes if this is not in a lightbox
          if (!picture.closest('.carousel-lightbox')) {
            // Add Universal Editor attributes to picture element only
            picture.setAttribute('data-aue-resource', 'image');
            picture.setAttribute('data-aue-behavior', 'component');
            picture.setAttribute('data-aue-type', 'media');
            picture.setAttribute('data-aue-label', 'Imagem');
            // Add carousel slide reference for Universal Editor hierarchy
            picture.setAttribute('data-aue-prop', 'image_mobile');
          }

          // Keep carousel-specific attributes
          picture.setAttribute('data-component', 'image');
          picture.setAttribute('data-carousel-slide', slideIndex);

          // Remove Universal Editor attributes from img elements to prevent duplicates
          const imgs = picture.querySelectorAll('img');
          imgs.forEach((img) => {
            img.removeAttribute('data-aue-resource');
            img.removeAttribute('data-aue-behavior');
            img.removeAttribute('data-aue-type');
            img.removeAttribute('data-aue-label');
            img.removeAttribute('data-aue-prop');
            // Keep only carousel-specific attributes
            img.setAttribute('data-component', 'image');
            img.setAttribute('data-carousel-slide', slideIndex);
          });
        });

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

  // Assign classes to divs in the original row before moving them
  assignClassesToRow();

  // Move images to be direct children of carousel slides for Universal Editor hierarchy
  const imageContainers = row.querySelectorAll('.carousel-slide-image');
  imageContainers.forEach((container) => {
    const imagePictures = container.querySelectorAll('picture');
    imagePictures.forEach((picture) => {
      // Create a new wrapper div with the proper classes
      const wrapperDiv = document.createElement('div');
      wrapperDiv.className = 'carousel-slide-image bg-images';

      // Clone the picture and add it to the wrapper div
      const clonedPicture = picture.cloneNode(true);
      wrapperDiv.appendChild(clonedPicture);

      // Add the wrapper div to the slide
      slide.appendChild(wrapperDiv);

      // Remove the original picture from the container
      picture.remove();
    });
    // Remove the now-empty image container
    if (container.children.length === 0) {
      container.remove();
    }
  });

  // Find and process link
  const { element: linkElement, container: linkContainer } = findLinkElement();
  const linkHref = linkElement?.getAttribute('href');

  if (linkHref) {
    // Create link wrapper
    const linkWrapper = document.createElement('a');
    linkWrapper.setAttribute('href', linkHref);
    linkWrapper.setAttribute('title', linkElement.getAttribute('title') || '');
    linkWrapper.classList.add('carousel-slide-link');

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

  // Handle special case: move content div after image div if needed
  const slideDivs = slide.querySelectorAll('div');
  if (slideDivs.length === 2) {
    const [firstDiv, secondDiv] = slideDivs;
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

  return slide;
}

async function initializeSwiper(block, slidesWrapper) {
  // Find the swiper-wrapper which contains the actual slides
  const slidesContainer = slidesWrapper.querySelector('.swiper-wrapper');
  const isSingleSlide = slidesContainer.children.length < 2;

  if (isSingleSlide) {
    return null;
  }

  // Ensure Swiper is loaded
  try {
    await loadSwiper();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Swiper initialization failed:', error);
    return null;
  }

  // Check if Swiper is available
  if (!window.Swiper) {
    return null;
  }

  // Initialize main Swiper
  const autoplayConfig = block.classList.contains('autoslide') ? {
    delay: 5000,
    disableOnInteraction: false,
    pauseOnMouseEnter: false, // Disable pause on mouse enter to prevent frequent pausing
  } : false;
  const swiper = new window.Swiper(slidesWrapper, {
    slidesPerView: 1,
    spaceBetween: 0,
    loop: true,
    centeredSlides: false,
    watchSlidesProgress: true,
    resistance: false,
    speed: 300,
    followFinger: false,
    momentum: false,
    threshold: 50,
    touchReleaseOnEdges: false,
    autoplay: autoplayConfig,
    navigation: {
      nextEl: block.querySelector('.swiper-button-next'),
      prevEl: block.querySelector('.swiper-button-prev'),
    },
    pagination: {
      el: block.querySelector('.swiper-pagination'),
      clickable: true,
      bulletClass: 'swiper-pagination-bullet',
      bulletActiveClass: 'swiper-pagination-bullet-active',
    },
    on: {
      slideChange() {
        const activeSlide = this.slides[this.activeIndex];
        if (activeSlide) {
          updateActiveSlide(activeSlide);
        }
      },
      init() {
        // Set initial active slide
        const activeSlide = this.slides[this.activeIndex];
        if (activeSlide) {
          updateActiveSlide(activeSlide);
        }
      },
    },
  });

  // Store swiper instance on the block for external access
  block.swiper = swiper;

  // Explicitly start autoplay if it's configured and the carousel is visible
  if (block.classList.contains('autoslide') && swiper.autoplay) {
    // Use a small delay to ensure the carousel is fully rendered
    setTimeout(() => {
      if (swiper.autoplay && !swiper.autoplay.running) {
        swiper.autoplay.start();
      } else if (swiper.autoplay && swiper.autoplay.running && swiper.autoplay.paused) {
        swiper.autoplay.resume();
      }
    }, 100);

    // Add an additional delayed check to force resume if still paused
    setTimeout(() => {
      if (swiper.autoplay && swiper.autoplay.running && swiper.autoplay.paused) {
        swiper.autoplay.resume();
      }
    }, 2000); // Check after 2 seconds
  }

  return swiper;
}

function updateLightboxInfo(block, slideIndex, realIndex) {
  const lightbox = block.querySelector('.carousel-lightbox');
  const lightboxSwiper = lightbox.querySelector('.carousel-lightbox-swiper');
  const lightboxSlides = lightboxSwiper.querySelectorAll('.carousel-lightbox-slide');
  const currentSlide = lightboxSlides[slideIndex];

  if (!currentSlide) return;

  const counter = lightbox.querySelector('.carousel-lightbox-counter');
  const subtitle = lightbox.querySelector('.carousel-lightbox-subtitle');

  // Update counter - use realIndex for correct slide numbering when looping
  if (counter) {
    const totalSlides = lightboxSlides.length;
    const displayIndex = realIndex !== undefined ? realIndex + 1 : slideIndex + 1;
    counter.textContent = `${displayIndex} / ${totalSlides}`;
  }

  // Update caption from image alt text
  if (subtitle) {
    const img = currentSlide.querySelector('picture img');
    const alt = img ? img.getAttribute('alt') || '' : '';
    subtitle.textContent = alt;
  }
}

async function initializeLightboxSwiper(block, lightboxContainer, isMobile, isWindowsTouch) {
  const slidesContainer = lightboxContainer.querySelector('.swiper-wrapper');

  if (!slidesContainer || slidesContainer.children.length < 1) {
    return null;
  }

  // Ensure Swiper is loaded
  try {
    await loadSwiper();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Swiper initialization failed for lightbox:', error);
    return null;
  }

  // Initialize lightbox Swiper - operates independently from main carousel
  const lightboxSwiper = new window.Swiper(lightboxContainer.querySelector('.swiper'), {
    slidesPerView: 1,
    spaceBetween: 0,
    rewind: true,
    centeredSlides: true,
    speed: 300,
    allowTouchMove: true,
    // Disable zoom on mobile OS devices, enable on desktop and Windows touch devices
    zoom: (isMobile && !isWindowsTouch) ? false : {
      enabled: true,
      maxRatio: 3,
      minRatio: 1,
      toggle: false, // We'll handle toggle manually
      containerClass: 'swiper-zoom-container',
      zoomedSlideClass: 'swiper-slide-zoomed',
      // Additional zoom settings for proper mouse handling
      limitToOriginalSize: false,
      scale: 1,
    },
    // Disable pan on mobile OS devices, enable on desktop and Windows touch devices
    panOnMouseMove: !(isMobile && !isWindowsTouch),
    // Additional zoom settings (only for desktop and Windows touch devices)
    ...((isMobile && !isWindowsTouch) ? {} : {
      zoomRatio: 2,
      zoomMaxRatio: 3,
      zoomMinRatio: 1,
      grabCursor: true,
    }),
    // Mobile OS device settings to prevent zoom interference
    ...((isMobile && !isWindowsTouch) ? {
      allowTouchMove: true,
      touchStartPreventDefault: false,
      touchMoveStopPropagation: false,
      // Ensure no zoom-related touch handling
      preventInteractionOnTransition: false,
    } : {}),
    preventClicks: false,
    preventClicksPropagation: false,
    keyboard: {
      enabled: true,
      onlyInViewport: false,
    },
    navigation: {
      nextEl: lightboxContainer.querySelector('.swiper-button-next'),
      prevEl: lightboxContainer.querySelector('.swiper-button-prev'),
    },
    on: {
      slideChange() {
        // Update counter and caption for lightbox only
        updateLightboxInfo(block, this.activeIndex, this.realIndex);

        // Reset zoom state when slide changes
        if (block.zoomPanHandler && block.isCurrentlyZoomed) {
          // Get the new slide's zoom container
          const newSlide = this.slides[this.activeIndex];
          const newZoomContainer = newSlide?.querySelector('.swiper-zoom-container');

          if (newZoomContainer && block.zoomPanHandler) {
            // Update the handler for the new container
            block.zoomPanHandler.updateContainer(newZoomContainer);
          } else {
            // Fallback: just reset the handler
            block.zoomPanHandler.handleSlideChange();
          }

          block.isCurrentlyZoomed = false;

          // Re-enable touch/swipe navigation
          if (this.allowTouchMove !== undefined) {
            this.allowTouchMove = true;
            this.allowSlideNext = true;
            this.allowSlidePrev = true;
          }
        }
      },
      init() {
        updateLightboxInfo(block, this.activeIndex, this.realIndex);
      },

    },
  });

  // Store lightbox swiper instance
  block.lightboxSwiper = lightboxSwiper;

  // Handle zoom module based on device type
  if (isMobile && !isWindowsTouch) {
    // Completely disable Swiper zoom module in lightbox on mobile OS devices
    // to allow native OS pinch-to-zoom without interference
    if (lightboxSwiper.zoom && lightboxSwiper.zoom.enabled) {
      lightboxSwiper.zoom.disable();
    }
    // Remove zoom-related classes from slides to prevent CSS interference
    lightboxSwiper.slides.forEach((slide) => {
      slide.classList.remove('swiper-slide-zoomed');
      const zoomContainer = slide.querySelector('.swiper-zoom-container');
      if (zoomContainer) {
        zoomContainer.classList.remove('swiper-zoom-container');
        // Ensure no custom zoom transforms are applied
        zoomContainer.style.transform = 'none';
        zoomContainer.style.transformOrigin = 'initial';
        // Allow native touch behavior
        zoomContainer.style.touchAction = 'manipulation';
      }
    });
  } else if (lightboxSwiper.zoom && !lightboxSwiper.zoom.enabled) {
    // Try to manually enable zoom module if it's not working (desktop and Windows touch devices)
    lightboxSwiper.zoom.enable();
  }

  // Check if zoom module is properly loaded
  if (lightboxSwiper.zoom) {
    // Manually set zoom ratios since configuration isn't being applied
    lightboxSwiper.zoom.maxRatio = 3;
    lightboxSwiper.zoom.minRatio = 1;

    // Force zoom module to reinitialize with new ratios
    lightboxSwiper.zoom.disable();
    lightboxSwiper.zoom.enable();

    // Wait for slides to be fully loaded before finalizing zoom setup
    setTimeout(() => {
      if (lightboxSwiper.zoom) {
        lightboxSwiper.zoom.enable();
      }
    }, 100);
  }

  return lightboxSwiper;
}

let carouselId = 0;
export default async function decorate(block) {
  // Detect mobile OS devices and Windows touch devices separately
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window)
    || (navigator.maxTouchPoints > 0)
    || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  // Detect Windows touch devices specifically (Surface tablets, etc.)
  const isWindowsTouch = /Windows/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0;

  carouselId += 1;
  block.setAttribute('id', `carousel-${carouselId}`);
  block.setAttribute('data-component', 'carousel');

  const rows = block.querySelectorAll(':scope > div');
  const isSingleSlide = rows.length < 2;

  const placeholders = await fetchPlaceholders();

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', placeholders.carousel || 'Carousel');

  const container = document.createElement('div');
  container.classList.add('carousel-slides-container');

  const slidesWrapper = document.createElement('div');
  slidesWrapper.classList.add('swiper');
  block.prepend(slidesWrapper);

  const slidesContainer = document.createElement('div');
  slidesContainer.classList.add('swiper-wrapper');
  slidesWrapper.appendChild(slidesContainer);

  let slideIndicators;
  if (!isSingleSlide) {
    const slideIndicatorsNav = document.createElement('nav');
    slideIndicatorsNav.setAttribute('aria-label', placeholders.carouselSlideControls || 'Carousel Slide Controls');
    slideIndicators = document.createElement('div');
    slideIndicators.classList.add('swiper-pagination');
    slideIndicatorsNav.append(slideIndicators);
    block.append(slideIndicatorsNav);

    // Create navigation buttons
    const slidePrevButton = document.createElement('button');
    slidePrevButton.classList.add('swiper-button-prev');
    slidePrevButton.setAttribute('aria-label', placeholders.previousSlide || 'Previous Slide');

    const slideNextButton = document.createElement('button');
    slideNextButton.classList.add('swiper-button-next');
    slideNextButton.setAttribute('aria-label', placeholders.nextSlide || 'Next Slide');

    slidesWrapper.appendChild(slidePrevButton);
    slidesWrapper.appendChild(slideNextButton);
  }

  rows.forEach((row, idx) => {
    const slide = createSlide(row, idx, carouselId);
    moveInstrumentation(row, slide);
    slidesContainer.appendChild(slide);
    row.remove();
  });

  container.appendChild(slidesWrapper);
  block.prepend(container);

  // Initialize Swiper
  await initializeSwiper(block, slidesWrapper);

  const lightbox = document.createElement('div');
  lightbox.className = 'carousel-lightbox';

  // Create lightbox swiper structure
  const lightboxSwiper = document.createElement('div');
  lightboxSwiper.className = 'swiper carousel-lightbox-swiper';

  const lightboxWrapper = document.createElement('div');
  lightboxWrapper.className = 'swiper-wrapper';

  // Clone slides for lightbox
  const mainSlides = slidesContainer.children;
  Array.from(mainSlides).forEach((slide) => {
    const lightboxSlide = document.createElement('div');
    lightboxSlide.className = 'swiper-slide carousel-lightbox-slide';

    const picture = slide.querySelector('picture');
    if (picture) {
      const lightboxPicture = picture.cloneNode(true);

      // Remove ALL Universal Editor attributes from lightbox pictures
      // to prevent them from appearing in content tree
      lightboxPicture.removeAttribute('data-aue-resource');
      lightboxPicture.removeAttribute('data-aue-behavior');
      lightboxPicture.removeAttribute('data-aue-type');
      lightboxPicture.removeAttribute('data-aue-label');
      lightboxPicture.removeAttribute('data-aue-prop');

      // Also remove Universal Editor attributes from img elements in lightbox
      const lightboxImgs = lightboxPicture.querySelectorAll('img');
      lightboxImgs.forEach((img) => {
        img.removeAttribute('data-aue-resource');
        img.removeAttribute('data-aue-behavior');
        img.removeAttribute('data-aue-type');
        img.removeAttribute('data-aue-label');
        img.removeAttribute('data-aue-prop');
      });

      // Add zoom container class to enable zoom functionality (desktop and Windows touch devices)
      if (!isMobile || isWindowsTouch) {
        lightboxPicture.classList.add('swiper-zoom-container');
      }

      // Update all img elements within the picture to use high-resolution version
      const imgs = lightboxPicture.querySelectorAll('img');
      imgs.forEach((img) => {
        const currentSrc = img.getAttribute('src');
        if (currentSrc) {
          const url = new URL(currentSrc, window.location.href);
          url.searchParams.set('width', '2000');
          img.src = url.toString();
        }

        // Detect portrait vs landscape and add appropriate class
        // eslint-disable-next-line func-names
        img.onload = function () {
          if (this.naturalWidth && this.naturalHeight) {
            const isPortrait = this.naturalHeight > this.naturalWidth;
            lightboxSlide.classList.add(isPortrait ? 'portrait' : 'landscape');
          }
        };

        // If image is already loaded, check immediately
        if (img.complete) {
          if (img.naturalWidth && img.naturalHeight) {
            const isPortrait = img.naturalHeight > img.naturalWidth;
            lightboxSlide.classList.add(isPortrait ? 'portrait' : 'landscape');
          }
        }
      });
      lightboxSlide.appendChild(lightboxPicture);
    }

    lightboxWrapper.appendChild(lightboxSlide);
  });

  lightboxSwiper.appendChild(lightboxWrapper);

  // Add navigation and pagination for lightbox
  const lightboxNavPrev = document.createElement('button');
  lightboxNavPrev.className = 'swiper-button-prev carousel-lightbox-nav';
  lightboxNavPrev.setAttribute('aria-label', 'Previous slide');

  const lightboxNavNext = document.createElement('button');
  lightboxNavNext.className = 'swiper-button-next carousel-lightbox-nav';
  lightboxNavNext.setAttribute('aria-label', 'Next slide');

  const lightboxPagination = document.createElement('div');
  lightboxPagination.className = 'swiper-pagination carousel-lightbox-pagination';

  lightboxSwiper.appendChild(lightboxNavPrev);
  lightboxSwiper.appendChild(lightboxNavNext);
  lightboxSwiper.appendChild(lightboxPagination);

  lightbox.innerHTML = `
    <div class="carousel-lightbox-backdrop"></div>
    <div class="carousel-lightbox-content">
      <div class="carousel-lightbox-counter"></div>
      <button class="carousel-lightbox-zoom" aria-label="Zoom In" title="Zoom In">
        <span class="zoom-icon zoom-in">
          <span class="zoom-handle"></span>
        </span>
      </button>
      <button class="carousel-lightbox-close" aria-label="Close">&times;</button>
      <div class="carousel-lightbox-subtitle"></div>
      <div class="carousel-lightbox-text"></div>
    </div>
  `;

  // Insert the swiper into the lightbox content
  const lightboxContent = lightbox.querySelector('.carousel-lightbox-content');
  lightboxContent.insertBefore(lightboxSwiper, lightboxContent.querySelector('.carousel-lightbox-subtitle'));

  // Set lightbox background color based on grandparent container's cor-global- classes
  const grandparentContainer = block.parentElement.parentElement;
  if (grandparentContainer) {
    const containerClasses = Array.from(grandparentContainer.classList);
    const corGlobalClass = containerClasses.find((cls) => cls.startsWith('cor-global-'));
    if (corGlobalClass) {
      const colorVariable = `--${corGlobalClass}`;
      lightbox.style.setProperty('background', `var(${colorVariable}, var(--cor-global-azul-20))`);
    }
  }

  block.append(lightbox);

  // Add Windows touch device class to lightbox for CSS targeting
  if (isWindowsTouch) {
    lightbox.classList.add('windows-touch-device');
  }

  // Initialize lightbox Swiper
  await initializeLightboxSwiper(block, lightbox, isMobile, isWindowsTouch);

  // Function to open lightbox to specific slide
  function openLightbox(slideIndex) {
    const lightboxDiv = block.querySelector('.carousel-lightbox');

    if (lightboxDiv) {
      // Open the lightbox
      lightboxDiv.classList.add('open');
      document.body.classList.add('lightbox-open');

      // Sync lightbox swiper to the correct slide and update info
      if (block.lightboxSwiper) {
        block.lightboxSwiper.slideTo(slideIndex, 0);
        // Update info after slide change
        setTimeout(() => {
          updateLightboxInfo(block, slideIndex, slideIndex);
        }, 0);
      }
    }
  }

  // Simple close lightbox function
  function closeLightbox() {
    const lightboxDiv = block.querySelector('.carousel-lightbox');
    if (lightboxDiv) {
      lightboxDiv.classList.remove('open');
      document.body.classList.remove('lightbox-open');
    }
  }

  // Add event listeners for lightbox close
  const closeBtn = lightbox.querySelector('.carousel-lightbox-close');
  const backdrop = lightbox.querySelector('.carousel-lightbox-backdrop');

  closeBtn.addEventListener('click', closeLightbox);
  backdrop.addEventListener('click', closeLightbox);

  // Add click-outside-image-to-close functionality
  function setupClickOutsideToClose() {
    const lightboxContentElement = lightbox.querySelector('.carousel-lightbox-content');

    // Simple click handler to close lightbox when clicking outside the image
    lightboxContentElement.addEventListener('click', (e) => {
      // Don't close if clicking on controls or navigation
      if (e.target.closest('.carousel-lightbox-close')
          || e.target.closest('.carousel-lightbox-zoom')
          || e.target.closest('.swiper-button-next')
          || e.target.closest('.swiper-button-prev')
          || e.target.closest('.swiper-pagination')) {
        return;
      }

      // If the click target is an IMG element, don't close the lightbox
      // This allows Swiper to handle swipe navigation on images
      if (e.target.tagName === 'IMG') {
        return;
      }

      // Add a small delay to allow Swiper to complete any slide transitions
      // This prevents the lightbox from closing during swipe navigation
      setTimeout(() => {
        // Check if click is outside the visible image area
        const currentSlide = block.lightboxSwiper?.slides[block.lightboxSwiper.activeIndex];

        if (currentSlide) {
          const img = currentSlide.querySelector('img');
          if (img) {
            const imgRect = img.getBoundingClientRect();
            const clickX = e.clientX;
            const clickY = e.clientY;

            const isOutsideImage = clickX < imgRect.left
              || clickX > imgRect.right
              || clickY < imgRect.top
              || clickY > imgRect.bottom;

            // Check if click is outside the image bounds
            if (isOutsideImage) {
              closeLightbox();
            }
          }
        }
      }, 50); // 50ms delay to allow Swiper to complete slide transitions
    });
  }

  // Setup click outside functionality
  setupClickOutsideToClose();

  // Keyboard navigation for lightbox (Escape key)
  function handleLightboxKeydown(e) {
    const lightboxDiv = block.querySelector('.carousel-lightbox');
    if (!lightboxDiv.classList.contains('open')) return;

    if (e.key === 'Escape') {
      closeLightbox();
    }
  }

  document.addEventListener('keydown', handleLightboxKeydown);

  // Zoom functionality using ZoomPanHandler (desktop only)
  const zoomBtn = lightbox.querySelector('.carousel-lightbox-zoom');

  // Disable zoom button and custom zoom functionality on mobile OS devices only
  // Windows touch devices get custom zoom functionality
  if (isMobile && !isWindowsTouch) {
    zoomBtn.style.display = 'none';
    zoomBtn.disabled = true;
    zoomBtn.setAttribute('aria-hidden', 'true');

    // Ensure no custom zoom handlers are created for mobile OS devices
    block.isCurrentlyZoomed = false;
    block.zoomPanHandler = null;
  } else {
    // Store zoom state in block object so it can be accessed by Swiper events
    block.isCurrentlyZoomed = false;
    block.zoomPanHandler = null;

    zoomBtn.addEventListener('click', () => {
      if (!block.isCurrentlyZoomed) {
      // Zoom in
        // Disable touch/swipe navigation when zoomed in to allow panning
        if (block.lightboxSwiper) {
          block.lightboxSwiper.allowTouchMove = false;
          block.lightboxSwiper.allowSlideNext = false;
          block.lightboxSwiper.allowSlidePrev = false;
        }

        // Get the current slide and set up ZoomPanHandler
        const currentSlide = block.lightboxSwiper?.slides[block.lightboxSwiper.activeIndex];
        if (currentSlide) {
          const zoomContainer = currentSlide.querySelector('.swiper-zoom-container');
          if (zoomContainer) {
          // Always check if we need to update the handler for the current slide
            if (block.zoomPanHandler && block.zoomPanHandler.element === zoomContainer) {
            // Same container, just activate
              block.zoomPanHandler.activate();
            } else {
            // Different container or no handler exists, create/update handler
              if (block.zoomPanHandler) {
                block.zoomPanHandler.updateContainer(zoomContainer);
              } else {
                block.zoomPanHandler = new ZoomPanHandler(zoomContainer);
              }
              block.zoomPanHandler.activate();
            }

            // Update button state
            zoomBtn.setAttribute('aria-label', 'Zoom Out');
            zoomBtn.querySelector('.zoom-icon').classList.remove('zoom-in');
            zoomBtn.querySelector('.zoom-icon').classList.add('zoom-out');
          }
        }

        block.isCurrentlyZoomed = true;
      } else {
      // Zoom out
        // Re-enable touch/swipe navigation when zoomed out
        if (block.lightboxSwiper) {
          block.lightboxSwiper.allowTouchMove = true;
          block.lightboxSwiper.allowSlideNext = true;
          block.lightboxSwiper.allowSlidePrev = true;
        }

        // Handle zoom out via ZoomPanHandler
        if (block.zoomPanHandler) {
          block.zoomPanHandler.manualZoomOut();
        }

        // Update button state
        zoomBtn.setAttribute('aria-label', 'Zoom In');
        zoomBtn.querySelector('.zoom-icon').classList.remove('zoom-out');
        zoomBtn.querySelector('.zoom-icon').classList.add('zoom-in');

        block.isCurrentlyZoomed = false;
      }
    });
  } // Close the else block for mobile zoom button

  // Add click handlers to main carousel images to open lightbox
  const mainCarouselSlides = block.querySelectorAll('.carousel-slides-container .swiper-slide');
  mainCarouselSlides.forEach((slide, idx) => {
    const image = slide.querySelector('img');
    if (image) {
      image.addEventListener('click', () => {
        // Reset zoom state when opening lightbox
        block.isCurrentlyZoomed = false;
        if (block.zoomPanHandler) {
          block.zoomPanHandler.destroy();
          block.zoomPanHandler = null;
        }

        // On mobile OS devices, ensure no custom zoom functionality is available
        // On Windows touch devices, custom zoom functionality is available

        openLightbox(idx);
      });
    }
  });

  // Add global event listener to prevent image drag in lightbox when zoomed
  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG' && e.target.closest('.carousel-lightbox.open')) {
      e.preventDefault();
    }
  });

  // Download all carousel images when the carousel comes into view
  const carouselObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Download all carousel images when carousel becomes visible
        const slides = entry.target.querySelectorAll('.swiper-slide img');
        slides.forEach((img) => {
          if (img.src && !downloadedImages.has(img.src)) {
            startImageDownload(img.src);
          }
        });

        // Start autoplay if it's configured and not already running
        if (entry.target.classList.contains('autoslide') && entry.target.swiper && entry.target.swiper.autoplay) {
          if (!entry.target.swiper.autoplay.running) {
            entry.target.swiper.autoplay.start();
          }
        }

        // Stop observing after first download
        carouselObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 }); // Trigger when 10% of carousel is visible

  carouselObserver.observe(block);

  // Add periodic autoplay status monitoring and auto-resume
  if (block.classList.contains('autoslide')) {
    let monitorCount = 0;
    let consecutivePausedChecks = 0;
    const autoplayMonitor = setInterval(() => {
      monitorCount += 1;
      if (block.swiper && block.swiper.autoplay) {
        // Check if autoplay is stuck in paused state
        if (block.swiper.autoplay.running && block.swiper.autoplay.paused) {
          consecutivePausedChecks += 1;

          // If autoplay has been paused for more than 2 consecutive checks, force resume
          if (consecutivePausedChecks >= 2) {
            block.swiper.autoplay.resume();
            consecutivePausedChecks = 0; // Reset counter
          }
        } else {
          consecutivePausedChecks = 0; // Reset counter if not paused
        }
      }

      // Stop monitoring after 10 checks (10 seconds)
      if (monitorCount >= 10) {
        clearInterval(autoplayMonitor);
      }
    }, 1000);
  }
}
