/* ------------------------------------------------------------------
   Annotation overlay: a slim tab that lets you draw anywhere on the page.

   The canvas is fixed to the viewport (a canvas the height of the whole
   document would be hundreds of megabytes), but strokes are stored in
   *document* coordinates and rendered with the scroll offset applied, so
   marks stay pinned to the content they annotate rather than sliding
   around with the screen.

   Everything here is built in JS, so with scripting off the page is
   untouched rather than showing a toolbar that does nothing.
------------------------------------------------------------------- */
(() => {
  if (!document.createElement('canvas').getContext) return;

  const BRAND = [
    ['#f07822', 'Orange'],
    ['#c63472', 'Magenta'],
    ['#b08d57', 'Gold'],
    ['#7f9a83', 'Leaf'],
    ['#231f20', 'Ink']
  ];

  const ICONS = {
    brush: '<path d="M2 13c3.4-3.6 6.6-5.2 10-5.2S18.8 9.2 22 11.6c-3.4 1.4-6.6 2-10 2S5.4 12.2 2 13z" fill="currentColor"/>',
    smooth: '<path d="M2 13c3-4.6 5.6-4.6 8 0s5 4.6 12-1.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    pen: '<path d="M2 13c3-4.6 5.6-4.6 8 0s5 4.6 12-1.6" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
    pencil: '<path d="M2 13c3-4.6 5.6-4.6 8 0s5 4.6 12-1.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.2 2.1"/>',
    dotted: '<g fill="currentColor"><circle cx="3.2" cy="12.6" r="1.7"/><circle cx="9" cy="12.6" r="1.7"/><circle cx="14.8" cy="12.6" r="1.7"/><circle cx="20.6" cy="12.6" r="1.7"/></g>',
    petals: '<g fill="currentColor"><path d="M2.5 14.5c.6-2.4 2.4-3.6 4.4-3-.6 2.4-2.4 3.6-4.4 3z"/><path d="M9.8 13.2c.6-2.4 2.4-3.6 4.4-3-.6 2.4-2.4 3.6-4.4 3z"/><path d="M17.1 11.9c.6-2.4 2.4-3.6 4.4-3-.6 2.4-2.4 3.6-4.4 3z"/></g>',
    marker:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19l1.6-4.4L16 4.2a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8L9.4 18.4 5 20z" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  const LABEL = {
    brush: 'Brush',
    smooth: 'Smooth',
    pen: 'Pen',
    pencil: 'Pencil',
    dotted: 'Dotted',
    petals: 'Petals'
  };

  /* ---------- State ---------- */

  let active = false;
  let tool = 'brush';
  let colour = '#c63472';
  const strokes = [];
  let current = null;
  let vw = 0;
  let vh = 0;

  /* ---------- Canvas ---------- */

  const canvas = document.createElement('canvas');
  canvas.className = 'annot-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const seeded = seed => {
    let a = seed >>> 0;
    return () => {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const taper = (speed, base) => base * Math.max(0.55, Math.min(1, 1 - speed / 90));

  const line = (a, b, w, style, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = style;
    ctx.lineWidth = Math.max(0.4, w);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const petal = (x, y, angle, size, fill, rand) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + (rand() - 0.5) * 1.2);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(size * 0.62, -size * 0.52, size * 1.5, 0);
    ctx.quadraticCurveTo(size * 0.62, size * 0.52, 0, 0);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  const TOOLS = {
    brush: {
      base: 22,
      segment(a, b, s, i) {
        const rand = seeded(s.seed + i * 2654435761);
        const w = taper(dist(a, b), s.size);
        for (let k = 0; k < 5; k++) {
          const off = (k / 4 - 0.5) * w * 0.78;
          const nx = -(b.y - a.y);
          const ny = b.x - a.x;
          const len = Math.hypot(nx, ny) || 1;
          const j = (rand() - 0.5) * w * 0.16;
          line(
            { x: a.x + (nx / len) * off + j, y: a.y + (ny / len) * off + j },
            { x: b.x + (nx / len) * off + j, y: b.y + (ny / len) * off + j },
            w * 0.24,
            s.colour,
            0.3 + rand() * 0.24
          );
        }
      }
    },
    smooth: {
      base: 9,
      segment(a, b, s) {
        line(a, b, taper(dist(a, b), s.size), s.colour, 0.94);
      }
    },
    pen: {
      base: 3,
      segment(a, b, s) {
        line(a, b, s.size, s.colour, 1);
      }
    },
    pencil: {
      base: 6,
      segment(a, b, s, i) {
        const rand = seeded(s.seed + i * 40503);
        const d = dist(a, b);
        const steps = Math.max(2, Math.ceil(d / 1.4));
        ctx.fillStyle = s.colour;
        for (let k = 0; k < steps; k++) {
          const t = k / steps;
          const spread = s.size * 0.5;
          ctx.globalAlpha = 0.1 + rand() * 0.3;
          ctx.fillRect(
            a.x + (b.x - a.x) * t + (rand() - 0.5) * spread,
            a.y + (b.y - a.y) * t + (rand() - 0.5) * spread,
            1.1,
            1.1
          );
        }
        ctx.globalAlpha = 1;
      }
    },
    dotted: {
      base: 9,
      spacing: 22,
      stamp(x, y, angle, s, rand) {
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = s.colour;
        ctx.beginPath();
        ctx.arc(x, y, s.size * (0.42 + rand() * 0.2), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    },
    petals: {
      base: 12,
      spacing: 26,
      stamp(x, y, angle, s, rand) {
        petal(x, y, angle, s.size * (0.8 + rand() * 0.5), s.colour, rand);
      }
    }
  };

  const initialAcc = t => TOOLS[t].spacing || 0;

  /* Document coordinates -> viewport coordinates. */
  const toView = p => ({ x: p.x - window.scrollX, y: p.y - window.scrollY });

  const drawStamped = (s, from) => {
    const spec = TOOLS[s.tool];
    for (let i = Math.max(1, from); i < s.points.length; i++) {
      const a = toView(s.points[i - 1]);
      const b = toView(s.points[i]);
      const d = dist(a, b);
      if (!d) continue;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      let pos = spec.spacing - s.acc;
      while (pos <= d) {
        const t = pos / d;
        spec.stamp(
          a.x + (b.x - a.x) * t,
          a.y + (b.y - a.y) * t,
          angle,
          s,
          seeded(s.seed + i * 7919 + Math.round(pos))
        );
        pos += spec.spacing;
      }
      s.acc = d - (pos - spec.spacing);
    }
  };

  const drawStroke = (s, from = 1) => {
    const spec = TOOLS[s.tool];
    if (spec.stamp) {
      drawStamped(s, from);
      return;
    }
    for (let i = Math.max(1, from); i < s.points.length; i++) {
      spec.segment(toView(s.points[i - 1]), toView(s.points[i]), s, i);
    }
  };

  /* Skip strokes that are nowhere near the viewport. */
  const onScreen = s => {
    const pad = 80;
    return !(
      s.maxX < window.scrollX - pad ||
      s.minX > window.scrollX + vw + pad ||
      s.maxY < window.scrollY - pad ||
      s.minY > window.scrollY + vh + pad
    );
  };

  const render = () => {
    ctx.clearRect(0, 0, vw, vh);
    strokes.forEach(s => {
      if (!onScreen(s)) return;
      s.acc = initialAcc(s.tool);
      drawStroke(s, 1);
    });
  };

  let frame = null;
  const queueRender = () => {
    /* rAF is paused while the tab is hidden. Without this, a frame queued just
       before hiding never runs, `frame` never clears, and every later render is
       blocked for good, so render straight away when frames are not running. */
    if (document.hidden) {
      if (frame) { cancelAnimationFrame(frame); frame = null; }
      render();
      return;
    }
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      render();
    });
  };

  document.addEventListener('visibilitychange', () => {
    if (frame) { cancelAnimationFrame(frame); frame = null; }
    render();
  });

  const resize = () => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  };

  /* ---------- Drawing ---------- */

  const bounds = s => {
    const xs = s.points.map(p => p.x);
    const ys = s.points.map(p => p.y);
    s.minX = Math.min(...xs);
    s.maxX = Math.max(...xs);
    s.minY = Math.min(...ys);
    s.maxY = Math.max(...ys);
  };

  const grow = (s, p) => {
    s.minX = Math.min(s.minX, p.x);
    s.maxX = Math.max(s.maxX, p.x);
    s.minY = Math.min(s.minY, p.y);
    s.maxY = Math.max(s.maxY, p.y);
  };

  const docPoint = e => ({ x: e.pageX, y: e.pageY });

  const start = event => {
    if (!active) return;
    if (event.button !== undefined && event.button !== 0) return;
    const p = docPoint(event);
    current = {
      tool,
      colour,
      size: TOOLS[tool].base,
      seed: (Math.random() * 1e9) | 0,
      acc: initialAcc(tool),
      points: [p]
    };
    bounds(current);
    strokes.push(current);
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (_) {
      /* Synthetic or already-released pointers cannot be captured. */
    }
    updateActions();
  };

  const move = event => {
    if (!current) return;
    event.preventDefault();
    const coalesced = event.getCoalescedEvents ? event.getCoalescedEvents() : [];
    const events = coalesced.length ? coalesced : [event];
    events.forEach(e => {
      const p = docPoint(e);
      current.points.push(p);
      grow(current, p);
      drawStroke(current, current.points.length - 1);
    });
  };

  const end = () => {
    if (!current) return;
    if (current.points.length === 1) {
      const p = current.points[0];
      const step = (TOOLS[current.tool].spacing || 2) + 1;
      const q = { x: p.x + step, y: p.y };
      current.points.push(q);
      grow(current, q);
      current.acc = initialAcc(current.tool);
      drawStroke(current, 1);
    }
    current = null;
    updateActions();
  };

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  window.addEventListener('scroll', queueRender, { passive: true });
  document.addEventListener('scroll', queueRender, { passive: true, capture: true });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));

  /* iOS Safari collapses and restores its toolbar without reliably firing a
     window resize, so track the visual viewport too, otherwise the overlay
     keeps a stale size and marks drift from the content they annotate. */
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resize);
    window.visualViewport.addEventListener('scroll', queueRender);
  }

  /* ---------- The slim tab ---------- */

  const bar = document.createElement('div');
  bar.className = 'annot-bar';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'annot-toggle';
  toggle.innerHTML = `${ICONS.marker}<span class="annot-toggle-text">Sketch!</span>`;
  toggle.setAttribute('aria-expanded', 'false');
  bar.appendChild(toggle);

  const panel = document.createElement('div');
  panel.className = 'annot-panel';
  panel.setAttribute('role', 'toolbar');
  panel.setAttribute('aria-label', 'Annotation tools');

  const group = cls => {
    const g = document.createElement('span');
    g.className = `annot-group${cls ? ' ' + cls : ''}`;
    return g;
  };

  const toolGroup = group();
  Object.keys(LABEL).forEach(key => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'annot-tool';
    b.dataset.tool = key;
    b.title = LABEL[key];
    b.setAttribute('aria-pressed', String(key === tool));
    b.innerHTML = `<span class="sr-only">${LABEL[key]} stroke</span><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[key]}</svg>`;
    b.addEventListener('click', () => {
      tool = key;
      toolGroup.querySelectorAll('.annot-tool').forEach(x =>
        x.setAttribute('aria-pressed', String(x === b))
      );
    });
    toolGroup.appendChild(b);
  });
  panel.appendChild(toolGroup);
  panel.appendChild(Object.assign(document.createElement('span'), { className: 'annot-divider' }));

  const colourGroup = group();
  const picker = document.createElement('input');
  const setColour = (value, source) => {
    colour = value;
    colourGroup.querySelectorAll('.annot-swatch').forEach(x =>
      x.setAttribute('aria-pressed', String(x === source))
    );
    if (source !== picker) picker.value = value;
  };

  BRAND.forEach(([hex, name]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'annot-swatch';
    b.title = name;
    b.style.setProperty('--swatch', hex);
    b.setAttribute('aria-pressed', String(hex === colour));
    b.innerHTML = `<span class="sr-only">${name}</span>`;
    b.addEventListener('click', () => setColour(hex, b));
    colourGroup.appendChild(b);
  });

  const custom = document.createElement('label');
  custom.className = 'annot-custom';
  custom.title = 'Pick any colour';
  picker.type = 'color';
  picker.value = colour;
  picker.addEventListener('input', () => setColour(picker.value, picker));
  custom.innerHTML = '<span class="sr-only">Pick any colour</span>';
  custom.appendChild(picker);
  colourGroup.appendChild(custom);
  panel.appendChild(colourGroup);
  panel.appendChild(Object.assign(document.createElement('span'), { className: 'annot-divider' }));

  const actionGroup = group();
  const undoButton = document.createElement('button');
  undoButton.type = 'button';
  undoButton.className = 'annot-action';
  undoButton.textContent = 'Undo';
  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'annot-action';
  clearButton.textContent = 'Clear';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'annot-close';
  closeButton.title = 'Close annotation tools';
  closeButton.innerHTML = `<span class="sr-only">Close annotation tools</span>${ICONS.close}`;
  actionGroup.append(undoButton, clearButton, closeButton);
  panel.appendChild(actionGroup);

  bar.appendChild(panel);
  document.body.appendChild(bar);

  function updateActions() {
    const empty = strokes.length === 0;
    undoButton.disabled = empty;
    clearButton.disabled = empty;
    /* Lets the header go fully opaque while marks exist, so strokes scrolling
       underneath it do not show through its frosted background. */
    document.body.classList.toggle('has-annotations', !empty);
  }

  undoButton.addEventListener('click', () => {
    strokes.pop();
    render();
    updateActions();
  });

  clearButton.addEventListener('click', () => {
    strokes.length = 0;
    render();
    updateActions();
  });

  const setActive = on => {
    active = on;
    document.body.classList.toggle('is-annotating', on);
    bar.classList.toggle('is-open', on);
    toggle.setAttribute('aria-expanded', String(on));
    toggle.setAttribute('aria-label', on ? 'Stop sketching' : 'Sketch on this page');
    if (!on) end();
  };

  toggle.addEventListener('click', () => setActive(!active));
  closeButton.addEventListener('click', () => {
    setActive(false);
    toggle.focus();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) {
      setActive(false);
      toggle.focus();
    }
  });

  updateActions();
  setActive(false);
  resize();
})();
