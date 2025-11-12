// add delayed functionality here

window.dataLayer = window.dataLayer || [];

function loadGTM() {
  const gtmScript = document.createElement('script');
  gtmScript.async = true;
  gtmScript.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-N968C43';

  window.dataLayer.push({
    'gtm.start': new Date().getTime(),
    event: 'gtm.js',
  });

  document.head.appendChild(gtmScript);

  gtmScript.onload = () => {
    window.dataLayer.push({
      event: 'gtm_loaded',
      timestamp: new Date().getTime(),
    });
  };
}

loadGTM();
