import { IMAGE_PRELOAD_MARGIN } from './config.js';
import { sceneElements }        from './render.js';

export function initImageLoading() {
  // Сцена 1 — eager (img уже имеет src, загружается автоматически)
  // Атрибуты loading="eager" и fetchpriority="high" выставляются при рендере

  // Сцены 2–6 — lazy через IntersectionObserver
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const id  = parseInt(entry.target.dataset.scene);
      const img = sceneElements.get(id)?.image;
      if (!img || !img.dataset.src) return;

      img.src      = img.dataset.src;
      img.decoding = 'async'; // декодирование в фоне
      img.removeAttribute('data-src');
      imageObserver.unobserve(entry.target);
    });
  }, { rootMargin: IMAGE_PRELOAD_MARGIN });

  document.querySelectorAll('.scene:not([data-scene="1"])').forEach(scene => {
    imageObserver.observe(scene);
  });
}
