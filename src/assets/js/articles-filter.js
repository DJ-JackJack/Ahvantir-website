/* articles-filter.js — live filter and tag deep-link for /articles/ */
(function () {
  const input = document.getElementById('article-filter');
  const cards = document.querySelectorAll('.article-card');
  const sections = document.querySelectorAll('.articles-section');
  const btns = document.querySelectorAll('.filter-btn');
  let activeCategory = 'all';

  function applyFilters() {
    const q = input.value.toLowerCase();
    sections.forEach(sec => {
      let visible = 0;
      const cat = sec.dataset.category;
      if (activeCategory !== 'all' && cat !== activeCategory) {
        sec.style.display = 'none';
        return;
      }
      sec.querySelectorAll('.article-card').forEach(card => {
        const titleMatch = (card.dataset.title || '').includes(q);
        const tagMatch = (card.dataset.tags || '').includes(q);
        const show = !q || titleMatch || tagMatch;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      sec.style.display = visible ? '' : 'none';
    });
  }

  input.addEventListener('input', applyFilters);

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.filter;
      applyFilters();
    });
  });

  // Support tag deep-links: /articles/#tag-<slug>
  const hash = location.hash;
  if (hash && hash.startsWith('#tag-')) {
    const tagSlug = hash.slice(5);
    sections.forEach(sec => {
      let visible = 0;
      sec.querySelectorAll('.article-card').forEach(card => {
        const slugs = (card.dataset.tagSlugs || '').split(' ');
        const show = slugs.includes(tagSlug);
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      sec.style.display = visible ? '' : 'none';
    });
  }
})();
