/**
 * main.js — Анастасия Швейкина Portfolio
 *
 * КАРТА ИЗОБРАЖЕНИЙ: 1.jpg, 2.jpg, 3.jpg, 4.jpg, 5.jpg, p1.jpg
 *
 * СТРУКТУРА СТРАНИЦЫ:
 *   5 реальных секций (.page-section) + отдельная интро-фаза.
 *
 * МОДЕЛЬ ДАННЫХ:
 *   sectionsMeta[]   — описывает каждую из 5 секций (DOM + картинки)
 *   transitionsMeta[]— описывает переходы между сценами:
 *       [0] intro-transition: интро → секция-1 (триггер = scrollY)
 *       [1..4] sec-transitions: секция N → секция N+1 (триггер = lastTB)
 *
 * МЕХАНИКА REVEAL (одинакова для всех переходов):
 *   - Прогресс 0 → front-canvas полностью видим (текущая картинка)
 *   - Прогресс 0→1 → split-line снизу вверх: front clipPath уменьшается
 *   - Прогресс 1 → back-canvas стал «новым фронтом», JS меняет src
 *
 *   Для intro-transition:
 *     progress = clamp(scrollY / REVEAL_SCROLL_PX, 0, 1)
 *
 *   Для sec-transitions:
 *     progress = clamp(-lastTB.getBoundingClientRect().top / REVEAL_SCROLL_PX, 0, 1)
 *     (начинается ровно когда верхний край lastTB достигает верха viewport)
 *
 * TITLE PARKING:
 *   CSS управляет анимацией; JS переключает .title-parked на sticky-canvas.
 *   Парковка: firstTB.top <= 0. Отпарковка при скролле вверх.
 *
 * INTRO OVERLAY:
 *   Фейдит на основе scrollY, не зависит от textbox.
 *   Не пересматривается при скролле вниз после dismiss.
 */

'use strict';

/* ─── CACHED VH ──────────────────────────────────────────────── */
let cachedVH = window.innerHeight;
window.addEventListener('resize', () => {
    const h = window.innerHeight;
    if (Math.abs(h - cachedVH) > 80) cachedVH = h;
}, { passive: true });

/* ─── IMAGE SOURCES ─────────────────────────────────────────── */
const IMG = {
    1: '/1.jpg',
    2: '/2.jpg',
    3: '/3.jpg',
    4: '/4.jpg',
    5: '/5.jpg',
    p1: '/p1.jpg',
};

/* ─── DOM REFS ──────────────────────────────────────────────── */
const introOverlay = document.getElementById('intro-overlay');
const introHint    = introOverlay ? introOverlay.querySelector('.intro-scroll-hint') : null;
const topTrigger   = document.getElementById('top-trigger');
const sections     = Array.from(document.querySelectorAll('.page-section'));

const canvasFront = document.getElementById('canvas-front');
const canvasBack  = document.getElementById('canvas-back');
const frontBlur   = document.getElementById('front-blur');
const frontMain   = document.getElementById('front-main');
const backBlur    = document.getElementById('back-blur');
const backMain    = document.getElementById('back-main');

/* ─── CANVAS STATE ──────────────────────────────────────────── */
let loadedFront = 1;
let loadedBack  = 2;

function setFront(key) {
    if (loadedFront === key) return;
    loadedFront = key;
    const src = IMG[key] !== undefined ? IMG[key] : '';
    frontBlur.src = src;
    frontMain.src = src;
}

function setBack(key) {
    if (key === null || loadedBack === key) return;
    loadedBack = key;
    const src = IMG[key] !== undefined ? IMG[key] : '';
    backBlur.src = src;
    backMain.src = src;
}

/**
 * Устанавливает clip-path на front-canvas.
 * progress 0 = front полностью виден (текущая картинка).
 * progress 1 = front полностью скрыт (видна back-картинка).
 * Split-line движется снизу вверх.
 */
function setReveal(progress) {
    if (progress <= 0) {
        canvasFront.style.clipPath = '';
    } else {
        const pct = Math.min(1, progress) * 100;
        canvasFront.style.clipPath = `inset(0 0 ${pct.toFixed(2)}% 0)`;
    }
}

/* ─── SECTION METADATA ──────────────────────────────────────── */
/*
 * Только реальные DOM-секции. Нет виртуального intro-entry —
 * intro описывается через transitionsMeta[0] (isIntro=true).
 *
 * Поля:
 *   el        — DOM-элемент секции
 *   img       — ключ картинки секции (начало сцены)
 *   nextImg   — ключ следующей картинки (null = финальная секция)
 *   firstTB   — [data-first-textbox] элемент
 *   lastTB    — [data-last-textbox] элемент
 *   stickyEl  — .section-sticky-canvas
 *   inviteEl  — .scroll-invite
 */
let sectionsMeta = [];

function parseImgKey(str) {
    if (str === null || str === undefined) return null;
    const n = parseInt(str, 10);
    return isNaN(n) ? str : n;
}

function buildSectionsMeta() {
    sectionsMeta = sections.map(sec => ({
        el:             sec,
        img:            parseImgKey(sec.dataset.img),
        nextImg:        parseImgKey(
                            (sec.dataset.nextImg === 'none' || sec.dataset.nextImg === undefined)
                                ? null
                                : sec.dataset.nextImg
                        ),
        firstTB:        sec.querySelector('[data-first-textbox]'),
        lastTB:         sec.querySelector('[data-last-textbox]'),
        stickyEl:       sec.querySelector('.section-sticky-canvas'),
        titleEl:        sec.querySelector('.section-title'),
        inviteEl:       sec.querySelector('.scroll-invite'),
        titleParked:    false,
        inviteHidden:   false,
    }));
}

/* ─── TRANSITION METADATA ───────────────────────────────────── */
/*
 * Каждый transition — это переход между двумя сценами.
 *
 * Поля:
 *   fromSection     — sectionsMeta-запись, откуда уходим (null для intro)
 *   toSection       — sectionsMeta-запись, куда приходим
 *   fromImg         — ключ картинки, которая клипируется (front)
 *   toImg           — ключ картинки, которая появляется (back)
 *   triggerEl       — элемент-триггер (lastTB fromSection); null для intro
 *   isIntro         — true только для первого перехода (интро → секция-1)
 *
 * Логика построения:
 *   [0] intro → sec-1: fromSection=null, fromImg=1, toImg=sec[0].nextImg (= 2)
 *                       интро всегда img 1, первая content-сцена — img 2
 *   [1] sec-1 → sec-2: fromSection=sec[0], fromImg=sec[0].img, toImg=sec[0].nextImg
 *   ...и т.д. пока у секции есть nextImg
 */
let transitionsMeta = [];

function buildTransitionsMeta() {
    transitionsMeta = [];

    // Переход 0: интро (img 1) → первая content-сцена (img = sectionsMeta[0].img).
    // Прогресс = scrollY / REVEAL_SCROLL_PX.
    // toImg берётся из data-img секции, а НЕ из data-next-img,
    // чтобы не дублировать первый переход с обычными sec-transitions.
    if (sectionsMeta.length > 0) {
        transitionsMeta.push({
            fromSection: null,
            toSection:   sectionsMeta[0],
            fromImg:     1,
            toImg:       sectionsMeta[0].img,  // = 2 после обновления HTML
            triggerEl:   null,
            isIntro:     true,
        });
    }

    // Переходы sec[i] → sec[i+1]: fromImg=sec[i].img, toImg=sec[i+1].img.
    // triggerEl = sec[i].lastTB.
    // Нет зависимости от data-next-img — только от img-ключей соседних секций.
    for (let i = 0; i < sectionsMeta.length - 1; i++) {
        transitionsMeta.push({
            fromSection: sectionsMeta[i],
            toSection:   sectionsMeta[i + 1],
            fromImg:     sectionsMeta[i].img,
            toImg:       sectionsMeta[i + 1].img,
            triggerEl:   sectionsMeta[i].lastTB,
            isIntro:     false,
        });
    }
}

/* ─── ПАРАЛЛАКС ─────────────────────────────────────────────── */
/*
 * Мягкий вертикальный сдвиг front-изображения.
 * Амплитуда PARALLAX_PX должна оставаться небольшой.
 *
 * Во время intro-transition параллакс отключён (progress=0),
 * чтобы не конфликтовать со split-reveal.
 * Во время sec-transition параллакс привязан к fromSection-секции.
 * На back-image параллакс не применяется.
 */
const PARALLAX_PX = 28;

function applyParallax(imgEl, progress) {
    if (!imgEl) return;
    const shift = progress * PARALLAX_PX;
    imgEl.style.transform = 'translateY(' + shift.toFixed(1) + 'px)';
}

/**
 * Вычисляет прогресс параллакса для секции.
 * Возвращает число 0..1 (сколько секции прокручено в viewport).
 */
function sectionParallaxProgress(secMeta) {
    if (!secMeta || !secMeta.el) return 0;
    const r = secMeta.el.getBoundingClientRect();
    const scrolledIn = -r.top;
    const maxScroll  = Math.max(1, secMeta.el.offsetHeight - cachedVH);
    return Math.min(1, Math.max(0, scrolledIn / maxScroll));
}

/* ─── INCOMING TEXT HANDOFF ─────────────────────────────────── */
/*
 * При reveal-переходе:
 *   firstTB  входящей секции анимируется снизу (opacity + translateY).
 *   titleEl  входящей секции следует за split-line (top = (1-p)*cachedVH).
 *
 * firstTB:
 *   Диапазон revealProgress 0.7 → 1.0 → incomingTextProgress 0 → 1.
 *   Стартовый сдвиг = расстояние от текущей позиции firstTB до нижнего
 *   края viewport, захваченное один раз в начале анимации (incomingTextProgress > 0).
 *
 * titleEl:
 *   top = max(0, (1-revealProgress) * cachedVH) → ехать вверх вслед за split-line.
 *   При revealProgress=1 (top=0): force-park через .title-parked.
 *
 * Inline-стили firstTB очищаются через clearIncomingEntry().
 * Inline-стили titleEl очищаются при force-park.
 */

function applyIncomingEntry(secMeta, progress, startShift) {
    if (!secMeta || !secMeta.firstTB) return;
    const shift = startShift !== undefined ? startShift : 0;
    const ty    = ((1 - progress) * shift).toFixed(1);
    secMeta.firstTB.style.opacity    = progress.toFixed(3);
    secMeta.firstTB.style.transform  = 'translateY(' + ty + 'px)';
    secMeta.firstTB.style.transition = 'none';
}

function clearIncomingEntry(secMeta) {
    // Очищает только firstTB; titleEl управляется title-split-follow.
    if (!secMeta || !secMeta.firstTB) return;
    secMeta.firstTB.style.opacity    = '';
    secMeta.firstTB.style.transform  = '';
    secMeta.firstTB.style.transition = '';
}

/**
 * Анимирует заголовок входящей секции вслед за split-line.
 * revealProgress 0→1: top идёт от cachedVH до 0.
 * При revealProgress=1 выполняет force-park (добавляет .title-parked).
 */
function applyTitleSplitFollow(secMeta, revealProgress) {
    if (!secMeta || !secMeta.titleEl || !secMeta.stickyEl) return;
    const splitTop = Math.max(0, (1 - revealProgress) * cachedVH);
    const t        = secMeta.titleEl;
    if (revealProgress >= 1) {
        // Reveal завершён — паркуем заголовок через CSS-класс.
        t.style.top        = '';
        t.style.bottom     = '';
        t.style.transition = '';
        if (!secMeta.titleParked) {
            secMeta.titleParked = true;
            secMeta.stickyEl.classList.add('title-parked');
        }
    } else {
        // Следуем за split-line.
        t.style.top        = splitTop.toFixed(0) + 'px';
        t.style.bottom     = 'auto';
        t.style.transition = 'none';
    }
}

/**
 * Сбрасывает title-split-follow стили (при скролле вверх / выходе из transition).
 * Сам парк/анпарк потом управляется updateTitle().
 */
function clearTitleSplitFollow(secMeta) {
    if (!secMeta || !secMeta.titleEl) return;
    const t = secMeta.titleEl;
    t.style.top        = '';
    t.style.bottom     = '';
    t.style.transition = '';
}

/* ─── TITLE PARKING ─────────────────────────────────────────── */
/*
 * CSS управляет анимацией; JS только переключает .title-parked.
 * Парковка: firstTB.top <= 0 (textbox вышел за верх viewport).
 * Отпарковка: firstTB.top > PARK_THRESHOLD (гистерезис для скролла вверх).
 */
const PARK_THRESHOLD = cachedVH * 0.85;

function updateTitle(meta) {
    if (!meta.firstTB || !meta.stickyEl) return;
    const tbTop = meta.firstTB.getBoundingClientRect().top;
    if (!meta.titleParked && tbTop <= 0) {
        meta.titleParked = true;
        meta.stickyEl.classList.add('title-parked');
    } else if (meta.titleParked && tbTop > PARK_THRESHOLD) {
        meta.titleParked = false;
        meta.stickyEl.classList.remove('title-parked');
    }
}

/* ─── SCROLL INVITE ─────────────────────────────────────────── */
function updateScrollInvite(meta) {
    if (!meta.inviteEl) return;
    const tbTop = meta.firstTB ? meta.firstTB.getBoundingClientRect().top : 999;
    if (!meta.inviteHidden && tbTop < cachedVH * 0.5) {
        meta.inviteHidden = true;
        meta.inviteEl.classList.add('is-hidden');
    }
    if (meta.inviteHidden && tbTop > cachedVH * 0.9) {
        meta.inviteHidden = false;
        meta.inviteEl.classList.remove('is-hidden');
    }
}

/* ─── INTRO OVERLAY ─────────────────────────────────────────── */
/*
 * Интро-оверлей видим только в верхней зоне страницы:
 *   scrollY < INTRO_FADE_END   → полностью видим (opacity 1)
 *   INTRO_FADE_END < scrollY   → фейдит, затем dismiss
 *
 * После dismiss не возвращается, пока пользователь не вернётся
 * почти в самый верх (scrollY <= INTRO_RESTORE).
 */
const INTRO_FADE_START = 0;
const INTRO_FADE_END   = cachedVH * 0.4;
const INTRO_RESTORE    = cachedVH * 0.02;

let introDismissed = false;

function updateIntro() {
    if (!introOverlay) return;
    const sy = window.scrollY;

    if (introDismissed) {
        if (sy <= INTRO_RESTORE) {
            introDismissed = false;
            introOverlay.style.opacity = '1';
            if (introHint) introHint.style.opacity = '0.7';
        }
        return;
    }

    let opacity;
    if (sy <= INTRO_FADE_START) {
        opacity = 1;
    } else if (sy >= INTRO_FADE_END) {
        opacity = 0;
        introDismissed = true;
    } else {
        opacity = 1 - (sy - INTRO_FADE_START) / (INTRO_FADE_END - INTRO_FADE_START);
    }

    introOverlay.style.opacity = opacity.toFixed(3);

    if (introHint) {
        const hintFrac = Math.max(0, 1 - (sy - INTRO_FADE_START) / ((INTRO_FADE_END - INTRO_FADE_START) * 0.4));
        introHint.style.opacity = (hintFrac * 0.7).toFixed(3);
    }

    if (topTrigger) topTrigger.classList.toggle('is-visible', introDismissed);
}

/* ─── ОСНОВНОЙ ФРЕЙМ ────────────────────────────────────────── */
// Дистанция прокрутки, на которой разворачивается весь split-reveal
const REVEAL_SCROLL_PX = cachedVH * 0.80;

let ticking = false;

function onFrame() {
    ticking = false;

    // ── Интро-оверлей ──
    updateIntro();

    // ── Transition-walk: определяем активный transition и прогресс reveal ──
    //
    // Перебираем transitionsMeta по порядку.
    // Для каждого transition вычисляем revealProgress:
    //   - isIntro: прогресс = scrollY / REVEAL_SCROLL_PX
    //   - обычный: прогресс = -triggerEl.getBoundingClientRect().top / REVEAL_SCROLL_PX
    //
    // Если progress < 1 → этот transition активен, break.
    // Если progress >= 1 → reveal завершён, activeImg = toImg, продолжаем.
    // После цикла: activeImg = картинка стабильной сцены.

    let activeImg    = 1;          // начальное состояние — всегда img 1 (интро)
    let revealProgress = 0;
    let activeTransition = transitionsMeta.length > 0 ? transitionsMeta[0] : null;

    for (let i = 0; i < transitionsMeta.length; i++) {
        const tr = transitionsMeta[i];

        let progress;
        if (tr.isIntro) {
            progress = Math.min(1, Math.max(0, window.scrollY / REVEAL_SCROLL_PX));
        } else {
            if (!tr.triggerEl) continue;  // нет триггера → пропускаем
            const trigTop = tr.triggerEl.getBoundingClientRect().top;
            progress = Math.min(1, Math.max(0, -trigTop / REVEAL_SCROLL_PX));
        }

        if (progress < 1) {
            // Этот transition активен прямо сейчас
            activeTransition = tr;
            activeImg        = tr.fromImg;
            revealProgress   = progress;
            break;
        }

        // Transition завершён — activeImg становится toImg
        activeImg        = tr.toImg;
        activeTransition = (i + 1 < transitionsMeta.length) ? transitionsMeta[i + 1] : null;
        revealProgress   = 0;
        // Продолжаем: возможно следующий transition тоже завершён
    }

    // Определяем back-img: toImg активного transition, или сам activeImg если нет перехода
    const backImg = (activeTransition !== null) ? activeTransition.toImg : activeImg;

    // ── Обновляем canvas ──
    setFront(activeImg);
    setBack(backImg !== null ? backImg : activeImg);
    setReveal(revealProgress);

    // ── Параллакс на front-image ──
    //
    // Интро-transition: параллакс выключен (не конфликтует со split-reveal).
    // Sec-transition (reveal идёт): параллакс по fromSection.
    // Стабильная сцена (reveal=0): параллакс по toSection предыдущего (= fromSection текущего).
    //
    // «Текущая секция для параллакса» — всегда fromSection активного transition,
    // кроме случая когда все transitions завершены (конец страницы).
    let parallaxSec = null;
    if (activeTransition !== null) {
        if (!activeTransition.isIntro) {
            parallaxSec = activeTransition.fromSection;
        }
        // isIntro → parallaxSec остаётся null → параллакс = 0
    } else {
        // За пределами всех transitions (конец страницы) — берём последнюю секцию
        parallaxSec = sectionsMeta.length > 0 ? sectionsMeta[sectionsMeta.length - 1] : null;
    }

    if (parallaxSec) {
        applyParallax(frontMain, sectionParallaxProgress(parallaxSec));
    } else {
        // Интро или нет секции — сбрасываем параллакс без скачка
        frontMain.style.transform = 'translateY(0px)';
    }
    backMain.style.transform = 'none';

    // ── Incoming text handoff ──
    //
    // firstTB: появляется снизу в диапазоне revealProgress 0.7→1.0.
    //   Стартовый сдвиг = max(0, cachedVH - firstTB.top), снимается один раз
    //   при первом ненулевом incomingTextProgress и кэшируется в transition._tbShift.
    //
    // titleEl: ехать за split-line с top=(1-revealProgress)*cachedVH.
    //   Force-park при revealProgress=1.
    let incomingSec = null;
    if (activeTransition && activeTransition.toSection) {
        incomingSec = activeTransition.toSection;
        const itp = Math.min(1, Math.max(0, (revealProgress - 0.7) / 0.3));

        // firstTB: кэшируем стартовый сдвиг при первом появлении
        if (itp > 0 && activeTransition._tbShift === undefined) {
            const tbTop = incomingSec.firstTB
                ? incomingSec.firstTB.getBoundingClientRect().top
                : cachedVH;
            activeTransition._tbShift = Math.max(0, cachedVH - tbTop);
        }
        const shift = (itp > 0) ? (activeTransition._tbShift || 0) : 0;
        applyIncomingEntry(incomingSec, itp, shift);

        // titleEl: следует за split-line
        applyTitleSplitFollow(incomingSec, revealProgress);

        // Очищаем стили остальных секций
        sectionsMeta.forEach(function (m) {
            if (m !== incomingSec) {
                clearIncomingEntry(m);
                clearTitleSplitFollow(m);
            }
        });
    } else {
        sectionsMeta.forEach(function (m) {
            clearIncomingEntry(m);
            clearTitleSplitFollow(m);
        });
    }

    // ── Title parking + scroll invite для видимых секций ──
    //
    // Пропускаем incomingSec пока идёт reveal (её title управляется split-follow).
    sectionsMeta.forEach(function (meta) {
        const r = meta.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > cachedVH * 1.5) return;
        if (meta === incomingSec) return;
        updateTitle(meta);
        updateScrollInvite(meta);
    });
}

function requestTick() {
    if (!ticking) {
        ticking = true;
        requestAnimationFrame(onFrame);
    }
}

window.addEventListener('scroll', requestTick, { passive: true });

/* ─── REVIEWS CAROUSEL ──────────────────────────────────────── */
(function initReviews() {
    var track = document.getElementById('reviews-track');
    var dots  = Array.from(document.querySelectorAll('.reviews-dots .dot'));
    if (!track) return;

    var total = track.querySelectorAll('.review-slide').length;
    var current = 0, startX = 0, dragDX = 0, dragging = false;

    function goTo(idx, animate) {
        if (animate === undefined) animate = true;
        current = Math.max(0, Math.min(total - 1, idx));
        var w = track.parentElement.offsetWidth;
        track.style.transition = animate ? '' : 'none';
        track.style.transform  = 'translateX(' + (-current * w) + 'px)';
        dots.forEach(function (d, i) { d.classList.toggle('dot--active', i === current); });
    }

    function dragStart(x) { dragging = true; startX = x; dragDX = 0; track.classList.add('is-dragging'); }
    function dragMove(x)  {
        if (!dragging) return;
        dragDX = x - startX;
        track.style.transition = 'none';
        track.style.transform  = 'translateX(' + (-current * track.parentElement.offsetWidth + dragDX) + 'px)';
    }
    function dragEnd() {
        if (!dragging) return;
        dragging = false;
        track.classList.remove('is-dragging');
        if      (dragDX < -50) goTo(current + 1);
        else if (dragDX >  50) goTo(current - 1);
        else                   goTo(current);
    }

    track.addEventListener('touchstart', function (e) { dragStart(e.touches[0].clientX); },     { passive: true });
    track.addEventListener('touchmove',  function (e) { dragMove(e.touches[0].clientX); },      { passive: true });
    track.addEventListener('touchend',   function ()  { dragEnd(); },                           { passive: true });
    track.addEventListener('mousedown',  function (e) { e.preventDefault(); dragStart(e.clientX); });
    window.addEventListener('mousemove', function (e) { if (dragging) dragMove(e.clientX); });
    window.addEventListener('mouseup',   function ()  { dragEnd(); });
    dots.forEach(function (d) { d.addEventListener('click', function () { goTo(parseInt(d.dataset.slide, 10)); }); });
    goTo(0, false);
})();

/* ─── FAQ ───────────────────────────────────────────────────── */
(function initFaq() {
    document.querySelectorAll('.faq-question').forEach(function (btn) {
        var ans = btn.nextElementSibling;
        btn.addEventListener('click', function () {
            var open = btn.getAttribute('aria-expanded') === 'true';
            document.querySelectorAll('.faq-question').forEach(function (b) {
                b.setAttribute('aria-expanded', 'false');
                b.nextElementSibling.style.maxHeight = '0';
            });
            if (!open) {
                btn.setAttribute('aria-expanded', 'true');
                ans.style.maxHeight = ans.scrollHeight + 'px';
            }
        });
    });
})();

/* ─── INIT ──────────────────────────────────────────────────── */
window.addEventListener('load', function () {
    buildSectionsMeta();
    buildTransitionsMeta();

    // Начальное состояние: img 1 на фронте, img 2 (первый toImg) на back
    setFront(1);
    setBack(transitionsMeta.length > 0 ? transitionsMeta[0].toImg : 1);
    setReveal(0);
    onFrame();

    // Top trigger: скролл в самый верх возвращает интро
    if (topTrigger) {
        topTrigger.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});

var resizeTimer;
window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
        buildSectionsMeta();
        buildTransitionsMeta();
        onFrame();
    }, 200);
}, { passive: true });
