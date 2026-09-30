window.addEventListener('DOMContentLoaded', function () {
  if (typeof PagefindUI === 'undefined') {
    var el = document.getElementById('search');
    if (el) el.innerHTML =
      '<p class="search-error">Search failed to load. ' +
      'Try <a href="javascript:location.reload()">reloading the page</a>, ' +
      'or <a href="/articles/">browse the full article list</a>.</p>';
    return;
  }

  new PagefindUI({
    element: '#search',
    showSubResults: true,
    showImages:     false,
    filters:        { category: {} },
    translations: {
      placeholder:        'Search articles, factions, characters…',
      // Pagefind substitutes [COUNT] / [SEARCH_TERM] into these strings via
      // .replace(), so they MUST be plain strings — a function here throws
      // "X.replace is not a function" and the results never render.
      zero_results:       'No results for [SEARCH_TERM] — try a broader term.',
      many_results:       '[COUNT] results for [SEARCH_TERM]',
      one_result:         '[COUNT] result for [SEARCH_TERM]',
      load_more:          'Load more results',
      search_label:       'Search Ahvantir lore',
      filters_label:      'Filter by category',
      clear_search:       'Clear search',
      clear_filters:      'Clear filters',
    },
  });
});
