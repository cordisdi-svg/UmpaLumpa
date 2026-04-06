import { SCRUB, TEXT_START, RESIZE_DEBOUNCE } from './config.js';

let sceneHeights = [];
let BASE_VH = 0;
let lastWidth = 0;

let activeAnimations = [];

/**
 * Рассчитывает необходимую высоту сцены по контенту.
 * @param {Object} elCache Ссылка на объект кэша DOM
 * @param {number} baseVH Высота viewport
 * @returns {number} Требуемая физическая высота
 */
export function getSceneHeight(elCache, baseVH) {
  const textHeight = elCache.textLayerEl?.scrollHeight || 0;
  return baseVH * 2 + textHeight;
}

/**
 * Измеряет и выставляет высоты сцен перед инициализацией.
 */
export function recalcSceneHeights(SCENES, sceneElements) {
  BASE_VH = window.innerHeight;
  lastWidth = window.innerWidth;
  sceneHeights = [];

  // 1. Освобождаем layout от старых значений для чистого пересчёта (предотвращает overflow баги при ресайзе)
  SCENES.forEach((cfg) => {
    if (cfg.isIntro) return;
    const elCache = sceneElements.get(cfg.id);
    if (elCache && elCache.sceneEl) {
      elCache.sceneEl.style.height = '';
    }
  });

  // 2. Делаем замеры и выставляем актуальную высоту
  SCENES.forEach((cfg, i) => {
    const elCache = sceneElements.get(cfg.id);

    if (cfg.isIntro) {
      sceneHeights[i] = BASE_VH;
      return;
    }



    const h = getSceneHeight(elCache, BASE_VH);
    sceneHeights[i] = h;
    elCache.sceneEl.style.height = h + 'px';


  });
}

function cleanupGSAP() {
  activeAnimations.forEach(item => {
    if (item.kill) item.kill();
  });
  activeAnimations = [];
}

/**
 * Инициализирует GSAP логику одной сцены.
 */
export function initScene(elCache, sceneHeight) {
  const { sceneEl, maskEl, textBlocks } = elCache;

  // ─── Начальное состояние ──────────────────────────────────────────────────
  if (textBlocks.length) {
    gsap.set(textBlocks, { y: BASE_VH });
  }

  // ─── ТРИГГЕР 1: Шторка ───────────────────────────────────────────────────
  // Дистанция строго = BASE_VH (сцена въезжает снизу).
  // Компенсируем margin-top: -100dvh явным сдвигом, чтобы
  // clip-path начинал открываться при физическом въезде сцены в экран
  // и не перекрывал интро на нулевом скролле.
  const clipTl = gsap.timeline({
    scrollTrigger: {
      trigger: sceneEl,
      start: 'top bottom',
      end: 'top top',
      scrub: SCRUB,
    }
  });

  clipTl.fromTo(
    maskEl,
    { clipPath: 'inset(100% 0 0 0)' },
    { clipPath: 'inset(0% 0 0 0)', ease: 'none' }
  );

  // ─── ТРИГГЕР 2: Текстовые блоки ──────────────────────────────────────────
  // Дистанция = BASE_VH + textHeight.
  // TEXT_START и blockRatio нормализованы относительно этой дистанции.
  const textTriggerDistance = sceneHeight - BASE_VH; // = BASE_VH + textHeight

  const textTl = gsap.timeline({
    scrollTrigger: {
      trigger: sceneEl,
      start: 'top top',      // сцена залипла на viewport
      end: 'bottom bottom',  // конец сцены у нижнего края viewport
      scrub: SCRUB,
    }
  });

  // blockStart в долях прогресса text trigger (0.0 → 1.0)
  let currentStart = TEXT_START; // из config.js, не магическое число

  textBlocks.forEach(block => {
    // blockRatio нормализован к дистанции text trigger
    const blockRatio = block.offsetHeight / textTriggerDistance;

    if (currentStart >= 1) return; // мягкий clamp
    const safeDuration = Math.min(blockRatio, 1 - currentStart);

    textTl.fromTo(
      block,
      { y: BASE_VH },
      { y: 0, ease: 'none', duration: safeDuration },
      currentStart
    );

    // Триггер N+1: старт когда верхний край блока N уходит за top: 0
    // = currentStart + blockRatio (детерминированный шаг из мастерплана)
    currentStart += safeDuration;
  });

  // ─── ТРИГГЕР 3: will-change (без изменений из мастерплана) ───────────────
  const willChangeTrigger = ScrollTrigger.create({
    trigger: sceneEl,
    start: 'top 120%',
    end: 'bottom -20%',
    onEnter: () => maskEl.style.willChange = 'clip-path',
    onEnterBack: () => maskEl.style.willChange = 'clip-path',
    onLeave: () => maskEl.style.willChange = 'auto',
    onLeaveBack: () => maskEl.style.willChange = 'auto',
  });

  activeAnimations.push(clipTl, clipTl.scrollTrigger, textTl, textTl.scrollTrigger, willChangeTrigger);
}

/**
 * Основная точка входа для загрузки всех динамических сцен (Полная анимация).
 */
export function initScenes(SCENES, sceneElements) {
  cleanupGSAP();

  SCENES.forEach((cfg, i) => {
    if (cfg.isIntro) return;
    initScene(sceneElements.get(cfg.id), sceneHeights[i]);
  });
}

/**
 * Точка входа для устройств со сниженным количеством анимаций (Fallback).
 */
export function initStaticScenes(SCENES, sceneElements) {
  cleanupGSAP(); // Защита на случай переключения режимов

  SCENES.forEach(cfg => {
    if (cfg.isIntro) return;
    const elCache = sceneElements.get(cfg.id);
    gsap.set(elCache.maskEl, { clipPath: "inset(0% 0 0 0)" });
    if (elCache.textBlocks.length) {
      gsap.set(elCache.textBlocks, { y: 0 });
    }
  });
}


/* --- Resize Handle (Основы Фазы 6) --- */

let resizeTimer;
let resizeHandler = null;

export function initResizeHandler(SCENES, sceneElements) {
  // Уничтожаем старый хендлер, если он был, для защиты от утечек
  if (resizeHandler) destroyResizeHandler();

  resizeHandler = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Субпиксельная защита для Android + Защита iOS Address Bar drift
      if (Math.abs(window.innerWidth - lastWidth) < 2 && Math.abs(window.innerHeight - BASE_VH) < 2) return;

      recalcSceneHeights(SCENES, sceneElements);
      initScenes(SCENES, sceneElements);
      ScrollTrigger.refresh(true);
    }, RESIZE_DEBOUNCE);
  };

  window.addEventListener('resize', resizeHandler);
}

export function destroyResizeHandler() {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    clearTimeout(resizeTimer);
    resizeHandler = null;
  }
}
