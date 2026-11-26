(() => {
  'use strict';

  const tabs = Array.from(document.querySelectorAll('[data-auth-view]'));
  const panels = Array.from(document.querySelectorAll('[data-auth-panel]'));
  const heading = document.querySelector('#auth-heading');
  const intro = document.querySelector('#auth-intro');
  const message = document.querySelector('#auth-message');
  const modeNotice = document.querySelector('#auth-mode-notice');
  const verificationEmail = document.querySelector('#verification-email');
  const verificationCopy = document.querySelector('#verification-copy');
  const verificationCode = document.querySelector('#verification-code');
  const verificationWarning = document.querySelector('#verification-preview-warning');
  const signedInEmail = document.querySelector('#signed-in-email');
  const resendButton = document.querySelector('[data-resend-verification]');
  const resendCountdown = document.querySelector('#resend-countdown');
  const config = window.ZERO_DEV_BACKEND_CONFIG || {};

  const copy = {
    signin: ['Welcome back', 'Sign in to view your projects and messages.'],
    register: ['Create your account', 'Set up an account to keep your project activity in one place.'],
    verify: ['Verify your email', 'Enter the one-time code sent to your email address.'],
    guest: ['Access a guest project', 'Use the email address and project reference associated with your request.'],
    recovery: ['Reset your password', 'Enter the email address connected to your account.'],
    newpassword: ['Choose a new password', 'Create a new password for your account.'],
    signedin: ['You are signed in', 'Your account is authenticated. Open your private client workspace to manage project requests.']
  };

  let pendingEmail = '';
  let clientPromise = null;
  let recoveryEventSeen = false;
  let resendTimer = null;
  let resendUntil = 0;

  const isLiveMode = () => config.mode === 'live';
  const hasBackendSettings = () => Boolean(
    typeof config.supabaseUrl === 'string' && /^https:\/\//i.test(config.supabaseUrl) &&
    typeof config.supabasePublishableKey === 'string' && config.supabasePublishableKey.trim()
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
    tabs.forEach((tab) => {
      const active = tab.dataset.authView === name;
      if (tab.matches('[role="tab"]')) tab.setAttribute('aria-selected', String(active));
    });
    if (heading) heading.textContent = copy[name][0];
    if (intro) intro.textContent = copy[name][1];
    clearMessage();
    if (focusHeading && heading) heading.focus?.();
  }

  function maskEmail(email) {
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const local = parts[0];
    const visible = local.length <= 2 ? local.charAt(0) : local.slice(0, 2);
    return `${visible}${'•'.repeat(Math.max(2, Math.min(6, local.length - visible.length)))}@${parts[1]}`;
  }

  function friendlyError(error, action) {
    const code = String(error?.code || '').toLowerCase();
    const text = String(error?.message || '').toLowerCase();
    if (code.includes('email_address_not_authorized') || text.includes('email address not authorized')) {
      return 'The test email sender only delivers to approved project-team addresses. The project owner must configure custom SMTP before testing with other inboxes.';
    }
    if (code.includes('over_email_send_rate_limit') || code.includes('rate_limit') || text.includes('rate limit') || text.includes('too many requests')) {
      return 'Too many email requests were made. Wait a little before trying again.';
    }
    if (text.includes('failed to send') || text.includes('smtp') || text.includes('email provider')) {
      return 'The email service could not send this message. Check the custom SMTP settings, sender address, and provider logs in Supabase.';
    }
    if (action === 'signin' && (text.includes('invalid login') || text.includes('invalid credentials'))) {
      return 'Those sign-in details could not be verified. Check your email and password, or use password recovery.';
    }
    if (action === 'verify' && (text.includes('expired') || text.includes('invalid'))) {
      return 'That code is invalid or expired. Request a fresh code and enter the newest one.';
    }
    if (action === 'register' && text.includes('password')) {
      return 'The password does not meet the authentication service requirements. Use a unique password that meets the displayed rules.';
    }
    return 'The request could not be completed. Check the information and backend settings, then try again.';
  }

  async function getAuthClient() {
    if (!isLiveMode()) return null;
    if (!hasBackendSettings()) {
      throw new Error('Backend configuration is incomplete. The project owner must configure the Supabase URL and publishable key.');
    }
    if (!clientPromise) {
      clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
        .then(({ createClient }) => {
          const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
            auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
          });
          client.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
              recoveryEventSeen = true;
              showView('newpassword', true);
            }
          });
          return client;
        })
        .catch((error) => {
          clientPromise = null;
          throw error;
        });
    }
    return clientPromise;
  }

  function updateModeNotice() {
    if (!modeNotice) return;
    if (!isLiveMode()) {
      modeNotice.textContent = 'Demo mode: account actions and email delivery are disabled. No form details are transmitted or stored.';
      modeNotice.dataset.kind = 'demo';
    } else if (!hasBackendSettings()) {
      modeNotice.textContent = 'Setup incomplete: live authentication is blocked until the project URL, publishable key, email template, and SMTP sender are configured.';
      modeNotice.dataset.kind = 'warning';
    } else {
      modeNotice.textContent = 'Test connection mode: Supabase Auth handles account verification. Email delivery depends on the SMTP provider configured by the project owner.';
      modeNotice.dataset.kind = 'live';
    }
  }

  function setVerificationState(email, liveRequestSucceeded = false) {
    if (verificationEmail) verificationEmail.textContent = maskEmail(email);
    if (verificationCopy) verificationCopy.textContent = liveRequestSucceeded ? 'A confirmation code has been requested for:' : 'Verification is prepared for this email address:';
    if (verificationWarning) {
      verificationWarning.hidden = liveRequestSucceeded;
      if (!liveRequestSucceeded) verificationWarning.textContent = 'Demo preview only: no email has been sent and no code can be verified until the backend and sender are configured.';
    }
  }

  function startResendCooldown(seconds = 60) {
    if (!resendButton) return;
    window.clearInterval(resendTimer);
    resendUntil = Date.now() + seconds * 1000;
    resendButton.disabled = true;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000));
      if (resendCountdown) resendCountdown.textContent = remaining ? `Resend available in ${remaining}s` : '';
      if (remaining === 0) {
        resendButton.disabled = false;
        window.clearInterval(resendTimer);
        resendTimer = null;
      }
    };
    update();
    resendTimer = window.setInterval(update, 1000);
  }

  function getFormValues(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function demoMessage(action) {
    const notices = {
      signin: 'Preview only: sign-in is not connected. Your details were not sent or saved.',
      verify: 'Preview only: no verification code was sent, so this address cannot be verified.',
      guest: 'Preview only: secure guest-link delivery is not active. Your details were not sent or saved.',
      recovery: 'Preview only: password-reset email is not active. Your details were not sent or saved.',
      'new-password': 'Preview only: password updates are not connected.',
      register: 'Preview only: no account was created and no verification email was sent.'
    };
    showMessage(notices[action] || 'This account action is a preview only.');
  }

  async function handleLiveSubmit(form, action) {
    let client;
    try {
      client = await getAuthClient();
    } catch (error) {
      showMessage(error.message || 'Authentication setup is incomplete.', 'error');
      return;
    }
    if (!client) { demoMessage(action); return; }

    const values = getFormValues(form);
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      if (action === 'register') {
        const email = String(values.email || '').trim().toLowerCase();
        const fullName = String(values.name || '').trim();
        const { data, error } = await client.auth.signUp({
          email,
          password: String(values.password || ''),
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        if (data?.session) {
          await client.auth.signOut();
          throw new Error('Email confirmation appears to be disabled. Enable email confirmations before testing.');
        }
        if (!data?.user) throw new Error('Registration could not be started.');
        if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          showView('signin');
          showMessage('If an account is associated with that address, use sign-in or password recovery.', 'info');
          return;
        }
        pendingEmail = email;
        setVerificationState(email, true);
        if (verificationCode) verificationCode.value = '';
        form.reset();
        showView('verify');
        setVerificationState(email, true);
        startResendCooldown(60);
        showMessage('The confirmation request was accepted. Check your inbox and spam folder. If it does not arrive, the project owner should check SMTP delivery.', 'success');
        verificationCode?.focus();
        return;
      }

      if (action === 'signin') {
        const { data, error } = await client.auth.signInWithPassword({
          email: String(values.email || '').trim().toLowerCase(),
          password: String(values.password || '')
        });
        if (error) throw error;
        if (signedInEmail) signedInEmail.textContent = data.user?.email || 'Your account';
        form.reset();
        showView('signedin');
        showMessage('Authentication succeeded. Open your private client workspace to continue.', 'success');
        return;
      }

      if (action === 'verify') {
        if (!pendingEmail) throw new Error('Return to registration and request a new confirmation code.');
        const { data, error } = await client.auth.verifyOtp({
          email: pendingEmail,
          token: String(values.code || '').trim(),
          type: 'email'
        });
        if (error) throw error;
        if (signedInEmail) signedInEmail.textContent = data.user?.email || pendingEmail;
        form.reset();
        window.clearInterval(resendTimer);
        resendTimer = null;
        pendingEmail = '';
        showView('signedin');
        showMessage('Email verified successfully. Your account is authenticated. Open your client workspace to continue.', 'success');
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

      if (action === 'guest') {
        showMessage('Secure guest access is not connected yet. Guest access needs its own email verification and private-token flow.', 'warning');
        return;
      }

      if (action === 'new-password') {
        const password = String(values.password || '');
        const confirmation = String(values.confirmPassword || '');
        if (password !== confirmation) throw new Error('The passwords do not match.');
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        form.reset();
        showView('signedin');
        showMessage('Your password has been updated.', 'success');
      }
    } catch (error) {
      showMessage(friendlyError(error, action), 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  tabs.forEach((control) => control.addEventListener('click', () => showView(control.dataset.authView)));

  document.querySelectorAll('[data-auth-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const action = form.dataset.authForm;
      if (!isLiveMode()) {
        if (action === 'register') {
          const emailField = form.querySelector('input[name="email"]');
          pendingEmail = emailField?.value.trim().toLowerCase() || '';
          setVerificationState(pendingEmail || 'you@example.com', false);
          const passwordField = form.querySelector('input[name="password"]');
          if (passwordField) passwordField.value = '';
          if (verificationCode) verificationCode.value = '';
          showView('verify');
        }
        demoMessage(action);
        return;
      }
      void handleLiveSubmit(form, action);
    });
  });

  resendButton?.addEventListener('click', async () => {
    if (!isLiveMode()) {
      const destination = pendingEmail ? maskEmail(pendingEmail) : 'your email address';
      showMessage(`Demo preview: a live service would request a fresh code for ${destination}. No email was sent.`);
      return;
    }
    if (!pendingEmail) {
      showMessage('Return to registration and request a new confirmation code.', 'error');
      return;
    }
    resendButton.disabled = true;
    try {
      const client = await getAuthClient();
      const { error } = await client.auth.resend({ type: 'signup', email: pendingEmail });
      if (error) throw error;
      startResendCooldown(60);
      showMessage('A fresh confirmation email was requested. Use the newest code and check your spam folder too.', 'success');
    } catch (error) {
      resendButton.disabled = false;
      showMessage(friendlyError(error, 'register'), 'error');
    }
  });

  document.querySelector('[data-sign-out]')?.addEventListener('click', async () => {
    try {
      const client = await getAuthClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      pendingEmail = '';
      showView('signin');
      showMessage('You have been signed out.', 'success');
    } catch (error) {
      showMessage(error?.message || 'Sign-out could not be completed.', 'error');
    }
  });

  verificationCode?.addEventListener('input', () => {
    verificationCode.value = verificationCode.value.replace(/\D/g, '').slice(0, 6);
  });

  updateModeNotice();

  if (isLiveMode() && hasBackendSettings()) {
    getAuthClient().then((client) => client.auth.getSession()).then(({ data, error }) => {
      if (error) throw error;
      if (data.session) {
        if (recoveryEventSeen || new URLSearchParams(window.location.search).get('flow') === 'recovery') {
          showView('newpassword', true);
        } else {
          if (signedInEmail) signedInEmail.textContent = data.session.user?.email || 'Your account';
          showView('signedin');
          showMessage('You are signed in. Your private project workspace is ready when the backend is configured.', 'success');
        }
      }
    }).catch(() => showMessage('The authentication service could not be reached. Check the project configuration and connection.', 'error'));
  }
})();
