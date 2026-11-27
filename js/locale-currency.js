(() => {
  'use strict';
  const PREF_KEY = 'zerodev-locale-v1';
  const RATE_KEY = 'zerodev-fx-usd-v1';
  const countries = [
    ['PH','Philippines','PHP'],['US','United States','USD'],['GB','United Kingdom','GBP'],['CA','Canada','CAD'],['AU','Australia','AUD'],['NZ','New Zealand','NZD'],
    ['SG','Singapore','SGD'],['MY','Malaysia','MYR'],['ID','Indonesia','IDR'],['TH','Thailand','THB'],['VN','Vietnam','VND'],['JP','Japan','JPY'],['KR','South Korea','KRW'],
    ['CN','China','CNY'],['IN','India','INR'],['AE','United Arab Emirates','AED'],['SA','Saudi Arabia','SAR'],['DE','Germany','EUR'],['FR','France','EUR'],['ES','Spain','EUR'],
    ['IT','Italy','EUR'],['NL','Netherlands','EUR'],['IE','Ireland','EUR'],['BR','Brazil','BRL'],['MX','Mexico','MXN'],['ZA','South Africa','ZAR'],['CH','Switzerland','CHF'],['HK','Hong Kong','HKD'],['TW','Taiwan','TWD'],['TR','Türkiye','TRY']
  ].map(([code,name,currency]) => ({code,name,currency}));
  const currencies = ['PHP','USD','EUR','GBP','CAD','AUD','NZD','SGD','MYR','IDR','THB','VND','JPY','KRW','CNY','INR','AED','SAR','BRL','MXN','ZAR','CHF','HKD','TWD','TRY'];
  const currencyNames = new Intl.DisplayNames(['en'], {type:'currency'});
  const countryNames = new Intl.DisplayNames(['en'], {type:'region'});
  const safeStorage = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key,value) { try { localStorage.setItem(key,value); } catch (_) { /* storage disabled */ } }
  };

  function detectCountry() {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const zones = {'Asia/Manila':'PH','Asia/Singapore':'SG','Asia/Kuala_Lumpur':'MY','Asia/Jakarta':'ID','Asia/Bangkok':'TH','Asia/Ho_Chi_Minh':'VN','Asia/Tokyo':'JP','Asia/Seoul':'KR','Asia/Kolkata':'IN','Asia/Dubai':'AE','Asia/Riyadh':'SA','Europe/London':'GB','Europe/Berlin':'DE','Europe/Paris':'FR','Europe/Madrid':'ES','Europe/Rome':'IT','Europe/Amsterdam':'NL','America/Toronto':'CA','America/Vancouver':'CA','America/New_York':'US','America/Los_Angeles':'US','Australia/Sydney':'AU','Pacific/Auckland':'NZ','America/Sao_Paulo':'BR','America/Mexico_City':'MX','Africa/Johannesburg':'ZA','Europe/Zurich':'CH'};
    if (zones[zone]) return zones[zone];
    const tags = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language || ''];
    for (const tag of tags) {
      const match = String(tag).match(/[-_]([A-Z]{2})(?:$|[-_])/i);
      if (match) return match[1].toUpperCase();
    }
    return 'US';
  }

  const detectedCountry = detectCountry();
  let saved = {};
  try { saved = JSON.parse(safeStorage.get(PREF_KEY) || '{}') || {}; } catch (_) { saved = {}; }
  let countryCode = typeof saved.country === 'string' && /^[A-Z]{2}$/.test(saved.country) ? saved.country : detectedCountry;
  let currencyCode = currencies.includes(saved.currency) ? saved.currency : (countries.find((item) => item.code === countryCode)?.currency || 'USD');
  let currencyWasManuallySet = Boolean(saved.manualCurrency && saved.currency && currencies.includes(saved.currency));
  let ratePromise = null;
  let rateData = null;

  function persist() { safeStorage.set(PREF_KEY, JSON.stringify({country:countryCode,currency:currencyCode,manualCurrency:currencyWasManuallySet,updatedAt:new Date().toISOString()})); }
  function currencyLabel(code) { try { return `${code} — ${currencyNames.of(code) || code}`; } catch (_) { return code; } }
  function format(amount, currency = currencyCode) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return '—';
    try { return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2}).format(value); }
    catch (_) { return `${currency} ${value.toFixed(2)}`; }
  }
  async function getRates() {
    const now = Math.floor(Date.now()/1000);
    if (rateData && rateData.time_next_update_unix > now) return rateData.rates;
    try {
      const cached = JSON.parse(safeStorage.get(RATE_KEY) || 'null');
      if (cached?.result === 'success' && cached?.rates && cached.time_next_update_unix > now) {
        rateData = cached;
        return cached.rates;
      }
    } catch (_) { /* ignore broken cache */ }
    if (!ratePromise) {
      ratePromise = fetch('https://open.er-api.com/v6/latest/USD',{method:'GET',mode:'cors',credentials:'omit',cache:'no-store'})
        .then((response) => { if (!response.ok) throw new Error(`Exchange-rate request failed (${response.status}).`); return response.json(); })
        .then((data) => {
          if (data?.result !== 'success' || !data.rates || !Number.isFinite(data.time_next_update_unix)) throw new Error('Exchange-rate data is unavailable.');
          rateData = data;
          safeStorage.set(RATE_KEY, JSON.stringify(data));
          return data.rates;
        })
        .finally(() => { ratePromise = null; });
    }
    return ratePromise;
  }
  async function convert(amount, from, to) {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    if (from === to) return {amount:numeric,rate:1,updatedAt:rateData?.time_last_update_utc || null};
    const rates = await getRates();
    const fromRate = from === 'USD' ? 1 : rates[from];
    const toRate = to === 'USD' ? 1 : rates[to];
    if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0) return null;
    const rate = toRate / fromRate;
    return {amount:numeric * rate,rate,updatedAt:rateData?.time_last_update_utc || null};
  }
  function countryLabel(code) {
    const item = countries.find((country) => country.code === code);
    if (item) return item.name;
    try { return countryNames.of(code) || code; } catch (_) { return code; }
  }
  function refreshSelects() {
    document.querySelectorAll('[data-country-select]').forEach((select) => {
      const options = countries.map((item) => {
        const option = document.createElement('option'); option.value = item.code; option.textContent = `${item.name} (${item.code})`; option.selected = item.code === countryCode; return option;
      });
      if (!countries.some((item) => item.code === countryCode)) {
        const option = document.createElement('option'); option.value = countryCode; option.textContent = `${countryLabel(countryCode)} (${countryCode}) · browser region`; option.selected = true; options.unshift(option);
      }
      select.replaceChildren(...options);
    });
    document.querySelectorAll('[data-currency-select]').forEach((select) => {
      const automatic = document.createElement('option'); automatic.value = 'AUTO'; automatic.textContent = 'Automatic (country default)'; automatic.selected = !currencyWasManuallySet;
      select.replaceChildren(automatic, ...currencies.map((code) => {
        const option = document.createElement('option'); option.value = code; option.textContent = currencyLabel(code); option.selected = currencyWasManuallySet && code === currencyCode; return option;
      }));
    });
    document.querySelectorAll('[data-country-detected]').forEach((node) => { node.textContent = `Country: ${countryLabel(countryCode)} · currency: ${currencyCode}`; });
  }
  function applyBudgetCurrency() {
    const select = document.querySelector('#project-request-form select[name="budget_currency"]');
    if (select && !select.dataset.userChanged) {
      const available = Array.from(select.options).some((option) => option.value === currencyCode);
      if (available) select.value = currencyCode;
    }
  }
  function updateBudgetPreview() {
    const preview = document.querySelector('[data-fx-preview]');
    const form = document.querySelector('#project-request-form');
    if (!preview || !form) return;
    const min = form.querySelector('[name="budget_min"]')?.value;
    const max = form.querySelector('[name="budget_max"]')?.value;
    const source = form.querySelector('[name="budget_currency"]')?.value || currencyCode;
    const values = [min,max].filter((value) => value !== '').map(Number).filter(Number.isFinite);
    if (!values.length || source === currencyCode) {
      preview.textContent = `Your request will be saved in ${source}. Your selected display currency is ${currencyCode}.`;
      return;
    }
    preview.textContent = 'Checking the latest indicative conversion…';
    Promise.all(values.map((value) => convert(value,source,currencyCode))).then((converted) => {
      if (converted.some((item) => !item)) { preview.textContent = 'Conversion is temporarily unavailable. Your entered amount and currency will remain unchanged.'; return; }
      const formatted = converted.map((item) => format(item.amount,currencyCode));
      const range = formatted.length === 2 ? `${formatted[0]} – ${formatted[1]}` : formatted[0];
      const updated = converted.find((item) => item.updatedAt)?.updatedAt;
      preview.textContent = `Indicative equivalent: ${range}${updated ? ` · rate data updated ${updated}` : ''}. This is for estimation only; your submitted budget stays in ${source}.`;
    }).catch(() => { preview.textContent = 'Conversion is temporarily unavailable. Your entered amount and currency will remain unchanged.'; });
  }
  async function refreshCurrencyDisplays() {
    const items = Array.from(document.querySelectorAll('[data-fx-display]'));
    for (const node of items) {
      const amount = Number(node.dataset.fxAmount);
      const base = node.dataset.fxBase || 'USD';
      if (!Number.isFinite(amount)) { node.textContent = '—'; continue; }
      if (base === currencyCode) { node.textContent = format(amount, currencyCode); node.removeAttribute('title'); continue; }
      node.textContent = 'Updating…';
      try {
        const converted = await convert(amount, base, currencyCode);
        node.textContent = converted ? `${format(converted.amount, currencyCode)} (indicative)` : 'Not available';
        if (converted?.updatedAt) node.title = `Indicative exchange-rate data updated ${converted.updatedAt}. This is not a payment rate.`;
        else node.removeAttribute('title');
      } catch (_) { node.textContent = 'Conversion unavailable'; node.removeAttribute('title'); }
    }
  }

  document.addEventListener('change',(event) => {
    const target = event.target;
    if (target.matches('[data-country-select]')) {
      countryCode = target.value;
      if (!currencyWasManuallySet) currencyCode = countries.find((item) => item.code === countryCode)?.currency || 'USD';
      persist(); refreshSelects(); applyBudgetCurrency(); updateBudgetPreview(); void refreshCurrencyDisplays();
    } else if (target.matches('[data-currency-select]')) {
      currencyWasManuallySet = target.value !== 'AUTO';
      currencyCode = currencyWasManuallySet ? target.value : (countries.find((item) => item.code === countryCode)?.currency || 'USD');
      persist(); refreshSelects(); updateBudgetPreview(); void refreshCurrencyDisplays();
    } else if (target.matches('#project-request-form [name="budget_currency"]')) {
      target.dataset.userChanged = 'true'; updateBudgetPreview();
    }
  });
  document.addEventListener('input',(event) => {
    if (event.target.matches('#project-request-form [name="budget_min"], #project-request-form [name="budget_max"]')) updateBudgetPreview();
  });
  refreshSelects();
  applyBudgetCurrency();
  updateBudgetPreview();
  void refreshCurrencyDisplays();

  window.ZeroDevLocale = Object.freeze({
    version:'1.1.0', detectedCountry, get country(){return countryCode;}, get currency(){return currencyCode;}, currencies,
    countryLabel, currencyLabel, format, convert, getRates, updateBudgetPreview, refreshCurrencyDisplays
  });
})();
