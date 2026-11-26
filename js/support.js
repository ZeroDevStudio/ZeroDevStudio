(() => {
  'use strict';
  const form = document.querySelector('[data-support-search-form]');
  const input = document.querySelector('#support-search-input');
  const articles = Array.from(document.querySelectorAll('[data-article]'));
  const groups = Array.from(document.querySelectorAll('[data-article-group]'));
  const cards = Array.from(document.querySelectorAll('[data-topic-card]'));
  const noResults = document.querySelector('[data-no-results]');
  const count = document.querySelector('[data-article-count]');

  function filterTopics(query) {
    const normalized = String(query || '').trim().toLowerCase();
    let visibleCount = 0;
    articles.forEach((article) => {
      const haystack = `${article.textContent} ${article.dataset.search || ''}`.toLowerCase();
      const visible = !normalized || haystack.includes(normalized);
      article.hidden = !visible;
      if (visible) visibleCount += 1;
      if (visible && normalized) article.open = true;
    });
    groups.forEach((group) => {
      const hasVisible = Array.from(group.querySelectorAll('[data-article]')).some((article) => !article.hidden);
      group.hidden = !hasVisible;
    });
    cards.forEach((card) => {
      const haystack = `${card.textContent} ${card.dataset.search || ''}`.toLowerCase();
      card.hidden = Boolean(normalized) && !haystack.includes(normalized);
    });
    if (noResults) noResults.hidden = visibleCount > 0;
    if (count) count.textContent = `${visibleCount} ARTICLE${visibleCount === 1 ? '' : 'S'}`;
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    filterTopics(input?.value || '');
  });
  input?.addEventListener('input', () => filterTopics(input.value));
  document.querySelectorAll('[data-search-term]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!input) return;
      input.value = button.dataset.searchTerm || '';
      filterTopics(input.value);
      input.focus();
      document.querySelector('[data-support-articles]')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  });
})();
