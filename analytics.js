/* ------------------------------------------------------------------
   Cloudflare Web Analytics.

   Chosen because it is free with no traffic cap, sets no cookies and
   stores nothing in the browser, so the site still needs no cookie
   banner, and the privacy page's promise holds.

   ── THE ONLY LINE YOU EVER EDIT ──
   Paste the token from your Cloudflare dashboard between the quotes
   below. Leave it empty and nothing loads at all, which is why it is
   safe to deploy this file before you have signed up.
------------------------------------------------------------------- */

const CLOUDFLARE_ANALYTICS_TOKEN = '4bfe26dced1b4764acef6d0cc77fc4bc';

if (CLOUDFLARE_ANALYTICS_TOKEN) {
  const beacon = document.createElement('script');
  beacon.defer = true;
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.setAttribute('data-cf-beacon', JSON.stringify({ token: CLOUDFLARE_ANALYTICS_TOKEN }));
  document.head.appendChild(beacon);
}
