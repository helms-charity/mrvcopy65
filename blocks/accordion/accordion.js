/*
 * Accordion Block
 * Recreate an accordion with smooth animations
 * https://www.hlx.live/developer/block-collection/accordion
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

// Animation configuration - easily adjustable
const ANIMATION_CONFIG = {
  duration: {
    opening: 500,
    closing: 400,
  },
  easing: 'ease-out',
};

function handleIconLogic(summary, details) {
  const iconSpan = summary.querySelector('.icon');
  const iconImg = iconSpan?.querySelector('img');

  const isIconOnly = summary.children.length === 1
    && iconSpan
    && iconSpan.classList.contains('icon')
    && iconImg;

  if (isIconOnly) {
    summary.classList.add('icon-only');

    // Special alignment for icon-exclamacao
    if (iconSpan.classList.contains('icon-exclamacao')) {
      summary.classList.add('centered-icon-summary');
      details.classList.add('centered-icon-block');
    }
  }
}

function addSmoothToggle(details, summary, body) {
  let isAnimating = false;

  const resetStyles = () => {
    body.style.height = '';
    body.style.opacity = '';
    body.style.overflow = '';
    body.style.transition = '';
    isAnimating = false;
  };

  const animate = (targetHeight, targetOpacity, duration) => {
    const heightTransition = `height ${duration}ms ${ANIMATION_CONFIG.easing}`;
    const opacityTransition = `opacity ${Math.round(duration * 0.8)}ms ${ANIMATION_CONFIG.easing}`;

    body.style.transition = `${heightTransition}, ${opacityTransition}`;
    body.style.height = targetHeight;
    body.style.opacity = targetOpacity;
  };

  summary.addEventListener('click', (e) => {
    e.preventDefault();

    // Prevent overlapping animations
    if (isAnimating) return;
    isAnimating = true;

    const isCurrentlyOpen = details.hasAttribute('open');
    body.style.overflow = 'hidden';

    if (!isCurrentlyOpen) {
      // Opening animation
      details.setAttribute('open', '');
      body.style.height = '0px';
      body.style.opacity = '0';

      const naturalHeight = `${body.scrollHeight}px`;

      requestAnimationFrame(() => {
        animate(naturalHeight, '1', ANIMATION_CONFIG.duration.opening);
      });

      setTimeout(resetStyles, ANIMATION_CONFIG.duration.opening);
    } else {
      // Closing animation
      const currentHeight = `${body.scrollHeight}px`;
      body.style.height = currentHeight;

      requestAnimationFrame(() => {
        animate('0px', '0', ANIMATION_CONFIG.duration.closing);
      });

      setTimeout(() => {
        details.removeAttribute('open');
        resetStyles();
      }, ANIMATION_CONFIG.duration.closing);
    }
  });

  // Enhanced keyboard navigation
  summary.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isAnimating) {
      e.preventDefault();
      summary.click();
    }
  });
}

export default function decorate(block) {
  [...block.children].forEach((row) => {
    // Decorate accordion item label
    const label = row.children[0];
    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    summary.append(...label.childNodes);

    // Decorate accordion item body
    const body = row.children[1];
    body.className = 'accordion-item-body';

    // Decorate accordion item
    const details = document.createElement('details');
    moveInstrumentation(row, details);
    details.className = 'accordion-item';
    details.append(summary, body);
    row.replaceWith(details);

    // Handle icon-only summaries
    handleIconLogic(summary, details);

    // Add smooth animation
    addSmoothToggle(details, summary, body);
  });
}
