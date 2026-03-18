/**
 * main.js — Анастасия Швейкина Portfolio
 *
 * IMAGE MAP: 1.jpg, 2.jpg, 3.jpg, 4.jpg, 5.jpg, p1.jpg
 *
 * The page has 5 real sections + a virtual "intro" phase.
 * Image sequence driven by split-line reveal:
 *
 *   INTRO  → image 1  (static overlay, fades out as sec-1 scrolls in)
 *   Sec 1  → image 2  (title: Я практикующий психолог)
 *   Sec 2  → image 3  (С какими запросами)
 *   Sec 3  → image 4  (Как проходит работа)
 *   Sec 4  → image 5  (Форматы и стоимость)
 *   Sec 5  → image p1 (Остались вопросы)
 *
 * SPLIT LINE rule (same for all transitions including intro→sec1):
 *   - Trigger = the "lastTB" element for that transition
 *     · For INTRO: sec-1's [data-first-textbox] (the firstTB reaches viewport top)
 *     · For every real section: its own [data-last-textbox]
 *   - Reveal distance = REVEAL_SCROLL_PX (80vh)
 *
 * TITLE BEHAVIOR:
 *   - Starts big at bottom of sticky canvas
 *   - Parks small at top when firstTB top <= 0
 *
 * INTRO BEHAVIOR:
 *   - Text stays static, no fly-out
 *   - Overlay fades out as sec-1 scrolls in (firstTB approaches viewport)
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
const introHint = introOverlay ? introOverlay.querySelector('.intro-scroll-hint') : null;
const topTrigger = document.getElementById('top-trigger');
const sections = Array.from(document.querySelectorAll('.page-section'));

const canvasFront = document.getElementById('canvas-front');
const canvasBack = document.getElementById('canvas-back');
const frontBlur = document.getElementById('front-blur');
const frontMain = document.getElementById('front-main');
const backBlur = document.getElementById('back-blur');
const backMain = document.getElementById('back-main');

/* ─── CANVAS STATE ──────────────────────────────────────────── */
let loadedFront = 1;
let loadedBack = 2;

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
 * Set the reveal clip on the front canvas.
 * progress 0 = front fully visible; 1 = front fully clipped (back image shows).
 * Clips from bottom upward (split line sweeps up).
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
 * sectionMeta is an array where:
 *   [0] = virtual INTRO entry (img=1, nextImg=2)
 *         lastTB = sec-1's firstTB (triggers the 1→2 split)
 *   [1..5] = real DOM sections read from data-img / data-next-img
 *
 * For each real section:
 *   img      : key for the image shown during the section
 *   nextImg  : key for the image to reveal (null = no more transitions)
 *   lastTB   : the trigger element (top hitting viewport top starts the reveal)
 *   firstTB  : used for title parking and scroll invite
 */
let sectionMeta = [];

function parseImgKey(str) {
    if (str === null || str === undefined) return null;
    const n = parseInt(str, 10);
    return isNaN(n) ? str : n;
}

function buildSectionMeta() {
    sectionMeta = sections.map(sec => {
        const imgKey = sec.dataset.img;
        const nextRaw = sec.dataset.nextImg;
        const nextKey = (nextRaw === 'none' || nextRaw === undefined) ? null : nextRaw;
        return {
            el: sec,
            img: parseImgKey(imgKey),
            nextImg: parseImgKey(nextKey),
            lastTB: sec.querySelector('[data-last-textbox]'),
            firstTB: sec.querySelector('[data-first-textbox]'),
            stickyEl: sec.querySelector('.section-sticky-canvas'),
            inviteEl: sec.querySelector('.scroll-invite'),
            titleParked: false,
            inviteHidden: false,
        };
    });
}

/* ─── PARALLAX ──────────────────────────────────────────────── */
const PARALLAX_PX = 28;

function applyParallax(imgEl, progress) {
    if (!imgEl) return;
    const shift = progress * PARALLAX_PX;
    imgEl.style.transform = 'translateY(' + shift.toFixed(1) + 'px)';
}

/* ─── TITLE PARKING ─────────────────────────────────────────── */
/*
 * CSS handles the animation; JS toggles .title-parked on the sticky canvas.
 * Park: firstTB top <= 0 (textbox has scrolled above viewport top).
 * Unpark: firstTB top > parkThreshold (generous hysteresis for scroll-up).
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

/* ─── INTRO VISIBILITY ──────────────────────────────────────── */
/*
 * RULE: The intro overlay is visible ONLY in the top zone of the page.
 *
 * - While scrollY < INTRO_FADE_END    → fully visible (opacity 1)
 * - INTRO_FADE_END < scrollY < INTRO_GONE → fades out linearly
 * - scrollY >= INTRO_GONE             → hidden, flag set
 * - On scroll UP: does NOT reappear, UNLESS scrollY drops back below INTRO_RESTORE
 *
 * This prevents the intro from popping up every time the user scrolls up a bit.
 * It only returns when the user consciously goes back to the very top.
 */
const INTRO_FADE_START = 0;
const INTRO_FADE_END = cachedVH * 0.4;
const INTRO_RESTORE = cachedVH * 0.02;

let introDismissed = false;   // true once intro has been fully scrolled past

function updateIntro() {
    if (!introOverlay) return;
    const sy = window.scrollY;

    // Once dismissed, only restore if user scrolls almost to the very top
    if (introDismissed) {
        if (sy <= INTRO_RESTORE) {
            introDismissed = false;
            introOverlay.style.opacity = '1';
            if (introHint) introHint.style.opacity = '0.7';
        }
        return;  // otherwise do nothing — stay hidden
    }

    // Compute opacity based purely on scrollY (no firstTB dependency)
    let opacity;
    if (sy <= INTRO_FADE_START) {
        opacity = 1;
    } else if (sy >= INTRO_FADE_END) {
        opacity = 0;
        introDismissed = true;   // crossed the threshold — dismiss
    } else {
        opacity = 1 - (sy - INTRO_FADE_START) / (INTRO_FADE_END - INTRO_FADE_START);
    }

    introOverlay.style.opacity = opacity.toFixed(3);

    // Scroll hint fades earlier (disappears at 40% of the fade range)
    if (introHint) {
        const hintFrac = Math.max(0, 1 - (sy - INTRO_FADE_START) / ((INTRO_FADE_END - INTRO_FADE_START) * 0.4));
        introHint.style.opacity = (hintFrac * 0.7).toFixed(3);
    }

    // Show/hide the compact top trigger (appears when intro is fully dismissed)
    if (topTrigger) topTrigger.classList.toggle('is-visible', introDismissed);
}

/* ─── MAIN FRAME ────────────────────────────────────────────── */
// Scroll range over which the split-line reveal animation plays
const REVEAL_SCROLL_PX = cachedVH * 0.80;

let ticking = false;

function onFrame() {
    ticking = false;

    // ── Intro fade ──
    updateIntro();

    // ── Walk transitions to find current active image + next + reveal progress ──
    //
    // sectionMeta traversal:
    //   For each entry, check its "lastTB" element.
    //   If lastTB top > 0      → haven't reached this trigger yet, break
    //   If lastTB top <= 0     → compute reveal progress
    //   If progress < 1        → reveal in progress, break
    //   If progress == 1       → fully revealed, advance to next entry, continue
    //
    // Default: start with intro (index 0), image 1
    let activeImg = 1;
    let nextImg = 2;
    let reveal = 0;
    let activeSec = 0;

    for (let i = 0; i < sectionMeta.length; i++) {
        const meta = sectionMeta[i];
        if (!meta.lastTB) continue;   // safety: skip entries without a trigger element

        const trigTop = meta.lastTB.getBoundingClientRect().top;

        if (trigTop > 0) {
            // Haven't reached this trigger yet — this entry's image is active
            activeImg = meta.img;
            nextImg = meta.nextImg;
            reveal = 0;
            activeSec = i;
            break;
        }

        // Trigger element's top is at or above viewport top
        const progress = Math.min(1, Math.max(0, -trigTop / REVEAL_SCROLL_PX));

        if (progress < 1) {
            // Reveal in progress
            activeImg = meta.img;
            nextImg = meta.nextImg;
            reveal = progress;
            activeSec = i;
            break;
        }

        // Fully revealed — advance to next entry
        const nextEntryImg = meta.nextImg !== null ? meta.nextImg : meta.img;
        const nextEntryNext = (i + 1 < sectionMeta.length) ? sectionMeta[i + 1].nextImg : null;
        activeImg = nextEntryImg;
        nextImg = nextEntryNext;
        reveal = 0;
        activeSec = i + 1;
        // Continue loop: check if the next entry has also been fully revealed
    }

    // ── Update image canvases ──
    setFront(activeImg);
    setBack(nextImg !== null ? nextImg : activeImg);
    setReveal(reveal);

    // ── Parallax on front image (skip virtual intro entry with no DOM el) ──
    const clampedIdx = Math.min(activeSec, sectionMeta.length - 1);
    const activeSecMeta = sectionMeta[clampedIdx];
    if (activeSecMeta && activeSecMeta.el) {
        const r = activeSecMeta.el.getBoundingClientRect();
        const scrolledIn = -r.top;
        const maxScroll = Math.max(1, activeSecMeta.el.offsetHeight - cachedVH);
        applyParallax(frontMain, Math.min(1, Math.max(0, scrolledIn / maxScroll)));
    }
    backMain.style.transform = 'none';

    // ── Title + scroll invite for visible sections ──
    sectionMeta.forEach(function (meta) {
        if (!meta.el) return;   // skip virtual intro entry
        const r = meta.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > cachedVH * 1.5) return;
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
    var dots = Array.from(document.querySelectorAll('.reviews-dots .dot'));
    if (!track) return;

    var total = track.querySelectorAll('.review-slide').length;
    var current = 0, startX = 0, dragDX = 0, dragging = false;

    function goTo(idx, animate) {
        if (animate === undefined) animate = true;
        current = Math.max(0, Math.min(total - 1, idx));
        var w = track.parentElement.offsetWidth;
        track.style.transition = animate ? '' : 'none';
        track.style.transform = 'translateX(' + (-current * w) + 'px)';
        dots.forEach(function (d, i) { d.classList.toggle('dot--active', i === current); });
    }

    function dragStart(x) { dragging = true; startX = x; dragDX = 0; track.classList.add('is-dragging'); }
    function dragMove(x) {
        if (!dragging) return;
        dragDX = x - startX;
        track.style.transition = 'none';
        track.style.transform = 'translateX(' + (-current * track.parentElement.offsetWidth + dragDX) + 'px)';
    }
    function dragEnd() {
        if (!dragging) return;
        dragging = false;
        track.classList.remove('is-dragging');
        if (dragDX < -50) goTo(current + 1);
        else if (dragDX > 50) goTo(current - 1);
        else goTo(current);
    }

    track.addEventListener('touchstart', function (e) { dragStart(e.touches[0].clientX); }, { passive: true });
    track.addEventListener('touchmove', function (e) { dragMove(e.touches[0].clientX); }, { passive: true });
    track.addEventListener('touchend', function () { dragEnd(); }, { passive: true });
    track.addEventListener('mousedown', function (e) { e.preventDefault(); dragStart(e.clientX); });
    window.addEventListener('mousemove', function (e) { if (dragging) dragMove(e.clientX); });
    window.addEventListener('mouseup', function () { dragEnd(); });
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
    buildSectionMeta();
    // Initial state: image 1 on front, image 2 on back
    setFront(1);
    setBack(2);
    setReveal(0);
    onFrame();

    // Top trigger: scroll to very top (intro will reappear once scrollY drops below INTRO_RESTORE)
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
        buildSectionMeta();
        onFrame();
    }, 200);
}, { passive: true });
