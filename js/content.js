import { MAX_TEXT_LINES } from './config.js';

/**
 * Загружает content.json с обработкой ошибок.
 * @returns {Promise<Object>} Парсированный JSON
 */
export async function fetchContent() {
  let response;
  try {
    response = await fetch('/content.json');
  } catch (e) {
    showFatalError('Не удалось загрузить контент. Проверьте соединение.');
    throw e;
  }
  
  if (!response.ok) {
    showFatalError(`Ошибка загрузки контента: ${response.status}`);
    throw new Error(`HTTP ${response.status}`);
  }
  
  let content;
  try {
    content = await response.json();
  } catch (e) {
    showFatalError('Контент повреждён (невалидный JSON).');
    throw e;
  }
  
  return content;
}

/**
 * Валидирует структуру контента на соответствие конфигу SCENES.
 * @param {Object} content Данные из JSON
 * @param {Array} SCENES Конфигурация сцен
 */
export function validateContent(content, SCENES) {
  if (!content.scenes || !Array.isArray(content.scenes)) {
    throw new Error('Отсутствует или невалиден массив content.scenes');
  }
  if (content.scenes.length !== SCENES.length) {
    throw new Error(`Несовпадение количества сцен: ожидали ${SCENES.length}, получили ${content.scenes.length}`);
  }

  for (let i = 0; i < SCENES.length; i++) {
    const sceneConfig = SCENES[i];
    const sceneData = content.scenes[i];

    if (!sceneConfig.isIntro) {
      if (typeof sceneData.image !== 'string') throw new Error(`Сцена ${sceneConfig.id}: отсутствует или не строка image`);
      if (typeof sceneData.title !== 'string') throw new Error(`Сцена ${sceneConfig.id}: отсутствует или не строка title`);
    }

    if (!Array.isArray(sceneData.textBlocks)) {
      throw new Error(`Сцена ${sceneConfig.id}: textBlocks должен быть массивом`);
    }
    
    const expectedTextBlocks = sceneConfig.isIntro ? 1 : sceneConfig.textBlocks;
    if (sceneData.textBlocks.length !== expectedTextBlocks) {
      throw new Error(`Сцена ${sceneConfig.id}: ожидали ${expectedTextBlocks} textBlocks, получили ${sceneData.textBlocks.length}`);
    }

    sceneData.textBlocks.forEach((block, idx) => {
      if (typeof block !== 'string') {
        throw new Error(`Сцена ${sceneConfig.id}, текстовый блок ${idx}: должен быть строкой`);
      }
      
      const lineCount = (block.match(/\n/g) || []).length + 1;
      if (lineCount > MAX_TEXT_LINES) {
        console.warn(`Внимание! Сцена ${sceneConfig.id}, блок ${idx}: количество строк (${lineCount}) превышает MAX_TEXT_LINES (${MAX_TEXT_LINES})`);
      }
    });

    if (sceneData.title) {
      const titleLines = (sceneData.title.match(/\n/g) || []).length + 1;
      if (titleLines > 3) {
        console.warn(`Внимание! Заголовок сцены ${sceneConfig.id} содержит более 3 строк (${titleLines}). Возможен title overflow.`);
      }
    }
    
    if (sceneConfig.hasCarousel) {
      if (!content.carousel || !Array.isArray(content.carousel.slides)) {
        throw new Error(`Сцена ${sceneConfig.id} требует карусель, но content.carousel.slides отсутствует или не массив`);
      }
      if (content.carousel.slides.length < 3) {
        throw new Error(`Для корректного loop карусели требуется минимум 3 слайда, получено ${content.carousel.slides.length}`);
      }
    }
    
    if (sceneConfig.hasButtons) {
      if (!content.buttons || !Array.isArray(content.buttons)) {
        throw new Error(`Сцена ${sceneConfig.id} требует кнопки, но content.buttons отсутствует или не массив`);
      }
    }
  }

  if (!content.faq || !Array.isArray(content.faq)) {
    throw new Error('Отсутствует или невалиден массив content.faq');
  }
}

/**
 * Отображает критическую ошибку поверх всего, если приложение не может загрузиться.
 * @param {string} message 
 */
function showFatalError(message) {
  const overlay = document.getElementById('fatal-error');
  if (overlay) {
    overlay.innerHTML = `<div style="padding:2rem;font-family:sans-serif;color:#c0392b;background:#fff;text-align:center;">${message}</div>`;
    overlay.removeAttribute('hidden');
    // Скрываем основной контент
    const main = document.getElementById('scenes-container');
    if (main) main.style.display = 'none';
  } else {
    // Fallback если DOM не инициализирован
    document.body.innerHTML = `<div style="padding:2rem;font-family:sans-serif;color:#c0392b">${message}</div>`;
  }
}
