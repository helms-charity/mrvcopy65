import {
  getLojasIndexData,
  loadTaxonomyMap,
  convertHyphenatedToProperCity,
  convertCityToHyphenated,
  getStateNameFromAbbreviation,
} from '../../scripts/utils.js';

// Cache for frequently accessed data
const dataCache = {
  indexData: null,
  taxonomyMap: null,
  lojasData: null,
};

// Data management
const dataManager = {
  async getIndexData() {
    if (!dataCache.indexData) {
      dataCache.indexData = await getLojasIndexData();
      dataCache.lojasData = dataCache.indexData.filter((item) => item.template === 'loja');
    }
    return dataCache.indexData; // return index data for lojas pages
  },

  async getTaxonomyMap() {
    if (!dataCache.taxonomyMap) {
      dataCache.taxonomyMap = await loadTaxonomyMap();
    }
    return dataCache.taxonomyMap;
  },

  getTagTitle(tagData, taxonomyMap) {
    if (Array.isArray(tagData) && tagData.length > 0) {
      const firstTagId = tagData[0];
      return taxonomyMap.get(firstTagId) || firstTagId;
    }
    if (typeof tagData === 'string') {
      return taxonomyMap.get(tagData) || tagData;
    }
    return tagData;
  },

  // Extract states from URL paths: /lojas/[state]
  extractStates() {
    const states = new Set();

    // Filter data to only include paths that start with /lojas/
    const lojasPaths = dataCache.indexData.filter((item) => item.path && item.path.startsWith('/lojas/'));

    // Extract the first child pathname after /lojas
    lojasPaths.forEach((item) => {
      const pathParts = item.path.split('/').filter(Boolean); // Remove empty strings
      if (pathParts.length >= 2 && pathParts[0] === 'lojas') {
        const state = pathParts[1]; // First child after /lojas/
        if (state && state.trim()) {
          states.add(state.trim());
        }
      }
    });

    return Array.from(states).sort();
  },

  // Extract cities for a state from URL paths: /lojas/[state]/[city]
  extractCitiesForState(selectedState) {
    const cities = new Set();

    // Filter data to only include paths that start with /lojas/[selectedState]/
    const statePaths = dataCache.indexData.filter((item) => item.path
    && item.path.startsWith(`/lojas/${selectedState}/`)
    && item.template === 'loja');

    // Extract the city from the next child pathname
    statePaths.forEach((item) => {
      const pathParts = item.path.split('/').filter(Boolean); // Remove empty strings
      if (pathParts.length >= 3 && pathParts[0] === 'lojas' && pathParts[1] === selectedState) {
        const city = pathParts[2]; // Next child after /lojas/[state]/
        if (city && city.trim()) {
          // Convert hyphenated city name to proper city name
          const cityProper = convertHyphenatedToProperCity(city.trim());
          cities.add(cityProper);
        }
      }
    });

    return Array.from(cities).sort();
  },
};

// Form builder utilities
const formBuilder = {
  createSelectOption(value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
  },

  populateSelect(select, options, taxonomyMap = null) {
    select.innerHTML = '<option value="">Estado</option>';
    options.forEach((option) => {
      const optionElement = this.createSelectOption(
        option.value || option,
        // eslint-disable-next-line max-len
        taxonomyMap ? dataManager.getTagTitle(option.label || option, taxonomyMap) : (option.label || option),
      );
      select.appendChild(optionElement);
    });
  },
};

// Lojas filter form builder
const lojasFilterFormBuilder = {
  async buildLojasFilterForm() {
    const filterForm = document.createElement('form');
    filterForm.id = 'lojas-filter-form';
    filterForm.innerHTML = `
      <div>
        <select name="state" id="lojas-state" aria-label="Estado">
          <option>Estado</option>
        </select>
        
        <select name="city" id="lojas-city" aria-label="Cidade">
          <option>Cidade</option>
        </select>
        <button class="button secondary" type="submit">Buscar loja</button>
      </div>
    `;

    const stateSelect = filterForm.querySelector('#lojas-state');
    const citySelect = filterForm.querySelector('#lojas-city');

    try {
      const [, taxonomyMap] = await Promise.all([
        dataManager.getIndexData(),
        dataManager.getTaxonomyMap(),
      ]);

      const states = dataManager.extractStates();

      // Populate state dropdown
      formBuilder.populateSelect(stateSelect, states.map((state) => {
        // Try to get full state name from abbreviation first
        const fullStateName = getStateNameFromAbbreviation(state);
        const displayName = fullStateName || dataManager.getTagTitle(state, taxonomyMap);

        return {
          value: state,
          label: displayName,
        };
      }));

      // Handle state selection
      stateSelect.addEventListener('change', () => {
        const selectedState = stateSelect.value;
        citySelect.innerHTML = '<option value="">Cidade</option>';

        if (selectedState) {
          const cities = dataManager.extractCitiesForState(selectedState);
          formBuilder.populateSelect(citySelect, cities.map((city) => ({
            value: city,
            label: dataManager.getTagTitle(city, taxonomyMap),
          })));
        }
      });

      // Handle form submission - redirect to /lojas URLs
      filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedState = stateSelect.value;
        const selectedCity = citySelect.value;

        if (selectedState && selectedCity) {
          const hyphenatedCity = convertCityToHyphenated(selectedCity);
          window.location.href = `/lojas/${selectedState}/${hyphenatedCity}`;
        } else if (selectedState) {
          window.location.href = `/lojas/${selectedState}`;
        }
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error building lojas filter form:', error);
    }

    return filterForm;
  },
};

/**
 * Decorates the lojas filter block
 * @param {Element} block The lojas filter block element
 */
export default async function decorate(block) {
  try {
    // Extract the richtext content from the first child (authored content)
    const richtextContent = block.children[0];

    const filterForm = await lojasFilterFormBuilder.buildLojasFilterForm();

    // Clear the block and add richtext content first, then the form
    block.textContent = '';

    if (richtextContent) {
      // Add the richtext content at the top
      block.appendChild(richtextContent);
    }

    // Add the form below the richtext
    block.appendChild(filterForm);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error decorating lojas filter block:', error);
  }
}
