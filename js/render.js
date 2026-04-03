import { getIconSvg } from './icons.js';

export const sceneElements = new Map();

function renderIntroScene(data) {
  const el = document.createElement('div');
  el.className = 'scene scene--intro';
  el.dataset.scene = data.id;

  el.innerHTML = `
    <img src="${data.image}" loading="eager" fetchpriority="high" alt="">
    <h2 class="scene__intro-title">${data.title}</h2>
    <div class="scene__intro-text">
      <p class="scene__intro-body">${data.textBlocks && data.textBlocks.length > 0 ? data.textBlocks[0] : ''}</p>
    </div>
  `;
  return el;
}

function renderScene(data, config, index, content) {
  const el = document.createElement('div');
  el.className = 'scene';
  el.dataset.scene = data.id;

  const textBlocksHtml = (data.textBlocks || []).map(text => 
    `<div class="scene__text-block">${text}</div>`
  ).join('');

  let carouselHtml = '';
  if (config.hasCarousel) {
    carouselHtml = `<div class="scene__carousel-slot"></div>`;
  }

  let buttonsHtml = '';
  if (config.hasButtons && content.buttons) {
    const btns = content.buttons.map((btn, i) => {
      const isDisabled = !btn.href || btn.href.trim() === '';
      return `
        <a class="contact-btn ${isDisabled ? 'contact-btn--disabled' : ''}" 
           href="${isDisabled ? '#' : btn.href}" 
           ${isDisabled ? 'aria-disabled="true"' : 'target="_blank" rel="noopener noreferrer"'}
           id="contact-btn-${btn.icon}-${i}">
          <span class="contact-btn__icon">${getIconSvg(btn.icon)}</span>
          <span class="contact-btn__track">
            <span class="contact-btn__label">${btn.label}</span>
          </span>
        </a>
      `;
    }).join('');
    buttonsHtml = `<div class="scene__buttons">${btns}</div>`;
  }

  el.innerHTML = `
    <div class="scene__mask">
      <div class="scene__image-layer">
        <img data-src="${data.image}" alt="" width="390" height="844">
      </div>
    </div>
    <div class="scene__title-layer">
      <h2>${data.title}</h2>
    </div>
    <div class="scene__text-layer">
      ${textBlocksHtml}
      ${carouselHtml}
      ${buttonsHtml}
    </div>
  `;
  return el;
}

function renderFaqSection(faqData) {
  const section = document.createElement('section');
  section.className = 'faq';
  section.id = 'faq';
  
  if (faqData && faqData.length > 0) {
    section.innerHTML = faqData.map(item => `
      <div class="faq__item">
        <button class="faq__question" aria-expanded="false">${item.question}</button>
        <div class="faq__content">
          <p>${item.answer}</p>
        </div>
      </div>
    `).join('');
  }
  
  return section;
}

export function renderScenes(content, scenes) {
  const page = document.getElementById('page');
  
  if (!page) {
    throw new Error('Element containing #page id not found.');
  }

  scenes.forEach((config, i) => {
    const sceneData = content.scenes.find(s => s.id === config.id);
    if (!sceneData) return;
    
    const el = config.isIntro
      ? renderIntroScene(sceneData)
      : renderScene(sceneData, config, i + 1, content);
    page.appendChild(el);
  });

  const faqScene = scenes.find(s => s.hasFaq);
  if (faqScene && content.faq) {
    page.appendChild(renderFaqSection(content.faq));
  }
}

export function buildSceneElementsMap() {
  document.querySelectorAll('.scene').forEach(el => {
    const id = parseInt(el.dataset.scene);
    el.style.setProperty('--scene-index', id);

    sceneElements.set(id, {
      scene:      el,
      mask:       el.querySelector('.scene__mask') || null,
      image:      el.querySelector('.scene__image-layer img') || el.querySelector('img') || null,
      textBlocks: el.querySelectorAll('.scene__text-block')
    });
  });
}
