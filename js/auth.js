(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const tabs = Array.from(document.querySelectorAll('.auth-tab[data-auth-view]'));
  const panels = Array.from(document.querySelectorAll('[data-auth-panel]'));
  const heading = $('#auth-heading');
  const intro = $('#auth-intro');
  const message = $('#auth-message');
  const modeNotice = $('#auth-mode-notice');
  const verificationEmail = $('#verification-email');
  const verificationCopy = $('#verification-copy');
  const verificationCode = $('#verification-code');
  const verificationWarning = $('#verification-preview-warning');
  const signedInEmail = $('#signed-in-email');
  const resendButton = $('[data-resend-verification]');
  const resendCountdown = $('#resend-countdown');
  const config = window.ZERO_DEV_BACKEND_CONFIG || { mode: 'demo' };
  const PENDING_EMAIL_KEY = 'zerodev.pending-verification-email';
  const SDK_URL = 'https://esm.sh/@supabase/supabase-js@2.119.2';

  const copy = {
    signin: ['Welcome back', 'Sign in to view your projects and messages.'],
    register: ['Create your account', 'Set up an account to keep your project activity in one place.'],
    verify: ['Verify your email', 'Enter the newest one-time code sent to your email address.'],
    guest: ['Guest access is not active', 'Project references alone never grant access. Use a verified account for private project information.'],
    recovery: ['Reset your password', 'Enter the email address connected to your account.'],
    newpassword: ['Choose a new password', 'Create a unique password for your account.'],
    changeemail: ['Change your email address', 'Supabase will send confirmation messages before the new address becomes active.'],
    signedin: ['You are signed in', 'Your account is authenticated. Open your private client workspace to manage project requests.']
  };

  let pendingEmail = '';
  let clientPromise = null;
  let resendTimer = null;
  let resendUntil = 0;
  let currentUser = null;

  const isLiveMode = () => config.mode === 'live';
  const hasBackendSettings = () => Boolean(
    typeof config.supabaseUrl === 'string' && /^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(config.supabaseUrl) &&
    typeof config.supabasePublishableKey === 'string' && config.supabasePublishableKey.trim().length > 10
  );

  function showMessage(text, kind = 'info') {
    if (!message) return;
    message.textContent = text;
    message.dataset.kind = kind;
    message.classList.add('is-visible');
  }
  function clearMessage() {
    if (!message) return;
    message.classList.remove('is-visible');
    message.textContent = '';
    delete message.dataset.kind;
  }
  function showView(name, focusHeading = false) {
    if (!copy[name]) return;
    panels.forEach((panel) => { panel.hidden = panel.dataset.authPanel !== name; });
    tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.authView === name)));
    if (heading) heading.textContent = copy[name][0];
    if (intro) intro.textContent = copy[name][1];
    clearMessage();
    if (focusHeading && heading) heading.focus();
  }
  function maskEmail(email) {
    const parts = String(email || '').split('@');
    if (parts.length !== 2) return 'your email address';
    const local = parts[0];
    return `${local.slice(0, Math.min(2, local.length))}${'•'.repeat(Math.max(2, Math.min(6, local.length - 2)))}@${parts[1]}`;
  }
  function savePendingEmail(email) {
    pendingEmail = String(email || '').trim().toLowerCase();
    if (isLiveMode()) {
      try { sessionStorage.setItem(PENDING_EMAIL_KEY, pendingEmail); } catch (_) { /* private browsing can block storage */ }
    }
  }
  function clearPendingEmail() {
    pendingEmail = '';
    try { sessionStorage.removeItem(PENDING_EMAIL_KEY); } catch (_) { /* ignore */ }
  }
  function safeNextPath() {
    const raw = new URLSearchParams(window.location.search).get('next') || '';
    if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '';
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin || url.pathname.endsWith('/account/index.html')) return '';
      return url.pathname + url.search + url.hash;
    } catch (_) { return ''; }
  }
  function continueToNext() {
    const next = safeNextPath();
    if (next) window.location.assign(next);
  }
  function friendlyError(error, action) {
    const code = String(error?.code || '').toLowerCase();
    const text = String(error?.message || '').toLowerCase();
    if (code.includes('email_address_not_authorized') || text.includes('email address not authorized')) return 'The test sender only delivers to approved addresses. The project owner must configure custom SMTP before testing other inboxes.';
    if (code.includes('over_email_send_rate_limit') || code.includes('rate_limit') || text.includes('rate limit') || text.includes('too many requests')) return 'The email provider is limiting requests. Wait before requesting another message.';
    if (text.includes('failed to send') || text.includes('smtp') || text.includes('email provider')) return 'The email service could not send this message. The project owner should review SMTP settings and provider logs.';
    if (action === 'signin' && (text.includes('invalid login') || text.includes('invalid credentials'))) return 'Those sign-in details could not be verified. Check them or use password recovery.';
    if (action === 'verify' && (text.includes('expired') || text.includes('invalid'))) return 'That code is invalid or expired. Request a fresh code and use the newest message.';
    if (action === 'register' && text.includes('password')) return 'The password does not meet the authentication service rules. Use a longer, unique password.';
    if (action === 'change-email' && (text.includes('same') || text.includes('already'))) return 'Enter a different email address that is not already in use.';
    return 'The request could not be completed. Check the details and connection, then try again.';
  }
  async function getAuthClient() {
    if (!isLiveMode()) return null;
    if (!hasBackendSettings()) throw new Error('Backend configuration is incomplete. The project owner must configure the Supabase URL and publishable key.');
    if (!clientPromise) {
      clientPromise = import(SDK_URL).then(({ createClient }) => createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' }
      })).catch((error) => { clientPromise = null; throw error; });
    }
    return clientPromise;
  }
  function updateModeNotice() {
    if (!modeNotice) return;
    if (!isLiveMode()) {
      modeNotice.textContent = 'Demo mode: account actions and email delivery are disabled. Form data is not transmitted or saved.';
      modeNotice.dataset.kind = 'demo';
    } else if (!hasBackendSettings()) {
      modeNotice.textContent = 'Setup incomplete: live authentication is blocked until Supabase and the email sender are configured.';
      modeNotice.dataset.kind = 'warning';
    } else {
      modeNotice.textContent = 'Development backend: Supabase Auth handles verification and recovery. Delivery depends on the SMTP sender configured by the project owner.';
      modeNotice.dataset.kind = 'live';
    }
  }
  function setVerificationState(email, sent = false) {
    if (verificationEmail) verificationEmail.textContent = maskEmail(email);
    if (verificationCopy) verificationCopy.textContent = sent ? 'A confirmation code was requested for:' : 'Verification preview for:';
    if (verificationWarning) {
      verificationWarning.hidden = sent;
      if (!sent) verificationWarning.textContent = 'Demo preview only: no email was sent and no code can be verified.';
    }
  }
  function startResendCooldown(seconds = 60) {
    if (!resendButton) return;
    window.clearInterval(resendTimer);
    resendUntil = Date.now() + seconds * 1000;
    resendButton.disabled = true;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000));
      if (resendCountdown) resendCountdown.textContent = remaining ? `Resend available in ${remaining}s` : 'You can request another code.';
      if (!remaining) { resendButton.disabled = false; window.clearInterval(resendTimer); resendTimer = null; }
    };
    update();
    resendTimer = window.setInterval(update, 1000);
  }
  function formValues(form) { return Object.fromEntries(new FormData(form).entries()); }
  function demoMessage(action) {
    const messages = {
      signin: 'Preview only: sign-in is disabled. Your details were not sent or saved.',
      verify: 'Preview only: no verification code was sent, so this address cannot be verified.',
      guest: 'Guest access is not active. No project information is retrieved.',
      recovery: 'Preview only: password-reset email is disabled.',
      'new-password': 'Preview only: password updates are disabled.',
      'change-email': 'Preview only: email changes and confirmation messages are disabled.',
      register: 'Preview only: no account was created and no email was sent.'
    };
    showMessage(messages[action] || 'This account action is a preview only.', 'warning');
  }
  async function setSignedIn(user) {
    currentUser = user || null;
    if (!user?.email_confirmed_at) {
      const email = user?.email || pendingEmail;
      if (email) savePendingEmail(email);
      try { const client = await getAuthClient(); await client?.auth.signOut(); } catch (_) { /* protected pages also enforce verification */ }
      setVerificationState(email, true);
      showView('verify', true);
      showMessage('This account still needs email verification. Enter the newest code or request another one.', 'warning');
      startResendCooldown(60);
      return;
    }
    clearPendingEmail();
    if (signedInEmail) signedInEmail.textContent = user.email || 'Your account';
    showView('signedin');
    showMessage('Email verified. Your account is ready to use.', 'success');
    window.setTimeout(continueToNext, 500);
  }
  async function handleLiveSubmit(form, action) {
    let client;
    try { client = await getAuthClient(); }
    catch (error) { showMessage(error.message || 'Authentication setup is incomplete.', 'error'); return; }
    if (!client) { demoMessage(action); return; }
    const values = formValues(form);
    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    try {
      if (action === 'register') {
        const email = String(values.email || '').trim().toLowerCase();
        const name = String(values.name || '').trim();
        const password = String(values.password || '');
        if (password.length < 12) throw new Error('Use a unique password with at least 12 characters.');
        const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (error) throw error;
        if (!data?.user) throw new Error('Registration could not be started.');
        if (data.session) {
          await client.auth.signOut();
          throw new Error('Email confirmation appears to be disabled. The project owner must enable it before signup testing.');
        }
        if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          showView('signin');
          showMessage('If an account is associated with that address, use sign-in or password recovery.', 'info');
          return;
        }
        savePendingEmail(email);
        form.reset();
        setVerificationState(email, true);
        if (verificationCode) verificationCode.value = '';
        showView('verify');
        setVerificationState(email, true);
        startResendCooldown(60);
        showMessage('Confirmation request accepted. Check your inbox and spam folder. If it does not arrive, the project owner should review SMTP delivery.', 'success');
        verificationCode?.focus();
        return;
      }
      if (action === 'signin') {
        const email = String(values.email || '').trim().toLowerCase();
        const { data, error } = await client.auth.signInWithPassword({ email, password: String(values.password || '') });
        if (error) {
          const errorText = String(error.message || '').toLowerCase();
          const errorCode = String(error.code || '').toLowerCase();
          if (errorCode.includes('email_not_confirmed') || errorText.includes('email not confirmed')) {
            savePendingEmail(email);
            setVerificationState(email, true);
            showView('verify', true);
            startResendCooldown(60);
            showMessage('Your email address is not verified yet. Check your inbox or request a new confirmation code.', 'warning');
            return;
          }
          throw error;
        }
        if (!data?.user?.email_confirmed_at) {
          const email = data?.user?.email || String(values.email || '').trim().toLowerCase();
          await client.auth.signOut();
          savePendingEmail(email);
          setVerificationState(email, true);
          showView('verify');
          startResendCooldown(60);
          showMessage('Your email address is not verified yet. Check your inbox or request a new confirmation code.', 'warning');
          return;
        }
        form.reset();
        await setSignedIn(data.user);
        return;
      }
      if (action === 'verify') {
        if (!pendingEmail) throw new Error('Return to registration or sign-in and request a new confirmation code.');
        const code = String(values.code || '').replace(/\D/g, '').slice(0, 6);
        if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code from the newest confirmation email.');
        const { data, error } = await client.auth.verifyOtp({ email: pendingEmail, token: code, type: 'email' });
        if (error) throw error;
        if (!data?.user?.email_confirmed_at) throw new Error('The provider did not confirm this email. Request a fresh code and try again.');
        form.reset();
        window.clearInterval(resendTimer);
        clearPendingEmail();
        await setSignedIn(data.user);
        showMessage('Email verified successfully. Your account is ready.', 'success');
        return;
      }
      if (action === 'recovery') {
        const email = String(values.email || '').trim().toLowerCase();
        const redirectTo = `${window.location.origin}${window.location.pathname}?flow=recovery`;
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        form.reset();
        showMessage('If an account is associated with that address, password-reset instructions will be sent. Check your inbox.', 'success');
        return;
      }
      if (action === 'new-password') {
        const password = String(values.password || '');
        if (password.length < 12) throw new Error('Use a unique password with at least 12 characters.');
        if (password !== String(values.confirmPassword || '')) throw new Error('The passwords do not match.');
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError || !sessionData?.session) throw new Error('This recovery session is missing or expired. Request a new password-reset email.');
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        form.reset();
        await client.auth.signOut();
        window.history.replaceState(null, '', window.location.pathname);
        showView('signin');
        showMessage('Your password was updated. Sign in with your new password.', 'success');
        return;
      }
      if (action === 'change-email') {
        const email = String(values.email || '').trim().toLowerCase();
        if (!currentUser) throw new Error('Sign in again before changing your email address.');
        const { error } = await client.auth.updateUser({ email });
        if (error) throw error;
        form.reset();
        showView('signedin');
        showMessage('Email-change request accepted. Follow the confirmation message(s) from Supabase. Your account email changes only after the required confirmation steps.', 'success');
        return;
      }
      if (action === 'guest') {
        showMessage('Secure guest access is not included. Sign in with a verified account to view private tickets.', 'warning');
      }
    } catch (error) {
      const raw = String(error?.message || '').toLowerCase();
      showMessage(error.message && (raw.includes('12 characters') || raw.includes('do not match') || raw.includes('expired') || raw.includes('missing')) ? error.message : friendlyError(error, action), 'error');
      if (raw.includes('rate limit') || raw.includes('too many')) startResendCooldown(90);
    } finally {
      if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
    }
  }

  document.querySelectorAll('[data-auth-view]').forEach((control) => control.addEventListener('click', () => showView(control.dataset.authView, false)));
  document.querySelectorAll('[data-auth-form]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault();
    const action = form.dataset.authForm;
    if (!isLiveMode()) {
      if (action === 'register') {
        const email = form.querySelector('input[name="email"]')?.value || '';
        setVerificationState(email, false);
        if (verificationCode) verificationCode.value = '';
        showView('verify');
      }
      demoMessage(action);
      return;
    }
    void handleLiveSubmit(form, action);
  }));

  resendButton?.addEventListener('click', async () => {
    if (!isLiveMode()) { showMessage('Demo preview: no verification email was sent.', 'warning'); return; }
    if (!pendingEmail) { showMessage('Return to registration or sign-in and request a new confirmation code.', 'error'); return; }
    resendButton.disabled = true;
    try {
      const client = await getAuthClient();
      const { error } = await client.auth.resend({ type: 'signup', email: pendingEmail });
      if (error) throw error;
      startResendCooldown(60);
      showMessage('A fresh confirmation email was requested. Use the newest code.', 'success');
    } catch (error) {
      showMessage(friendlyError(error, 'register'), 'error');
      if (String(error?.message || '').toLowerCase().includes('rate')) startResendCooldown(90);
      else resendButton.disabled = false;
    }
  });

  $('[data-sign-out]')?.addEventListener('click', async () => {
    try {
      const client = await getAuthClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      currentUser = null;
      clearPendingEmail();
      showView('signin');
      showMessage('You have been signed out.', 'success');
    } catch (error) { showMessage(error.message || 'Sign-out could not be completed.', 'error'); }
  });

  verificationCode?.addEventListener('input', () => { verificationCode.value = verificationCode.value.replace(/\D/g, '').slice(0, 6); });
  updateModeNotice();

  if (isLiveMode()) {
    try { pendingEmail = sessionStorage.getItem(PENDING_EMAIL_KEY) || ''; } catch (_) { pendingEmail = ''; }
    const initialParams = new URLSearchParams(window.location.search);
    if (pendingEmail && initialParams.get('flow') !== 'recovery') {
      setVerificationState(pendingEmail, true);
      showView('verify');
      startResendCooldown(60);
    } else if (initialParams.get('verification') === 'required' && pendingEmail) {
      setVerificationState(pendingEmail, true);
      showView('verify');
    }
    if (hasBackendSettings()) {
      getAuthClient().then(async (client) => {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        const flow = new URLSearchParams(window.location.search).get('flow');
        const isRecoveryFlow = flow === 'recovery' || window.location.hash.includes('type=recovery');
        if (isRecoveryFlow) {
          if (data.session?.user) {
            currentUser = data.session.user;
            showView('newpassword', true);
          } else {
            showView('recovery', true);
            showMessage('This password-reset session is missing or expired. Request a fresh reset email to continue.', 'warning');
          }
        } else if (data.session?.user) {
          currentUser = data.session.user;
          await setSignedIn(data.session.user);
        }
        client.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY') showView('newpassword', true);
          if (event === 'USER_UPDATED' && session?.user) currentUser = session.user;
        });
      }).catch(() => showMessage('The authentication service could not be reached. Check the project URL, publishable key, and connection.', 'error'));
    }
  }
})();
