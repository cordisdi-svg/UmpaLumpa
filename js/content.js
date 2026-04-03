import { SCENES, MAX_TEXT_LINES } from './config.js';

export async function fetchContent() {
  const res = await fetch('/content.json');
  if (!res.ok) throw new Error(`Ошибка загрузки content.json: ${res.status}`);
  return res.json();
}

export function validateContent(content, scenes) {
  scenes.forEach(sceneConfig => {
    if (sceneConfig.isIntro) return;

    const data = content.scenes.find(s => s.id === sceneConfig.id);
    if (!data) throw new Error(`Scene ${sceneConfig.id}: нет данных в content.json`);
    if (!data.image) throw new Error(`Scene ${sceneConfig.id}: отсутствует image`);
    if (!data.title) throw new Error(`Scene ${sceneConfig.id}: отсутствует title`);

    const expected = sceneConfig.textBlocks;
    const actual   = (data.textBlocks || []).length;
    if (actual !== expected) {
      throw new Error(`Scene ${sceneConfig.id}: ожидается ${expected} textBlocks, получено ${actual}`);
    }

    const titleLines = data.title.split('\n').length;
    if (titleLines > 3) {
      console.warn(`Scene ${sceneConfig.id}: заголовок ${titleLines} строк > 3, возможен перекрыв первого текстблока`);
    }

    (data.textBlocks || []).forEach((text, i) => {
      const lines = text.split('\n').length;
      if (lines > MAX_TEXT_LINES) {
        console.warn(`Scene ${sceneConfig.id}, textBlock[${i}]: ${lines} строк > MAX_TEXT_LINES (${MAX_TEXT_LINES})`);
      }
    });
  });
}
