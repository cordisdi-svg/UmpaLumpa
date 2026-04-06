/**
 * main.js — точка входа, lifecycle
 * Фаза 0: заглушка. Полный lifecycle появится в Фазе 8.
 *
 * Lifecycle (порядок строгий, по MASTER-PLAN v4.3):
 * 1.  fetchContent()
 * 2.  validateContent(content, SCENES)
 * 3.  renderScenes(content, SCENES)
 * 4.  renderFaq(content.faq)
 * 5.  buildSceneElementsMap()
 * 6.  initImageLoading()
 * 7.  await document.fonts.load(`1em ${CRITICAL_FONT}`).catch(() => {})
 * 8.  recalcSceneHeights()
 * 9.  scene.style.height = sceneHeights[i]
 * 10. gsap.set(".scene__mask", ...)
 * 11. if (prefersReducedMotion) { static } else { initScenes() }
 * 12. initCarousel(content.carousel.slides)
 * 13. initFaq(content.faq)
 * 14. initResizeHandler()
 * 15. ScrollTrigger.refresh()
 */

import { SCENES, CRITICAL_FONT } from './config.js';
import { fetchContent, validateContent } from './content.js';
import { renderScenes, renderFaq, buildSceneElementsMap } from './render.js';
import { initImageLoading } from './images.js';
import { recalcSceneHeights, initScenes, initStaticScenes, initResizeHandler } from './engine.js';

async function main() {
  console.log('[main] Scene Engine v4.3 — Фаза 0/1');

  // 1-2. Контент
  const content = await fetchContent();
  validateContent(content, SCENES);

  // 3-5. Рендер DOM и кэш
  renderScenes(content, SCENES);
  renderFaq(content.faq);
  const sceneElements = buildSceneElementsMap();
  window._sceneElements = sceneElements; // ← добавить эту строку

  // 6. Ленивая загрузка
  initImageLoading();

  // 7. Загрузка шрифтов
  await document.fonts.load(`1em ${CRITICAL_FONT}`).catch(() => {
    console.warn('[main] Шрифт не загрузился, продолжаем fallback-рендеринг');
  });

  // 8 & 9. Пересчёт высот
  recalcSceneHeights(SCENES, sceneElements);

  // 10 & 11. GSAP или Static View
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    initStaticScenes(SCENES, sceneElements);
  } else {
    initScenes(SCENES, sceneElements);
    initResizeHandler(SCENES, sceneElements);
  }

  // (Временно) 15. refresh (полностью реализуется в Фазе 6)
  ScrollTrigger.refresh(true);

  console.log('[main] Фаза 3: Движок GSAP + ScrollTrigger запущен');
}

document.addEventListener('DOMContentLoaded', () => {
  main().catch(err => console.error('[main] Критическая ошибка:', err));
});
