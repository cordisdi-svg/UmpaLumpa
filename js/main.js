import { gsap }              from 'gsap';
import { ScrollTrigger }     from 'gsap/ScrollTrigger';
import { SCENES }            from './config.js';
import { fetchContent, validateContent } from './content.js';
import { renderScenes, buildSceneElementsMap } from './render.js';
import { initImageLoading }    from './images.js';

// --- GSAP регистрация — здесь, не в config.js ---
// gsap ещё не используется в этой фазе, но регистрацию лучше сделать заранее
gsap.registerPlugin(ScrollTrigger);

async function main() {
  try {
    // 1. Загрузка контента
    const content = await fetchContent();

    // 2. Валидация
    validateContent(content, SCENES);

    // 3. Рендер DOM
    renderScenes(content, SCENES);

    // 4. Кэширование DOM-элементов
    buildSceneElementsMap();

    // 5. Настройка lazy-загрузки изображений
    initImageLoading();

    // 6. Ждём шрифтов (КРИТИЧНО: до расчёта высот)
    await document.fonts.ready;

    // Фазы 3–6 (engine, carousel, faq, resize) — здесь поставим плейсхолдер
    console.log('Фаза 1 завершена успешно');
  } catch (err) {
    console.error('Ошибка инициализации:', err);
  }
}

main();
