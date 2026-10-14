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

  /* The suggestions below the box are for a reader who has not typed
     anything yet. Once there is a query they are in the way of the results,
     so they go. Pagefind builds its own input, which is why this waits for
     the element to exist rather than binding at load. */
  var start = document.getElementById('search-start');
  if (!start) return;

  var tries = 0;
  (function bind() {
    var input = document.querySelector('#search input[type="text"], #search .pagefind-ui__search-input');
    if (!input) {
      // Pagefind renders asynchronously; give it a second, then give up
      // quietly, leaving the suggestions visible rather than hidden forever.
      if (++tries < 40) setTimeout(bind, 50);
      return;
    }
    var sync = function () { start.hidden = input.value.trim().length > 0; };
    input.addEventListener('input', sync);
    sync();
  })();
});
