import {
  getGenericIndexData, waitForTaxonomyUpdate, parseLocationCard,
} from '../../scripts/utils.js';
import { loadCSS, getHref } from '../../scripts/aem.js';
import { populateCard } from '../../scripts/scripts.js';

// Helper function to check if a card matches location criteria
function cardMatchesLocation(card, stateCode, cityCode = null) {
  const hasMatchingState = card.locationState && Array.isArray(card.locationState)
    && card.locationState.some((state) => state.toLowerCase() === stateCode);

  if (!hasMatchingState) return false;

  // If no city specified, just check state
  if (!cityCode) return true;

  // Check if locationCard contains the city code
  if (card.locationCard && Array.isArray(card.locationCard)) {
    return card.locationCard.some((locationCard) => {
      const locationData = parseLocationCard(locationCard);
      if (locationData) {
        // Check if both state and city match
        return locationData.state === stateCode && locationData.city === cityCode;
      }
      return false;
    });
  }

  return false;
}

// Cache the index data to avoid repeated API calls
let cachedIndexData = null;
let cachedFilteredData = null;
let lastFilterParams = null;

/**
 * Get cached index data or fetch if not available
 */
async function getIndexData() {
  if (!cachedIndexData) {
    const allIndexData = await getGenericIndexData();
    cachedIndexData = allIndexData.filter((item) => item.template === 'imovel-default');
  }
  return cachedIndexData;
}

/**
 * Returns the relative path from a given path.
 * If the path is a URL, it extracts the pathname.
 * @param {string} path - The path to get the relative path from.
 * @returns {string} - The relative path.
 */
function getRelativePath(path) {
  let relPath = path;
  try {
    const url = new URL(path);
    relPath = url.pathname;
  } catch (error) {
    // do nothing
  }
  return relPath;
}

/**
 * Memoized text formatting function
 */
const formatTextCache = new Map();
function formatText(text) {
  if (formatTextCache.has(text)) {
    return formatTextCache.get(text);
  }

  let result;
  if (text.length === 2) {
    // Make 2-letter codes uppercase
    result = text.toUpperCase();
  } else if (text.toLowerCase() === 'imoveis') {
    // Special case for "imoveis"
    result = 'Imóveis';
  } else {
    // Capitalize each word
    result = text.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }

  formatTextCache.set(text, result);
  return result;
}

function createBreadcrumbs(block, currentPath) {
  // Only create breadcrumbs if not on /resultados page
  if (currentPath === '/resultados') return;

  // Create breadcrumbs
  const breadcrumbs = document.createElement('div');
  breadcrumbs.classList.add('breadcrumbs');

  // Split the path into parts and remove empty strings
  const pathParts = currentPath.split('/').filter((part) => part !== '');

  // Build breadcrumb items array for JSON-LD
  const breadcrumbItems = [];

  // Always add home as first item
  breadcrumbItems.push({
    '@type': 'ListItem',
    position: 1,
    name: 'Sensia',
    item: `${window.location.origin}/`,
  });

  if (pathParts.length === 0) {
    // Root page
    breadcrumbs.innerHTML = '<p><a href="/">Sensia</a></p>';
  } else if (pathParts.length === 1) {
    // One level deep (e.g., /imoveis)
    const pageName = formatText(pathParts[0]);
    breadcrumbs.innerHTML = `<p><a href="/">Sensia</a> > ${pageName}</p>`;

    // Add current page to breadcrumb array
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: pageName,
      item: window.location.href,
    });
  } else {
    // Multiple levels deep (e.g., /imoveis/mg/fortaleza)
    const breadcrumbParts = [];
    breadcrumbParts.push('<a href="/">Sensia</a>');

    // Build intermediate links
    for (let i = 0; i < pathParts.length - 1; i += 1) {
      const part = pathParts[i];
      const formattedPart = formatText(part);
      const linkPath = `/${pathParts.slice(0, i + 1).join('/')}`;
      breadcrumbParts.push(`<a href="${linkPath}">${formattedPart}</a>`);

      // Add intermediate item to breadcrumb array
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: i + 2,
        name: formattedPart,
        item: `${window.location.origin}${linkPath}`,
      });
    }

    // Add the last part without a link
    const lastPart = pathParts[pathParts.length - 1];
    const formattedLastPart = formatText(lastPart);
    breadcrumbParts.push(formattedLastPart);

    // Add last item to breadcrumb array
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: pathParts.length + 1,
      name: formattedLastPart,
      item: window.location.href,
    });

    breadcrumbs.innerHTML = `<p>${breadcrumbParts.join(' > ')}</p>`;
  }

  // Insert breadcrumbs at the beginning of the block
  block.insertBefore(breadcrumbs, block.firstChild);

  // Create and inject JSON-LD structured data for breadcrumbs
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-name', 'breadcrumb');
  script.textContent = JSON.stringify(breadcrumbSchema);
  document.head.appendChild(script);
}

/** function to get an array of card objects from indexData */
export function getCardObject(link) {
  const path = link?.getAttribute('href');
  let relPath = getRelativePath(path);

  // In AEM editor, extract the content path from the full author URL
  if (relPath && relPath.includes('/content/meusensia/') && relPath.endsWith('.html')) {
    try {
      relPath = relPath.replace('/content/meusensia', '').replace('.html', '');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('cards-filter: Failed to parse author URL:', relPath);
    }
  }

  return cachedIndexData?.find((item) => item.path === relPath);
}

/**
 * Optimized filtering function with caching
 */
function filterCardsByUrl(cards) {
  const currentHref = getHref();
  const currentPath = new URL(currentHref).pathname;
  const urlParams = new URLSearchParams(window.location.search);

  // Create a cache key for the current filter parameters
  const filterParams = {
    currentPath,
    search: urlParams.get('s'),
    status: urlParams.get('status'),
    amenities: urlParams.get('lazer'),
    tipologia: urlParams.get('tipologia'),
    minPrice: urlParams.get('minPrice'),
    maxPrice: urlParams.get('maxPrice'),
  };

  // Check if we have cached results for the same parameters
  if (cachedFilteredData && lastFilterParams
    && JSON.stringify(filterParams) === JSON.stringify(lastFilterParams)) {
    return cachedFilteredData;
  }

  // Check if we're on the /resultados page
  if (currentPath === '/resultados') {
    const searchParam = urlParams.get('s');
    const statusParam = urlParams.get('status');
    const amenitiesParam = urlParams.get('lazer');

    // Parse status parameters
    let selectedStatuses = [];
    if (statusParam) {
      const decodedStatusParam = decodeURIComponent(statusParam);
      selectedStatuses = decodedStatusParam.split('+');
    }

    // Parse amenities parameter
    const selectedAmenities = amenitiesParam ? decodeURIComponent(amenitiesParam).split('+') : [];

    // Parse tipologia parameter
    const tipologiaParam = urlParams.get('tipologia');
    const selectedTipologias = tipologiaParam ? decodeURIComponent(tipologiaParam).split('+') : [];

    // Parse price parameters
    const minPriceParam = urlParams.get('minPrice');
    const maxPriceParam = urlParams.get('maxPrice');
    const minPrice = minPriceParam ? parseInt(minPriceParam, 10) : null;
    const maxPrice = maxPriceParam ? parseInt(maxPriceParam, 10) : null;

    // Parse location parameters
    let stateCode = null;
    let cityCode = null;
    if (searchParam) {
      // Split the search parameter by '+' to get state and city
      // The + is URL-encoded as %2B, so we need to decode it first
      const decodedParam = decodeURIComponent(searchParam);
      const searchValues = decodedParam.split('+');
      stateCode = searchValues[0]?.toLowerCase();
      cityCode = searchValues[1]?.toLowerCase();
    }

    // Pre-compile regex patterns for better performance
    const colonSlashRegex = /[:/]/;
    const whitespaceRegex = /\s+/g;

    // Filter cards based on location, status, and amenities
    const filteredCards = cards.filter((card) => {
      // Location filtering
      let locationMatch = true;
      if (stateCode && cityCode) {
        locationMatch = cardMatchesLocation(card, stateCode, cityCode);
      } else if (stateCode) {
        locationMatch = cardMatchesLocation(card, stateCode);
      }

      // Early return if location doesn't match
      if (!locationMatch) return false;

      // Status filtering
      let statusMatch = true;
      if (selectedStatuses.length > 0) {
        statusMatch = card.availability && Array.isArray(card.availability)
          && card.availability.some((availability) => {
            // Get the last part of the availability value (after the last colon or slash)
            const availabilityParts = availability.split(colonSlashRegex);
            const lastPart = availabilityParts[availabilityParts.length - 1]?.toLowerCase().replace(whitespaceRegex, '-');

            // Check if any of the selected statuses match this availability
            return selectedStatuses.some(
              (selectedStatus) => lastPart === selectedStatus.toLowerCase(),
            );
          });
      }
      if (!statusMatch) return false;

      // Amenities filtering
      let amenitiesMatch = true;
      if (selectedAmenities.length > 0) {
        amenitiesMatch = card.amenities && Array.isArray(card.amenities)
          && card.amenities.some((amenityString) => {
            // Split the comma-separated amenity string into individual amenities
            const individualAmenities = amenityString.split(',').map((amenity) => amenity.trim());

            // Check if any of the individual amenities match the selected amenities
            return individualAmenities.some((amenity) => {
              // Get the last part of the amenity value (after the last colon or slash)
              const amenityParts = amenity.split(colonSlashRegex);
              const lastPart = amenityParts[amenityParts.length - 1]?.toLowerCase().replace(whitespaceRegex, '-');

              // Check if any of the selected amenities match this amenity
              return selectedAmenities.some(
                (selectedAmenity) => lastPart.startsWith(selectedAmenity.toLowerCase()),
              );
            });
          });
      }
      if (!amenitiesMatch) return false;

      // Tipologia filtering (using dormitorios meta tags)
      let tipologiaMatch = true;
      if (selectedTipologias.length > 0) {
        // Get dormitorios values from meta tags
        const dormitoriosMin = card.searchDormitoriosMin
          ? parseInt(card.searchDormitoriosMin, 10) : null;
        const dormitoriosMax = card.searchDormitoriosMax
          ? parseInt(card.searchDormitoriosMax, 10) : null;

        // Check if any selected tipologia matches the dormitorios range
        tipologiaMatch = selectedTipologias.some((selectedTipologia) => {
          const selectedDormitorios = parseInt(selectedTipologia, 10);

          // If we have both min and max, check if selected is within range
          if (dormitoriosMin !== null && dormitoriosMax !== null) {
            return selectedDormitorios >= dormitoriosMin && selectedDormitorios <= dormitoriosMax;
          }

          // If we only have min, check if selected is >= min
          if (dormitoriosMin !== null) {
            return selectedDormitorios >= dormitoriosMin;
          }

          // If we only have max, check if selected is <= max
          if (dormitoriosMax !== null) {
            return selectedDormitorios <= dormitoriosMax;
          }
          return false;
        });
      }
      if (!tipologiaMatch) return false;

      // Price filtering
      let priceMatch = true;
      if (minPrice !== null || maxPrice !== null) {
        const cardPriceMin = card.searchPriceMin ? parseInt(card.searchPriceMin, 10) : null;
        const cardPriceMax = card.searchPriceMax ? parseInt(card.searchPriceMax, 10) : null;

        if (cardPriceMin !== null || cardPriceMax !== null) {
          // Check if the card's price range overlaps with the filter range
          // Card range: [cardPriceMin, cardPriceMax]
          // Filter range: [minPrice, maxPrice]
          if (minPrice !== null && maxPrice !== null) {
            // Filter has both min and max - check for overlap
            const cardMin = cardPriceMin || 0;
            const cardMax = cardPriceMax || Number.MAX_SAFE_INTEGER;
            priceMatch = cardMin <= maxPrice && cardMax >= minPrice;
          } else if (minPrice !== null) {
            // Filter has only min - check if card max is >= filter min
            const cardMax = cardPriceMax || Number.MAX_SAFE_INTEGER;
            priceMatch = cardMax >= minPrice;
          } else if (maxPrice !== null) {
            // Filter has only max - check if card min is <= filter max
            const cardMin = cardPriceMin || 0;
            priceMatch = cardMin <= maxPrice;
          }
        } else {
          // If no price is set on the card, exclude it from price-filtered results
          priceMatch = false;
        }
      }

      return priceMatch;
    });

    // Cache the results
    cachedFilteredData = filteredCards;
    lastFilterParams = filterParams;
    return filteredCards;
  }

  // Check if URL matches "/imoveis/state/city" pattern (with or without .html)
  let relPath = getRelativePath(currentPath);
  // In AEM editor, extract the content path from the full author URL
  if (relPath && relPath.includes('/content/meusensia/') && relPath.endsWith('.html')) {
    try {
      relPath = relPath.replace('/content/meusensia', '').replace('.html', '');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('cards-filter: Failed to parse author URL:', relPath);
    }
  }
  const imoveisStateCityMatch = relPath.match(/\/imoveis\/([^/]+)\/([^/]+)(?:\.html)?$/);

  // Check if URL matches "/imoveis/state" pattern (with or without .html)
  const imoveisStateMatch = relPath.match(/\/imoveis\/([^/]+)(?:\.html)?$/);

  if (imoveisStateCityMatch) {
    const stateCode = imoveisStateCityMatch[1]; // Extract the state code (e.g., "ce")
    const cityCode = imoveisStateCityMatch[2]; // Extract the city code (e.g., "fortaleza")

    // Filter cards where locationState contains the state code AND
    // locationCard contains the city code
    const filteredCards = cards.filter((card) => cardMatchesLocation(card, stateCode, cityCode));

    // Cache the results
    cachedFilteredData = filteredCards;
    lastFilterParams = filterParams;
    return filteredCards;
  }

  if (imoveisStateMatch) {
    const stateCode = imoveisStateMatch[1]; // Extract the state code (e.g., "ce")

    // Filter cards where locationState contains the state code
    const filteredCards = cards.filter((card) => cardMatchesLocation(card, stateCode));

    // Cache the results
    cachedFilteredData = filteredCards;
    lastFilterParams = filterParams;
    return filteredCards;
  }

  // If URL doesn't match any pattern, return all cards
  cachedFilteredData = cards;
  lastFilterParams = filterParams;
  return cards;
}

/** function to render card list when an array of card objects are passed.
*/
export async function renderCardList(wrapper, cards, limit = 6, type = 'card') {
  let limitPerPage = limit;
  if (limit === 0) {
    limitPerPage = cards.length;
  } else {
    limitPerPage = Number.isNaN(parseInt(limit, 10)) ? 10 : parseInt(limit, 10);
  }

  wrapper.innerHTML = '';
  if (!cards || cards.length === 0) {
    return;
  }

  // Create the ul element for cards
  const ul = document.createElement('ul');

  // Initialize or get current displayed count
  if (!wrapper.dataset.displayedCount) {
    wrapper.dataset.displayedCount = limitPerPage;
  }

  let displayedCount = parseInt(wrapper.dataset.displayedCount, 10);
  const cardsToShow = cards.slice(0, displayedCount);

  // Use Promise.all for parallel processing
  await Promise.all(cardsToShow.map(async (card) => {
    await populateCard(ul, card, type);
  }));

  // Add the ul to the wrapper
  wrapper.append(ul);

  // Add "Load More" button if there are more cards to show
  if (displayedCount < cards.length && limit !== 0) {
    const loadMoreContainer = document.createElement('div');
    loadMoreContainer.classList.add('load-more-container');

    const loadMoreButton = document.createElement('button');
    loadMoreButton.classList.add('button', 'secondary');
    loadMoreButton.textContent = 'Veja mais imóveis';
    loadMoreButton.setAttribute('aria-label', 'Veja mais imóveis');
    loadMoreButton.type = 'button';

    loadMoreButton.addEventListener('click', async () => {
      const newDisplayedCount = Math.min(displayedCount + limitPerPage, cards.length);
      wrapper.dataset.displayedCount = newDisplayedCount;

      // Get the new cards to add
      const newCards = cards.slice(displayedCount, newDisplayedCount);

      // Add new cards to the ul
      await Promise.all(newCards.map(async (card) => {
        await populateCard(ul, card, type);
      }));

      // Update displayed count
      displayedCount = newDisplayedCount;

      // Remove button if all cards are displayed
      if (newDisplayedCount >= cards.length) {
        loadMoreContainer.remove();
      }
    });

    loadMoreContainer.appendChild(loadMoreButton);
    wrapper.append(loadMoreContainer);
  }
}

export default async function decorate(block) {
  // Wait for taxonomy to be loaded and metadata to be updated
  await waitForTaxonomyUpdate();

  await loadCSS(`${window.hlx.codeBasePath}/blocks/cards/cards.css`);

  // Get current path for breadcrumbs
  let currentPath = window.location.pathname;
  const iframe = document.querySelector('iframe');
  if (iframe && iframe.src) {
    try {
      const iframeUrl = new URL(iframe.src);
      currentPath = iframeUrl.pathname;
    } catch (e) {
      // If URL parsing fails, fall back to window.location.pathname
      // eslint-disable-next-line no-console
      console.warn('Failed to parse iframe src URL:', e);
    }
  }

  // Create breadcrumbs
  createBreadcrumbs(block, currentPath);

  // Get cached or fetch index data
  const imovels = await getIndexData();

  // Filter cards based on current URL
  const filteredImovels = filterCardsByUrl(imovels);

  const div = document.createElement('div');
  div.className = 'cards imovel';
  const ul = document.createElement('ul');
  div.append(ul);
  block.append(div);
  renderCardList(div, filteredImovels, 6); // TODO: change to 12

  // Debounced event handlers to prevent excessive re-filtering
  let debounceTimer;
  const debouncedRefilter = async () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const reFilteredImovels = filterCardsByUrl(imovels);
      renderCardList(div, reFilteredImovels, 6); // TODO: change to 12
    }, 100);
  };

  window.addEventListener('hashchange', debouncedRefilter);

  // Also listen for URL changes (for /resultados page)
  window.addEventListener('popstate', debouncedRefilter);
}
