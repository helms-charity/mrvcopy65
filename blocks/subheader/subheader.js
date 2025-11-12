import { getMetadata } from '../../scripts/aem.js';
import { decorateButtons } from '../../scripts/scripts.js';
import { waitForTaxonomyUpdate, getQueryIndexData } from '../../scripts/utils.js';

async function loadFragment(path) {
  if (path && path.startsWith('/fragments/')) {
    const resp = await fetch(`${path}.plain.html`);
    if (resp.ok) {
      const fragment = document.createElement('div');
      fragment.innerHTML = await resp.text();
      return fragment;
    }
  }
  return null;
}

async function getCurrentPageLocationCard() {
  try {
    const currentPath = window.location.pathname;
    const json = await getQueryIndexData();

    if (!json || !json.data) return null;

    // Find the current page in the index
    const currentPageData = json.data.find((item) => item.path === currentPath);

    if (currentPageData && currentPageData.locationCard) {
      return currentPageData.locationCard;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching current page locationCard:', error);
  }
  return null;
}

function parseLocationCard(locationCard) {
  if (!locationCard) return [];

  // locationCard is an array, get the first value
  const locationCardValue = Array.isArray(locationCard) ? locationCard[0] : locationCard;

  if (!locationCardValue || typeof locationCardValue !== 'string') return [];

  // Extract the state after the last "/"
  // Format: "meusensia:locations-for-cards/regiao-do-guapore---ribeirao-preto---sp"
  const lastSlashIndex = locationCardValue.lastIndexOf('/');
  if (lastSlashIndex === -1) return [];

  const locationString = locationCardValue.slice(lastSlashIndex + 1);
  const locationParts = locationString.split('---');

  if (locationParts.length >= 3) {
    return [
      locationParts[0], // First part before first ---
      locationParts[1], // Part between the two ---
      locationParts[2], // Last part (state code)
    ];
  }

  return [];
}

function decorateBreadcrumbs(block, pageListingName, locationParts, locationDisplayParts) {
  // Create breadcrumbs
  const breadcrumbs = document.createElement('div');
  breadcrumbs.classList.add('breadcrumbs');

  let breadcrumbHTML;
  const breadcrumbItems = [];

  // Build breadcrumb items array for JSON-LD
  breadcrumbItems.push({
    '@type': 'ListItem',
    position: 1,
    name: 'Sensia',
    item: `${window.location.origin}/`,
  });

  if (locationParts.length >= 3 && locationDisplayParts.length >= 3) {
    breadcrumbHTML = `<p><a href="/">Sensia</a> > <a href="/imoveis/${locationParts[2]}">${locationDisplayParts[2]}</a> > <a href="/imoveis/${locationParts[2]}/${locationParts[1]}">${locationDisplayParts[1]}</a> > ${pageListingName}</p>`;

    // Add location items to breadcrumb array
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: locationDisplayParts[2],
      item: `${window.location.origin}/imoveis/${locationParts[2]}`,
    });

    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: locationDisplayParts[1],
      item: `${window.location.origin}/imoveis/${locationParts[2]}/${locationParts[1]}`,
    });

    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 4,
      name: pageListingName,
      item: window.location.href,
    });
  } else if (locationDisplayParts.length >= 1) {
    breadcrumbHTML = `<p><a href="/">Sensia</a> > ${locationDisplayParts[0]} > ${pageListingName}</p>`;

    // Add location item to breadcrumb array
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: locationDisplayParts[0],
      item: window.location.href,
    });

    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: pageListingName,
      item: window.location.href,
    });
  } else {
    breadcrumbHTML = `<p><a href="/">Sensia</a> > ${pageListingName}</p>`;

    // Add current page to breadcrumb array
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: pageListingName,
      item: window.location.href,
    });
  }

  breadcrumbs.innerHTML = breadcrumbHTML;
  block.appendChild(breadcrumbs);

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

  // Return breadcrumb items for reuse
  return breadcrumbItems;
}

function setJsonLd(data, name) {
  const existingScript = document.head.querySelector(`script[data-name="${name}"]`);
  if (existingScript) {
    existingScript.innerHTML = JSON.stringify(data);
    return;
  }

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.name = name;

  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/**
 * Cria o schema para o imóvel
 * Builds the schema for the property
 * @param {Array} breadcrumbItems - Array of breadcrumb items to extract location data from
 * @param {Object} metadata - Pre-fetched metadata object to avoid repeated getMetadata calls
 * @returns {void}
 */
export function buildRealEstateSchema(breadcrumbItems = [], metadata = null) {
  const meta = metadata || {};

  // Cache window.location values for better performance
  const { origin, pathname } = window.location;
  let addressRegion = meta.tagsLocationCard || getMetadata('tags-location-card');
  let addressLocality = meta.tagsLocationCard || getMetadata('tags-location-card');

  // Find position 2 (state) and position 3 (city) from breadcrumb items
  const stateItem = breadcrumbItems.find((item) => item.position === 2);
  const cityItem = breadcrumbItems.find((item) => item.position === 3);

  if (stateItem && stateItem.name) {
    addressRegion = stateItem.name;
  }
  if (cityItem && cityItem.name) {
    addressLocality = cityItem.name;
  }

  // Get metadata values with fallback
  const ogTitle = meta.ogTitle || getMetadata('og:title');
  const description = meta.description || getMetadata('description');
  const publishedTime = meta.publishedTime || getMetadata('published-time');
  const searchPriceMin = meta.cardPrice || getMetadata('card-price');
  const searchPriceMax = meta.searchPriceMax || getMetadata('search-price-max');
  const cardTitle = meta.cardTitle || getMetadata('card-title');
  const searchDormitoriosMin = meta.searchDormitoriosMin || getMetadata('search-dormitorios-min');
  const searchDormitoriosMax = meta.searchDormitoriosMax || getMetadata('search-dormitorios-max');
  const searchAreaMin = meta.searchAreaMin || getMetadata('search-area-min');
  const searchAreaMax = meta.searchAreaMax || getMetadata('search-area-max');
  const enderecoCompleto = meta.enderecoCompleto || getMetadata('endereco-completo');
  const tagsLazer = meta.tagsLazer || getMetadata('tags-lazer');
  const template = meta.template || getMetadata('template');

  // Process amenity tags
  const amenityFeatures = tagsLazer
    ? tagsLazer
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag)
      .map((tag) => ({
        '@type': 'LocationFeatureSpecification',
        name: tag,
        value: true,
      }))
    : [];

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'RealEstateListing',
        name: `Anúncio: ${ogTitle}`,
        url: `${origin}${pathname}`,
        description,
        datePosted: publishedTime,
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/InStock',
          priceSpecification: {
            '@type': 'PriceSpecification',
            priceCurrency: 'BRL',
            minPrice: searchPriceMin,
            maxPrice: searchPriceMax,
          },
        },
        itemOffered: {
          '@id': `${origin}${pathname}#imovel`,
        },
      },
      {
        '@type': 'ApartmentComplex',
        '@id': `${origin}${pathname}#imovel`,
        name: cardTitle,
        numberOfBedrooms: {
          '@type': 'QuantitativeValue',
          minValue: searchDormitoriosMin,
          maxValue: searchDormitoriosMax,
        },
        floorSize: {
          '@type': 'QuantitativeValue',
          minValue: searchAreaMin,
          maxValue: searchAreaMax,
          unitCode: 'MTK',
        },
        petsAllowed: true,
        address: {
          '@type': 'PostalAddress',
          streetAddress: enderecoCompleto,
          addressLocality,
          addressRegion,
          addressCountry: 'BR',
        },
        amenityFeature: amenityFeatures,
      },
    ],
  };

  if (template === 'imovel-default') {
    setJsonLd(data, 'realEstateListing');
  }
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

  return {
    // Subheader display metadata
    pageListingName: getCachedMetadata('card-title'),
    pageLocationCard: getCachedMetadata('tags-location-card'),
    pageAvailability: getCachedMetadata('tags-status'),
    cardStatus: getCachedMetadata('card-status'),
    cardQuartosText: getCachedMetadata('card-quartos'),
    cardAreaText: getCachedMetadata('card-area'),
    subheaderHighlightIcon: getCachedMetadata('subheader-highlight-icon'),
    subheaderHighlightText: getCachedMetadata('subheader-highlight'),
    subheaderExtraText: getCachedMetadata('subheader-extra'),
    subheaderExtraIcon: getCachedMetadata('subheader-extra-icon'),

    // Schema metadata (camelCase for consistency with schema function)
    cardTitle: getCachedMetadata('card-title'),
    tagsLocationCard: getCachedMetadata('tags-location-card'),
    ogTitle: getCachedMetadata('og:title'),
    description: getCachedMetadata('description'),
    publishedTime: getCachedMetadata('published-time'),
    searchPriceMin: getCachedMetadata('card-price'),
    searchPriceMax: getCachedMetadata('search-price-max'),
    searchDormitoriosMin: getCachedMetadata('search-dormitorios-min'),
    searchDormitoriosMax: getCachedMetadata('search-dormitorios-max'),
    searchAreaMin: getCachedMetadata('search-area-min'),
    searchAreaMax: getCachedMetadata('search-area-max'),
    enderecoCompleto: getCachedMetadata('endereco-completo'),
    tagsLazer: getCachedMetadata('tags-lazer'),
    template: getCachedMetadata('template'),
  };
}

export default async function decorate(block) {
  if (!block || !block.nodeType) return;

  const hasLinks = block.querySelector('a[href]') !== null;
  const isAbsoluteSubheader = block.closest('#absolute-subheader') !== null;

  // Wait for taxonomy to be loaded and metadata to be updated
  await waitForTaxonomyUpdate();

  const metadata = getBatchMetadata();

  // Get locationCard from query-index.json and parse it for URLs
  const locationCard = await getCurrentPageLocationCard();
  const locationParts = parseLocationCard(locationCard);

  // Parse original metadata for display text
  let locationDisplayParts = [];
  if (metadata.pageLocationCard && metadata.pageLocationCard.includes('|')) {
    locationDisplayParts = metadata.pageLocationCard.split('|').map((part) => part.trim());
  }

  // Create breadcrumbs and get breadcrumb items for schema
  const breadcrumbItems = decorateBreadcrumbs(
    block,
    metadata.pageListingName,
    locationParts,
    locationDisplayParts,
  );

  // Create all elements in a document fragment to minimize DOM reflows
  const fragment = document.createDocumentFragment();
  // Create wrapper div for the top 3 elements
  const subheaderTop = document.createElement('div');
  subheaderTop.classList.add('subheader-top');

  const subheaderAvailability = document.createElement('p');
  // Handle case where cardStatus is an empty array or falsy
  const hasValidCardStatus = metadata.cardStatus
    && (Array.isArray(metadata.cardStatus) ? metadata.cardStatus.length > 0 : true);
  subheaderAvailability.textContent = hasValidCardStatus
    ? metadata.cardStatus : metadata.pageAvailability;
  subheaderAvailability.classList.add('availability');
  subheaderTop.appendChild(subheaderAvailability);

  const subheaderLogo = document.createElement('img');
  subheaderLogo.src = '/icons/logo-sensia-white.svg';
  subheaderLogo.alt = 'Logo Sensia';
  subheaderLogo.classList.add('subheader-logo');
  subheaderTop.appendChild(subheaderLogo);

  const subheaderTitle = document.createElement('h2');
  let titleText = metadata.pageListingName;

  // Remove "Sensia" from the beginning of the title for all subheaders
  if (titleText && titleText.toLowerCase().startsWith('sensia ')) {
    titleText = titleText.substring(7); // Remove "Sensia " (7 characters)
  }

  subheaderTitle.textContent = titleText;
  subheaderTop.appendChild(subheaderTitle);

  const locationList = document.createElement('ul');
  locationList.classList.add('location-list');

  const amenitiesList = document.createElement('div');
  amenitiesList.classList.add('amenities-list');

  // Add all elements to fragment
  fragment.appendChild(subheaderTop);
  fragment.appendChild(locationList);
  fragment.appendChild(amenitiesList);

  const subheaderLocation = document.createElement('li');
  subheaderLocation.classList.add('location');

  // Format location data using original metadata from waitForTaxonomyUpdate
  if (metadata.pageLocationCard && metadata.pageLocationCard.includes('|')) {
    const locationPartsFormatted = metadata.pageLocationCard.split('|');
    if (locationPartsFormatted.length >= 3) {
      if (isAbsoluteSubheader) {
        // Use hyphen instead of <br> for absolute subheader
        subheaderLocation.textContent = `${locationPartsFormatted[0].trim()} - ${locationPartsFormatted[1].trim()} - ${locationPartsFormatted[2].trim()}`;
      } else {
        // Regular subheader with <br>
        subheaderLocation.innerHTML = `<strong>${locationPartsFormatted[0].trim()}</strong><br>${locationPartsFormatted[1].trim()} - ${locationPartsFormatted[2].trim()}`;
      }
    } else {
      subheaderLocation.textContent = metadata.pageLocationCard;
    }
  } else {
    subheaderLocation.textContent = metadata.pageLocationCard;
  }
  locationList.appendChild(subheaderLocation);

  // Batch create amenities elements
  const amenitiesData = [
    { value: metadata.cardQuartosText, className: 'quartos' },
    { value: metadata.cardAreaText, className: 'area' },
    { value: metadata.subheaderHighlightText, className: 'subheader-highlight' },
    { value: metadata.subheaderHighlightIcon, className: 'subheader-highlight-icon' },
    { value: metadata.subheaderExtraText, className: 'subheader-extra' },
    { value: metadata.subheaderExtraIcon, className: 'subheader-extra-icon' },
  ];

  // Process amenities data and pair icon values with text elements
  const iconValues = new Map();
  const textElements = [];
  const amenitiesFragment = document.createDocumentFragment();

  // Pre-filter valid data to avoid repeated checks
  const validAmenitiesData = amenitiesData.filter(({ value }) => value && value.trim());

  validAmenitiesData.forEach(({ value, className }) => {
    if (className.endsWith('-icon')) {
      // Store icon value with base name (without -icon suffix)
      const baseName = className.replace('-icon', '');
      iconValues.set(baseName, value);
    } else {
      // Create paragraph for text elements
      const element = document.createElement('p');
      element.classList.add(className);
      element.textContent = value;

      // Store text element with base name (without -icon suffix)
      const baseName = className.replace('-icon', '');
      textElements.push({ element, baseName });
    }
  });

  // Add icon classes to text elements and collect them in a fragment
  textElements.forEach(({ element, baseName }) => {
    const iconValue = iconValues.get(baseName);
    if (iconValue) {
      // Add the icon value as a class to the text element
      element.classList.add(`icon-${iconValue}`);
    }
    amenitiesFragment.appendChild(element);
  });

  // Single DOM operation to add all elements
  amenitiesList.appendChild(amenitiesFragment);

  // Append the main fragment to the block in one operation
  block.appendChild(fragment);

  // Check for AEM universal editor content in the second child div and add it to amenitiesList
  // Only proceed if there are at least 2 children and the second child is not a breadcrumb
  if (block.children.length >= 2) {
    const secondChildDiv = block.children[1]; // Direct access instead of querySelector
    if (secondChildDiv
        && secondChildDiv.textContent.trim()
        && !secondChildDiv.classList.contains('breadcrumbs')) {
      // Ensure the amenitiesList div exists and is properly added to the DOM
      if (amenitiesList && amenitiesList.classList.contains('amenities-list')) {
        // Clear existing content from amenitiesList
        amenitiesList.innerHTML = '';
        // Move all children from secondChildDiv to amenitiesList
        while (secondChildDiv.firstChild) {
          amenitiesList.appendChild(secondChildDiv.firstChild);
        }
        // Remove the second child div from the block since we've moved its content
        secondChildDiv.remove();
      }
    }
  }
  // Handle button or fragment as the last child
  if (!hasLinks) {
    const loadedFragment = await loadFragment('/fragments/fale-especialista');
    if (loadedFragment) {
      decorateButtons(loadedFragment);
      block.appendChild(loadedFragment);
    }
  } else {
    const button = block.querySelector('a');
    if (button) {
      button.classList.add('secondary');
      // Move the button to be the last child
      block.appendChild(button.parentElement.parentElement);
    }
  }

  // Build real estate schema with breadcrumb location data and pre-fetched metadata
  // Only generate schema for imovel pages
  if (metadata.template === 'imovel-default') {
    buildRealEstateSchema(breadcrumbItems, metadata);
  }
}
