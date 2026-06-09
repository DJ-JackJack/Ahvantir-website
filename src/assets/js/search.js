window.addEventListener('DOMContentLoaded', function () {
  if (typeof PagefindUI === 'undefined') return;

  new PagefindUI({
    element: '#search',
    showSubResults: true,
    showImages:     false,
    filters:        { category: {} },
    translations: {
      placeholder:        'Search articles, factions, characters…',
      zero_results:       function (query) { return 'No results for "' + query + '" — try a broader term.'; },
      many_results:       function (count, query) { return count + ' results for "' + query + '"'; },
      one_result:         function (query) { return '1 result for "' + query + '"'; },
      load_more:          'Load more results',
      search_label:       'Search Ahvantir lore',
      filters_label:      'Filter by category',
      clear_search:       'Clear search',
      clear_filters:      'Clear filters',
    },
  });
});
