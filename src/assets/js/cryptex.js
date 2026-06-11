(function () {
  'use strict';

  var RUNES      = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ'];
  var RUNE_NAMES = ['Fehu', 'Uruz', 'Thurisaz', 'Ansuz', 'Raidho', 'Kauno', 'Gebo', 'Wunjo'];

  // Hand-curated easter eggs: seqKey -> flavor message (no article link)
  var SPECIALS = {
    '0,0,0': 'The oldest sequence. Three Fehu. No door opens here — only the memory of what the world held before names.',
    '7,7,7': 'Three Wunjo. Joy spirals back on itself. The Cryptex grows still.',
    '2,0,4': 'Thurisaz, Fehu, Raidho — the road guarded by giants. The stone knows this path, but will not open it.'
  };

  var current    = [0, 0, 0];
  var articleMap = {};
  var audioCtx   = null;

  /* ── djb2 hash → 3-rune sequence ───────────────────────────── */
  function djb2(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
      h = h >>> 0;
    }
    return h;
  }

  function titleToSeq(title) {
    var h = djb2(title.toLowerCase().trim()) % 512;
    return [Math.floor(h / 64) % 8, Math.floor(h / 8) % 8, h % 8];
  }

  function seqKey(arr) { return arr[0] + ',' + arr[1] + ',' + arr[2]; }

  function buildMap() {
    var _el = document.getElementById('cryptex-data');
    var articles = _el ? JSON.parse(_el.textContent) : (window.__CRYPTEX_ARTICLES__ || []);
    for (var i = 0; i < articles.length; i++) {
      var a = articles[i];
      if (!a.title) continue;
      var k = seqKey(titleToSeq(a.title));
      if (!articleMap[k]) articleMap[k] = a;
    }
  }

  /* ── Web Audio ──────────────────────────────────────────────── */
  function getAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (_) { audioCtx = null; }
    }
    return audioCtx;
  }

  function playGrind(dur, freq) {
    var ctx = getAudio();
    if (!ctx) return;
    try {
      var n = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, n, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * dur * 0.6));
      }
      var src  = ctx.createBufferSource();
      src.buffer = buf;
      var filt = ctx.createBiquadFilter();
      filt.type      = 'bandpass';
      filt.frequency.value = freq || 110;
      filt.Q.value   = 0.6;
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch (_) {}
  }

  function playRumble() {
    var ctx = getAudio();
    if (!ctx) return;
    try {
      var n = Math.floor(ctx.sampleRate * 2);
      var buf = ctx.createBuffer(1, n, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(300, ctx.currentTime);
      lp.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 2);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7, ctx.currentTime);
      gain.gain.setValueAtTime(0.7, ctx.currentTime + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
      src.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch (_) {}
  }

  /* ── DOM helpers ────────────────────────────────────────────── */
  function qs(sel) { return document.querySelector(sel); }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderStones() {
    for (var i = 0; i < 3; i++) {
      var stone = qs('.cryptex-stone[data-pos="' + i + '"]');
      if (!stone) continue;
      stone.querySelector('.cryptex-rune').textContent      = RUNES[current[i]];
      stone.querySelector('.cryptex-rune-name').textContent = RUNE_NAMES[current[i]];
    }
  }

  function cycleRune(pos, dir) {
    current[pos] = (current[pos] + dir + 8) % 8;
    playGrind(0.22, 100 + pos * 25);
    renderStones();
    clearResult();
  }

  function clearResult() {
    var el = qs('#cryptex-result');
    if (el) { el.className = 'cryptex-result'; el.innerHTML = ''; }
  }

  function setResult(html, mod) {
    var el = qs('#cryptex-result');
    if (!el) return;
    el.className = 'cryptex-result' + (mod ? ' cryptex-result--' + mod : '');
    el.innerHTML = html;
  }

  /* ── Consult ────────────────────────────────────────────────── */
  function consult() {
    var key = seqKey(current);

    if (SPECIALS[key]) {
      playGrind(0.5, 75);
      setResult('<span class="cryptex-message">' + esc(SPECIALS[key]) + '</span>', 'special');
      return;
    }

    var article = articleMap[key];
    if (article) {
      playRumble();
      document.querySelectorAll('.cryptex-stone').forEach(function (s) {
        s.classList.add('cryptex-stone--reveal');
      });
      setResult(
        '<span class="cryptex-found-label">The Cryptex Reveals —</span>' +
        '<a href="' + esc(article.url) + '" class="cryptex-found-link">' +
          esc(article.title) +
        '</a>',
        'found'
      );
      recordDiscovery(article);
    } else {
      playGrind(0.4, 85);
      setResult('<span class="cryptex-unmapped">This sequence is not yet mapped by the Cryptex.</span>', 'unmapped');
    }
  }

  /* ── Discoveries (localStorage) ─────────────────────────────── */
  var STORE = 'ahvantir-cryptex-discoveries';

  function loadDisc() {
    try { return JSON.parse(localStorage.getItem(STORE) || '[]'); }
    catch (_) { return []; }
  }

  function saveDisc(list) {
    try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (_) {}
  }

  function recordDiscovery(article) {
    var list = loadDisc();
    if (list.some(function (d) { return d.url === article.url; })) {
      return; // already recorded
    }
    list.unshift({
      title: article.title,
      url:   article.url,
      seq:   current.map(function (i) { return RUNES[i]; }).join(''),
      date:  new Date().toISOString().slice(0, 10)
    });
    saveDisc(list);
    renderDiscoveries();
  }

  function renderDiscoveries() {
    var list   = loadDisc();
    var toggle = qs('.discoveries-toggle');
    var ul     = qs('.discoveries-list');
    if (!toggle || !ul) return;
    toggle.textContent = 'Discoveries (' + list.length + ')';
    if (!list.length) {
      ul.innerHTML = '<li class="discoveries-empty">No sequences unlocked yet.</li>';
      return;
    }
    ul.innerHTML = list.map(function (d) {
      return '<li class="discoveries-item">' +
        '<span class="discoveries-seq">' + esc(d.seq) + '</span>' +
        '<a href="' + esc(d.url) + '" class="discoveries-link">' + esc(d.title) + '</a>' +
        '<span class="discoveries-date">' + esc(d.date) + '</span>' +
        '</li>';
    }).join('');
  }

  /* ── Init ───────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    buildMap();
    renderStones();
    renderDiscoveries();

    document.querySelectorAll('.cryptex-btn-up').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        cycleRune(+btn.dataset.pos, -1);
      });
    });
    document.querySelectorAll('.cryptex-btn-down').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        cycleRune(+btn.dataset.pos, 1);
      });
    });

    // Click the stone face itself to advance forward
    document.querySelectorAll('.cryptex-stone').forEach(function (stone) {
      stone.addEventListener('click', function (e) {
        if (!e.target.closest('button')) {
          cycleRune(+stone.dataset.pos, 1);
        }
      });
    });

    var consultBtn = qs('#cryptex-consult');
    if (consultBtn) consultBtn.addEventListener('click', consult);

    var toggle = qs('.discoveries-toggle');
    var ul     = qs('.discoveries-list');
    if (toggle && ul) {
      toggle.addEventListener('click', function () {
        var open = ul.classList.toggle('discoveries-list--open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }
  });
})();
