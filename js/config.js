// ============================================================
// CONFIG.JS — единственный источник констант и конфигурации сцен
// Все значения объявляются здесь. 
// ============================================================

// --- Глобальные константы ---
export const SCRUB                = 0.8;     // инерция scroll-анимации (не менять точечно)
export const MAX_TEXT_LINES       = 10;      // максимум строк в одном textBlock
export const RESIZE_DEBOUNCE      = 250;     // ms, debounce для resize
export const IMAGE_PRELOAD_MARGIN = '200%';  // rootMargin для IntersectionObserver

// --- Конфигурация сцен ---
// Единственный источник правды о структуре каждой сцены.
// Кодер не хардкодит textBlocks, hasCarousel и др. нигде кроме этого массива.

export const SCENES = [
  { id: 1, textBlocks: 0, isIntro: true },
  { id: 2, textBlocks: 2 },
  { id: 3, textBlocks: 1 },
  { id: 4, textBlocks: 2 },
  { id: 5, textBlocks: 1, hasCarousel: true },
  { id: 6, textBlocks: 1, hasButtons: true, hasFaq: true },
];
