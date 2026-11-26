(() => {
  'use strict';

  const tabs = Array.from(document.querySelectorAll('[data-auth-view]'));
  const panels = Array.from(document.querySelectorAll('[data-auth-panel]'));
  const heading = document.querySelector('#auth-heading');
  const intro = document.querySelector('#auth-intro');
  const message = document.querySelector('#auth-message');

  const copy = {
    signin: ['Welcome back', 'Sign in to view your projects and messages.'],
    register: ['Create your account', 'Set up an account to keep your project activity in one place.'],
    guest: ['Access a guest project', 'Use the email address and project reference associated with your request.'],
    recovery: ['Reset your password', 'Enter the email address connected to your account.']
  };

  function showView(name, focusHeading = false) {
    if (!copy[name]) return;
    panels.forEach((panel) => { panel.hidden = panel.dataset.authPanel !== name; });
    tabs.forEach((tab) => {
      const active = tab.dataset.authView === name;
      if (tab.matches('[role="tab"]')) tab.setAttribute('aria-selected', String(active));
    });
    if (heading) heading.textContent = copy[name][0];
    if (intro) intro.textContent = copy[name][1];
    if (message) {
      message.classList.remove('is-visible');
      message.textContent = '';
    }
    if (focusHeading && heading) heading.focus?.();
  }

  tabs.forEach((control) => {
    control.addEventListener('click', () => showView(control.dataset.authView));
  });

  document.querySelectorAll('[data-demo-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const action = form.dataset.demoForm;
      const notices = {
        signin: 'Preview only: sign-in is not connected yet. Your details were not sent or saved.',
        register: 'Preview only: account creation and email verification will be connected after the secure backend is configured. Nothing was saved.',
        guest: 'Preview only: secure guest-link delivery is not active yet. Your details were not sent or saved.',
        recovery: 'Preview only: password-reset email is not active yet. Your details were not sent or saved.'
      };
      if (message) {
        message.textContent = notices[action] || 'This account action is a preview only.';
        message.classList.add('is-visible');
      }
    });
  });
})();
