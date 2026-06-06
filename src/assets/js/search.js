window.addEventListener('DOMContentLoaded', function () {
  if (typeof PagefindUI === 'undefined') return;

  new PagefindUI({
    element: '#search',
    showSubResults: true,
    showImages: false,
    translations: {
      placeholder: 'Search articles, factions, characters…',
    },
  });
});
