/**
 * resolveAsset — маппит пути из content.json ('/1.webp') в реальные ('public/1.webp')
 */
const ASSETS_PATH = 'public';
const resolveAsset = (path) => path.startsWith('/') ? `${ASSETS_PATH}${path}` : `${ASSETS_PATH}/${path}`;

/**
 * Рендерит все сцены в контейнер.
 * @param {Object} content Контент из JSON
 * @param {Array} SCENES Конфигурация
 */
export function renderScenes(content, SCENES) {
  const container = document.getElementById('scenes-container');
  if (!container) return;

  container.innerHTML = ''; // Очистка контейнера

  for (let i = 0; i < SCENES.length; i++) {
    const sceneConfig = SCENES[i];
    const sceneData = content.scenes[i];
    
    const sceneEl = document.createElement('div');
    sceneEl.classList.add('scene');
    if (sceneConfig.isIntro) sceneEl.classList.add('scene--intro');
    sceneEl.dataset.scene = sceneConfig.id;
    sceneEl.style.setProperty('--scene-index', i + 1);

    if (sceneConfig.isIntro) {
      // Сцена 1 (интро)
      const titleHtml = sceneData.title.replace(/\n/g, '<br>');
      const textHtml = sceneData.textBlocks[0].replace(/\n/g, '<br>');
      const imagePath = resolveAsset(sceneData.image);
      
      sceneEl.innerHTML = `
        <div class="scene__intro-image">
          <img src="${imagePath}" alt="" loading="eager" fetchpriority="high">
        </div>
        <div class="scene__intro-title">
          <h1 class="scene__title">${titleHtml}</h1>
        </div>
        <div class="scene__intro-text">
          <div class="scene__text-block">${textHtml}</div>
        </div>
      `;
    } else {
      // Сцены 2-6
      const titleHtml = sceneData.title.replace(/\n/g, '<br>');
      const imagePath = resolveAsset(sceneData.image);
      
      let textLayerHtml = '';
      sceneData.textBlocks.forEach(text => {
        textLayerHtml += `<div class="scene__text-block">${text.replace(/\n/g, '<br>')}</div>`;
      });
      
      if (sceneConfig.hasCarousel) {
        textLayerHtml += `<div class="scene__carousel-slot"></div>`;
      }
      
      if (sceneConfig.hasButtons) {
        let buttonsHtml = '';
        content.buttons.forEach(btn => {
          buttonsHtml += createButtonHtml(btn);
        });
        textLayerHtml += `<div class="contact-buttons-container">${buttonsHtml}</div>`;
      }

      sceneEl.innerHTML = `
        <div class="scene__mask">
          <img data-src="${imagePath}" alt="">
        </div>
        <div class="scene__title-layer">
          <h2 class="scene__title">${titleHtml}</h2>
        </div>
        <div class="scene__text-layer">
          ${textLayerHtml}
        </div>
      `;
    }
    
    container.appendChild(sceneEl);
  }
}

/**
 * Генерирует HTML для одной кнопки.
 */
function createButtonHtml(btn) {
  let iconHtml = '';
  
  // Маппинг иконок (trusted контент)
  if (btn.icon === 'telegram') {
    iconHtml = `<img class="contact-btn__icon" src="${resolveAsset('/Telegram_icon.webp')}" alt="Telegram" width="32" height="32">`;
  } else if (btn.icon === 'instagram') {
    iconHtml = `<img class="contact-btn__icon" src="${resolveAsset('/Instagram_icon.webp')}" alt="Instagram" width="32" height="32">`;
  } else if (btn.icon === 'youtube') {
    iconHtml = `<img class="contact-btn__icon" src="${resolveAsset('/youtube_icon.webp')}" alt="YouTube" width="32" height="32">`;
  } else if (btn.icon === 'web') {
    // Встроенный SVG для "Нужен сайт"
    iconHtml = `
      <svg class="contact-btn__icon" width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 2C12 2 8 7 8 12s4 10 4 10M12 2c0 0 4 5 4 10s-4 10-4 10M2 12h20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
  }
  
  return `
    <a class="contact-btn" href="${btn.href}" target="_blank" rel="noopener noreferrer">
      ${iconHtml}
      <span class="contact-btn__label">${btn.label}</span>
    </a>
  `;
}

/**
 * Рендерит аккордеон FAQ.
 * @param {Array} faqData Массив с faq
 */
export function renderFaq(faqData) {
  const section = document.getElementById('faq');
  if (!section) return;

  let itemsHtml = '';
  faqData.forEach((item, index) => {
    itemsHtml += `
      <div class="faq__item">
        <button class="faq__question" aria-expanded="false" aria-controls="faq-content-${index}">
          ${item.question}
        </button>
        <div class="faq__content" id="faq-content-${index}" hidden>
          <p class="faq__answer">${item.answer}</p>
        </div>
      </div>
    `;
  });

  section.innerHTML = `
    <div class="faq__container">
      <h2 class="faq__heading">Вопросы и ответы</h2>
      ${itemsHtml}
    </div>
  `;
}

/**
 * Создаёт Map-кэш всех ключевых DOM-элементов для сцен (оптимизация).
 * @returns {Map} Map<sceneId, SceneElements>
 */
export function buildSceneElementsMap() {
  const sceneElements = new Map();
  const sceneEls = document.querySelectorAll('.scene');
  
  sceneEls.forEach(sceneEl => {
    const id = parseInt(sceneEl.dataset.scene, 10);
    
    // Интро-сцена
    if (sceneEl.classList.contains('scene--intro')) {
      sceneElements.set(id, {
        sceneEl,
        maskEl: null,
        imgEl: sceneEl.querySelector('.scene__intro-image img'),
        titleLayerEl: sceneEl.querySelector('.scene__intro-title'),
        textLayerEl: sceneEl.querySelector('.scene__intro-text'),
        textBlocks: Array.from(sceneEl.querySelectorAll('.scene__text-block')),
        carouselSlotEl: null,
        buttons: []
      });
      return;
    }
    
    // Остальные сцены
    sceneElements.set(id, {
      sceneEl,
      maskEl: sceneEl.querySelector('.scene__mask'),
      imgEl: sceneEl.querySelector('.scene__mask img'),
      titleLayerEl: sceneEl.querySelector('.scene__title-layer'),
      textLayerEl: sceneEl.querySelector('.scene__text-layer'),
      textBlocks: Array.from(sceneEl.querySelectorAll('.scene__text-block')),
      carouselSlotEl: sceneEl.querySelector('.scene__carousel-slot'),
      buttons: Array.from(sceneEl.querySelectorAll('.contact-btn'))
    });
  });
  
  return sceneElements;
}
