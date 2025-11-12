// Minimal client script for Arkaios landing page
// Lucide icons are loaded from the CDN. Initialize them on load.

document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.warn('Lucide icon initialization warning:', err);
  }
});

