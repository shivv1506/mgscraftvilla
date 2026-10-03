/* ------------------------------------------------------------------
   The studio wall: drag to move along it, click a print to open it.
------------------------------------------------------------------- */
(() => {
  const wall = document.querySelector('.wall');
  const lightbox = document.querySelector('#wallLightbox');
  if (!wall) return;

  const shots = [...wall.querySelectorAll('.wall-shot')];
  const hint = document.querySelector('.wall-hint');

  /* ---------- Drag to pan ---------- */

  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  let moved = 0;

  wall.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    dragging = true;
    moved = 0;
    startX = event.clientX;
    startScroll = wall.scrollLeft;
    wall.classList.add('is-dragging');
  });

  wall.addEventListener('pointermove', event => {
    if (!dragging) return;
    const delta = event.clientX - startX;
    moved = Math.max(moved, Math.abs(delta));
    if (moved > 4) {
      /* Only capture once it is clearly a drag, so taps still reach the photo.
         Capture can throw for a pointer that is no longer active, that must
         never stop the pan itself. */
      try {
        wall.setPointerCapture(event.pointerId);
      } catch (_) {}
      wall.scrollLeft = startScroll - delta;
      hint?.classList.add('is-gone');
    }
  });

  const stopDrag = () => {
    if (!dragging) return;
    dragging = false;
    wall.classList.remove('is-dragging');
  };

  wall.addEventListener('pointerup', stopDrag);
  wall.addEventListener('pointercancel', stopDrag);
  wall.addEventListener('pointerleave', stopDrag);
  wall.addEventListener('scroll', () => hint?.classList.add('is-gone'), { passive: true, once: true });

  /* No wheel handling on purpose: a vertical wheel or trackpad swipe should
     scroll the page down, never drag the wall sideways. Horizontal intent , 
     a two-finger sideways swipe, shift+wheel, or a press-and-drag, is handled
     natively by overflow-x plus the drag code above. */

  /* ---------- Lightbox ---------- */

  if (!lightbox || !lightbox.showModal) {
    /* Without <dialog> support the photos simply stay on the wall. */
    shots.forEach(s => s.setAttribute('aria-disabled', 'true'));
    return;
  }

  const image = lightbox.querySelector('#lightboxImg');
  const note = lightbox.querySelector('#lightboxNote');
  const closeButton = lightbox.querySelector('.lightbox-close');
  const prevButton = lightbox.querySelector('.lightbox-nav.prev');
  const nextButton = lightbox.querySelector('.lightbox-nav.next');

  const slides = shots.map(shot => {
    const img = shot.querySelector('img');
    const figure = shot.closest('.wall-item');
    const caption = figure?.querySelector('.wall-note');
    return { src: img.src, alt: img.alt, note: caption ? caption.textContent : '' };
  });

  let index = 0;
  let lastFocused = null;

  const show = i => {
    index = (i + slides.length) % slides.length;
    const slide = slides[index];
    image.src = slide.src;
    image.alt = slide.alt;
    note.textContent = slide.note;
  };

  const open = i => {
    lastFocused = shots[i];
    show(i);
    lightbox.showModal();
    closeButton.focus();
  };

  shots.forEach((shot, i) =>
    shot.addEventListener('click', event => {
      /* Suppress the click that ends a drag. */
      if (moved > 4) {
        event.preventDefault();
        return;
      }
      open(i);
    })
  );

  closeButton.addEventListener('click', () => lightbox.close());
  prevButton.addEventListener('click', () => show(index - 1));
  nextButton.addEventListener('click', () => show(index + 1));

  lightbox.addEventListener('close', () => lastFocused?.focus());

  /* Click the backdrop (but not the photo) to close. */
  lightbox.addEventListener('click', event => {
    if (event.target === lightbox) lightbox.close();
  });

  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      show(index - 1);
    }
  });

  /* Swipe between photos on touch. */
  let swipeX = null;
  lightbox.addEventListener('pointerdown', e => {
    swipeX = e.clientX;
  });
  lightbox.addEventListener('pointerup', e => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 55) show(index + (dx < 0 ? 1 : -1));
  });
})();
