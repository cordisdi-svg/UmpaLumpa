/**
 * config.js — глобальные константы и конфигурация сцен
 *
 * ⚠️ Все пороговые значения анимации берутся ТОЛЬКО отсюда.
 *    Магические числа в engine.js запрещены.
 *
 * MASTER-PLAN v4.3 — эталонные значения.
 */

// ─── Анимация ────────────────────────────────────────────────────────────────

/** Инерция GSAP scrub (чем больше — тем плавнее, но медленнее реакция) */
export const SCRUB = 0.8;

/**
 * Прогресс сцены (0–1) когда clip-path маски полностью открыт (шторка готова).
 * Анимация split: от 0 до SPLIT_END.
 */
export const SPLIT_END = 0.75;

/**
 * Прогресс сцены когда ПЕРВЫЙ текстблок начинает движение снизу.
 * overlap = SPLIT_END - TEXT_START = 0.10 — намеренный overlap split↔text.
 */
export const TEXT_START = 0.65;

// ─── Валидация контента ──────────────────────────────────────────────────────

/** Максимальное количество строк в одном textBlock (warning при превышении) */
export const MAX_TEXT_LINES = 10;

// ─── Производительность ──────────────────────────────────────────────────────

/** Задержка debounce обработчика resize (мс) */
export const RESIZE_DEBOUNCE = 250;

/**
 * rootMargin для IntersectionObserver фоновых изображений (images.js).
 * Вертикальный — предзагрузка за 2 экрана до появления.
 */
export const IMAGE_PRELOAD_MARGIN = '200%';

/**
 * Критический шрифт для document.fonts.load().
 * Должен совпадать с font-family в CSS (без кавычек допустимо).
 */
export const CRITICAL_FONT = 'Inter';

// ─── Конфигурация сцен ───────────────────────────────────────────────────────

/**
 * SCENES — эталонный массив конфигурации всех сцен.
 *
 * id:          порядковый номер сцены (= data-scene атрибут в DOM)
 * textBlocks:  количество .scene__text-block элементов в сцене
 * isIntro:     true — сцена статична, engine.js пропускает её
 * hasCarousel: true — в .scene__text-layer добавляется .scene__carousel-slot
 * hasButtons:  true — в сцену добавляются кнопки контактов (.contact-btn)
 *
 * ⚠️ После изменения массива — обновить content.json и перезапустить сайт.
 */
export const SCENES = [
  { id: 1, textBlocks: 0, isIntro: true },            // 1.webp — статичная интро
  { id: 2, textBlocks: 2 },                            // 2.webp — запросы клиентов
  { id: 3, textBlocks: 1 },                            // 3.webp — подход
  { id: 4, textBlocks: 2 },                            // 4.webp — как работают сессии
  { id: 5, textBlocks: 1, hasCarousel: true },         // 5.webp — цены + карусель
  { id: 6, textBlocks: 1, hasButtons: true },          // p2.webp — контакты
];
