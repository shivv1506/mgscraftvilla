const yearSlot = document.querySelector('#year');
if (yearSlot) yearSlot.textContent = String(new Date().getFullYear());

/* ---------- Mobile navigation ---------- */
const menu = document.querySelector('.menu');
const nav = document.querySelector('.site-header nav');
if (menu && nav) {
  nav.id = 'primary-navigation';
  menu.setAttribute('aria-controls', 'primary-navigation');
  menu.setAttribute('aria-expanded', 'false');

  const setNav = open => {
    nav.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };

  menu.addEventListener('click', () => setNav(!nav.classList.contains('open')));
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setNav(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      setNav(false);
      menu.focus();
    }
  });
  document.addEventListener('click', event => {
    if (nav.classList.contains('open') && !nav.contains(event.target) && !menu.contains(event.target)) setNav(false);
  });
}

/* ---------- Waitlist dialog ---------- */
const waitlist = document.querySelector('#waitlist');
if (waitlist) {
  let lastFocused = null;

  const openWaitlist = trigger => {
    lastFocused = trigger || document.activeElement;
    waitlist.showModal();
    waitlist.querySelector('input')?.focus();
  };

  document.querySelectorAll('[data-open-waitlist]').forEach(button =>
    button.addEventListener('click', () => openWaitlist(button))
  );
  waitlist.querySelector('.close')?.addEventListener('click', () => waitlist.close());
  waitlist.addEventListener('close', () => lastFocused?.focus());

  /* Click outside the panel closes it. */
  waitlist.addEventListener('click', event => {
    if (event.target === waitlist) waitlist.close();
  });
}

/* ---------- Forms ----------
   Entries go to a Google Apps Script bound to the enquiries spreadsheet, which
   writes the row, saves any attachment to Drive and emails the studio.

   The body is sent as JSON with a text/plain content type on purpose: that is a
   CORS-safelisted type, so the browser sends no preflight, and Apps Script
   cannot answer an OPTIONS request. The action stays on the <form> so a
   no-JavaScript submit still reaches the script, which mails the raw payload
   rather than losing the enquiry. */
const WHATSAPP_FALLBACK = 'https://wa.me/919717884400?text=Hi%20MG%27s%20Craftvillaa%2C%20I%27d%20like%20to%20enquire.';
const STUDIO_EMAIL = 'mgscraftvilla@gmail.com';
const MAX_UPLOAD_MB = 8;

const readAsBase64 = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });

const collect = async form => {
  const payload = { page: location.pathname.split('/').pop() || 'index.html' };
  for (const field of form.elements) {
    if (!field.name || field.name === '_honey') continue;
    if (field.type === 'file') {
      const file = field.files && field.files[0];
      if (!file) continue;
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        throw new Error(`That file is over ${MAX_UPLOAD_MB} MB, please send it on WhatsApp instead.`);
      }
      payload.fileName = file.name;
      payload.fileType = file.type || 'application/octet-stream';
      payload.fileData = await readAsBase64(file);
      continue;
    }
    /* Checkboxes and radios only count when ticked, and several
       checkboxes can share one name. Join those into a single value so
       the sheet gets "Canvas painting, Fabric painting" in one cell. */
    if (field.type === 'checkbox' || field.type === 'radio') {
      if (!field.checked) continue;
      payload[field.name] = payload[field.name]
        ? payload[field.name] + ', ' + field.value
        : field.value;
      continue;
    }

    payload[field.name] = field.value;
  }
  return payload;
};

const enhanceForm = (form, successText) => {
  if (!form) return;
  const message = form.querySelector('.form-message');
  const submit = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async event => {
    if (!form.reportValidity()) return;
    event.preventDefault();

    /* Honeypot: bots fill every field. Look successful, send nothing. */
    if (form.querySelector('[name="_honey"]')?.value) {
      if (message) message.textContent = successText;
      return;
    }

    const label = submit?.innerHTML;
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Sending…';
    }
    if (message) {
      message.classList.remove('is-error');
      message.textContent = '';
    }

    try {
      const payload = await collect(form);
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const result = await response.json().catch(() => ({ ok: true }));
      if (result.ok === false) throw new Error(result.error || 'The studio inbox rejected that');

      form.reset();
      if (message) message.textContent = successText;
      if (submit) submit.remove();
    } catch (error) {
      if (message) {
        message.classList.add('is-error');
        message.innerHTML =
          `${error.message && /over \d+ MB/.test(error.message) ? error.message + ' ' : 'That didn\u2019t go through. '}` +
          `Please <a href="${WHATSAPP_FALLBACK}">message us on WhatsApp</a> or email ` +
          `<a href="mailto:${STUDIO_EMAIL}">${STUDIO_EMAIL}</a>.`;
      }
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = label;
      }
    }
  });
};

enhanceForm(
  document.querySelector('#visionForm'),
  'Thank you, your commission request is with MG. You\u2019ll hear back personally within a couple of days.'
);
enhanceForm(
  document.querySelector('#waitlistForm'),
  'You\u2019re on the list. We\u2019ll write to you as soon as the next Coffee with Canvas date opens.'
);
enhanceForm(
  document.querySelector('#classesForm'),
  'Thank you. Madhvi will write back about classes that suit you, usually within a couple of days.'
);
