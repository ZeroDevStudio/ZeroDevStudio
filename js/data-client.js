(() => {
  'use strict';
  const config = window.ZERO_DEV_BACKEND_CONFIG || { mode: 'demo' };
  let clientPromise = null;
  const SDK_URL = 'https://esm.sh/@supabase/supabase-js@2.119.2';

  const hasConfig = () => config.mode === 'live' &&
    typeof config.supabaseUrl === 'string' && /^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(config.supabaseUrl) &&
    typeof config.supabasePublishableKey === 'string' && config.supabasePublishableKey.trim().length > 10;

  async function getClient() {
    if (!hasConfig()) throw new Error('The secure backend is not configured. Keep demo mode enabled until the setup checklist is complete.');
    if (!clientPromise) {
      clientPromise = import(SDK_URL).then(({ createClient }) => createClient(
        config.supabaseUrl,
        config.supabasePublishableKey,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: 'pkce'
          },
          global: { headers: { 'X-ZeroDev-Version': '1.1.0' } }
        }
      )).catch((error) => { clientPromise = null; throw error; });
    }
    return clientPromise;
  }

  function setNotice(element, message, kind = 'info') {
    if (!element) return;
    element.textContent = message;
    element.dataset.kind = kind;
    element.hidden = !message;
  }

  function statusLabel(value) {
    return String(value || 'new').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  async function requireUser(client, { verified = true } = {}) {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    const user = data?.user;
    if (!user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `../account/index.html?next=${next}`;
      return null;
    }
    if (verified && !user.email_confirmed_at) {
      await client.auth.signOut();
      window.location.href = '../account/index.html?verification=required';
      return null;
    }
    return user;
  }

  window.ZeroDevApp = Object.freeze({
    config, hasConfig, getClient, setNotice, statusLabel, requireUser,
    version: '1.1.0',
    async getVerifiedUser(client) { return requireUser(client, { verified: true }); }
  });
})();
