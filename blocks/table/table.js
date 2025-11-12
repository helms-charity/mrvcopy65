/*
 * Table Block
 * Recreate a table
 * https://www.hlx.live/developer/block-collection/table
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 *
 * @param {Element} block
 */
export default async function decorate(block) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const header = !block.classList.contains('no-header');

  [...block.children].forEach((row, i) => {
    const tr = document.createElement('tr');
    moveInstrumentation(row, tr);

    [...row.children].forEach((cell) => {
      const td = document.createElement(i === 0 && header ? 'th' : 'td');

      if (i === 0) td.setAttribute('scope', 'column');
      td.innerHTML = cell.innerHTML;
      tr.append(td);
    });
    if (i === 0 && header) thead.append(tr);
    else tbody.append(tr);
  });
  table.append(thead, tbody);
  block.replaceChildren(table);

  // Handle download behavior and icon visibility for PDF links
  table.querySelectorAll('a[href*=".pdf"]').forEach((link) => {
    const downloadIcon = link.querySelector('.download-icon');
    const isDownloadButton = link.textContent.includes('Baixar');

    if (downloadIcon) {
      downloadIcon.style.display = isDownloadButton ? 'inline' : 'none';
    }

    if (isDownloadButton) {
      link.setAttribute('download', '');
    } else {
      link.removeAttribute('download');
    }
  });
}
