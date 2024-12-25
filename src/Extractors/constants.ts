export const CONSTANTS = {
    MAX_DESCRIPTION_LENGTH: 200,
    CURRENCY_MAP: { 
      '$': 'USD', 
      '£': 'GBP', 
      '€': 'EUR', 
      USD: 'USD', 
      EUR: 'EUR', 
      GBP: 'GBP' 
    },
    SELECTORS: {
      MAIN_CONTENT: [
        'main', 'article', '.main-content', '#main-content', '.entry-content',
        '#productDescription', '#feature-bullets', '.markdown', '[class*="blog"]',
        '#centerCol', '.a-section.a-spacing-none', '.Blog'
      ],
      CLEANUP: [
        'script', 'style', 'svg', 'nav', 'footer', 'header', 'aside',
        '[class*="footer"]', '[class*="nav"]', '[class*="sidebar"]',
        '.ad-container', '.advertisement', '.cookie-consent', '.menu',
        '.tags', '[class*="popup"]', '[class*="related"]', '.related'
      ],
      PRICE: ['.price', '.current-price', '.priceToPay', '.a-price', '#priceblock_ourprice']
    }
  };