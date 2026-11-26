'use strict';

const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.querySelector('#primary-nav');

function closeNavigation({ restoreFocus = false } = {}) {
  if (!menuToggle || !primaryNav) return;
  primaryNav.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open navigation');
  if (restoreFocus) menuToggle.focus();
}

if (menuToggle && primaryNav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = primaryNav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  });

  primaryNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeNavigation());
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && primaryNav.classList.contains('is-open')) {
      closeNavigation({ restoreFocus: true });
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) closeNavigation();
  });
}

const currentYear = document.querySelector('#current-year');
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

// Portfolio filters: these only filter local, illustrative sample concepts.
const filterButtons = document.querySelectorAll('[data-filter]');
const conceptCards = document.querySelectorAll('.concept-card[data-category]');
const portfolioCount = document.querySelector('#portfolio-count');

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selectedFilter = button.dataset.filter || 'all';
    let visibleCount = 0;

    filterButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-pressed', String(isActive));
    });

    conceptCards.forEach((card) => {
      const shouldShow = selectedFilter === 'all' || card.dataset.category === selectedFilter;
      card.hidden = !shouldShow;
      if (shouldShow) visibleCount += 1;
    });

    if (portfolioCount) {
      portfolioCount.textContent = `Showing ${visibleCount} sample concept${visibleCount === 1 ? '' : 's'}`;
    }
  });
});

// Concept dialog: content comes from the local data attributes on each card.
const conceptDialog = document.querySelector('#concept-dialog');
const conceptTitle = document.querySelector('#concept-dialog-title');
const conceptCategory = document.querySelector('#concept-dialog-category');
const conceptDescription = document.querySelector('#concept-dialog-description');
const conceptFeatures = document.querySelector('#concept-dialog-features');
const conceptOpenButtons = document.querySelectorAll('[data-view-concept]');
const conceptCloseButtons = document.querySelectorAll('[data-close-concept]');

if (conceptDialog && conceptTitle && conceptCategory && conceptDescription && conceptFeatures) {
  conceptOpenButtons.forEach((button) => {
    button.addEventListener('click', () => {
      conceptTitle.textContent = button.dataset.title || 'Sample concept';
      conceptCategory.textContent = button.dataset.category || 'SAMPLE CONCEPT';
      conceptDescription.textContent = button.dataset.description || '';
      conceptFeatures.replaceChildren();

      (button.dataset.features || '').split('|').filter(Boolean).forEach((feature) => {
        const item = document.createElement('li');
        item.textContent = feature;
        conceptFeatures.append(item);
      });

      if (typeof conceptDialog.showModal === 'function') {
        conceptDialog.showModal();
      } else {
        window.alert(`${conceptTitle.textContent}\n\n${conceptDescription.textContent}`);
      }
    });
  });

  conceptCloseButtons.forEach((button) => {
    button.addEventListener('click', () => conceptDialog.close());
  });

  conceptDialog.addEventListener('click', (event) => {
    if (event.target === conceptDialog) conceptDialog.close();
  });
}

// Portal status dialog — it deliberately does not collect data or payments.
const portalDialog = document.querySelector('#portal-dialog');
const portalButton = document.querySelector('#portal-info-button');

if (portalDialog && portalButton) {
  portalButton.addEventListener('click', () => {
    if (typeof portalDialog.showModal === 'function') {
      portalDialog.showModal();
    } else {
      window.alert('Start a project request from the secure project intake page. Real submissions require an activated backend. Payments are handled separately and are not collected on this website.');
    }
  });

  portalDialog.querySelectorAll('.dialog-close, .dialog-done').forEach((button) => {
    button.addEventListener('click', () => portalDialog.close());
  });

  portalDialog.addEventListener('click', (event) => {
    if (event.target === portalDialog) portalDialog.close();
  });
}


// Gentle scroll-reveal effect for major public-site sections and cards.
// Elements remain visible if motion is reduced or IntersectionObserver is unavailable.
const revealTargets = document.querySelectorAll(
  '.section-heading, .service-card, .concept-card, .budget-tier-card, .price-card, .payment-panel, .process-grid article, .faq-item, .closing-inner'
);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduceMotion && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -22px 0px' });

  revealTargets.forEach((element) => {
    element.classList.add('reveal-on-scroll');
    revealObserver.observe(element);
  });
}
