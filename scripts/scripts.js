/* GLOSSÁRIO - Ações e nomes comuns usados nesses arquivos javascript.
* (Inglês: Português)
* create: criar
* load: carregar
* decorate: decorar
* wrap, wrapper: envolver, um envoltório
* import, export, move: importar, exportar, mover
* block: um bloco (um componente ou widget AEM)
* section: uma seção/uma dobra de página, um contêiner para blocos
* metadata: metadados
* index: índice
* picture: um elemento <picture> com uma imagem
* images: um array de imagens
* ref: referência
* attr: atributo
*/

import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateLinkedPictures,
  decorateBlocks,
  decorateTemplateAndTheme,
  buildBlock,
  decorateBlock,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  createOptimizedPicture,
  readBlockConfig,
  toCamelCase,
  toClassName,
  getMetadata,
} from './aem.js';

import { loadTaxonomyMap, decorateTagsLazer } from './utils.js';

// Shared breakpoints for responsive images
const RESPONSIVE_IMAGE_BREAKPOINTS = [
  { media: '(max-width: 600px)', width: '750' },
  { media: '(min-width: 601px)', width: '1200' },
  { media: '(min-width: 1200px)', width: '1900' },
];

// Cached media query results for performance
const MEDIA_QUERIES = {
  mobile: window.matchMedia('(max-width: 599px)'),
  tablet: window.matchMedia('(min-width: 600px) and (max-width: 899px)'),
  desktop: window.matchMedia('(min-width: 900px)'),
};

const IMOVELS_INDEX = `${window.hlx.codeBasePath}/imovel/query-index.json`;

// Debounce utility for performance
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Consultas de mídia (media queries/viewports). ref:  https://www.freecodecamp.org/news/the-100-correct-way-to-do-css-breakpoints-88d6a5ba1862/

// adicione os modelos permitidos aqui (add the allowed templates here)
// const TEMPLATES = ['property', 'home'];

/**
 * Aplica imageAlt e outros atributos a outro elemento fornecido.
 * Applies imageAlt and other attributes to another given element.
 * @param {Element} from o elemento para copiar atributos de
 * @param {Element} to o destino dos atributos
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from?.removeAttribute(attr);
    }
  });
}

/**
 * Editor universal: aplica atributos de instrumentação a outro elemento fornecido.
 * Universal Editor: Applies instrumentation attributes to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * Carrega fonts.css e define um flag de sessão
 * Loads fonts.css and sets a session storage flag
 * ref: https://www.aem.live/developer/font-fallback
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Calcula qual índice de imagem deve ser exibido,
 * com base no número de imagens e no tamanho atual da janela de visualização.
 * Calculates which image index should be shown and when
 * @param {number} imageCount o número de imagens (3, 2 ou 1)
 * @returns {number} o índice da imagem a ser exibida.
 */
function getResponsiveImageIndex(imageCount) {
  // Use cached media query results for performance
  const isMobile = MEDIA_QUERIES.mobile.matches;
  const isTablet = MEDIA_QUERIES.tablet.matches;
  const isDesktop = MEDIA_QUERIES.desktop.matches;

  if (imageCount === 3) {
    if (isMobile) return 0;
    if (isTablet) return 1;
    if (isDesktop) return 2;
    return 0; // fallback (contingência)
  }
  if (imageCount === 2) {
    if (isMobile) return 0;
    if (isTablet || isDesktop) return 1;
    return 0; // fallback (contingência)
  }
  return 0; // fallback (contingência)
}

/**
 * Cria um array de imagens a partir de um array de elementos picture.
 * Creates an array of images from a given array of picture elements.
 * @param {Array} pictures o array de elementos picture
 * @returns {Array} o array de imagens
 */
function getResponsiveImageEntries(pictures) {
  return Array.from(pictures).map((picture, idx) => ({
    idx,
    picture,
    parent: picture.parentElement,
    img: picture.querySelector('img'),
  }));
}

/**
 * Atualiza as imagens responsivas e seus atributos de carregamento
 * Updates the responsive images and their loading attributes
 * @param {Array} imageEntries o array de imagens
 */
function updateResponsiveImages(imageEntries) {
  const currentIdx = getResponsiveImageIndex(imageEntries.length);

  // Get the best breakpoint based on current viewport and media queries
  const getBestBreakpoint = (breakpoints) => {
    const matchedBreakpoint = breakpoints
      .filter((br) => !br.media || window.matchMedia(br.media).matches)
      .reduce((acc, curr) => {
        const currWidth = parseInt(curr.width, 10);
        const accWidth = parseInt(acc.width, 10);
        return currWidth > accWidth ? curr : acc;
      }, breakpoints[0]);
    return matchedBreakpoint;
  };

  imageEntries.forEach(({
    idx, picture, parent, img,
  }) => {
    if (idx === currentIdx) {
      if (!parent.contains(picture)) {
        parent.appendChild(picture);
      }

      // Update the img src to use the correct width for current viewport
      if (img) {
        const currentSrc = img.getAttribute('src');
        if (currentSrc) {
          // Use shared breakpoints for this image
          const breakpoints = RESPONSIVE_IMAGE_BREAKPOINTS;

          const matchedBreakpoint = getBestBreakpoint(breakpoints);
          const baseWidth = parseInt(matchedBreakpoint.width, 10);

          const url = new URL(currentSrc, window.location.href);
          url.searchParams.set('width', baseWidth);
          img.setAttribute('src', url.toString());
        }
      }

      // Set loading='eager' only for Hero blocks (above the fold)
      const heroBlock = picture.closest('.hero');
      if (img && heroBlock) {
        img.setAttribute('loading', 'eager');
      }
    } else if (parent.contains(picture)) {
      parent.removeChild(picture);
    }
  });
}

export function createOptimizedBackgroundImage(
  element,
  breakpoints = RESPONSIVE_IMAGE_BREAKPOINTS,
) {
  return createOptimizedPicture(element, '', false, breakpoints);
}

export function prepareResponsivePictures(bgImagesDiv) {
  const pictures = bgImagesDiv.querySelectorAll('picture');
  if (pictures.length >= 2) {
    // Add responsive classes once
    pictures.forEach((picture, idx) => {
      if (idx === 0) picture.parentElement.classList.add('mobile');
      if (idx === 1) picture.parentElement.classList.add('tablet');
      if (idx === 2) picture.parentElement.classList.add('desktop');
    });

    const imageEntries = getResponsiveImageEntries(pictures);

    // Initial update
    updateResponsiveImages(imageEntries);

    // Optimized resize handler with proper debouncing
    const debouncedUpdate = debounce(() => {
      updateResponsiveImages(imageEntries);
    }, 150); // Increased debounce time for better performance

    // Use passive event listener for better performance
    window.addEventListener('resize', debouncedUpdate, { passive: true });

    // Clean up function (optional - for memory management)
    return () => {
      window.removeEventListener('resize', debouncedUpdate);
    };
  }
  return undefined; // Explicit return for consistency
}

/**
 * Decora todas as seções (dobras) em um elemento contêiner. Movido de aem.js.
 * Decorates all sections in a container element. Moved from aem.js
 * @param {Element} main The container element
 */
export function decorateSections(main) {
  main.querySelectorAll(':scope > div:not([data-section-status])').forEach((section) => {
    const wrappers = [];
    let defaultContent = false;
    [...section.children].forEach((e) => {
      if ((e.tagName === 'DIV' && e.className) || !defaultContent) {
        const wrapper = document.createElement('div');
        wrappers.push(wrapper);
        defaultContent = e.tagName !== 'DIV' || !e.className;
        if (defaultContent) wrapper.classList.add('default-content-wrapper');
      }
      wrappers[wrappers.length - 1].append(e);
    });
    wrappers.forEach((wrapper) => section.append(wrapper));
    section.classList.add('section');
    section.dataset.sectionStatus = 'initialized';
    section.style.display = 'none';

    // Metadados da seção de processo
    // Process section metadata
    const sectionMeta = section.querySelector('div.section-metadata');
    let imageMetaKeys = []; // will be an array of keys that start with 'image-'
    let imageMeta = {}; // Start with an empty object to store image meta data
    if (sectionMeta) {
      const meta = readBlockConfig(sectionMeta);
      // Encontre todas as chaves em meta que começam com 'image-'
      // Find all keys in meta that start with 'image-'
      imageMetaKeys = Object.keys(meta).filter((key) => key.startsWith('image-'));
      imageMeta = imageMetaKeys.reduce((acc, key) => { acc[key] = meta[key]; return acc; }, {});
      Object.keys(meta).forEach((key) => {
        if (key === 'style') {
          const styles = meta.style
            .split(',')
            .filter((style) => style)
            .map((style) => toClassName(style.trim()));
          styles.forEach((style) => section.classList.add(style));
        } else if (key === 'id') {
          section.id = meta[key];
        } else if (!key.startsWith('image-')) {
          // qualquer chave, exceto estilo, id ou 'image-*',
          // é adicionada ao conjunto de dados da seção
          // any key except style, id or 'image-' is added to the section dataset
          section.dataset[toCamelCase(key)] = meta[key];
        }
      });
      sectionMeta.parentNode.remove();
    }

    // converter chaves de metadados 'image-*' em elementos de imagem
    // convert 'image-*' metadata keys into picture elements
    if (imageMetaKeys.length > 0 && sectionMeta) {
      const div = document.createElement('div');
      div.classList.add('bg-images');
      // se o atributo absolute-always estiver presente, adicione a classe absolute-always
      if (section.dataset.absoluteAlways === 'true') {
        div.classList.add('absolute-always');
      }
      imageMetaKeys.forEach((key) => {
        const p = document.createElement('p');

        // Use shared breakpoints for all images
        const breakpoints = RESPONSIVE_IMAGE_BREAKPOINTS;

        const picture = createOptimizedBackgroundImage(imageMeta[key], breakpoints);

        // Set appropriate width and height attributes for the image
        const img = picture.querySelector('img');
        if (img) {
          // Set reasonable default dimensions
          img.setAttribute('width', '1600');
          img.setAttribute('height', '900');
        }

        // ajusta e posição da <img>
        // Apply object-fit and object-position to the <img>
        if (img) {
          if (key === 'object-fit' && imageMeta[key]) {
            img.style.objectFit = imageMeta[key];
          }
          if (key === 'object-position' && imageMeta[key]) {
            img.style.objectPosition = imageMeta[key];
          }
        }

        p.appendChild(picture);
        div.appendChild(p);
      });
      section.prepend(div);
    }
  });

  // Aplicar classes responsivas a imagens de fundo
  // Apply responsive classes to bg-images pictures
  main.querySelectorAll('.section .bg-images').forEach((bgImagesDiv) => {
    prepareResponsivePictures(bgImagesDiv);
  });
}

function autolinkModals(element) {
  element.addEventListener('click', async (e) => {
    const origin = e.target.closest('a');

    if (origin && origin.href && origin.href.includes('/modals/')) {
      e.preventDefault();
      const { openModal } = await import(`${window.hlx.codeBasePath}/blocks/modal/modal.js`);
      openModal(origin.href);
    }
  });
}

/**
 * Cria todos os blocos sintéticos em um elemento contêiner.
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // add auto block, if needed. ref: https://www.aem.live/developer/markup-sections-blocks#auto-blocking
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Verifica se o texto do link é o mesmo que o href, ou se é um embed do Google Maps
 * checks if link text is same as the href, or if it's a Google Maps embed
 * @param {Element} link o elemento link
 * @returns {boolean} verdadeiro ou falso (true or false)
 */
export function linkTextIncludesHref(link) {
  const href = link.getAttribute('href');
  const textcontent = link.textContent;

  return textcontent.includes(href) || textcontent.includes('/maps/embed?');
}

/**
 * Cria blocos de 'embed' quando links não fragmentados são encontrados
 * Builds 'embed' blocks when non-fragment links are encountered
 * @param {Element} main o elemento contêiner
 */
export function buildEmbedBlocks(main) {
  const embedPlatforms = /google|youtu|vimeo|twitter\.com|neusensia\.com.br|mrv\.com.br/;
  main.querySelectorAll('a[href]').forEach((a) => {
    if (embedPlatforms.test(a.href) && linkTextIncludesHref(a)) {
      const embedBlock = buildBlock('embed', a.cloneNode(true));
      a.replaceWith(embedBlock); // substitua o link pelo bloco 'embed'
      decorateBlock(embedBlock);
    }
  });
}

/**
 * Decora todos os botões em um elemento contêiner.
 * Decorates all buttons in a container element.
 * @param {Element} element The container element
 */
export function decorateButtons(element) {
  element.querySelectorAll('a').forEach((a) => {
    a.title = a.title || a.textContent;
    if (a.href !== a.textContent && !a.href.includes('/fragments/')) {
      const up = a.parentElement;
      const twoup = a.parentElement.parentElement;
      if (!a.querySelector('img')) {
        if (up.childNodes.length === 1 && (up.tagName === 'P' || up.tagName === 'DIV')) {
          a.className = 'button'; // default
          up.classList.add('button-container');
        }
        if (
          up.childNodes.length === 1
          && up.tagName === 'STRONG'
          && twoup.childNodes.length === 1
          && twoup.tagName === 'P'
        ) {
          a.className = 'button primary';
          twoup.classList.add('button-container');
        }
        if (
          up.childNodes.length === 1
          && up.tagName === 'EM'
          && twoup.childNodes.length === 1
          && twoup.tagName === 'P'
        ) {
          a.className = 'button secondary';
          twoup.classList.add('button-container');
        }
      }
    }
    // Verifica se o link é um PDF e adiciona o ícone de download
    // Check for PDF links and add download icon
    if (a.href && a.href.toLowerCase().endsWith('.pdf')) {
      a.className = a.className ? `${a.className} icon-download` : 'icon-download';

      // Create and add download icon if it doesn't already exist
      if (!a.querySelector('.download-icon')) {
        const downloadIcon = document.createElement('img');
        downloadIcon.src = '/icons/download.svg';
        downloadIcon.alt = 'Download';
        downloadIcon.className = 'download-icon';
        a.prepend(downloadIcon);
      }
    }
  });
}

// --- INÍCIO: Auxiliar de formatação de tags ---
// --- BEGIN: Tag Formatting Helper ---
/**
 * META names and where to find their tag ids
 * expected structure: { data: [ { tag: "mytag:id1", title: "Nice Title 1" }, ... ] }
 * @type {string[]}
 */

const META_TAG_NAMES = [
  'tags-status',
  'tags-lazer',
  'tags-tipologia',
  'tags-location-card',
  'card-quartos',
];

// Obtém os ids de tags para um nome meta específico como um array
// Gets tag ids for a given meta name as an array
function getTagIdsForMeta(metaName) {
  // Assumes tags are stored as CSV in <meta name="metaName" content="...">
  const metaEl = document.querySelector(`meta[name="${metaName}"]`);
  if (!metaEl || !metaEl.content) return [];
  return metaEl.content.split(',').map((s) => s.trim()).filter(Boolean);
}

function setMetaContent(metaName, value) {
  let meta = document.querySelector(`meta[name="${metaName}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = metaName;
    document.head.appendChild(meta);
  }
  meta.content = value;
}

async function updateTagsMetaFromTaxonomy() {
  const taxonomyMap = await loadTaxonomyMap();
  META_TAG_NAMES.forEach((metaName) => {
    const tagIds = getTagIdsForMeta(metaName);
    if (!tagIds.length) return;
    // Look up each tagId, skip any not found
    const tagTitles = tagIds
      .map((id) => taxonomyMap.get(id))
      .filter(Boolean);
    if (tagTitles.length) {
      setMetaContent(metaName, tagTitles.join(', '));
    }
  });
}
// --- FIM: Auxiliar de formatação de tags ---
// --- END: Tag Formatting Helper ---

// --- INÍCIO: Renderização de dados relacionados ao Card ---
// --- START: Card-related data rendering ---
/**
 * Gets details about imovel pages that are indexed
 * @param {Array} pathNames list of pathNames
 */

export async function lookupImovels(pathNames) {
  const resp = await fetch(IMOVELS_INDEX);
  const json = await resp.json();
  const lookup = {};
  json.data.forEach((row) => {
    lookup[row.path] = row;
    if (row.image && !row.image.startsWith('/default-meta-image.png'));
  });
  window.imovelIndex = {
    data: json.data,
    lookup,
  };

  const result = pathNames.map((path) => window.imovelIndex.lookup[path]).filter((e) => e);
  // eslint-disable-next-line no-console
  console.log('result', result);
  return (result);
}

/**
 * Popula um elemento de cartão com dados de imóvel
 * Populates a card element with imovel data
 * @param {Element} container The container to append the card to
 * @param {Object} cardInfo The card data object
 * @param {Map} [taxonomyMap] Optional pre-loaded taxonomy map to avoid redundant loading
 * @returns {Promise<void>}
 */
export async function populateCard(container, cardInfo = 'card', taxonomyMap = null) {
  const card = document.createElement('li');
  card.className = 'card-imovel-li';

  // Load taxonomy map to get tag titles (only if not provided or not a Map)
  const finalTaxonomyMap = (taxonomyMap instanceof Map) ? taxonomyMap : await loadTaxonomyMap();

  // Helper function to get tag title from tag ID(s)
  const getTagTitle = (tagData) => {
    if (Array.isArray(tagData) && tagData.length > 0) {
      // Get the first tag ID from the array
      const firstTagId = tagData[0];
      return finalTaxonomyMap.get(firstTagId) || firstTagId;
    }
    if (typeof tagData === 'string') {
      // Handle single string value
      return finalTaxonomyMap.get(tagData) || tagData;
    }
    return tagData;
  };

  // Get titles for all tag-based fields
  const locationTitle = getTagTitle(cardInfo.locationCard);
  const availabilityTitle = getTagTitle(cardInfo.availability);
  const cardQuartosTitle = getTagTitle(cardInfo.cardQuartos);

  // Debug logging for availability data
  // eslint-disable-next-line no-console
  console.log('Card path:', cardInfo.path);
  // eslint-disable-next-line no-console
  console.log('cardStatus raw:', cardInfo.cardStatus);
  // eslint-disable-next-line no-console
  console.log('availability raw:', cardInfo.availability);
  // eslint-disable-next-line no-console
  console.log('availabilityTitle processed:', availabilityTitle);

  // Use cardStatus first, then fall back to availabilityTitle
  // Handle case where cardStatus is an empty array or falsy
  const hasValidCardStatus = cardInfo.cardStatus
    && (Array.isArray(cardInfo.cardStatus) ? cardInfo.cardStatus.length > 0 : true);
  const displayAvailability = hasValidCardStatus ? cardInfo.cardStatus : availabilityTitle;

  // eslint-disable-next-line no-console
  console.log('hasValidCardStatus:', hasValidCardStatus);
  // eslint-disable-next-line no-console
  console.log('displayAvailability final:', displayAvailability);

  const createPElement = (iconName, iconAlt, data, className = '') => `<p${className ? ` class="${className}"` : ''}>
  <span class="icon icon-${iconName}">
  <img data-icon-name="${iconName}" src="/icons/${iconName}.svg" alt="${iconAlt}" loading="lazy">
  </span>${data}</p>`;

  // Build card body content dynamically
  const availabilityElement = displayAvailability ? `<p class="availability-title" data-id="${displayAvailability}">${displayAvailability}</p>` : '';
  // eslint-disable-next-line no-console
  console.log('availabilityElement to render:', availabilityElement);
  const cardBodyContent = [
    availabilityElement,
    cardInfo.listingName ? `<p class="listing-name"><strong>${cardInfo.listingName}</strong></p>` : '',
    locationTitle ? createPElement('endereco', 'endereco', locationTitle) : '',
    '<hr>',
    cardQuartosTitle && cardQuartosTitle.length > 0 ? createPElement('dormitorios', 'dormitorios', cardQuartosTitle) : '',
    cardInfo.cardArea && cardInfo.cardArea.length > 0 ? createPElement('area', 'area', cardInfo.cardArea) : '',
    cardInfo.cardHighlight && cardInfo.cardHighlight.length > 0 ? createPElement('estrela', 'estrela', cardInfo.cardHighlight) : '',
  ].filter((content) => content !== '').join('');

  card.innerHTML = `
              <a href="${cardInfo.path}">
              <div class="cards-card-image">
              ${createOptimizedPicture(cardInfo.image, cardInfo.listingName, false, [{ width: '750' }]).outerHTML}
              </div>
              <div class="cards-card-body">
                ${cardBodyContent}
              </div></a>
          `;
  container.append(card);
}

// --- FIM: Renderização de dados relacionados ao Card ---
// --- END: Card-related data rendering ---

export function centerHeadlines() {
  const headlines = document.querySelectorAll('h1 > u, h2 > u, h3 > u, h4 > u, h5 > u, h6 > u');
  headlines.forEach((headline) => {
    headline.parentElement.classList.add('center');
  });
}

export function decorateSpacers(main) {
  const textCodes = main.querySelectorAll('pre > code');
  textCodes.forEach((node) => {
    const spaceCode = node.textContent && node.textContent.match(/espaço-(\d+)\s*/g); // espaço-5
    const lineCode = node.textContent && node.textContent.match(/linha\s*/g); // linha
    if (spaceCode) {
      const match = spaceCode[0].match(/espaço-(\d+)/);
      if (match) {
        const spacerHeight = parseInt(match[1], 10);
        node.parentElement.style.height = `${spacerHeight}px`;
        node.parentElement.className = 'spacer';
        node.innerHTML = ' ';
      }
    }
    if (lineCode) {
      node.parentElement.className = 'line';
      node.parentElement.style.borderBottom = '1px solid rgb(255 255 255 / 50%)';
      node.parentElement.style.marginBottom = '36px';
      node.innerHTML = ' ';
    }
  });
}

/**
 * Builds fragment blocks from links to fragments, but only within columns blocks
 * @param {Element} main The container element
 */
function buildFragmentBlocksInColumns(main) {
  // Find all columns blocks and process fragment links within them
  main.querySelectorAll('.columns').forEach((columnsBlock) => {
    columnsBlock.querySelectorAll('a[href]').forEach((a) => {
      const url = new URL(a.href);
      if (url.pathname.includes('/fragments/')) {
        const block = buildBlock('fragment', url.pathname);
        const parent = a.parentElement;
        a.replaceWith(block);
        decorateBlock(block);
        if (parent.tagName === 'P' && parent.querySelector('.block')) {
          const div = document.createElement('div');
          div.className = parent.className;
          while (parent.firstChild) div.appendChild(parent.firstChild);
          parent.replaceWith(div);
        }
      }
    });
  });
}

/**
 * Adds a hidden H1 element to the main content if no H1 exists and card-title metadata is
 * available.
 * Adiciona um elemento H1 oculto ao conteúdo principal se não existir H1 e houver metadados
 * card-title.
 */
function addCardTitleToMain() {
  const cardTitleMeta = document.querySelector('meta[name="card-title"]');
  if (!cardTitleMeta || !cardTitleMeta.content) {
    return; // Exit if no card-title meta tag found
  }

  const main = document.querySelector('main');
  if (!main) {
    return;
  }

  // Check if H1 already exists in main to avoid duplicates
  const existingH1 = main.querySelector('h1');
  if (existingH1) {
    return; // Exit if H1 already exists
  }

  // Create H1 element with the card-title content
  const h1 = document.createElement('h1');
  h1.textContent = cardTitleMeta.content.trim();

  // Prepend the H1 to the main element
  main.prepend(h1);
}

/**
 * Decora o elemento principal ('main').
 * Decorates the main element.
 * @param {Element} main o elemento 'main'
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  updateTagsMetaFromTaxonomy();
  addCardTitleToMain();
  decorateButtons(main);
  decorateIcons(main);
  decorateLinkedPictures(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  buildEmbedBlocks(main);
  centerHeadlines(main);
  decorateSpacers(main);
  decorateTagsLazer(main);
  buildFragmentBlocksInColumns(main);
}

async function createSkipToMainNavigationBtn() {
  const main = document.querySelector('main');
  main.id = 'main';

  const anchor = document.createElement('a');
  anchor.id = 'skip-to-main-content';
  anchor.className = 'visually-hidden focusable';
  anchor.href = '#main';
  anchor.textContent = 'Ir para o conteúdo';
  document.body.insertBefore(anchor, document.body.firstChild);
}

function setJsonLd(data, name) {
  const existingScript = document.head.querySelector(`script[data-name="${name}"]`);
  if (existingScript) {
    existingScript.innerHTML = JSON.stringify(data);
    return;
  }

  const script = document.createElement('script');
  script.type = 'application/ld+json';

  script.innerHTML = JSON.stringify(data);
  script.dataset.name = name;
  document.head.appendChild(script);
}

/* buildRealEstateSchema moved to blocks/subheader/subheader.js */

/**
 * Builds the schema for the real estate agent
 * Cria o esquema para o agente imobiliário
 * @returns {void}
 */
export function buildRealEstateAgentSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: 'Sensia Incorporadora',
    description: 'Com a Sensia, incorporadora premium da MRV&CO, seu apartamento é único! Venha conhecer e personalize o seu apartamento do seu jeito!',
    url: `${window.location.origin}`,
    logo: 'https://main--meusensia--mrvengenharia.aem.page/media_1e3a81a3479dff877af636e455b278958b916a014.jpg?width=1200&format=pjpg&optimize=medium',
    image: 'https://main--meusensia--mrvengenharia.aem.page/media_1e3a81a3479dff877af636e455b278958b916a014.jpg?width=1200&format=pjpg&optimize=medium',
    telephone: '0900-728-9000',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Av. Raja Gabaglia, 2378 - Estoril',
      addressLocality: 'Belo Horizonte',
      addressRegion: 'MG',
      postalCode: '30494-170',
      addressCountry: 'BR',
    },
    founder: {
      '@type': 'Person',
      name: 'Rubens Menin Teixeira de Souza',
    },
    foundingDate: '1979-10-01',
    parentOrganization: {
      '@type': 'Organization',
      name: 'MRV',
    },
    sameAs: ['https://www.facebook.com/meusensia', 'https://www.instagram.com/meusensia', 'https://www.youtube.com/meusensia'],
  };
  setJsonLd(data, 'realEstateAgent');
}

export function buildWebSiteSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `https://meusensia.com.br${window.location.pathname}`,
        url: `https://meusensia.com.br${window.location.pathname}`,
        name: getMetadata('og:title'),
        description: getMetadata('description'),
        image: getMetadata('og:image'),
        inLanguage: 'pt-BR',
        isPartOf: { '@id': 'https://meusensia.com.br/#website' },
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://meusensia.com.br/?s={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
        publisher: { '@id': 'https://meusensia.com.br/#organization' },
      },
    ],
  };
  setJsonLd(data, 'webPage');
}

export function buildCollectionPageSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `https://meusensia.com.br${window.location.pathname}`,
        url: `https://meusensia.com.br${window.location.pathname}`,
      },
    ],
  };

  setJsonLd(data, 'collectionPage');
}
/**
 * Carrega tudo o que é necessário para atingir LCP.
 * Ref: https://www.aem.live/developer/keeping-it-100#lcp
 * Loads everything needed to get to LCP.
 * @param {Element} doc o elemento contêiner
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  await createSkipToMainNavigationBtn();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* Se a área de trabalho (proxy para conexão rápida) ou fontes já estiverem carregadas,
    carregue fonts.css */
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // então não faça nada (do nothing)
  }
}

/**
 * Carrega tudo que não precisa ser atrasado.
 * ref: https://www.aem.live/developer/keeping-it-100#three-phase-loading-e-l-d
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  autolinkModals(doc);
  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));
  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
  buildRealEstateAgentSchema();
  buildWebSiteSchema();
  if (getMetadata('template') === 'arquivo' || getMetadata('template') === 'loja') {
    buildCollectionPageSchema();
  }
}

/**
 * Carrega tudo o que acontece muito mais tarde, sem impactar a experiência do usuário.
 * Loads everything that happens a lot later, without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // carregue qualquer coisa que possa ser adiada para carregar por último aqui
  // load anything that can be postponed to load last here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
