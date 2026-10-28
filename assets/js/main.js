'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer  = window.matchMedia('(pointer: fine)').matches;

/* ---------- Год в подвале ---------- */
document.querySelectorAll('[data-year]').forEach(el => {
  el.textContent = new Date().getFullYear();
});

/* ---------- Портфолио: слайдер «лекало ↔ изделие», категории, просмотр фото ----------
   Данные — window.PORTFOLIO из assets/js/portfolio-data.js (собирает build_portfolio.py). */
(function works() {
  const root = document.getElementById('works');
  const WORKS = Array.isArray(window.PORTFOLIO) ? window.PORTFOLIO : [];
  if (!root || !WORKS.length) return;

  const $ = (sel) => root.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');
  const cmp = $('.cmp');
  const range = $('.cmp__range');
  const patternImg = $('.cmp__pattern');
  const photoImg = $('.cmp__photo');
  const stamp = $('.works__stamp');
  const openBtn = $('.works__open');
  const hint = $('.works__hint');
  const STAMP_ROWS = [['fabric', 'Материал'], ['size', 'Размер'], ['work', 'Что сделано'], ['client', 'Для кого']];
  const ALL = 'Все';
  let current = 0;
  let touched = false; // пользователь сам тянул иглу — подсказку-анимацию не крутим

  const setX = (v) => { cmp.style.setProperty('--x', v + '%'); range.value = v; };
  range.addEventListener('input', () => setX(range.value));
  range.addEventListener('pointerdown', () => { touched = true; });
  range.addEventListener('keydown', () => { touched = true; });
  photoImg.addEventListener('load', () => photoImg.classList.remove('is-loading'));
  photoImg.addEventListener('error', () => photoImg.classList.remove('is-loading'));

  /* закладки-категории */
  const cats = [ALL, ...new Set(WORKS.map(w => w.cat).filter(Boolean))];
  const tabs = cats.map(cat => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'works__tab';
    b.setAttribute('role', 'tab');
    b.textContent = cat;
    b.addEventListener('click', () => pickCategory(cat));
    $('.works__tabs').append(b);
    return b;
  });

  /* миниатюры */
  const thumbs = WORKS.map((w, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    const img = document.createElement('img');
    img.src = w.thumb; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    const cap = document.createElement('span');
    cap.className = 'thumb__cap';
    const title = document.createElement('span');
    title.textContent = w.title || w.cat || '';
    const note = document.createElement('i');
    note.textContent = w.pattern.length ? '+ лекала' : (w.photos.length > 1 ? `${w.photos.length} фото` : '');
    cap.append(title, note);
    b.append(img, cap);
    b.addEventListener('click', () => {
      show(i);
      // на телефоне работа открывается под сеткой — подводим к ней
      if (window.matchMedia('(max-width: 820px)').matches) {
        $('.works__main').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    });
    $('.works__thumbs').append(b);
    return b;
  });

  function pickCategory(cat) {
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.textContent === cat)));
    WORKS.forEach((w, i) => { thumbs[i].hidden = cat !== ALL && w.cat !== cat; });
    if (cat !== ALL) show(WORKS.findIndex(w => w.cat === cat));
  }

  function show(i) {
    current = i;
    const w = WORKS[i];
    const hasPattern = w.pattern.length > 0;
    cmp.classList.toggle('is-single', !hasPattern);
    if (hasPattern) patternImg.src = w.pattern[0];
    const src = w.photos[0] || w.pattern[0];
    if (photoImg.getAttribute('src') !== src) {
      photoImg.classList.add('is-loading');
      photoImg.src = src;
    }
    photoImg.alt = w.title || '';
    setX(50);

    $('.works__cat').textContent = w.cat || '';
    $('.works__no').textContent = `Работа ${pad(i + 1)} / ${pad(WORKS.length)}`;
    $('.works__title').textContent = w.title || '';
    $('.works__desc').textContent = w.desc || '';
    const rows = STAMP_ROWS.filter(([key]) => w[key]).map(([key, label]) => {
      const tr = document.createElement('tr');
      const k = document.createElement('td');
      const v = document.createElement('td');
      k.textContent = label;
      v.textContent = w[key];
      tr.append(k, v);
      return tr;
    });
    stamp.tBodies[0].replaceChildren(...rows);
    stamp.hidden = !rows.length;

    const n = w.pattern.length + w.photos.length;
    openBtn.textContent = n > 1 ? `Все фото (${n})` : 'Открыть фото';
    hint.hidden = !hasPattern;
    thumbs.forEach((t, k) => t.setAttribute('aria-current', String(k === i)));
  }

  /* Подсказка: при первом показе игла сама «проходит» туда-обратно */
  function teaseNeedle() {
    if (reduceMotion || touched || cmp.classList.contains('is-single')) return;
    const keys = [50, 74, 28, 50];
    const DUR = 2000;
    const ease = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    let t0 = 0;
    const step = (now) => {
      if (touched) return;
      if (!t0) t0 = now;
      const p = Math.min((now - t0) / DUR, 1);
      const seg = p * (keys.length - 1);
      const k = Math.min(Math.floor(seg), keys.length - 2);
      setX((keys[k] + (keys[k + 1] - keys[k]) * ease(seg - k)).toFixed(1));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); setTimeout(teaseNeedle, 500); }
    }, { threshold: 0.6 });
    io.observe(cmp);
  }

  /* Просмотр всех фото работы */
  const box = document.querySelector('.lightbox');
  if (box && typeof box.showModal === 'function') {
    const boxImg = box.querySelector('.lightbox__img');
    const boxCap = box.querySelector('.lightbox__cap');
    const prev = box.querySelector('.lightbox__btn--prev');
    const next = box.querySelector('.lightbox__btn--next');
    let list = [];
    let pos = 0;

    const render = () => {
      const item = list[pos];
      boxImg.src = item.src;
      boxImg.alt = item.cap;
      boxCap.textContent = list.length > 1 ? `${item.cap} · ${pos + 1} / ${list.length}` : item.cap;
    };
    const go = (d) => { pos = (pos + d + list.length) % list.length; render(); };
    const open = () => {
      const w = WORKS[current];
      list = [
        ...w.pattern.map(src => ({ src, cap: 'Лекало' })),
        ...w.photos.map(src => ({ src, cap: w.title || '' })),
      ];
      pos = 0;
      prev.hidden = next.hidden = list.length < 2;
      render();
      box.showModal();
    };

    openBtn.addEventListener('click', open);
    // у работы без лекал слайдера нет — клик по фото открывает просмотр
    cmp.addEventListener('click', () => { if (cmp.classList.contains('is-single')) open(); });
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    box.querySelector('.lightbox__close').addEventListener('click', () => box.close());
    // клик мимо фото (по подложке) закрывает
    box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    });
    let sx = null;
    boxImg.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    boxImg.addEventListener('pointerup', (e) => {
      if (sx !== null && Math.abs(e.clientX - sx) > 40 && list.length > 1) go(e.clientX < sx ? 1 : -1);
      sx = null;
    });
  } else {
    openBtn.hidden = true;
  }

  pickCategory(ALL);
  show(0);
})();

/* ---------- Обо мне: цифры на линейках миллиметровки ---------- */
(function buildRulers() {
  const fill = (el, count, start, step) => {
    if (!el) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.textContent = String(start + i * step);
      frag.append(s);
    }
    el.append(frag);
  };
  // вертикальные линейки: сверху вниз
  fill(document.querySelector('.desk__ruler--left'), 11, 10, 10);
  fill(document.querySelector('.desk__ruler--right'), 11, 110, 10);
  // нижняя: слева направо
  fill(document.querySelector('.desk__ruler--bottom'), 16, 20, 20);
})();

/* ---------- Hero: медленный конвейер эскизов по «столу» ----------
   Эскизы въезжают слева (самый левый — на переднем плане, z-index выше),
   растворяются перед табличкой на фото, снова проявляются за ней и
   уходят вправо за экран. Два видимых окна с «дырой» на месте таблички. */
(function heroConveyor() {
  const layer = document.querySelector('.hero__sketches');
  if (!layer) return;

  // Список эскизов генерирует build_sketches.py -> assets/js/sketches.js
  const IMAGES = Array.isArray(window.HERO_SKETCHES) ? window.HERO_SKETCHES : [];
  if (!IMAGES.length) return;

  const CARDS  = 16;     // элементов в пуле
  const PERIOD = 76;     // сек на полный проход слева за правый край
  const X0 = -0.11;      // старт по X (доля ширины) — чуть за левым краем
  const X1 = 1.20;       // конец по X — за правым краем экрана
  const Y_LEFT = 0.55;   // низ дуги у левого края, доля высоты
  const Y_RIGHT = 0.69;  // низ дуги у правого края, доля высоты
  const Y_TOP = 0.26;    // верх дуги в центре, доля высоты
  const JITTERY = 0.05;  // вертикальный разброс
  const ROT = 4;         // максимальный наклон, град
  const PHONE_CARDS = 6, PHONE_PERIOD = 42, PHONE_X0 = -0.3, PHONE_X1 = 1.3;
  const OP_FLOOR = 0.05; // нижний предел непрозрачности в зонах перехода (не 0)

  // Границы видимости по доле ширины (xf): два окна с «дырой» на табличке.
  const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
  const ramp = (v, a, b) => clamp01((v - a) / (b - a));

  const wide = window.matchMedia('(max-width: 1000px)');
  let W = 0, H = 0;
  let CW = 0;   // ширина карточки, доля ширины слоя
  const measure = () => {
    const r = layer.getBoundingClientRect(); W = r.width; H = r.height;
    CW = cards.length && W ? cards[0].el.offsetWidth / W : 0.2;
  };

  let ptr = 0;
  const assign = (c) => {
    c.el.src = 'assets/img/sketches/' + IMAGES[ptr % IMAGES.length];
    ptr++;
    c.rot = (Math.random() * 2 - 1) * ROT;
    c.jy  = (Math.random() * 2 - 1) * JITTERY;
  };

  const cards = [];
  for (let k = 0; k < CARDS; k++) {
    const el = document.createElement('img');
    el.className = 'sketch-card';
    el.alt = ''; el.decoding = 'async'; el.loading = 'eager';
    layer.appendChild(el);
    const c = { el, k, phase: k / CARDS, prevP: 0, rot: 0, jy: 0 };
    assign(c);
    cards.push(c);
  }

  const opacityAt = (xf) => {
    // окно 1: слева до таблички; гаснем по ПРАВОМУ краю карточки, чтобы она
    // целиком уходила до плашки и бирки, а не наезжала на них
    const left  = Math.min(ramp(xf, -0.06, 0.00), 1 - ramp(xf + CW, 0.34, 0.41));
    // окно 2: за табличкой → уход за правый край
    const right = Math.min(ramp(xf, 0.74, 0.80), 1 - ramp(xf, 1.05, 1.15));
    // максимум непрозрачности на «полке», в зонах перехода — не 0, а OP_FLOOR
    return OP_FLOOR + (1 - OP_FLOOR) * Math.max(left, right);
  };

  let raf = null, t0 = 0;
  const frame = (now) => {
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;
    const phone = wide.matches;
    for (const c of cards) {
      // на телефоне — короткий пул и более быстрый проход по полосе под биркой
      if (phone) {
        c.el.style.display = c.k < PHONE_CARDS ? '' : 'none';
        if (c.k >= PHONE_CARDS) continue;
      }
      const p = ((t / (phone ? PHONE_PERIOD : PERIOD)) + (phone ? c.k / PHONE_CARDS : c.phase)) % 1;
      if (p < c.prevP - 0.5) assign(c);     // прошёл круг → новый эскиз + новый разброс
      c.prevP = p;
      const xf = (phone ? PHONE_X0 : X0) + ((phone ? PHONE_X1 : X1) - (phone ? PHONE_X0 : X0)) * p;
      const x = xf * W;
      if (phone) {
        const yp = 10 + c.jy * H + Math.sin(xf * 6 + c.k) * 4;
        c.el.style.transform = `translate3d(${x.toFixed(1)}px, ${yp.toFixed(1)}px, 0) rotate(${c.rot.toFixed(2)}deg)`;
        c.el.style.opacity = Math.min(ramp(xf, -0.1, 0.0), 1 - ramp(xf, 1.0, 1.1)).toFixed(3);
        c.el.style.zIndex = '1';
        continue;
      }
      // дуга: нижние углы → подъём к центру → нижние углы
      const u = clamp01(xf);
      const arc = 1 - (2 * u - 1) * (2 * u - 1); // 1 в центре, 0 у краёв
      const endBase = Y_LEFT + (Y_RIGHT - Y_LEFT) * u; // низ дуги: левый край выше правого
      const y = (endBase - (endBase - Y_TOP) * arc + c.jy) * H;
      c.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${c.rot.toFixed(2)}deg)`;
      c.el.style.opacity = opacityAt(xf).toFixed(3);
      // z-index «домиком»: слева передний — самый левый, справа — самый правый.
      const zBase = xf <= 0.5 ? (0.5 - xf) : (xf - 0.5);
      c.el.style.zIndex = String(Math.round(zBase * 1000));
    }
    raf = requestAnimationFrame(frame);
  };

  const start = () => { if (!raf && !reduceMotion) { measure(); t0 = 0; raf = requestAnimationFrame(frame); } };
  const stop  = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } };

  window.addEventListener('resize', measure);
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
  wide.addEventListener('change', () => { stop(); start(); });
  start();
})();

/* ---------- Reveal + разворот сантиметровой ленты ---------- */
(function revealOnScroll() {
  const items = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  items.forEach(el => io.observe(el));
})();

/* ---------- Активный пункт меню по текущему разделу ---------- */
(function activeNav() {
  const links = [...document.querySelectorAll('.nav a[href^="#"]')];
  const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const sections = [...byId.keys()].map(id => document.getElementById(id)).filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;
  // «текущий» раздел — тот, что пересекает полосу посередине экрана;
  // над хиро или между отслеживаемыми разделами подсветка снимается
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id); });
    const current = sections.find(s => visible.has(s.id));
    links.forEach(a => a.classList.toggle('is-active', !!current && a === byId.get(current.id)));
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => io.observe(s));
})();

/* ---------- Плавающая кнопка Telegram: после хиро, но не поверх контактов ---------- */
(function floatingContact() {
  const fab = document.querySelector('.fab');
  const hero = document.getElementById('hero');
  const contacts = document.getElementById('contacts');
  if (!fab || !hero || !contacts || !('IntersectionObserver' in window)) return;
  let heroVisible = true, contactsVisible = false;
  const sync = () => fab.classList.toggle('is-hidden', heroVisible || contactsVisible);
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; sync(); }).observe(hero);
  new IntersectionObserver(([e]) => { contactsVisible = e.isIntersecting; sync(); }).observe(contacts);
})();

/* ---------- Прошивающая строчка по скроллу ---------- */
(function stitchProgress() {
  const seam   = document.querySelector('.stitch__seam');
  const needle = document.querySelector('.needle');
  if (!seam || !needle || reduceMotion) return;

  const LEN = 1000; // соответствует viewBox высоте
  let ticking = false;

  function update() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    // dashoffset уходит от LEN к 0 — строчка «прошивается» сверху вниз
    seam.style.strokeDashoffset = String(LEN * (1 - p));
    needle.style.top = (p * window.innerHeight) + 'px';
    ticking = false;
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

/* ---------- Бургер-меню (телефон) ---------- */
(function burgerMenu() {
  const bar = document.querySelector('.topbar');
  const btn = bar && bar.querySelector('.burger');
  if (!btn) return;
  const set = (open) => {
    bar.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', () => set(!bar.classList.contains('is-open')));
  bar.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => set(false)));
  document.addEventListener('click', (e) => { if (!bar.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  window.matchMedia('(min-width: 721px)').addEventListener('change', () => set(false));
})();

/* ---------- Курсор-игла с ниткой ---------- */
(function needleCursor() {
  const cursor = document.querySelector('.cursor');
  const thread = document.querySelector('.thread');
  if (!cursor || !thread || !finePointer || reduceMotion) return;

  const path = thread.querySelector('path');
  const trail = [];
  const MAX = 14;
  /* нитка выходит из ушка, а не из острия: ушко смещено от острия на
     (21.5-4, 6.5-24)·30/28 ≈ (18.75, -18.75)px */
  const EYE_DX = 18.75, EYE_DY = -18.75;
  let x = window.innerWidth / 2, y = window.innerHeight / 2;
  let tx = x, ty = y;
  let active = false;   // системный курсор прячем только после первого движения
  let running = false;  // флаг RAF-цикла, чтобы не крутить его в простое

  function start() {
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  window.addEventListener('mousemove', (e) => {
    tx = e.clientX; ty = e.clientY;
    if (!active) {
      active = true;
      document.documentElement.classList.add('has-custom-cursor');
    }
    cursor.style.opacity = '1';
    start();
  });
  document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });

  // подсветка иглы над кликабельным
  document.addEventListener('mouseover', (e) => {
    const link = e.target.closest('a, button, .card, .contact');
    cursor.style.transform = link ? 'translate(-4.3px,-25.7px) scale(1.35)' : 'translate(-4.3px,-25.7px) scale(1)';
  });

  function loop() {
    // мягкое следование — «протягиваем нитку»
    x += (tx - x) * 0.7;
    y += (ty - y) * 0.7;
    // translate вместо left/top: не вызывает layout на каждом кадре
    cursor.style.translate = `${x}px ${y}px`;

    trail.push({ x: x + EYE_DX, y: y + EYE_DY });
    if (trail.length > MAX) trail.shift();
    if (trail.length > 1) {
      let d = `M ${trail[0].x} ${trail[0].y}`;
      for (let i = 1; i < trail.length; i++) d += ` L ${trail[i].x} ${trail[i].y}`;
      path.setAttribute('d', d);
    }
    // пока игла ещё догоняет цель — продолжаем; в покое цикл останавливается
    if (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) {
      requestAnimationFrame(loop);
    } else {
      running = false;
    }
  }
})();
