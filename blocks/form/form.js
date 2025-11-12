import { loadScript } from '../../scripts/aem.js';
import {
  createTag,
  getGenericIndexData,
  loadTaxonomyMap,
  parseLocationCard,
  convertHyphenatedToProperCity,
  convertCityToHyphenated,
  getStateNameFromAbbreviation,
} from '../../scripts/utils.js';

// Cache for frequently accessed data
const dataCache = {
  indexData: null,
  taxonomyMap: null,
  imovelData: null,
};

// Data management functions (same as header.js)
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

class SensiaForm {
  constructor(block) {
    this.block = block;
    this.form = null;
    this.recaptchaWidgetId = null;
    this.init();
  }

  async init() {
    await this.loadRecaptcha();
    this.createForm();
    this.bindEvents();
    this.setupStateCityLogic();
  }

  async loadRecaptcha() {
    try {
      await loadScript('https://www.google.com/recaptcha/api.js?render=explicit');
      window.grecaptcha.ready(() => {
        this.renderRecaptcha();
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading reCAPTCHA:', error);
    }
  }

  renderRecaptcha() {
    if (window.grecaptcha && this.recaptchaContainer) {
      this.recaptchaWidgetId = window.grecaptcha.render(this.recaptchaContainer, {
        sitekey: '6Lcs4EQpAAAAABSHtkptmJx6NvNGJhd0p0wNsLvH', // taken from meusensia.com.br/imovel/la-vie/
        callback: this.onRecaptchaSuccess.bind(this),
        'expired-callback': this.onRecaptchaExpired.bind(this),
      });
    }
  }

  onRecaptchaSuccess(token) {
    this.recaptchaToken = token;
    this.recaptchaContainer.classList.remove('error');
  }

  onRecaptchaExpired() {
    this.recaptchaToken = null;
    this.recaptchaContainer.classList.add('error');
  }

  createForm() {
    this.form = createTag('form', {
      class: 'sensia-contact-form',
      id: 'sensiaContactForm',
    });

    // Name field
    const nameField = SensiaForm.createFieldGroup('Nome', 'text', 'name', true);

    // Phone field
    const phoneField = SensiaForm.createFieldGroup('Telefone', 'tel', 'phone', true);

    // Email field
    const emailField = SensiaForm.createFieldGroup('Email', 'email', 'email', true);

    // State field
    const stateField = SensiaForm.createSelectField('Estado', 'state', true, []);

    // City field
    const cityField = SensiaForm.createSelectField('Cidade', 'city', true, []);

    // City code field
    const cityCodeField = SensiaForm.createSelectField('Código da Cidade', 'cityCode', false, []);

    // Privacy policy checkbox
    const privacyField = SensiaForm.createCheckboxField();

    // reCAPTCHA container
    this.recaptchaContainer = createTag('div', {
      class: 'recaptcha-container',
      id: 'recaptchaContainer',
    });

    // Submit button
    const submitButton = createTag('button', {
      type: 'submit',
      class: 'submit-button button secondary',
    });
    submitButton.textContent = 'Enviar informações';

    // Error message container
    const errorContainer = createTag('div', { class: 'error-message' });

    // Success message container
    const successContainer = createTag('div', { class: 'success-message' });

    // Assemble form
    this.form.appendChild(nameField);
    this.form.appendChild(phoneField);
    this.form.appendChild(emailField);
    this.form.appendChild(stateField);
    this.form.appendChild(cityField);
    this.form.appendChild(cityCodeField);
    this.form.appendChild(privacyField);
    this.form.appendChild(this.recaptchaContainer);
    this.form.appendChild(submitButton);
    this.form.appendChild(errorContainer);
    this.form.appendChild(successContainer);

    // Replace block content with form
    this.block.innerHTML = '';
    this.block.appendChild(this.form);
  }

  static createFieldGroup(label, type, name, required) {
    const fieldGroup = createTag('div', { class: 'field-group' });

    const labelElement = createTag('label', { for: name });
    labelElement.textContent = label;
    if (required) {
      const requiredSpan = createTag('span', { class: 'required' });
      requiredSpan.textContent = ' *';
      labelElement.appendChild(requiredSpan);
    }

    const input = createTag('input', {
      type,
      id: name,
      placeholder: `Digite seu ${label.toLowerCase()}`,
      name,
      required,
    });

    fieldGroup.appendChild(labelElement);
    fieldGroup.appendChild(input);

    return fieldGroup;
  }

  static createSelectField(label, name, required, options) {
    const fieldGroup = createTag('div', { class: 'field-group' });

    const labelElement = createTag('label', { for: name });
    labelElement.textContent = label;
    if (required) {
      const requiredSpan = createTag('span', { class: 'required' });
      requiredSpan.textContent = ' *';
      labelElement.appendChild(requiredSpan);
    }

    const select = createTag('select', {
      id: name,
      name,
      required,
    });

    // Add default option
    const defaultOption = createTag('option', { value: '' });
    defaultOption.textContent = `Selecione ${label.toLowerCase()}`;
    select.appendChild(defaultOption);

    // Add options
    options.forEach((option) => {
      const optionElement = createTag('option', { value: option.code });
      optionElement.textContent = option.name;
      select.appendChild(optionElement);
    });

    fieldGroup.appendChild(labelElement);
    fieldGroup.appendChild(select);

    return fieldGroup;
  }

  static createCheckboxField() {
    const fieldGroup = createTag('div', { class: 'field-group checkbox-group' });

    const checkbox = createTag('input', {
      type: 'checkbox',
      id: 'privacy',
      name: 'privacy',
      required: true,
    });

    const label = createTag('label', { for: 'privacy', class: 'checkbox-label' });
    label.innerHTML = 'Estou de acordo com a <a href="/politica-privacidade" target="_blank">política de privacidade</a> e aceito receber contatos (Whatsapp, SMS, e-mail, ligações) da Sensia e marcas MRV&CO.';

    fieldGroup.appendChild(checkbox);
    fieldGroup.appendChild(label);

    return fieldGroup;
  }

  async setupStateCityLogic() {
    const stateSelect = this.form.querySelector('#state');
    const citySelect = this.form.querySelector('#city');
    const cityCodeSelect = this.form.querySelector('#cityCode');

    try {
      // Load data
      const [, taxonomyMap] = await Promise.all([
        dataManager.getIndexData(),
        dataManager.getTaxonomyMap(),
      ]);

      const { imovelData } = dataCache;
      const states = dataManager.extractStates(imovelData);

      // Populate state dropdown
      stateSelect.innerHTML = '<option value="">Estado de interesse</option>';
      states.forEach((state) => {
        // Try to get full state name from abbreviation first
        const fullStateName = getStateNameFromAbbreviation(state);
        const displayName = fullStateName || dataManager.getTagTitle(state, taxonomyMap);

        const option = createTag('option', { value: state });
        option.textContent = displayName;
        stateSelect.appendChild(option);
      });

      // Handle state selection
      stateSelect.addEventListener('change', async (e) => {
        const selectedState = e.target.value;
        citySelect.innerHTML = '<option value="">Cidade de interesse</option>';
        cityCodeSelect.innerHTML = '<option value="">Selecione Código</option>';

        if (selectedState) {
          const cities = dataManager.extractCitiesForState(imovelData, selectedState);

          cities.forEach((city) => {
            const cityOption = createTag('option', { value: city });
            cityOption.textContent = dataManager.getTagTitle(city, taxonomyMap);
            citySelect.appendChild(cityOption);
          });
        }
      });

      // Handle city selection
      citySelect.addEventListener('change', (e) => {
        const selectedCity = e.target.value;
        cityCodeSelect.innerHTML = '<option value="">Selecione Código</option>';

        if (selectedCity) {
          // For now, we'll use a simple mapping
          // You can expand this with a proper cities database
          const cityCode = convertCityToHyphenated(selectedCity);
          const codeOption = createTag('option', { value: cityCode });
          codeOption.textContent = cityCode;
          cityCodeSelect.appendChild(codeOption);
        }
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error setting up state-city logic:', error);
    }
  }

  bindEvents() {
    this.form.addEventListener('submit', this.handleSubmit.bind(this));

    // Real-time validation
    const inputs = this.form.querySelectorAll('input, select');
    inputs.forEach((input) => {
      input.addEventListener('blur', () => SensiaForm.validateField(input));
      input.addEventListener('input', () => SensiaForm.clearFieldError(input));
    });
  }

  static validateField(field) {
    const value = field.value.trim();
    const isRequired = field.hasAttribute('required');

    SensiaForm.clearFieldError(field);

    if (isRequired && !value) {
      return false;
    }

    if (field.type === 'email' && value && !SensiaForm.isValidEmail(value)) {
      SensiaForm.showFieldError(field, 'Email inválido');
      return false;
    }

    if (field.type === 'tel' && value && !SensiaForm.isValidPhone(value)) {
      SensiaForm.showFieldError(field, 'Telefone inválido');
      return false;
    }

    return true;
  }

  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPhone(phone) {
    const phoneRegex = /^[\d\s()+-]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  static showFieldError(field, message) {
    field.classList.add('error');

    let errorElement = field.parentNode.querySelector('.field-error');
    if (!errorElement) {
      errorElement = createTag('div', { class: 'field-error' });
      field.parentNode.appendChild(errorElement);
    }
    errorElement.textContent = message;
  }

  static clearFieldError(field) {
    field.classList.remove('error');
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
      errorElement.remove();
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    // Validate all fields
    const inputs = this.form.querySelectorAll('input, select');
    let isValid = true;

    inputs.forEach((input) => {
      if (!SensiaForm.validateField(input)) {
        isValid = false;
      }
    });

    // Check reCAPTCHA
    if (!this.recaptchaToken) {
      this.recaptchaContainer.classList.add('error');
      isValid = false;
    }

    if (!isValid) {
      this.showError('Por favor, corrija os erros no formulário.');
      return;
    }

    // Show loading state
    const submitButton = this.form.querySelector('.submit-button');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Enviando...';
    submitButton.disabled = true;

    try {
      // Here you would typically send the form data to your backend
      // For now, we'll simulate a successful submission
      await SensiaForm.submitForm();

      this.showSuccess('Formulário TEST enviado com sucesso! Entraremos em contato em breve.');
      this.form.reset();
      this.recaptchaToken = null;

      // Reset reCAPTCHA
      if (window.grecaptcha && this.recaptchaWidgetId !== null) {
        window.grecaptcha.reset(this.recaptchaWidgetId);
      }
    } catch (error) {
      this.showError('Erro ao enviar formulário. Tente novamente.');
    } finally {
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  }

  static async submitForm() {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });

    // In production, you would send the form data like this:
    /*
    const formData = new FormData(this.form);
    formData.append('recaptcha_token', this.recaptchaToken);

    const response = await fetch('/api/contact', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    return response.json();
    */
  }

  showError(message) {
    const errorContainer = this.form.querySelector('.error-message');
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';

    setTimeout(() => {
      errorContainer.style.display = 'none';
    }, 5000);
  }

  showSuccess(message) {
    const successContainer = this.form.querySelector('.success-message');
    successContainer.textContent = message;
    successContainer.style.display = 'block';

    setTimeout(() => {
      successContainer.style.display = 'none';
    }, 5000);
  }
}

// Initialize form when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const formBlocks = document.querySelectorAll('.form');
  formBlocks.forEach((block) => {
    const sensiaForm = new SensiaForm(block);
    sensiaForm.init();
  });
});

export default function init(block) {
  const sensiaForm = new SensiaForm(block);
  sensiaForm.init();
}
