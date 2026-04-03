# 🗺️ MASTER-PLAN — Scene Engine v4.1
### Сайт: Анастасия Швейкина — телесно-ориентированный психолог
> ⚠️ Этот файл — эталонный документ. Не перезаписывать implementation plan'ами.
> После каждого прохода разработки сверяться с этим планом.

---

## Структура сцен (финальная, согласована)

```
SCENES = [
  { id: 1, textBlocks: 0, isIntro: true },           // 1.webp — статичная интро
  { id: 2, textBlocks: 2 },                           // 2.webp — запросы клиентов
  { id: 3, textBlocks: 1 },                           // 3.webp — подход
  { id: 4, textBlocks: 2 },                           // 4.webp — как работают сессии
  { id: 5, textBlocks: 1, hasCarousel: true },        // 5.webp — цены + карусель
  { id: 6, textBlocks: 1, hasButtons: true, hasFaq: true }, // p2.webp — контакты + FAQ
]
```

> ⚠️ ВАЖНО: Сцена 5 имеет `textBlocks: 1` (цены) + `hasCarousel: true` (карусель отзывов).
> Карусель рендерится ПОСЛЕ текстблока внутри сцены 5, но является отдельным независимым компонентом
> (горизонтальный свайп, без вертикального скролла, без GSAP-анимации).
> Карусель не входит в timeline сцены 5 — она монтируется статично в `.scene__carousel-slot`.

---

## Файловая структура проекта

```
/
├── index.html
├── content.json          ← единственный источник контента
├── css/
│   ├── reset.css
│   ├── tokens.css        ← CSS-переменные (цвета, шрифты, отступы)
│   ├── scene.css         ← стили сцен
│   ├── carousel.css      ← стили карусели
│   ├── faq.css           ← стили FAQ
│   └── buttons.css       ← стили кнопок
├── js/
│   ├── main.js           ← точка входа, lifecycle
│   ├── config.js         ← SCENES, глобальные константы
│   ├── content.js        ← fetch + validateContent()
│   ├── render.js         ← renderScenes(), buildSceneElementsMap()
│   ├── engine.js         ← initScenes(), initScene(), recalcSceneHeights()
│   ├── carousel.js       ← initCarousel(), touch-логика
│   ├── faq.js            ← initFaq()
│   └── images.js         ← initImageLoading() (IntersectionObserver)
└── public/
    ├── 1.webp–5.webp     ← фоновые изображения сцен 1–5
    ├── p2.webp           ← фоновое изображение сцены 6
    └── reviews/
        └── 1.webp–6.webp ← слайды карусели
```

---

## Фазы разработки

---

### ФА3А 0 — Scaffolding (каркас)
**Цель:** пустой HTML-каркас + CSS-система + подключение библиотек

#### Задачи:
- [ ] `index.html` — базовая разметка, подключение GSAP + ScrollTrigger через CDN
- [ ] `css/reset.css` — современный CSS reset
- [ ] `css/tokens.css` — CSS-переменные: шрифт (Google Fonts), палитра, отступы
- [ ] `css/scene.css` — базовые стили `.scene`, `.scene__mask`, `.scene__title-layer`, `.scene__text-layer`, `.scene__text-block`, `.scene__image-layer`
- [ ] `js/config.js` — константы `SCRUB`, `MAX_TEXT_LINES`, `RESIZE_DEBOUNCE`, `IMAGE_PRELOAD_MARGIN`; массив `SCENES`

#### Проверка фазы 0:
- Страница открывается в браузере без ошибок в консоли
- CSS-переменные доступны (можно проверить через DevTools)

---

### ФАЗА 1 — Контент и рендер
**Цель:** загрузить content.json, отрендерить DOM-структуру всех сцен

#### Задачи:
- [ ] `js/content.js` — `fetchContent()`, `validateContent(content, SCENES)`

  **Что валидирует `validateContent`:**
  - Для каждой не-intro сцены: наличие `image`, `title`, совпадение количества `textBlocks`
  - Длина заголовка: если заголовок > 3 строк — `console.warn()` (Риск 7)
  - Количество строк в каждом textBlock ≤ `MAX_TEXT_LINES`

- [ ] `js/render.js` — `renderScenes(content, SCENES)`:
  - Сцена 1 (isIntro) — специальная разметка (см. план §8)
  - Сцены 2–6 — стандартная разметка (см. план §6)
  - Сцена 5 — добавить `.scene__carousel-slot` после `.scene__text-layer`
  - Сцена 6 — добавить кнопки контактов (`.contact-btn` × N) из `content.buttons`
  - `buildSceneElementsMap()` — кэш DOM-элементов в `Map`
  - Установка `--scene-index` через `sceneEl.style.setProperty('--scene-index', i + 1)`

- [ ] `js/images.js` — `initImageLoading()`:
  - Сцена 1: `loading="eager" fetchpriority="high"`
  - Сцены 2–6: `data-src`, `IntersectionObserver` с `rootMargin: IMAGE_PRELOAD_MARGIN`
  - `img.decoding = "async"` при загрузке

#### Проверка фазы 1:
- В браузере видна разметка всех 6 сцен
- `validateContent()` бросает ошибку при нарушении structure
- Консоль чистая (нет 404 на изображения до IntersectionObserver)

---

### ФАЗА 2 — CSS сцен (визуальная основа)
**Цель:** сцены корректно расположены на странице, z-index работает, sticky заголовки на месте

#### Задачи:
- [ ] `css/scene.css` — все слои сцены:

  ```css
  /* Запрещено на .scene: transform, overflow: hidden, filter, clip-path */
  .scene {
    position: relative;
    z-index: calc(var(--scene-index) * 100);
    /* contain: layout style — УБРАНО (Риск 1: ломает sticky/scrollHeight в Safari) */
  }

  .scene__mask {
    position: absolute;
    inset: 0;
    clip-path: inset(100% 0 0 0);
    z-index: 0;
  }

  .scene__image-layer img {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    transform: translateY(-50%);
    /* Никогда не двигается — только clip-path маски создаёт эффект появления */
  }

  .scene__title-layer {
    position: sticky;
    top: 32px;
    z-index: 2;
    max-width: 600px;
    margin: 0 auto;
    /* Нет overflow: hidden — sticky работает только вне clip-path контекста */
  }

  .scene__text-layer {
    position: relative;
    z-index: 2;
    padding-top: calc(var(--title-height, 60px) + 64px);
  }
  ```

- [ ] Сцена интро (`.scene--intro`): `img` — 100% высоты viewport, `intro-text` — абсолютный блок снизу
- [ ] z-index проверить: сцена 6 (z-index: 600) перекрывает сцену 5 (z-index: 500) и т.д.

#### Проверка фазы 2:
- При ручном скролле сцены визуально перекрывают друг друга в правильном порядке
- Сцена 1 занимает ровно 100vh
- CSS clip-path на `.scene__mask` создаёт закрытую маску (сцены не видны)

---

### ФАЗА 3 — Высоты сцен + Scene Engine
**Цель:** реализовать вычисление высот, явное выставление `style.height`, инициализацию GSAP

#### Задачи:
- [ ] `js/engine.js` — `getSceneHeight(sceneEl, sceneConfig)`:
  ```
  BASE + SPLIT + textHeight
  BASE = window.innerHeight
  SPLIT = window.innerHeight
  textHeight = sceneEl.querySelector('.scene__text-layer')?.scrollHeight || 0
  ```
  > ⚠️ `getSceneHeight` вызывается только ПОСЛЕ `document.fonts.ready`

- [ ] `recalcSceneHeights()` — пересчёт `sceneHeights[]` массива

- [ ] Явное выставление высоты DOM-элементов:
  ```js
  sceneEl.style.height = sceneHeights[i] + 'px';
  ```

- [ ] `initScene(sceneEl, sceneConfig, prevSceneEl, sceneHeight)`:
  - Математика долей: `splitRatio`, `overlapRatio`, `textStartPos`, `blockRatio`
  - Фаза 1: timeline для clip-path маски (`0 → splitRatio`, `ease: "none"`)
  - Фаза 2: последовательный вывод textBlocks (`textStartPos → ...`, `y: BASE_VH → 0`)
  - **Буфер**: после последнего textBlock остаётся ~20–40% прогресса без анимации — это ожидаемое поведение (зона чтения перед переходом к следующей сцене)
  - Фаза 3: кнопки сцены 6 (`hasButtons` → `tl.to(btnTrack, …, 0.15)`)
  - Отдельный ScrollTrigger для `will-change` (привязан к `sceneEl`, `top 120% / bottom -20%`)

- [ ] `initScenes()`:
  - `gsap.set(".scene:not([data-scene='1']) .scene__mask", { clipPath: "inset(100% 0 0 0)" })`
  - Итерация SCENES, вызов `initScene()` для каждой не-intro сцены

#### Проверка фазы 3:
- Скролл вниз раскрывает сцены через маску (снизу вверх)
- Заголовки sticky — прилипают к верху при прокрутке внутри сцены
- Текстблоки поднимаются снизу при прокрутке
- Скролл вверх точно инвертирует анимацию
- `will-change` в DevTools → Layers активируется только для текущей/следующей сцены

---

### ФАЗА 4 — Карусель (Сцена 5)
**Цель:** горизонтальный свайп отзывов, не конфликтующий с вертикальным скроллом

#### Задачи:
- [ ] `css/carousel.css` — стили карусели (`.carousel`, `.carousel__track`, `.carousel__slide`)
- [ ] `js/carousel.js` — `initCarousel(slides)`:
  - DOM-клонирование для loop (первые 2 → конец, последние 2 → начало)
  - Guard: если `slides.length < 3` → `disableLoop()` (у нас 6 слайдов → loop активен)
  - Клоны используют `data-src`, не `src`
  - Repositioning только когда карусель в покое (не в момент анимации)
- [ ] Touch-логика карусели:
  ```css
  .carousel { touch-action: pan-x; }
  ```
  ```js
  // touchstart: passive: true
  // touchmove: passive: false, с e.cancelable проверкой перед preventDefault
  // isHorizontalSwipe определяется по dx > dy && dx > 8
  ```
- [ ] Lazy-loading слайдов через IntersectionObserver (клоны тоже используют `data-src`)

#### Проверка фазы 4:
- Горизонтальный свайп работает внутри сцены 5
- Вертикальный скролл не блокируется при свайпе карусели
- Loop бесконечный (repositioning без прыжков)
- В консоли нет `Unable to preventDefault inside passive event listener`

---

### ФАЗА 5 — FAQ (Сцена 6)
**Цель:** аккордеон для вопросов/ответов, корректное обновление ScrollTrigger

#### Задачи:
- [ ] `css/faq.css` — стили FAQ (`.faq`, `.faq__item`, `.faq__question`, `.faq__content`)
- [ ] `js/faq.js` — `initFaq()`:
  - Аккордеон с возможностью открыть несколько пунктов одновременно
  - `ScrollTrigger.refresh()` после `transitionend` (с guard по `e.propertyName === 'height'`)
  - Снятие слушателя после отработки (one-time listener)

#### Проверка фазы 5:
- FAQ раскрывается/закрывается плавно
- Открытие нескольких пунктов — работает
- После открытия/закрытия сцены выше не "прыгают"

---

### ФАЗА 6 — Resize + Reduced Motion + ScrollTrigger.refresh()
**Цель:** стабильность при изменении размера окна и поддержка accessibility

#### Задачи:
- [ ] `initResizeHandler()`:
  - Guard: `Math.abs(window.innerWidth - lastWidth) < 2` → skip (защита от субпиксельного масштабирования Android)
  - Debounce: `RESIZE_DEBOUNCE` (250ms)
  - Порядок: `ScrollTrigger.kill()` → `recalcSceneHeights()` → `scene.style.height` → `initScenes()`

- [ ] `prefers-reduced-motion`:
  ```js
  if (prefersReducedMotion) {
    gsap.set(".scene__mask", { clipPath: "inset(0% 0 0 0)" });
    gsap.set(".scene__text-block", { y: 0 });        // текст виден
    gsap.set(".contact-btn__track", { scaleX: 1 });   // кнопки раскрыты
    gsap.set(".contact-btn__label", { opacity: 1 });
  } else {
    initScenes();
  }
  ```

- [ ] `ScrollTrigger.refresh()` в конце `main()` (после всех инициализаций)

#### Проверка фазы 6:
- Поворот экрана → сцены пересчитываются корректно, нет прыжков
- `prefers-reduced-motion: reduce` → все сцены и кнопки видны статично
- `ScrollTrigger.refresh()` вызывается один раз в конце `main()`

---

### ФАЗА 7 — Desktop версия
**Цель:** отдельный интерфейс для desktop через `matchMedia`

#### Задачи:
- [ ] Переключение через `window.matchMedia('(pointer: fine) and (min-width: 1024px)')`
- [ ] Desktop: двухколоночный layout (Image | Text), обычный scroll без GSAP
- [ ] Отдельные CSS-файлы для desktop (`css/desktop.css`)
- [ ] **Правило изоляции:** ни один desktop-компонент не импортирует mobile-логику и наоборот
- [ ] Общий `content.json`, раздельные рендеры

#### Проверка фазы 7:
- На desktop (pointer: fine, ширина ≥ 1024px) — показывается desktop-версия
- На мобильном — показывается mobile Scene Engine
- Нет импортов между mobile/desktop JS

---

### ФАЗА 8 — Полировка и финал
**Цель:** типографика, финальные стили, SEO, production-ready

#### Задачи:
- [ ] Google Fonts — выбор и подключение через `<link>` (preconnect + stylesheet)
- [ ] `css/tokens.css` — итоговая типографика, цветовая схема
- [ ] SEO: `<title>`, `<meta name="description">`, `<meta name="viewport">`, OG-теги
- [ ] Favicon
- [ ] Проверка LCP (сцена 1 — eager + fetchpriority="high")
- [ ] Проверка на реальном iPhone (Safari) — sticky, clip-path, карусель
- [ ] Проверка на Android Chrome — touchmove passive, carousel loop
- [ ] Lighthouse Mobile audit

---

## Lifecycle инициализации (v4.1 — финальный)

```
main()
 │
 ├── 1. fetch('/content.json')
 ├── 2. validateContent(content, SCENES)        ← бросает ошибку при несоответствии
 ├── 3. renderScenes(content, SCENES)           ← DOM всех сцен
 ├── 4. buildSceneElementsMap()                 ← кэш в sceneElements Map
 ├── 5. initImageLoading()                      ← сцена 1 eager, 2–6 IntersectionObserver
 ├── 6. await document.fonts.ready              ← КРИТИЧНО: до расчёта высот
 ├── 7. recalcSceneHeights()                    ← sceneHeights[] массив
 ├── 8. scene.style.height = sceneHeights[i]   ← КРИТИЧНО: скролл без этого не работает
 ├── 9. gsap.set(".scene__mask", ...)           ← начальное состояние масок
 ├── 10. if (prefersReducedMotion) { ... }      ← статичный показ, else initScenes()
 ├── 11. initCarousel(content.carousel.slides)  ← карусель в сцене 5
 ├── 12. initFaq(content.faq)                   ← аккордеон в сцене 6
 ├── 13. initResizeHandler()                    ← debounce 250ms
 └── 14. ScrollTrigger.refresh()                ← финальный пересчёт позиций
```

---

## Конфигурация SCENES — эталон

```js
const SCRUB                = 0.8;
const MAX_TEXT_LINES       = 10;
const RESIZE_DEBOUNCE      = 250;
const IMAGE_PRELOAD_MARGIN = '200%';

const SCENES = [
  { id: 1, textBlocks: 0, isIntro: true },
  { id: 2, textBlocks: 2 },
  { id: 3, textBlocks: 1 },
  { id: 4, textBlocks: 2 },
  { id: 5, textBlocks: 1, hasCarousel: true },
  { id: 6, textBlocks: 1, hasButtons: true, hasFaq: true },
];
```

---

## Критические запреты (выжимка)

| Запрет | Причина |
|---|---|
| `contain: layout style` на `.scene` | Ломает `sticky` и `scrollHeight` в Safari |
| `transform / overflow: hidden / filter` на `.scene` | Создаёт stacking context, ломает `sticky` |
| `clip-path` на `.scene` (не на `.scene__mask`) | Ломает `sticky` на iOS Safari |
| `duration` в px в timeline | Разрушает нормализованную модель |
| `scrub: true` или `scrub: 1` | Перескакивает фазы / слишком долгая инерция |
| `passive: true` на `touchmove` карусели | Блокирует `preventDefault` |
| Swiper | Конфликт с touch-action логикой |
| Вызов `recalcSceneHeights()` до `document.fonts.ready` | Высоты будут неверными |
| Установка `style.height` без `recalcSceneHeights()` | Скролл не работает |
| `opacity` для текста | Только `transform: translateY` |
| `will-change` статически в CSS | Только динамически через JS |

---

## Инварианты (должны выполняться всегда)

- ✔ Один animation timeline + один will-change ScrollTrigger на сцену
- ✔ Timeline нормализован через `splitRatio`, `blockRatio` (без магических чисел)
- ✔ Overlap split↔text через `textStartPos = splitRatio - overlapRatio`
- ✔ "Буфер чтения" в конце каждой сцены — ожидаемое поведение, не баг
- ✔ Все анимации обратимы (scroll вверх = точная инверсия)
- ✔ DOM-элементы сцен кэшированы в `sceneElements Map`
- ✔ Контент только из `content.json`
- ✔ `validateContent()` до рендера
- ✔ `style.height` явно после каждого `recalcSceneHeights()`
- ✔ `ScrollTrigger.refresh()` в конце `main()`

---

## ЗОНЫ РИСКА — статус и комментарии

### ✅ Зашиты в план (применены)

| Риск | Решение |
|---|---|
| **Р1: `contain: layout style`** | Убран из CSS `.scene` — не использовать |
| **Р5: `prefers-reduced-motion`** | Расширен блок: `gsap.set` для mask + textBlocks + buttons/labels |
| **Р6: ScrollTrigger.refresh()** | Добавлен в конец `main()` как шаг 14 |
| **Р2: "Буфер" / пустой хвост timeline** | Задокументировано как ожидаемое поведение ("зона чтения") |

### ⚠️ Мониторинг в процессе (не ломают план, но требуют внимания при тестировании)

**Риск 3: `await document.fonts.ready` — не гарантирует все шрифты**
- Когда может сработать: фаза 3 (расчёт высот), фаза 8 (тест на реальных устройствах)
- Симптом: лёгкий сдвиг текста после инициализации, анимация начинается не с той позиции
- Компенсация: resize + reinit уже есть; при bugs — добавить `requestAnimationFrame` задержку перед `recalcSceneHeights()`
- Дополнительная защита: при тестировании шрифта с `font-display: swap` — рассмотреть `font-display: block` для критически важных шрифтов

**Риск 4: Рассинхрон двойных триггеров (timeline + will-change)**
- Когда может сработать: фаза 3 (инициализация engine), фаза 6 (resize)
- Симптом: `will-change` активирован, анимация ещё не началась — GPU-слои "горят" впустую; или наоборот — анимация идёт без GPU-ускорения
- Компенсация: зоны уже заданы корректно (`top 120% / bottom -20%`)
- При bugs: расширить зону `start: "top 150%"` для раннего включения GPU

**Риск 7: Переполнение заголовка (Title Overflow)**
- Когда может сработать: фаза 1 (валидация контента), фаза 2 (CSS)
- Симптом: длинный заголовок перекрывает первый текстблок или вылезает за sticky-зону
- Компенсация: `console.warn()` в `validateContent()` при заголовке > 3 строк
- При bugs CSS: добавить `max-height` + `overflow: hidden` на `.scene__title-layer`

**Риск 8: "Прыгающий" скролл на Android при открытии FAQ**
- Когда может сработать: фаза 5 (FAQ)
- Симптом: при разворачивании FAQ ScrollTrigger.refresh() вызывает видимый прыжок позиции
- Компенсация: FAQ находится ниже всех scroll-trigger сцен, изменения его высоты не должны влиять на start/end триггеров сцен
- При bugs: вместо `transitionend` попробовать задержку через `setTimeout(ScrollTrigger.refresh, 300)`

---

*Версия мастер-плана: 1.0 | Дата: 2026-04-03 | Основан на: scene-engine-plan-v4.1*
