const INDEX = `${window.hlx.codeBasePath}/query-index.json`;
const IMOVELS_INDEX = `${window.hlx.codeBasePath}/imovel/query-index.json`;
const TAXONOMY_URL = `${window.hlx.codeBasePath}/taxonomy.json`;

// Brazilian States mapping
const BRAZILIAN_STATES_MAP = new Map([
  ['AC', 'Acre'],
  ['AL', 'Alagoas'],
  ['AP', 'Amapá'],
  ['AM', 'Amazonas'],
  ['BA', 'Bahia'],
  ['CE', 'Ceará'],
  ['GO', 'Goiás'],
  ['ES', 'Espírito Santo'],
  ['MA', 'Maranhão'],
  ['MT', 'Mato Grosso'],
  ['MS', 'Mato Grosso do Sul'],
  ['MG', 'Minas Gerais'],
  ['PA', 'Pará'],
  ['PB', 'Paraíba'],
  ['PR', 'Paraná'],
  ['PE', 'Pernambuco'],
  ['PI', 'Piauí'],
  ['RJ', 'Rio de Janeiro'],
  ['RN', 'Rio Grande do Norte'],
  ['RS', 'Rio Grande do Sul'],
  ['RO', 'Rondônia'],
  ['RR', 'Roraima'],
  ['SP', 'São Paulo'],
  ['SC', 'Santa Catarina'],
  ['SE', 'Sergipe'],
  ['TO', 'Tocantins'],
  ['DF', 'Distrito Federal'],
]);

// Simple createTag function since it doesn't exist in the codebase
export function createTag(tagName, attributes = {}) {
  const element = document.createElement(tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'class') {
      element.className = value;
    } else if (key === 'for') {
      element.setAttribute('for', value);
    } else {
      element.setAttribute(key, value);
    }
  });
  return element;
}

/**
   * Retrieves data from an index.
   * @param {string} [index=IMOVELS_INDEX] - The index to retrieve data from.
   * @returns {Promise<Array>} - A promise that resolves to an array of retrieved data.
   */
async function getIndexData(index = IMOVELS_INDEX) {
  const retrievedData = [];
  const limit = 500;

  const first = await fetch(`${index}?limit=${limit}`)
    .then((resp) => {
      if (resp.ok) {
        return resp.json();
      }
      return {};
    });

  const { total } = first;
  if (total) {
    retrievedData.push(...first.data);
    const promises = [];
    const buckets = Math.ceil(total / limit);
    for (let i = 1; i < buckets; i += 1) {
      promises.push(new Promise((resolve) => {
        const offset = i * limit;
        fetch(`${index}?offset=${offset}&limit=${limit}`)
          .then((resp) => {
            if (resp.ok) {
              return resp.json();
            }
            return {};
          })
          .then((json) => {
            const { data } = json;
            if (data) {
              resolve(data);
            }
            resolve([]);
          });
      }));
    }

    await Promise.all(promises).then((values) => {
      values.forEach((list) => {
        retrievedData.push(...list);
      });
    });
  }

  return retrievedData;
}

let indexData = null;
/**
 * Retrieves index data from the query-index file.
 * @returns {Promise<Array>} A promise that resolves to an array of index data.
 */
export const getGenericIndexData = (() => async () => {
  if (!indexData) {
    indexData = await getIndexData();
  }
  // Protected against callers modifying the objects
  return structuredClone(indexData);
})();

let lojasIndexData = null;
/**
 * Retrieves index data from the main query-index.json file (for lojas).
 * @returns {Promise<Array>} A promise that resolves to an array of index data.
 */
export const getLojasIndexData = (() => async () => {
  if (!lojasIndexData) {
    lojasIndexData = await getIndexData(INDEX);
  }
  // Protected against callers modifying the objects
  return structuredClone(lojasIndexData);
})();

export function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- BEGIN: Query Index Helper Functions ---
let queryIndexCache = null;

/**
 * Retrieves and caches query-index.json data to avoid repeated fetches
 * @returns {Promise<Object|null>} A promise
 * that resolves to the query index data or null if fetch fails
 */
export async function getQueryIndexData() {
  if (!queryIndexCache) {
    try {
      const resp = await fetch(IMOVELS_INDEX);
      if (resp.ok) {
        queryIndexCache = await resp.json();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching query-index.json:', error);
      return null;
    }
  }
  return queryIndexCache;
}

// --- BEGIN: Taxonomy Helper Functions ---
let taxonomyMapCache = null;

/**
 * Caches taxonomy for performance
 * @returns {Promise<Map>} A promise that resolves to a Map of tag IDs to titles
 */
export async function loadTaxonomyMap() {
  if (taxonomyMapCache) return taxonomyMapCache;

  const res = await fetch(TAXONOMY_URL);
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error('taxonomy.json not found at:', TAXONOMY_URL);
    return new Map();
  }
  const taxonomy = await res.json();

  // Create a Map for fast lookups
  if (taxonomy.data && Array.isArray(taxonomy.data)) {
    taxonomyMapCache = new Map(
      taxonomy.data.map((tagObj) => [tagObj.tag, tagObj.title]),
    );
  } else {
    // eslint-disable-next-line no-console
    console.error('taxonomy.json structure not recognized', taxonomy);
    taxonomyMapCache = new Map();
  }
  return taxonomyMapCache;
}

/**
 * Gets the full taxonomy data including all properties like jcr:descriptions
 * @returns {Promise<Object>} A promise that resolves to the full taxonomy data
 */
export async function getFullTaxonomyData() {
  const res = await fetch(TAXONOMY_URL);
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error('taxonomy.json not found at:', TAXONOMY_URL);
    return { data: [] };
  }
  return res.json();
}
// --- END: Taxonomy Helper Functions ---

/**
 * Helper function to wait for taxonomy to be loaded and metadata to be updated
 * @returns {Promise<void>} A promise that resolves when taxonomy is loaded or timeout is reached
 */
export async function waitForTaxonomyUpdate() {
  // Check if taxonomy has already been loaded by looking for updated metadata
  const checkMetadata = () => {
    const locationMeta = document.querySelector('meta[name="tags-location-card"]');
    const statusMeta = document.querySelector('meta[name="tags-status"]');
    const lazerMeta = document.querySelector('meta[name="tags-lazer"]');

    // If metadata contains actual titles (not just IDs), taxonomy has been loaded
    if (locationMeta && locationMeta.content && !locationMeta.content.includes(':')) {
      return true;
    }
    if (statusMeta && statusMeta.content && !statusMeta.content.includes(':')) {
      return true;
    }
    if (lazerMeta && lazerMeta.content && !lazerMeta.content.includes(':')) {
      return true;
    }
    return false;
  };

  // If metadata is already updated, return immediately
  if (checkMetadata()) {
    return;
  }

  // Wait for taxonomy to be loaded with a timeout
  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (checkMetadata()) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 50);

    // Timeout after 2 seconds to prevent infinite waiting
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve();
    }, 2000);
  });
}

/**
 * Parses location data from locationCard format
 * @param {string} locationCard - The location card string in format
 * "meusensia:locations-for-cards/region---city---state"
 * @returns {Object|null} Object with region, city, state properties or null if parsing fails
 */
export function parseLocationCard(locationCard) {
  if (!locationCard || typeof locationCard !== 'string') {
    return null;
  }

  // Extract the part after the last "/"
  // Format: "meusensia:locations-for-cards/betania---belo-horizonte---mg"
  const parts = locationCard.split('/');
  if (parts.length < 2) {
    return null;
  }

  const locationString = parts[parts.length - 1];
  const locationParts = locationString.split('---');

  if (locationParts.length >= 3) {
    return {
      region: locationParts[0],
      city: locationParts[1],
      state: locationParts[2],
    };
  }

  return null;
}

/**
 * Converts a proper city name to hyphenated format
 * @param {string} cityName - The proper city name (e.g., "Belo Horizonte")
 * @returns {string} The hyphenated city name (e.g., "belo-horizonte")
 */
export function convertCityToHyphenated(cityName) {
  return cityName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Converts a hyphenated city name to proper format
 * @param {string} cityHyphenated - The hyphenated city name (e.g., "belo-horizonte")
 * @returns {string} The proper city name (e.g., "Belo Horizonte")
 */
export function convertHyphenatedToProperCity(cityHyphenated) {
  return cityHyphenated.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

// Reverse mapping for full state names to abbreviations
const BRAZILIAN_STATES_REVERSE_MAP = new Map(
  Array.from(BRAZILIAN_STATES_MAP.entries()).map(([abbrev, fullName]) => [fullName, abbrev]),
);

/**
 * Gets the full state name from a 2-letter abbreviation
 * @param {string} abbreviation - The 2-letter state abbreviation (e.g., "SP", "RJ")
 * @returns {string|null} The full state name or null if not found
 */
export function getStateNameFromAbbreviation(abbreviation) {
  if (!abbreviation || typeof abbreviation !== 'string') {
    return null;
  }
  return BRAZILIAN_STATES_MAP.get(abbreviation.toUpperCase()) || null;
}

/**
 * Gets the 2-letter abbreviation from a full state name
 * @param {string} stateName - The full state name (e.g., "São Paulo", "Rio de Janeiro")
 * @returns {string|null} The 2-letter abbreviation or null if not found
 */
export function getStateAbbreviationFromName(stateName) {
  if (!stateName || typeof stateName !== 'string') {
    return null;
  }
  return BRAZILIAN_STATES_REVERSE_MAP.get(stateName) || null;
}

/**
 * Gets all Brazilian states as an array of objects with abbreviation and name
 * @returns {Array<Object>} Array of state objects with {abbreviation, name} properties
 */
export function getAllBrazilianStates() {
  return Array.from(BRAZILIAN_STATES_MAP.entries()).map(([abbreviation, name]) => ({
    abbreviation,
    name,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Decorates the #tags-lazer div (see section ID of /content/meusensia/fragments/tags-lazer.html)
 * by replacing the first P element content with lazerMeta content.
 * Used in the Ficha Tecnica section of imovel-default pages.
 * @returns {void}
 */
export function decorateTagsLazer() {
  const main = document.querySelector('main');
  const tagsLazerDiv = main?.querySelector('div#tags-lazer');
  const lazerMeta = document.querySelector('meta[name="tags-lazer"]');

  if (tagsLazerDiv && lazerMeta && lazerMeta.content) {
    const firstP = tagsLazerDiv.querySelector('p');
    if (firstP) {
      firstP.textContent = lazerMeta.content;
    }
  }
}
