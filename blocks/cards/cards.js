import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation, lookupImovels, populateCard } from '../../scripts/scripts.js';

export default async function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');

  // Pre-identify dynamic cards to batch the lookupImovels call
  const dynamicCards = [];
  const manualCards = [];

  // First pass: categorize cards and collect hrefs
  [...block.children].forEach((row, index) => {
    // Check if this specific card has only links (for dynamic card generation)
    const hasOnlyLinks = (() => {
      // Check that we have at least 2 children
      if (row.children.length < 2) return false;

      // Check that first child is empty
      const firstChild = row.children[0];
      const isFirstChildEmpty = !firstChild.textContent.trim() && firstChild.children.length === 0;

      // Check that second child has only a link
      const secondChild = row.children[1];
      const secondChildLinks = secondChild.querySelectorAll('a');
      const isSecondChildOnlyLink = secondChildLinks.length === 1
        && secondChild.children.length === 1;

      return isFirstChildEmpty && isSecondChildOnlyLink;
    })();

    if (hasOnlyLinks) {
      // Extract href from this card's link
      const secondChild = row.children[1];
      const link = secondChild.querySelector('a');
      let href = link ? link.getAttribute('href') : null;

      // In AEM editor, extract the content path from the full author URL
      if (href && href.includes('/content/meusensia/') && href.endsWith('.html')) {
        try {
          href = href.replace('/content/meusensia', '').replace('.html', '');
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log('Failed to parse author URL:', href);
        }
      }

      if (href) {
        dynamicCards.push({ row, href, originalIndex: index });
      } else {
        manualCards.push({ row, originalIndex: index });
      }
    } else {
      manualCards.push({ row, originalIndex: index });
    }
  });

  // Batch fetch all dynamic card data in one call
  const cardDataMap = new Map();
  if (dynamicCards.length > 0) {
    const hrefs = dynamicCards.map((card) => card.href);
    const allCardData = await lookupImovels(hrefs);
    // const allCardData = hrefs.map((href) => getCardObject(href));

    // Create a map for quick lookup
    allCardData.forEach((cardData, index) => {
      cardDataMap.set(dynamicCards[index].href, cardData);
    });
  }

  // Pre-load taxonomy map once for all dynamic cards
  const { loadTaxonomyMap } = await import('../../scripts/utils.js');
  const taxonomyMap = dynamicCards.length > 0 ? await loadTaxonomyMap() : null;

  // Process all cards in original order
  const allCards = [...dynamicCards, ...manualCards]
    .sort((a, b) => a.originalIndex - b.originalIndex);

  // Process cards sequentially to maintain order
  await allCards.reduce(async (promise, cardInfo) => {
    await promise;

    if (cardInfo.href && cardDataMap.has(cardInfo.href)) {
      // Dynamic card processing
      const cardData = cardDataMap.get(cardInfo.href);
      await populateCard(ul, cardData, taxonomyMap);
    } else {
      // Manually-authored card processing
      const li = document.createElement('li');
      moveInstrumentation(cardInfo.row, li);
      while (cardInfo.row.firstElementChild) li.append(cardInfo.row.firstElementChild);
      [...li.children].forEach((div) => {
        if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
        else div.className = 'cards-card-body';
      });
      ul.append(li);
    }
  }, Promise.resolve());

  // Optimize images in manually-authored cards
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });

  block.textContent = '';
  block.append(ul);
}
