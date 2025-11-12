import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import {
  getGenericIndexData,
  loadTaxonomyMap,
  parseLocationCard,
  convertHyphenatedToProperCity,
  convertCityToHyphenated,
  getStateNameFromAbbreviation,
} from '../../scripts/utils.js';
import { createModal } from '../modal/modal.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

// Cache for frequently accessed data
const dataCache = {
  indexData: null,
  taxonomyMap: null,
  imovelData: null,
};

// Utility functions
const utils = {
  closeOnEscape(e) {
    if (e.code === 'Escape') {
      const nav = document.getElementById('nav');
      const navSections = nav.querySelector('.nav-sections');
      const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
      if (navSectionExpanded && isDesktop.matches) {
        this.toggleAllNavSections(navSections);
        navSectionExpanded.focus();
      } else if (!isDesktop.matches) {
        this.toggleMenu(nav, navSections);
        nav.querySelector('button').focus();
      }
    }
  },

  closeOnFocusLost(e) {
    const nav = e.currentTarget;
    if (!nav.contains(e.relatedTarget)) {
      const navSections = nav.querySelector('.nav-sections');
      const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
      if (navSectionExpanded && isDesktop.matches) {
        this.toggleAllNavSections(navSections, false);
      } else if (!isDesktop.matches) {
        this.toggleMenu(nav, navSections, false);
      }
    }
  },

  openOnKeydown(e) {
    const focused = document.activeElement;
    const isNavDrop = focused.className === 'nav-drop';
    if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
      const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
      this.toggleAllNavSections(focused.closest('.nav-sections'));
      focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
    }
  },

  focusNavSection() {
    document.activeElement.addEventListener('keydown', this.openOnKeydown.bind(this));
  },

  toggleAllNavSections(sections, expanded = false) {
    sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
      section.setAttribute('aria-expanded', expanded);
    });
  },

  toggleMenu(nav, navSections, forceExpanded = null) {
    const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
    const button = nav.querySelector('.nav-hamburger button');

    // Instead of setting overflow-y: hidden on body (which breaks sticky positioning),
    // create or use a wrapper div to prevent scroll while keeping header sticky
    let scrollWrapper = document.getElementById('scroll-wrapper');
    if (!scrollWrapper) {
      scrollWrapper = document.createElement('div');
      scrollWrapper.id = 'scroll-wrapper';
      scrollWrapper.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden; pointer-events: none; z-index: 50;';
      document.body.appendChild(scrollWrapper);
    }

    if (!expanded && !isDesktop.matches) {
      // Mobile menu opening - prevent scroll on main content
      scrollWrapper.style.pointerEvents = 'auto';
      scrollWrapper.style.overflow = 'hidden';
    } else {
      // Mobile menu closing or desktop - restore normal scroll
      scrollWrapper.style.pointerEvents = 'none';
      scrollWrapper.style.overflow = 'visible';
    }

    nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    this.toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
    button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');

    // enable nav dropdown keyboard accessibility
    const navDrops = navSections.querySelectorAll('.nav-drop');
    if (isDesktop.matches) {
      navDrops.forEach((drop) => {
        if (!drop.hasAttribute('tabindex')) {
          drop.setAttribute('tabindex', 0);
          drop.addEventListener('focus', this.focusNavSection.bind(this));
        }
      });
    } else {
      navDrops.forEach((drop) => {
        drop.removeAttribute('tabindex');
        drop.removeEventListener('focus', this.focusNavSection.bind(this));
      });
    }

    // enable menu collapse on escape keypress
    if (!expanded || isDesktop.matches) {
      window.addEventListener('keydown', this.closeOnEscape.bind(this));
      nav.addEventListener('focusout', this.closeOnFocusLost.bind(this));
    } else {
      window.removeEventListener('keydown', this.closeOnEscape.bind(this));
      nav.removeEventListener('focusout', this.closeOnFocusLost.bind(this));
    }
  },
};

// Data management
const dataManager = {
  async getIndexData() {
    if (!dataCache.indexData) {
      dataCache.indexData = await getGenericIndexData();
      dataCache.imovelData = dataCache.indexData.filter((item) => item.template === 'imovel-default');
    }
    return dataCache.indexData;
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

  extractStates(imovelData) {
    const states = new Set();
    imovelData.forEach((item) => {
      if (item.locationState && Array.isArray(item.locationState)) {
        item.locationState.forEach((state) => {
          if (state && state.trim()) {
            states.add(state.trim());
          }
        });
      }
    });
    return Array.from(states).sort();
  },

  extractCitiesForState(imovelData, selectedState) {
    const cities = new Set();
    imovelData.forEach((item) => {
      if (item.locationState && Array.isArray(item.locationState)
          && item.locationState.includes(selectedState)
          && item.locationCard && Array.isArray(item.locationCard)) {
        // Use locationCard to get the full location string and extract city from taxonomy
        item.locationCard.forEach((locationCard) => {
          const locationData = parseLocationCard(locationCard);
          if (locationData && locationData.state === selectedState) {
            // Convert hyphenated city name to proper city name
            const cityProper = convertHyphenatedToProperCity(locationData.city);
            cities.add(cityProper);
          }
        });
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

  createCheckboxContainer(id, value, label, className) {
    const container = document.createElement('div');
    container.className = className;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.value = value;
    checkbox.className = `${className.replace('-container', '')}`;

    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    labelElement.className = `${className.replace('-container', '')}-label`;

    container.appendChild(checkbox);
    container.appendChild(labelElement);
    return { container, checkbox };
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

// URL builder
const urlBuilder = {
  buildFilterUrl(params) {
    const urlParams = [];

    if (params.state && params.state.trim() !== '') {
      if (params.city && params.city.trim() !== '') {
        urlParams.push(`s=${params.state}%2B${params.city}`);
      } else {
        urlParams.push(`s=${params.state}`);
      }
    }

    if (params.status && params.status.length > 0) {
      urlParams.push(`status=${params.status.join('%2B')}`);
    }

    if (params.amenities && params.amenities.length > 0) {
      urlParams.push(`lazer=${params.amenities.join('%2B')}`);
    }

    if (params.tipologia && params.tipologia.length > 0) {
      urlParams.push(`tipologia=${params.tipologia.join('%2B')}`);
    }

    if (params.minPrice && params.minPrice.trim() !== '') {
      urlParams.push(`minPrice=${params.minPrice}`);
    }

    if (params.maxPrice && params.maxPrice.trim() !== '') {
      urlParams.push(`maxPrice=${params.maxPrice}`);
    }

    return `/resultados?${urlParams.join('&')}`;
  },

  getSelectedCheckboxes(checkboxes) {
    return checkboxes
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
  },
};

// Filter form builder
const filterFormBuilder = {
  async buildFilterForm() {
    const filterForm = document.createElement('form');
    filterForm.id = 'filter-form';
    filterForm.innerHTML = `
      <div><strong>Imóveis em</strong>
        <select name="state" id="state" aria-label="Estado">
          <option>Estado</option>
        </select>
        <select name="city" id="city" aria-label="Cidade">
          <option>Cidade</option>
        </select>
        <button class="button secondary" type="submit">Enviar</button>
      </div>
    `;

    const stateSelect = filterForm.querySelector('#state');
    const citySelect = filterForm.querySelector('#city');

    try {
      const [, taxonomyMap] = await Promise.all([
        dataManager.getIndexData(),
        dataManager.getTaxonomyMap(),
      ]);

      const { imovelData } = dataCache;
      const states = dataManager.extractStates(imovelData);

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
          const cities = dataManager.extractCitiesForState(imovelData, selectedState);
          formBuilder.populateSelect(citySelect, cities.map((city) => ({
            value: city,
            label: dataManager.getTagTitle(city, taxonomyMap),
          })));
        }
      });

      // Handle form submission
      filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedState = stateSelect.value;
        const selectedCity = citySelect.value;

        if (selectedState && selectedCity) {
          const hyphenatedCity = convertCityToHyphenated(selectedCity);
          window.location.href = `/imoveis/${selectedState}/${hyphenatedCity}`;
        } else if (selectedState) {
          window.location.href = `/imoveis/${selectedState}`;
        }
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error building filter form:', error);
    }

    return filterForm;
  },

  async buildFilterModal() {
    const filterForm = await this.buildFilterForm();
    const modalContent = this.createModalContent(filterForm);

    // Add event listeners for modal form
    this.setupModalFormListeners(modalContent);

    return modalContent;
  },

  createModalContent(filterForm) {
    const modalContent = document.createElement('div');
    modalContent.className = 'filter-modal-content';

    // Add title
    const title = document.createElement('h2');
    title.innerHTML = '<strong>PROCURO APARTAMENTO</strong><br><span style="font-weight: 400;">DO MEU JEITO EM:</span>';
    title.className = 'filter-modal-title';
    modalContent.appendChild(title);

    // Clone form for modal
    const newForm = filterForm.cloneNode(true);
    const originalSubmitButton = newForm.querySelector('button[type="submit"]');
    if (originalSubmitButton) {
      originalSubmitButton.remove();
    }
    modalContent.appendChild(newForm);

    // Add accordion with filters
    const filtersAccordion = this.createFiltersAccordion();
    modalContent.appendChild(filtersAccordion);

    // Add submit button and link
    this.addModalFooter(modalContent);

    return modalContent;
  },

  createFiltersAccordion() {
    const filtersAccordion = document.createElement('details');
    filtersAccordion.className = 'filters-accordion';
    filtersAccordion.style.marginTop = '20px';

    const filtersSummary = this.createFiltersSummary();
    const filterSectionsWrapper = this.createFilterSections();

    filtersAccordion.appendChild(filtersSummary);
    filtersAccordion.appendChild(filterSectionsWrapper);

    // Add accordion animation
    this.setupAccordionAnimation(filtersAccordion, filterSectionsWrapper);

    return filtersAccordion;
  },

  createFiltersSummary() {
    const filtersSummary = document.createElement('summary');
    filtersSummary.className = 'filters-summary';
    filtersSummary.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      cursor: pointer;
      font-weight: 600;
      font-size: 16px;
      color: var(--cor-global-acento);
      padding: 10px 0;
    `;

    const filterIcon = document.createElement('span');
    filterIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7.675 18V12.375H9.175V14.45H18V15.95H9.175V18H7.675ZM0 15.95V14.45H6.175V15.95H0ZM4.675 11.8V9.75H0V8.25H4.675V6.15H6.175V11.8H4.675ZM7.675 9.75V8.25H18V9.75H7.675ZM11.825 5.625V0H13.325V2.05H18V3.55H13.325V5.625H11.825ZM0 3.55V2.05H10.325V3.55H0Z" fill="#B7CAA6"/></svg>';
    filterIcon.style.cssText = 'margin-right: 24px; display: inline-block; vertical-align: middle; width: 0; height: 20px;';

    const filtersText = document.createElement('span');
    filtersText.textContent = 'Filtros';

    const accordionArrow = document.createElement('span');
    accordionArrow.className = 'accordion-arrow';
    accordionArrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#B7CAA6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    accordionArrow.style.cssText = 'margin-left: 8px; display: inline-block; vertical-align: middle; width: 12px; height: 24px;';

    filtersSummary.appendChild(filterIcon);
    filtersSummary.appendChild(filtersText);
    filtersSummary.appendChild(accordionArrow);

    return filtersSummary;
  },

  createFilterSections() {
    const filterSectionsWrapper = document.createElement('div');
    filterSectionsWrapper.className = 'filter-sections-wrapper';

    // Add status filter
    const statusSection = this.createStatusFilter();
    filterSectionsWrapper.appendChild(statusSection);

    // Add price filter
    const priceSection = this.createPriceFilter();
    filterSectionsWrapper.appendChild(priceSection);

    // Add amenities filter
    const amenitiesSection = this.createAmenitiesFilter();
    filterSectionsWrapper.appendChild(amenitiesSection);

    // Add tipologia filter
    const tipologiaSection = this.createTipologiaFilter();
    filterSectionsWrapper.appendChild(tipologiaSection);

    return filterSectionsWrapper;
  },

  createStatusFilter() {
    const statusSection = document.createElement('div');
    statusSection.className = 'status-filter-section';

    const statusTitle = document.createElement('h3');
    statusTitle.textContent = 'Status da Obra';
    statusTitle.className = 'status-filter-title';
    statusSection.appendChild(statusTitle);

    const statusCheckboxesGrid = document.createElement('div');
    statusCheckboxesGrid.className = 'status-checkboxes-grid';

    const statusOptions = [
      { value: 'breve-lancamento', label: 'Breve Lançamento' },
      { value: 'em-obras', label: 'Em Obras' },
      { value: 'lancamento', label: 'Lançamento' },
      { value: 'pronto', label: 'Pronto' },
    ];

    statusOptions.forEach((option) => {
      const { container } = formBuilder.createCheckboxContainer(
        `status-${option.value}`,
        option.value,
        option.label,
        'status-checkbox-container',
      );
      statusCheckboxesGrid.appendChild(container);
    });

    statusSection.appendChild(statusCheckboxesGrid);
    return statusSection;
  },

  createPriceFilter() {
    const priceSection = document.createElement('div');
    priceSection.className = 'price-filter-section';

    const priceTitle = document.createElement('h3');
    priceTitle.textContent = 'FAIXA DE PREÇO';
    priceTitle.className = 'price-filter-title';
    priceSection.appendChild(priceTitle);

    const priceRangeContainer = document.createElement('div');
    priceRangeContainer.className = 'price-range-container';

    const minPriceOptions = [
      { value: '', label: 'Selecione' },
      { value: '450000', label: 'R$ 450.000' },
      { value: '500000', label: 'R$ 500.000' },
      { value: '550000', label: 'R$ 550.000' },
      { value: '600000', label: 'R$ 600.000' },
      { value: '650000', label: 'R$ 650.000' },
      { value: '700000', label: 'R$ 700.000' },
      { value: '750000', label: 'R$ 750.000' },
      { value: '800000', label: 'R$ 800.000' },
      { value: '850000', label: 'R$ 850.000' },
      { value: '900000', label: 'R$ 900.000' },
      { value: '950000', label: 'R$ 950.000' },
      { value: '1000000', label: 'R$ 1.000.000' },
    ];

    const maxPriceOptions = [
      { value: '', label: 'Selecione' },
      { value: '700000', label: 'R$ 700.000' },
      { value: '800000', label: 'R$ 800.000' },
      { value: '900000', label: 'R$ 900.000' },
      { value: '1000000', label: 'R$ 1.000.000' },
      { value: '1500000', label: 'R$ 1.500.000' },
      { value: '2000000', label: 'R$ 2.000.000' },
      { value: '2500000', label: 'R$ 2.500.000' },
    ];

    const minPriceContainer = this.createPriceDropdown('min-price', 'Preço Mínimo', minPriceOptions);
    const maxPriceContainer = this.createPriceDropdown('max-price', 'Preço Máximo', maxPriceOptions);

    // Get the select elements for validation
    const minPriceSelect = minPriceContainer.querySelector('#min-price');
    const maxPriceSelect = maxPriceContainer.querySelector('#max-price');

    // Add validation logic
    const validatePriceRange = () => {
      const selectedMinPrice = minPriceSelect.value;

      if (selectedMinPrice && selectedMinPrice !== '') {
        const minPriceValue = parseInt(selectedMinPrice, 10);

        // Filter out invalid maxPrice options (those <= minPrice)
        // eslint-disable-next-line max-len
        const validMaxPriceOptions = maxPriceOptions.filter((option) => !option.value || parseInt(option.value, 10) > minPriceValue);

        // Clear and repopulate maxPrice select with valid options only
        maxPriceSelect.innerHTML = '';
        validMaxPriceOptions.forEach((option) => {
          const optionElement = formBuilder.createSelectOption(option.value, option.label);
          maxPriceSelect.appendChild(optionElement);
        });

        // Reset maxPrice selection since options changed
        maxPriceSelect.value = '';
      } else {
        // If no minPrice selected, restore all maxPrice options
        maxPriceSelect.innerHTML = '';
        maxPriceOptions.forEach((option) => {
          const optionElement = formBuilder.createSelectOption(option.value, option.label);
          maxPriceSelect.appendChild(optionElement);
        });
      }
    };

    // Add event listener to minPrice select
    minPriceSelect.addEventListener('change', validatePriceRange);

    priceRangeContainer.appendChild(minPriceContainer);
    priceRangeContainer.appendChild(maxPriceContainer);
    priceSection.appendChild(priceRangeContainer);

    return priceSection;
  },

  createPriceDropdown(id, label, options) {
    const container = document.createElement('div');
    container.className = 'price-dropdown-container';

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.className = 'price-label';

    const select = document.createElement('select');
    select.className = 'price-select';
    select.id = id;

    options.forEach((option) => {
      const optionElement = formBuilder.createSelectOption(option.value, option.label);
      select.appendChild(optionElement);
    });

    container.appendChild(labelElement);
    container.appendChild(select);

    return container;
  },

  createAmenitiesFilter() {
    const amenitiesSection = document.createElement('div');
    amenitiesSection.className = 'amenities-filter-section';

    const amenitiesTitle = document.createElement('h3');
    amenitiesTitle.textContent = 'ITENS DE LAZER';
    amenitiesTitle.className = 'amenities-filter-title';
    amenitiesSection.appendChild(amenitiesTitle);

    const amenitiesOptions = [
      { value: 'piscina', label: 'Piscina' },
      { value: 'salao-de-festas', label: 'Salão de Festas' },
      { value: 'academia', label: 'Academia' },
    ];

    amenitiesOptions.forEach((option) => {
      const { container } = formBuilder.createCheckboxContainer(
        `amenities-${option.value}`,
        option.value,
        option.label,
        'amenities-checkbox-container',
      );
      amenitiesSection.appendChild(container);
    });

    return amenitiesSection;
  },

  createTipologiaFilter() {
    const tipologiaSection = document.createElement('div');
    tipologiaSection.className = 'tipologia-filter-section';

    const tipologiaTitle = document.createElement('h3');
    tipologiaTitle.textContent = 'TIPOLOGIA';
    tipologiaTitle.className = 'tipologia-filter-title';
    tipologiaSection.appendChild(tipologiaTitle);

    const tipologiaCheckboxesRow = document.createElement('div');
    tipologiaCheckboxesRow.className = 'tipologia-checkboxes-row';

    const tipologiaOptions = [
      { value: '1', label: '1 quarto' },
      { value: '2', label: '2 quartos' },
      { value: '3', label: '3 quartos' },
    ];

    tipologiaOptions.forEach((option) => {
      const { container } = formBuilder.createCheckboxContainer(
        `tipologia-${option.value}`,
        option.value,
        option.label,
        'tipologia-checkbox-container',
      );
      tipologiaCheckboxesRow.appendChild(container);
    });

    tipologiaSection.appendChild(tipologiaCheckboxesRow);
    return tipologiaSection;
  },

  setupAccordionAnimation(filtersAccordion, filterSectionsWrapper) {
    let isAnimating = false;
    const filtersSummary = filtersAccordion.querySelector('.filters-summary');

    filtersSummary.addEventListener('click', (e) => {
      e.preventDefault();
      if (isAnimating) return;
      isAnimating = true;

      if (filtersAccordion.open) {
        const currentHeight = filterSectionsWrapper.scrollHeight;
        filterSectionsWrapper.style.height = `${currentHeight}px`;
        requestAnimationFrame(() => {
          filterSectionsWrapper.style.height = '0px';
          setTimeout(() => {
            filtersAccordion.open = false;
            isAnimating = false;
          }, 500);
        });
      } else {
        filtersAccordion.open = true;
        filterSectionsWrapper.style.height = '0px';
        requestAnimationFrame(() => {
          const fullHeight = filterSectionsWrapper.scrollHeight;
          filterSectionsWrapper.style.height = `${fullHeight}px`;
          setTimeout(() => {
            isAnimating = false;
          }, 500);
        });
      }
    });
  },

  addModalFooter(modalContent) {
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'button secondary';
    submitButton.textContent = 'Buscar';
    submitButton.style.cssText = 'margin-top: 40px; width: 130px; display: block; margin-left: auto; margin-right: auto; text-align: center; justify-content: center; align-items: center; padding: 12px;';
    modalContent.appendChild(submitButton);

    const allPropertiesLink = document.createElement('a');
    allPropertiesLink.href = '/imoveis';
    allPropertiesLink.textContent = 'Ver todos os imóveis';
    allPropertiesLink.style.cssText = 'display: block; text-align: center; margin-top: 35px; color: var(--cor-global-acento); font-size: 14px; padding-bottom: 50px;';
    modalContent.appendChild(allPropertiesLink);
  },

  async setupModalFormListeners(modalContent) {
    const newForm = modalContent.querySelector('form');
    const newStateSelect = newForm.querySelector('#state');
    const newCitySelect = newForm.querySelector('#city');

    // Copy state selection logic
    newStateSelect.addEventListener('change', async () => {
      const selectedState = newStateSelect.value;
      newCitySelect.innerHTML = '<option value="">Cidade</option>';

      if (selectedState) {
        const { imovelData } = dataCache;
        const { taxonomyMap } = dataCache;
        const cities = dataManager.extractCitiesForState(imovelData, selectedState);

        formBuilder.populateSelect(newCitySelect, cities.map((city) => ({
          value: city,
          label: dataManager.getTagTitle(city, taxonomyMap),
        })));
      }
    });

    // Add submit handlers
    const submitHandler = (e) => {
      e.preventDefault();
      const selectedState = newStateSelect.value;
      const selectedCity = newCitySelect.value;

      const statusCheckboxes = Array.from(modalContent.querySelectorAll('.status-checkbox'));
      const amenitiesCheckboxes = Array.from(modalContent.querySelectorAll('.amenities-checkbox'));
      const tipologiaCheckboxes = Array.from(modalContent.querySelectorAll('.tipologia-checkbox'));
      const minPriceSelect = modalContent.querySelector('#min-price');
      const maxPriceSelect = modalContent.querySelector('#max-price');

      const params = {
        state: selectedState,
        city: selectedCity ? convertCityToHyphenated(selectedCity) : selectedCity,
        status: urlBuilder.getSelectedCheckboxes(statusCheckboxes),
        amenities: urlBuilder.getSelectedCheckboxes(amenitiesCheckboxes),
        tipologia: urlBuilder.getSelectedCheckboxes(tipologiaCheckboxes),
        minPrice: minPriceSelect ? minPriceSelect.value : '',
        maxPrice: maxPriceSelect ? maxPriceSelect.value : '',
      };

      const url = urlBuilder.buildFilterUrl(params);
      window.location.href = url;
    };

    newForm.addEventListener('submit', submitHandler);
    const submitButton = modalContent.querySelector('button[type="submit"]');
    submitButton.addEventListener('click', submitHandler);
  },
};

// Modal handler
const modalHandler = {
  async openFilterModal() {
    const modalContent = await filterFormBuilder.buildFilterModal();
    const { showModal } = await createModal([modalContent]);
    showModal();
  },
};

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/framework/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools', 'search'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          utils.toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
      });
    });
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => utils.toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');

  // prevent mobile nav behavior on window resize
  utils.toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => utils.toggleMenu(nav, navSections, isDesktop.matches));

  // Add filter form to nav-sections section
  const navTools = nav.querySelector('.nav-sections');
  if (navTools) {
    const filterForm = await filterFormBuilder.buildFilterForm();
    navTools.appendChild(filterForm);
  }

  // Add click handler to search icon in nav-search
  const navSearch = nav.querySelector('.nav-search');
  if (navSearch) {
    const searchIcon = navSearch.querySelector('.icon-search img');
    if (searchIcon) {
      searchIcon.style.cursor = 'pointer';
      searchIcon.addEventListener('click', modalHandler.openFilterModal.bind(modalHandler));
    }
  }

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
