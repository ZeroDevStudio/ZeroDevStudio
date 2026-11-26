(() => {
  'use strict';
  const config = window.ZERO_DEV_BACKEND_CONFIG || { mode: 'demo' };
  let clientPromise = null;
  const hasConfig = () => config.mode === 'live' &&
    typeof config.supabaseUrl === 'string' && /^https:\/\//i.test(config.supabaseUrl) &&
    typeof config.supabasePublishableKey === 'string' && config.supabasePublishableKey.trim().length > 10;

  async function getClient() {
    if (!hasConfig()) throw new Error('The secure backend is not configured. Keep demo mode enabled until the setup guide is completed.');
    if (!clientPromise) {
      clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
        .then(({ createClient }) => createClient(config.supabaseUrl, config.supabasePublishableKey, {
          auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
        }))
        .catch((error) => { clientPromise = null; throw error; });
    }
    return clientPromise;
  }

  function setNotice(element, message, kind = 'info') {
    if (!element) return;
    element.textContent = message;
    element.dataset.kind = kind;
    element.hidden = !message;
  }

  function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  window.ZeroDevApp = Object.freeze({
    config,
    hasConfig,
    getClient,
    setNotice,
    escapeText,
    statusLabel(value) {
      return String(value || 'new').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    },
    async requireUser(client) {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      if (!data?.user) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `../account/index.html?next=${next}`;
        return null;
      }
      return data.user;
    }
  });
})();
