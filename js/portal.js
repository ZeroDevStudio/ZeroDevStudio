'use strict';

const navButtons = Array.from(document.querySelectorAll('[data-panel]'));
const panels = Array.from(document.querySelectorAll('[data-view]'));
const pageTitle = document.querySelector('#page-title');
const year = document.querySelector('#current-year');

const panelTitles = {
  overview: 'Overview',
  projects: 'My projects',
  messages: 'Messages',
  notifications: 'Notifications',
  profile: 'Profile'
};

function revealVisibleItems(root = document) {
  const items = root.querySelectorAll('.reveal-item');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

  items.forEach((item) => {
    item.classList.remove('is-revealed');
    observer.observe(item);
  });
}

function showPanel(panelName) {
  if (!panelTitles[panelName]) return;

  navButtons.forEach((button) => {
    const active = button.dataset.panel === panelName;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  panels.forEach((panel) => {
    const active = panel.dataset.view === panelName;
    panel.classList.toggle('is-visible', active);
    panel.hidden = !active;
  });

  if (pageTitle) pageTitle.textContent = panelTitles[panelName];
  revealVisibleItems(document.querySelector(`[data-view="${panelName}"]`));
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => showPanel(button.dataset.panel));
});

document.querySelectorAll('[data-open-panel]').forEach((button) => {
  button.addEventListener('click', () => showPanel(button.dataset.openPanel));
});

document.querySelectorAll('[data-open-profile]').forEach((button) => {
  button.addEventListener('click', () => showPanel('profile'));
});

if (year) year.textContent = String(new Date().getFullYear());
revealVisibleItems();
