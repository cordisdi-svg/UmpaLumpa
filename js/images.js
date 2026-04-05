import { IMAGE_PRELOAD_MARGIN } from './config.js';

/**
 * Инициализирует ленивую загрузку для background images сцен 2-6.
 * Полностью изолирован, сам ищет нужные узлы через querySelectorAll.
 */
export function initImageLoading() {
  // Сцена 1 — eager, проставляем только decoding = 'async'
  const eagerImg = document.querySelector('.scene--intro img');
  if (eagerImg) eagerImg.decoding = 'async';

  // Сцены 2–6 — lazy loading
  const lazyImgs = document.querySelectorAll('.scene__mask img[data-src]');
  
  if (!lazyImgs.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      
      const img = entry.target;
      img.src = img.dataset.src;
      img.decoding = 'async';
      obs.unobserve(img);
    });
  }, {
    rootMargin: IMAGE_PRELOAD_MARGIN || '200% 0px 200% 0px', // Вертикальная предзагрузка
  });

  lazyImgs.forEach(img => observer.observe(img));
}
