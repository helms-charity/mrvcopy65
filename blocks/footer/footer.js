import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * Creates a fixed WhatsApp link element with icon
 * @returns {HTMLElement} WhatsApp link element
 */
function createFixedWhatsAppLink() {
  const whatsappLink = document.createElement('a');
  whatsappLink.href = 'https://meusensia.com.br/contato-via-whatsapp/';
  whatsappLink.className = 'whatsapp-fixed';
  whatsappLink.setAttribute('target', '_blank');
  whatsappLink.setAttribute('rel', 'noopener noreferrer');
  whatsappLink.setAttribute('aria-label', 'Entre em contato via WhatsApp');

  const iconSpan = document.createElement('span');
  iconSpan.className = 'icon icon-whatsapp';

  const iconImg = document.createElement('img');
  iconImg.src = '/icons/whatsapp.svg';
  iconImg.alt = 'WhatsApp';
  iconImg.loading = 'lazy';
  iconImg.width = 30;
  iconImg.height = 30;

  iconSpan.appendChild(iconImg);
  whatsappLink.appendChild(iconSpan);

  return whatsappLink;
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/framework/footer';
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  block.append(footer);

  // Add fixed WhatsApp button to body if it doesn't already exist
  const existingWhatsApp = document.querySelector('.whatsapp-fixed');
  if (!existingWhatsApp) {
    const whatsappLink = createFixedWhatsAppLink();
    document.body.appendChild(whatsappLink);
  }
}
