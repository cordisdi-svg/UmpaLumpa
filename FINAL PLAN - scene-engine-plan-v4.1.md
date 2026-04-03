# Scene Engine — Технический план v4.1 (ПАТЧ)

---

## 0) Что это за продукт

Это **mobile-first одностраничный сайт**, построенный как
👉 **scroll-driven сцено-система (Scene Engine)**

Пользователь:

* скроллит страницу вниз
* при этом **не просто листает**, а **раскрывает сцены**
* каждая сцена:
  * появляется через **split (маску снизу вверх)**
  * имеет **заголовок (sticky)**
  * имеет **текстовые блоки, которые "доезжают" до верха**

### Ключевое уточнение архитектуры

👉 **Scroll управляет нормализованным прогрессом сцены (0 → 1)**
👉 **Прогресс управляет единым GSAP timeline**

---

## 1) Глобальная модель

### Основные сущности

```
Page
 ├── Scene[1..6]
 └── FAQ (часть сцены 6)
```

### Каждая Scene состоит из:

```
Scene
 ├── ImageLayer   (фон)
 ├── TitleLayer   (заголовок)
 └── TextLayer    (1–N текстблоков)
```

### Поток данных

```
Scroll (px)
  ↓
Scene Progress (0 → 1)
  ↓
Phase Mapping (split / text / UI)
  ↓
GSAP Timeline
```

### Ключевой принцип

👉 **ничего не "появляется" — всё уже существует и двигается через scroll**

* нет fade-ин как основного механизма
* нет event-driven логики
* всё через **progress (0 → 1)**
* GSAP используется как **исполнитель**, а не источник логики

---

## 2) Конфигурация сцен (единственный источник параметров)

Все параметры сцен хранятся в одном объекте. Кодер не хардкодит количество текстблоков или специальное поведение нигде кроме этого конфига:

```js
const SCENES = [
  { id: 1, textBlocks: 0, isIntro: true },
  { id: 2, textBlocks: 2 },
  { id: 3, textBlocks: 1 },
  { id: 4, textBlocks: 2 },
  { id: 5, textBlocks: 0, hasCarousel: true },
  { id: 6, textBlocks: 1, hasButtons: true, hasFaq: true },
];
```

### Ограничение контента

```js
const MAX_TEXT_LINES = 10;
```

👉 Превышение ломает тайминги — контролируется на уровне контента через `validateContent()` (см. раздел 3).

---

## 3) Контент (data-слой)

Весь контент хранится в одном файле `content.json`. Кодер **не хардкодит** текст, изображения или ссылки в компонентах.

Desktop и mobile читают один и тот же `content.json`. Рендерят через разные компоненты — общий только контент, не логика.

### Структура content.json

```json
{
  "scenes": [
    {
      "id": 2,
      "image": "/images/scene-2.webp",
      "title": "Заголовок",
      "textBlocks": ["Первый текст...", "Второй текст..."]
    }
  ],
  "carousel": {
    "slides": [
      { "image": "/images/slide-1.webp", "caption": "..." }
    ]
  },
  "buttons": [
    { "icon": "telegram", "label": "Написать в Telegram", "href": "https://..." }
  ],
  "faq": [
    { "question": "...", "answer": "..." }
  ]
}
```

### Валидация контента (НОВОЕ в v4)

После загрузки `content.json` — до инициализации сцен — вызвать:

```js
function validateContent(content, scenes) {
  scenes.forEach(sceneConfig => {
    if (sceneConfig.isIntro) return;

    const data = content.scenes.find(s => s.id === sceneConfig.id);
    if (!data) throw new Error(`Scene ${sceneConfig.id}: нет данных в content.json`);
    if (!data.image) throw new Error(`Scene ${sceneConfig.id}: отсутствует поле image`);
    if (!data.title) throw new Error(`Scene ${sceneConfig.id}: отсутствует поле title`);

    const expectedBlocks = sceneConfig.textBlocks;
    const actualBlocks   = (data.textBlocks || []).length;
    if (actualBlocks !== expectedBlocks) {
      throw new Error(`Scene ${sceneConfig.id}: ожидается ${expectedBlocks} textBlocks, получено ${actualBlocks}`);
    }

    (data.textBlocks || []).forEach((text, i) => {
      const lineCount = text.split('\n').length;
      if (lineCount > MAX_TEXT_LINES) {
        console.warn(`Scene ${sceneConfig.id}, textBlock[${i}]: ${lineCount} строк > MAX_TEXT_LINES (${MAX_TEXT_LINES})`);
      }
    });
  });
}

// Вызов:
validateContent(content, SCENES);
```

---

## 4) Глобальные константы

Объявляются в самом начале файла. Не разбрасывать по коду:

```js
const SCRUB                = 0.8;     // инерция scroll-анимации
const MAX_TEXT_LINES       = 10;      // ограничение строк в текстблоке
const RESIZE_DEBOUNCE      = 250;     // ms, debounce для resize
const IMAGE_PRELOAD_MARGIN = '200%';  // rootMargin для IntersectionObserver
```

> ⚠️ **v4.1:** Константы `SPLIT_END` и `TEXT_START` из v4.0 **упразднены**.
> Их роль теперь выполняют вычисляемые в `initScene()` значения:
> - `splitRatio = window.innerHeight / sceneHeight` — доля прогресса, за которую открывается маска (≈ 1 экран)
> - `overlapRatio = (window.innerHeight * 0.1) / sceneHeight` — перекрытие split и текста (10% экрана)
> - `textStartPos = splitRatio - overlapRatio` — момент старта текста
> - `blockRatio = block.offsetHeight / sceneHeight` — доля каждого текстблока
>
> Это золотой стандарт GSAP для scroll-движков: математика долей гарантирует
> пиксельную точность при любой высоте viewport и любом объёме контента.

---

## 5) Поведение скролла

### Тип скролла

* используется **нативный scroll браузера**
* НЕ используется scroll hijacking
* анимации привязаны к scroll через **GSAP ScrollTrigger**

### Scrub

Все ScrollTrigger используют `scrub: SCRUB` (0.8).

* `scrub: true` — **запрещён** (мгновенное следование, фазы визуально перескакиваются)
* `scrub: 1`    — **не рекомендован** (слишком долгая инерция, текст "плывёт" после остановки)
* `scrub: 0.8`  — GSAP интерполирует все промежуточные состояния в обе стороны при любой скорости скролла

Менять только через константу `SCRUB` в начале файла, никогда не точечно.

### Быстрый скролл

`scrub: 0.8` гарантирует прохождение всех фаз. Дополнительный clamp скорости не нужен.

---

## 6) DOM-структура сцены (критично)

Каждая сцена 2–6 строится строго по этой структуре:

```html
<div class="scene" data-scene="2">
  <div class="scene__mask">
    <div class="scene__image-layer">
      <img data-src="/images/scene-2.webp" alt="" width="390" height="844">
    </div>
  </div>
  <div class="scene__title-layer">
    <h2>Заголовок</h2>
  </div>
  <div class="scene__text-layer">
    <div class="scene__text-block">...</div>
    <div class="scene__text-block">...</div>
  </div>
</div>
```

```css
.scene {
  position: relative;
  z-index: calc(var(--scene-index) * 100); /* v4: было * 10 */
  contain: layout style;                   /* v4: НОВОЕ — изолирует layout сцены */
  /* ЗАПРЕЩЕНО: transform, overflow: hidden, filter */
}

.scene__mask {
  position: absolute;
  inset: 0;
  clip-path: inset(100% 0 0 0); /* анимируется через GSAP */
  z-index: 0;
}

.scene__title-layer {
  position: sticky;
  top: 32px;
  z-index: 2;
  max-width: 600px;
  margin: 0 auto;
}

.scene__text-layer {
  position: relative;
  z-index: 2;
  padding-top: calc(var(--title-height, 60px) + 64px); /* v4: НОВОЕ — отступ под sticky title */
}

.scene__image-layer img {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  transform: translateY(-50%);
  /* Изображение всегда центрировано, никогда не двигается */
}
```

### CSS-переменная --scene-index

Устанавливается при генерации DOM (или inline-стилем):

```js
sceneEl.style.setProperty('--scene-index', index); // index: 1..6
```

### 👉 КРИТИЧНО v4.1: Явное выставление высоты .scene

Элементы `.scene` используют `position: absolute` для внутренних слоёв.
Без явной высоты браузер не знает, сколько места занимает сцена — нативный скролл не работает.

```js
// После recalcSceneHeights() — обязательно!
sceneEl.style.height = sceneHeight + 'px';
```

Вызывается:
1. При инициализации — после `recalcSceneHeights()` в `main()` (см. раздел 21)
2. При каждом resize — после `recalcSceneHeights()` в обработчике (см. раздел 18)

### Почему clip-path на .scene__mask, а не на .scene

`clip-path` создаёт новый stacking context. Если повесить его на `.scene` — `position: sticky` у заголовка ломается на iOS Safari (известный баг, iOS 16 и ниже).

Решение: `.scene__mask` и `.scene__title-layer` являются siblings. `clip-path` на одном не влияет на sticky другого.

### Запрет на .scene

`transform`, `overflow: hidden`, `filter` — всё это создаёт stacking context и ломает `position: sticky`. Не использовать ни при каких обстоятельствах.

---

## 7) Высота сцен (гибридная модель) — v4

### Формула

v3 использовала фиксированный `textBlocks * 0.5 * innerHeight`.
v4 использует **реальную высоту контента** — это убирает пустые зоны на длинных или коротких текстах:

```js
function getSceneHeight(sceneEl, sceneConfig) {
  if (sceneConfig.isIntro) return window.innerHeight;

  const textHeight = sceneEl.querySelector('.scene__text-layer')?.scrollHeight || 0;

  const BASE  = window.innerHeight;  // минимальная высота для split-фазы
  const SPLIT = window.innerHeight;  // дополнительная высота для полного split

  return BASE + SPLIT + textHeight;
}
```

Результаты кэшируются в массиве `sceneHeights`. Пересчитываются при каждом resize.

### Почему гибрид, а не чисто v3 или чисто реальные размеры

| Подход | Плюс | Минус |
|---|---|---|
| Чистый v3 (формульный) | Стабильный ритм | Не адаптивен к реальному тексту |
| Только реальный размер | Адаптивен | Ломает нормализованный ритм split/text |
| **Гибрид (v4)** | **Стабильный split + адаптивный текст** | — |

`BASE + SPLIT` — фиксированная часть, гарантирует корректное прохождение split-фазы.
`textHeight` — динамическая часть, адаптируется под реальный контент.

### Важно

`getSceneHeight` вызывается **после** рендера DOM, загрузки контента **и ожидания `document.fonts.ready`** — когда `.scene__text-layer` уже имеет финальную высоту с учётом реальных шрифтов (см. раздел 21).

---

## 8) Сцена 1 (интро) — особая

### Визуально

```
[Картинка (приклеена к верху)]
[Текстбокс снизу — статичный, не анимируется]
```

### Поведение

* занимает ровно `window.innerHeight`
* текст НЕ анимируется scroll-анимацией
* сцена прокручивается как единый блок
* при скролле сразу начинается split сцены 2

### HTML

```html
<div class="scene scene--intro" data-scene="1">
  <img src="/images/scene-1.webp" loading="eager" fetchpriority="high" alt="">
  <div class="scene__intro-text">...</div>
</div>
```

Изображение сцены 1 — `loading="eager"` + `fetchpriority="high"`. Единственное изображение на странице без lazy loading.

### Привязка ScrollTrigger сцены 2

```js
// Триггер сцены 2 привязан к низу сцены 1
ScrollTrigger.create({
  trigger: scene1El,
  start: "bottom bottom",
  end: () => `+=${sceneHeights[1]}`,
  scrub: SCRUB,
});
```

`start: "bottom bottom"` — split сцены 2 начинается когда низ сцены 1 касается низа viewport, то есть сразу при начале скролла.
Если при тестировании обнаруживается воспринимаемый лаг — скорректировать на `"bottom bottom-=50px"`.

---

## 9) Единый движок анимации (Timeline) — ОБНОВЛЕНО в v4.1

### Архитектурный принцип

> **Одна сцена = один animation timeline + один will-change ScrollTrigger**

В v3 на каждую сцену создавались два отдельных ScrollTrigger: один для анимации, второй для `will-change`.
В v4.0 всё объединялось в один timeline с `onEnter/onLeave` callbacks.
В v4.1 architecture уточнена: animation timeline содержит только анимацию, `will-change` управляется через **отдельный независимый ScrollTrigger** привязанный к самой сцене (см. раздел 13). Это разделение необходимо: триггер анимации стартует от предыдущей сцены (`prevSceneEl`), а GPU-слои нужно активировать раньше — когда сцена сама приближается к viewport (`sceneEl, top 120%`).

### Структура timeline — v4.1 (математика долей)

```js
function initScene(sceneEl, sceneConfig, prevSceneEl, sceneHeight) {
  const mask = sceneEl.querySelector('.scene__mask');
  const textBlocks = sceneEl.querySelectorAll('.scene__text-block');

  // 👉 Математика долей для Timeline
  const BASE_VH = window.innerHeight;
  // Маска раскрывается ровно за 1 высоту экрана
  const splitRatio = BASE_VH / sceneHeight;
  // Overlap: текст начинает движение за 10% экрана до конца маски
  const overlapRatio = (BASE_VH * 0.1) / sceneHeight;
  const textStartPos = splitRatio - overlapRatio;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: prevSceneEl,
      start: "bottom bottom",
      end: () => `+=${sceneHeight}`,
      scrub: SCRUB,
      // onEnter/onLeave для will-change — НЕ здесь, см. раздел 13
    }
  });

  // Фаза 1: Маска раскрывается ровно за 1 высоту экрана
  tl.to(mask, {
    clipPath: "inset(0% 0 0 0)",
    ease: "none",
    duration: splitRatio  // Относительная доля в таймлайне!
  }, 0);

  // Фаза 2: Точное распределение текста
  let currentPos = textStartPos;

  Array.from(textBlocks).forEach(block => {
    const blockRatio = block.offsetHeight / sceneHeight;
    tl.fromTo(block,
      { y: BASE_VH },  // стартует из-под экрана
      { y: 0, ease: "none", duration: blockRatio },
      currentPos  // Точная позиция на таймлайне
    );
    // Следующий блок стартует ровно когда этот заканчивает свой "путь"
    currentPos += blockRatio;
  });

  // 9.3 UI-элементы (кнопки сцены 6 — см. раздел 16)
  // интегрируются здесь же, если sceneConfig.hasButtons

  return tl;
}
```

### Начальное состояние при монтировании

```js
gsap.set(".scene:not([data-scene='1']) .scene__mask", {
  clipPath: "inset(100% 0 0 0)"
});
```

Вызывается один раз — до инициализации сцен.

### Почему duration нормализованный, не в px

| Подход | Проблема |
|---|---|
| `duration` в px | Синхронизация ломается при разных высотах viewport |
| `duration` в нормализованных долях | Математически гарантирует overlap и фазы при любом устройстве |

❌ **duration в px — критический запрет** (был источником главного бага в промежуточной версии).

---

## 9.1 Split (детально)

```
clip-path: inset(100% 0 0 0)  →  clip-path: inset(0% 0 0 0)
```

* направление: снизу вверх
* диапазон: progress `0 → splitRatio` (≈ `BASE_VH / sceneHeight`)
* строго линейный: `ease: "none"`
* только 1 активный split одновременно
* каждая сцена анимирует только свою маску

---

## 9.2 Текстовые блоки (TextLayer)

### Общая логика

* текст НЕ появляется — нет opacity
* текст существует, но находится ниже viewport
* при скролле поднимается через `transform: translateY`

### Диапазоны — v4.1 (inline в initScene)

> ⚠️ **v4.1:** Функция `getTextAnimRanges()` из v4.0 **упразднена**.
> Логика перенесена непосредственно в `initScene()` и основана на `blockRatio`:
>
> ```
> blockRatio = block.offsetHeight / sceneHeight
> ```
>
> Каждый блок занимает в timeline ровно ту долю прогресса, которая соответствует
> его физической высоте. Блоки расставляются последовательно начиная с `textStartPos`.

Пересчитываются при resize вместе с высотами сцен (через переинициализацию `initScenes()`).

### Взаимодействие блоков

Второй блок начинает движение ровно когда первый заканчивает свой путь — гарантируется последовательным накоплением `currentPos += blockRatio`.

### Overlap с split

`textStartPos = splitRatio - overlapRatio` — намеренный overlap (10% экрана).
Текст начинает движение пока split ещё не закончился.
Это создаёт ощущение непрерывного живого движения, а не ступенчатых переключений.
**Убирать overlap нельзя.**

---

## 9.3 Привязка триггеров (общее правило)

Каждая сцена N привязывает свой timeline-trigger к DOM-элементу сцены N-1:

```js
// Инициализация всех сцен
function initScenes() {
  gsap.set(".scene:not([data-scene='1']) .scene__mask", {
    clipPath: "inset(100% 0 0 0)"
  });

  SCENES.forEach((config, i) => {
    if (config.isIntro) return;

    const sceneEl     = sceneElements.get(config.id).scene;
    const prevSceneEl = sceneElements.get(SCENES[i - 1].id).scene;
    const sceneHeight = sceneHeights[i];

    initScene(sceneEl, config, prevSceneEl, sceneHeight);
  });
}
```

Привязка к DOM-элементу (не к абсолютному offset) гарантирует корректность при изменении контента и пересчёте высот.

---

## 10) Заголовки (TitleLayer)

* появляются вместе со сценой (включены в `scene__mask` → раскрываются split-ом)

  **Уточнение**: заголовок (`scene__title-layer`) находится вне маски — он не обрезается clip-path. Он sticky и появляется сразу как только сцена начинает split. Перекрывается следующей сценой через z-index — это намеренно.

* прилипают к верхней части экрана при скролле внутри сцены

```css
.scene__title-layer {
  position: sticky;
  top: 32px;
  z-index: 2;
  max-width: 600px;
  margin: 0 auto;
}
```

* исчезают когда их перекрывает следующая сцена (не анимируется — просто перекрывается z-index)

---

## 11) Переход между сценами

Следующая сцена начинает split когда предыдущая достигла `progress = 1.0`.

```
Сцена 2: progress = textStartPos → текст начинает движение (split ещё идёт)
Сцена 2: progress = splitRatio   → split завершён, текст продолжает движение
Сцена 2: progress = 1.0          → всё на месте
↓
Сцена 3: начинается split (progress 0 → splitRatio)
Сцена 3: progress = textStartPos → текст сцены 3 начинает движение (overlap)
↓
Сцена 3 перекрывает сцену 2
```

Overlap между split и текстом (`textStartPos` < `splitRatio`) — намеренный. Убирать нельзя. Сцены перекрываются — нет "чистых переключений".

---

## 12) Z-index — v4

```css
.scene { z-index: calc(var(--scene-index) * 100); }
```

v4 изменение: было `* 10`, стало `* 100`. Это создаёт достаточный запас между уровнями сцен для внутренних элементов (заголовки, кнопки, FAQ).

Каждая сцена выше предыдущей. Заголовки не "протекают", split выглядит корректно.

**Запрещено на `.scene`:** `transform`, `overflow: hidden`, `filter`.

---

## 13) will-change (управление GPU-слоями) — ОБНОВЛЕНО в v4.1

> ⚠️ **v4.1:** `will-change` вынесен из callbacks основного timeline в **отдельный независимый ScrollTrigger**.
>
> **Почему**: триггер анимации привязан к `prevSceneEl` (старт — когда предыдущая сцена уходит за нижний край viewport). GPU-слои нужно активировать раньше — когда сама сцена ещё только приближается к viewport (`top 120%`). Два разных момента → два разных триггера.

Статически в CSS не устанавливается.

```js
function applyWillChange(sceneEl) {
  sceneEl.querySelector('.scene__mask').style.willChange = 'clip-path';
  sceneEl.querySelectorAll('.scene__text-block').forEach(el => {
    el.style.willChange = 'transform';
  });
}

function clearWillChange(sceneEl) {
  sceneEl.querySelector('.scene__mask').style.willChange = 'auto';
  sceneEl.querySelectorAll('.scene__text-block').forEach(el => {
    el.style.willChange = 'auto';
  });
}
```

### Отдельный триггер для GPU-слоёв

Добавить в логику `initScene()` после создания основного timeline:

```js
// 👉 Отдельный триггер для GPU-слоёв, привязан к САМОЙ сцене, а не к предыдущей
ScrollTrigger.create({
  trigger: sceneEl,
  start: "top 120%",
  end: "bottom -20%",
  onEnter:      () => applyWillChange(sceneEl),
  onLeave:      () => clearWillChange(sceneEl),
  onEnterBack:  () => applyWillChange(sceneEl),
  onLeaveBack:  () => clearWillChange(sceneEl),
});
```

При переходе между сценами активных GPU-слоёв будет 4–6 (маска + текстблоки текущей и следующей сцены) — это допустимо.

---

## 14) Загрузка изображений

### Сцена 1

```html
<img src="/images/scene-1.webp" loading="eager" fetchpriority="high" alt="">
```

### Сцены 2–6 — lazy через IntersectionObserver

```html
<img data-src="/images/scene-3.webp" alt="" width="390" height="844">
```

```js
// При инициализации — кэшируем DOM-элементы сцен в Map
// Не делать querySelector внутри колбэков — только обращение к Map
const sceneElements = new Map();
document.querySelectorAll('.scene').forEach((el, index) => {
  const id = parseInt(el.dataset.scene);
  el.style.setProperty('--scene-index', id);  // для z-index
  sceneElements.set(id, {
    scene:      el,
    mask:       el.querySelector('.scene__mask'),
    image:      el.querySelector('.scene__image-layer img'),
    textBlocks: el.querySelectorAll('.scene__text-block'),
  });
});

const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const id  = parseInt(entry.target.dataset.scene);
    const img = sceneElements.get(id)?.image;
    if (!img || !img.dataset.src) return;
    img.src         = img.dataset.src;
    img.decoding    = "async";            // v4: НОВОЕ
    img.removeAttribute('data-src');
    imageObserver.unobserve(entry.target);
  });
}, { rootMargin: IMAGE_PRELOAD_MARGIN });

document.querySelectorAll('.scene:not([data-scene="1"])').forEach(scene => {
  imageObserver.observe(scene);
});
```

`rootMargin: '200%'` — запас на два экрана. Необходим из-за большой прокручиваемой высоты сцен.

`img.decoding = "async"` — v4 добавление. Разрешает браузеру декодировать изображение в фоне, не блокируя основной поток.

---

## 15) Карусель (сцена 5)

### Поведение

* горизонтальный свайп управляет каруселью
* вертикальный скролл управляет сценами
* работают параллельно, нет блокировки
* **Swiper не использовать** — конфликтует с touch-action логикой

### Loop: DOM-клонирование

6–10 слайдов — используется DOM-клонирование:

* первые 2 слайда клонируются в конец
* последние 2 слайда клонируются в начало
* мгновенный repositioning только когда карусель в покое
* клоны используют `data-src`, не `src`

### Guard для малого числа слайдов (v4)

```js
function initCarousel(slides) {
  if (slides.length < 3) {
    disableLoop();  // loop требует минимум 3 слайда для корректного repositioning
  }
  // ... остальная инициализация
}
```

### Touch

```css
.carousel { touch-action: pan-x; }
.page     { touch-action: pan-y; }
```

Дополнительная защита для Android Chrome (v4 — обновлённая версия):

```js
let isHorizontalSwipe = null;
let startX, startY;

carousel.addEventListener('touchstart', e => {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
  isHorizontalSwipe = null;
}, { passive: true });

// v4: touchmove — passive: false, чтобы можно было вызвать preventDefault
carousel.addEventListener('touchmove', e => {
  if (isHorizontalSwipe === null) {
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    isHorizontalSwipe = dx > dy && dx > 8;
  }
  // v4: добавлена проверка e.cancelable перед preventDefault
  if (isHorizontalSwipe && e.cancelable) {
    e.preventDefault();   // блокируем вертикальный scroll во время свайпа
  }
}, { passive: false });   // v4: было passive: true — изменено на false
```

**Важно**: `passive: false` на `touchmove` необходимо для возможности вызвать `e.preventDefault()`. Без `e.cancelable` проверки Chrome выбрасывает предупреждение в консоль. Оба изменения взаимосвязаны.

---

## 16) Кнопки (сцена 6) — ИНТЕГРАЦИЯ В TIMELINE (v4)

В v3 кнопки имели отдельный ScrollTrigger с диапазоном `0.15 → 0.55`.
В v4 кнопки **интегрированы в единый timeline сцены 6**.

### HTML

```html
<a class="contact-btn" href="https://t.me/..." target="_blank" rel="noopener noreferrer">
  <span class="contact-btn__icon"><!-- svg --></span>
  <span class="contact-btn__track">
    <span class="contact-btn__label">Написать в Telegram</span>
  </span>
</a>
```

Только `<a>` теги. Никакого JS для навигации.

### CSS начальное состояние

```css
.contact-btn__track {
  transform-origin: left center;
  transform: scaleX(0);
  overflow: hidden;
  display: inline-block;
}
.contact-btn__label {
  opacity: 0;
  white-space: nowrap;
}
```

### Интеграция в timeline сцены 6

```js
// Внутри initScene() для sceneConfig.hasButtons === true
if (sceneConfig.hasButtons) {
  const btnTrack = sceneEl.querySelector('.contact-btn__track');
  const btnLabel = sceneEl.querySelector('.contact-btn__label');

  tl.to(btnTrack, { scaleX: 1, ease: "none" }, 0.15);
  tl.to(btnLabel, { opacity: 1, ease: "none" }, 0.15);
}
```

Позиция `0.15` в timeline = 15% прогресса сцены. Анимация обратима при скролле вверх-вниз.

---

## 17) FAQ

* обычный scroll, аккордеон, можно открыть несколько пунктов
* нет split, нет Scene-логики
* находится ниже всех ScrollTrigger-сцен

### ScrollTrigger.refresh() при toggle

```js
faqItems.forEach(item => {
  item.addEventListener('click', () => {
    toggleFaqItem(item);
    const content = item.querySelector('.faq__content');
    // transitionend надёжнее setTimeout — привязан к реальному завершению анимации
    // guard по propertyName нужен: transitionend стреляет на каждое свойство отдельно
    content.addEventListener('transitionend', function handler(e) {
      if (e.propertyName !== 'height') return;
      ScrollTrigger.refresh();
      content.removeEventListener('transitionend', handler);
    });
  });
});
```

---

## 18) Resize — УСИЛЕННАЯ ВЕРСИЯ (v4.1)

v3 использовала `ScrollTrigger.refresh()`. v4 делает **полную переинициализацию**: kill всех триггеров + пересчёт + повторный init.

```js
let resizeTimer;
let lastWidth = window.innerWidth;

window.addEventListener('resize', () => {
  // v4.1: guard уточнён — порог 2px вместо строгого равенства
  // Строгое равенство (=== lastWidth) не срабатывает при субпиксельном
  // масштабировании на некоторых Android-устройствах
  if (Math.abs(window.innerWidth - lastWidth) < 2) return;
  lastWidth = window.innerWidth;

  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // 1. Убиваем все текущие ScrollTrigger
    ScrollTrigger.getAll().forEach(t => t.kill());

    // 2. Пересчитываем высоты с новыми размерами viewport
    recalcSceneHeights();

    // 3. 👉 КРИТИЧНО v4.1: Явно обновляем высоту DOM-элементов
    SCENES.forEach((config, i) => {
      if (!config.isIntro) {
        sceneElements.get(config.id).scene.style.height = sceneHeights[i] + 'px';
      }
    });


    // 4. Полная переинициализация сцен
    initScenes();
  }, RESIZE_DEBOUNCE);
});
```

### Порядок шагов — критичен

1. `kill()` — обязательно до пересчётов, иначе старые триггеры конфликтуют с новыми
2. `recalcSceneHeights()` — после kill, до установки высот
3. Явное выставление `style.height` — после recalcSceneHeights, до initScenes
4. `initScenes()` — последним, создаёт новые ScrollTrigger с актуальными данными

### Почему 250ms

* Меньше → лишние пересчёты при скролле с адресбаром iOS
* Больше → заметный прыжок при повороте экрана

---

## 19) Desktop версия (отдельная)

👉 НЕ адаптация mobile — ДРУГОЙ интерфейс.

```
Section
 ├── Image (left/right)
 └── Text (opposite side)
```

* обычный scroll, без сложных анимаций
* отдельные компоненты, отдельная логика
* переключение через `matchMedia`, не роутинг
* ни один desktop-компонент не импортирует mobile-логику и наоборот
* общий только `content.json`

---

## 20) prefers-reduced-motion

```js
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReducedMotion) {
  // Убираем scrub-анимации, показываем сцены статично
  SCENES.forEach(config => {
    if (config.isIntro) return;
    const { mask } = sceneElements.get(config.id);
    gsap.set(mask, { clipPath: "inset(0% 0 0 0)" });
  });
} else {
  initScenes();
}
```

---

## 21) Порядок инициализации (полный lifecycle) — ОБНОВЛЕНО в v4.1

```js
async function main() {
  // 1. Загрузка контента
  const content = await fetch('/content.json').then(r => r.json());

  // 2. Валидация
  validateContent(content, SCENES);

  // 3. Рендер DOM
  renderScenes(content, SCENES);

  // 4. Кэширование DOM-элементов
  buildSceneElementsMap();

  // 5. Загрузка изображений (сцена 1 — eager, 2–6 — IntersectionObserver)
  initImageLoading();

  // 6. 👉 КРИТИЧНО v4.1: Ждём полного рендера шрифтов перед расчётом высот!
  // Без этого шага offsetHeight / scrollHeight возвращают значения
  // до применения веб-шрифтов — высоты сцен будут неверными.
  await document.fonts.ready;

  // 7. Пересчёт высот (после рендера и загрузки шрифтов, до init)
  recalcSceneHeights();

  // 8. 👉 КРИТИЧНО v4.1: Явно задаём высоту DOM-элементам
  // Без этого нативному скроллу негде прокручиваться
  // (элементы абсолютно спозиционированы внутри сцены)
  SCENES.forEach((config, i) => {
    if (!config.isIntro) {
      sceneElements.get(config.id).scene.style.height = sceneHeights[i] + 'px';
    }
  });

  // 9. Начальное состояние масок
  gsap.set(".scene:not([data-scene='1']) .scene__mask", {
    clipPath: "inset(100% 0 0 0)"
  });

  // 10. Проверка prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    // статичный показ всех сцен
    SCENES.forEach(config => {
      if (config.isIntro) return;
      const { mask } = sceneElements.get(config.id);
      gsap.set(mask, { clipPath: "inset(0% 0 0 0)" });
    });
  } else {
    // 11. Инициализация сцен (timelines + ScrollTrigger)
    initScenes();
  }

  // 12. FAQ
  initFaq();

  // 13. Resize listener
  initResizeHandler();
}

main();
```

---

## 22) Критические запреты (расширены в v4.1)

❌ `duration` в px в timeline (разрушает нормализованную модель)
❌ stagger без ranges (недетерминировано)
❌ несколько **анимационных** ScrollTrigger на одну сцену (разрешён один отдельный для will-change — см. раздел 13)
❌ scroll hijacking
❌ opacity для текста (только transform: translateY)
❌ `transform`, `overflow: hidden`, `filter` на `.scene`
❌ `clip-path` непосредственно на `.scene`
❌ Swiper для карусели
❌ `scrub: true` или `scrub: 1`
❌ статический `will-change` в CSS
❌ хардкодинг высот сцен и диапазонов текста
❌ `passive: true` на touchmove карусели (блокирует preventDefault)
❌ вызов `recalcSceneHeights()` до `document.fonts.ready` (шрифты меняют высоты блоков)
❌ выставление `style.height` на `.scene` без предшествующего `recalcSceneHeights()`

---

## 23) Инвариантные требования (расширены в v4.1)

✔ timeline нормализован (0 → 1) через математику долей (splitRatio, blockRatio)
✔ одна сцена = один animation timeline + один will-change ScrollTrigger (раздельные триггеры)
✔ split и текст синхронизированы через overlap (`textStartPos = splitRatio - overlapRatio`)
✔ все анимации обратимы — scroll вверх = точная инверсия
✔ нет layout shift
✔ нет "мёртвых зон" при скролле
✔ нет резких скачков
✔ will-change только на активных сценах, auto на неактивных
✔ lifecycle контролируется (kill + recalc + setHeight + initScenes при resize)
✔ все триггеры привязаны к DOM-элементам, не к абсолютным offset
✔ все DOM-элементы сцен кэшированы в Map при инициализации
✔ контент только из `content.json`
✔ validateContent() вызывается до рендера
✔ высоты пересчитываются только после `document.fonts.ready`
✔ `style.height` на `.scene` явно устанавливается после каждого recalcSceneHeights()
✔ высоты и диапазоны пересчитываются при resize

---

## Приложение А: Карта зависимостей (v4.1)

```
content.json
 └── validateContent()
      └── renderScenes()
           └── buildSceneElementsMap()
                └── initImageLoading()
                     └── document.fonts.ready  ← 👉 v4.1: ожидание шрифтов
                          └── recalcSceneHeights()
                               └── scene.style.height = sceneHeights[i]  ← 👉 v4.1
                                    └── initScenes()
                                         └── initScene(sceneEl, config, prevEl, height)
                                              ├── gsap.timeline({ scrollTrigger })
                                              │    ├── Split      (0 → splitRatio)
                                              │    ├── Text       (textStartPos → textStartPos + Σ blockRatio)
                                              │    └── UI/Buttons (0.15 → ...)  [если hasButtons]
                                              └── ScrollTrigger (will-change)  ← 👉 v4.1: отдельный
                                                   ├── trigger: sceneEl (top 120% / bottom -20%)
                                                   └── onEnter/onLeave → applyWillChange / clearWillChange

sceneElements Map (инициализируется один раз)
 ├── mask refs      → split animation
 ├── image refs     → IntersectionObserver (+ decoding async)
 └── textBlock refs → text animation + will-change

resize (debounce 250ms, guard |Δwidth| < 2px)
 └── ScrollTrigger.kill() → recalcSceneHeights() → scene.style.height → initScenes()

FAQ toggle
 └── transitionend (propertyName === 'height')
      └── ScrollTrigger.refresh()

prefers-reduced-motion
 └── статичный показ (без initScenes)
```

---
