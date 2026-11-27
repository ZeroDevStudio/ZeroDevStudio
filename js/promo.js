(() => {
  'use strict';

  const PROMO_CODE = 'NEW26';
  const DEMO_STORAGE_KEY = 'zerodev-demo-promo-new26';
  const config = window.ZERO_DEV_BACKEND_CONFIG || { mode: 'demo' };
  let supabasePromise = null;
  let activeRedemption = null;

  const formElements = Array.from(document.querySelectorAll('[data-promo-form]'));
  const statuses = Array.from(document.querySelectorAll('[data-promo-status]'));
  const appliedChips = Array.from(document.querySelectorAll('[data-promo-applied]'));
  const priceBlocks = Array.from(document.querySelectorAll('[data-promo-price]'));
  const tierPriceBlocks = Array.from(document.querySelectorAll('[data-promo-tier]'));

  const hasLiveConfig = () => Boolean(
    config.mode === 'live' &&
    typeof config.supabaseUrl === 'string' && /^https:\/\//i.test(config.supabaseUrl) &&
    typeof config.supabasePublishableKey === 'string' && config.supabasePublishableKey.trim()
  );

  async function getSupabaseClient() {
    if (!hasLiveConfig()) throw new Error('Live promotion redemption is not configured.');
    if (!supabasePromise) {
      supabasePromise = import('https://esm.sh/@supabase/supabase-js@2.119.2')
        .then(({ createClient }) => createClient(config.supabaseUrl, config.supabasePublishableKey, {
          auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
        }))
        .catch((error) => {
          supabasePromise = null;
          throw error;
        });
    }
    return supabasePromise;
  }

  function setStatus(message, kind = 'info') {
    statuses.forEach((element) => {
      element.textContent = message;
      element.dataset.kind = kind;
      element.hidden = !message;
    });
  }

  function setApplied(redemption, mode = 'live') {
    activeRedemption = redemption;
    const percent = Number(redemption.discountPercent || redemption.discount_percent || 10);
    appliedChips.forEach((element) => { element.hidden = false; });
    formElements.forEach((form) => {
      const input = form.querySelector('input[name="code"]');
      const button = form.querySelector('button[type="submit"]');
      if (input) {
        input.value = PROMO_CODE;
        input.disabled = true;
        input.setAttribute('aria-label', `Promo code ${PROMO_CODE} applied`);
      }
      if (button) {
        button.disabled = true;
        button.textContent = 'Applied';
      }
    });
    tierPriceBlocks.forEach((block) => {
      block.classList.add('is-promo-applied');
      block.querySelectorAll('[data-tier-standard]').forEach((element) => { element.hidden = true; });
      block.querySelectorAll('[data-tier-discounted], [data-tier-badge], [data-tier-original]').forEach((element) => { element.hidden = false; });
    });
    priceBlocks.forEach((block) => {
      block.classList.add('is-promo-applied');
      const standard = block.querySelector('[data-price-standard]');
      const discounted = block.querySelector('[data-price-discounted]');
      const standardPhp = block.querySelector('[data-price-php-standard]');
      const discountedPhp = block.querySelector('[data-price-php-discount]');
      const original = block.querySelector('[data-promo-original]');
      const badge = block.querySelector('[data-promo-badge]');
      const note = block.querySelector('[data-promo-price-note]');
      if (standard) standard.hidden = true;
      if (discounted) discounted.hidden = false;
      if (standardPhp) standardPhp.hidden = true;
      if (discountedPhp) discountedPhp.hidden = false;
      if (original) original.hidden = false;
      if (badge) {
        badge.hidden = false;
        badge.textContent = `${percent}% OFF`;
      }
      if (note) note.hidden = false;
    });
    setStatus(
      mode === 'demo'
        ? 'Preview applied in this browser. Real one-use-per-account redemption requires the connected backend.'
        : `${PROMO_CODE} applied to this account. Your 10% discount is saved for one eligible project.`,
      mode === 'demo' ? 'warning' : 'success'
    );
  }

  function clearApplied() {
    activeRedemption = null;
    appliedChips.forEach((element) => { element.hidden = true; });
    formElements.forEach((form) => {
      const input = form.querySelector('input[name="code"]');
      const button = form.querySelector('button[type="submit"]');
      if (input) {
        input.disabled = false;
        input.value = '';
        input.setAttribute('aria-label', 'Enter studio discount code');
      }
      if (button) {
        button.disabled = false;
        button.innerHTML = 'Apply code <span aria-hidden="true">→</span>';
      }
    });
    tierPriceBlocks.forEach((block) => {
      block.classList.remove('is-promo-applied');
      block.querySelectorAll('[data-tier-discounted], [data-tier-badge], [data-tier-original]').forEach((element) => { element.hidden = true; });
      block.querySelectorAll('[data-tier-standard]').forEach((element) => { element.hidden = false; });
    });
    priceBlocks.forEach((block) => {
      block.classList.remove('is-promo-applied');
      block.querySelectorAll('[data-price-discounted], [data-price-php-discount], [data-promo-original], [data-promo-badge], [data-promo-price-note]')
        .forEach((element) => { element.hidden = true; });
      block.querySelectorAll('[data-price-standard], [data-price-php-standard]')
        .forEach((element) => { element.hidden = false; });
    });
  }

  async function refreshLiveStatus() {
    const client = await getSupabaseClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!userData?.user) return;
    const { data, error } = await client.rpc('get_my_promo_status');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setApplied({ discountPercent: row.discount_percent, redeemedAt: row.redeemed_at }, 'live');
  }

  async function redeemLive(code) {
    const client = await getSupabaseClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!userData?.user) {
      throw new Error('Sign in with a verified account first. This offer can only be redeemed once per registered account.');
    }
    const { data, error } = await client.rpc('redeem_promo_code', { p_code: code });
    if (error) {
      const raw = String(error.message || '').toLowerCase();
      if (raw.includes('already') || raw.includes('duplicate')) {
        await refreshLiveStatus();
        throw new Error('This account has already redeemed NEW26. The one-time discount cannot be used again.');
      }
      if (raw.includes('invalid') || raw.includes('inactive') || raw.includes('expired')) {
        throw new Error('That code is invalid or no longer active. Check the code and try again.');
      }
      throw new Error('The code could not be redeemed. Confirm that the promotion and ticket migrations are installed in the development project, then try again.');
    }
    const row = Array.isArray(data) ? data[0] : data;
    setApplied({ discountPercent: row?.discount_percent || 10, redeemedAt: row?.redeemed_at }, 'live');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.querySelector('input[name="code"]');
    const button = form.querySelector('button[type="submit"]');
    const code = String(input?.value || '').trim().toUpperCase();
    if (!code) return;
    if (code !== PROMO_CODE) {
      setStatus('That code was not recognized. Look around the page for the studio easter egg.', 'error');
      input?.focus();
      return;
    }
    if (button) button.disabled = true;
    setStatus('Checking your code…', 'info');
    try {
      if (config.mode === 'demo') {
        const preview = { code: PROMO_CODE, discountPercent: 10, redeemedAt: new Date().toISOString() };
        try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(preview)); } catch (_) { /* storage may be unavailable */ }
        setApplied(preview, 'demo');
        return;
      }
      await redeemLive(code);
    } catch (error) {
      setStatus(error.message || 'The code could not be applied. Please try again.', 'error');
    } finally {
      if (button && !activeRedemption) button.disabled = false;
    }
  }

  formElements.forEach((form) => form.addEventListener('submit', handleSubmit));

  // Promo status is read from the authenticated account in live mode. Demo mode
  // only remembers the preview in this browser and is not a security control.
  if (config.mode === 'demo') {
    try {
      const saved = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || 'null');
      if (saved?.code === PROMO_CODE) setApplied(saved, 'demo');
    } catch (_) { /* start with the original prices if storage is unavailable */ }
  } else if (hasLiveConfig()) {
    refreshLiveStatus().catch(() => {
      setStatus('Sign in with your account to check whether NEW26 has already been redeemed.', 'info');
    });
  } else {
    setStatus('Promotion redemption is disabled until the secure backend is configured.', 'warning');
  }
})();
