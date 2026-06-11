/* player-hall-of-heroes.js — Hall of Heroes gallery for /player/hall-of-heroes/ */
(function () {
  'use strict';
  var db = window.__supabase;
  var heroData = [];

  document.addEventListener('DOMContentLoaded', async function () {
    var session = await window.requireAuth(true);
    if (!session) return;
    await loadHall();
    bindModal();
  });

  async function loadHall() {
    var app = document.getElementById('hall-app');

    var result = await db
      .from('characters')
      .select('id, data, character_images(storage_path, sort_order, created_at)')
      .eq('is_public', true);

    if (result.error) {
      app.innerHTML = '<p class="player-error">Failed to load the Hall of Heroes.</p>';
      return;
    }

    var chars = result.data || [];

    if (!chars.length) {
      app.innerHTML =
        '<p class="hall-empty">No heroes have stepped forward yet.<br>' +
        'Mark your character as <strong>Public</strong> from your character sheet to appear here.</p>';
      return;
    }

    // Find first image path per character
    var pathByCharId = {};
    chars.forEach(function (c) {
      var imgs = (c.character_images || []).slice().sort(function (a, b) {
        return (a.sort_order - b.sort_order) || a.created_at.localeCompare(b.created_at);
      });
      if (imgs.length) pathByCharId[c.id] = imgs[0].storage_path;
    });

    // Batch sign all image URLs in one request
    var allPaths = Object.values(pathByCharId);
    var signedByPath = {};
    if (allPaths.length) {
      var urlResult = await db.storage.from('character-images').createSignedUrls(allPaths, 3600);
      (urlResult.data || []).forEach(function (u) {
        if (u.signedUrl) signedByPath[u.path] = u.signedUrl;
      });
    }

    heroData = chars.map(function (c) {
      return Object.assign({}, c, { _imgUrl: signedByPath[pathByCharId[c.id]] || null });
    });

    var cards = heroData.map(function (c, idx) {
      var d = c.data || {};
      var name = d.name || 'Unknown Hero';
      var identity = buildIdentity(d);
      var portrait = c._imgUrl
        ? '<img src="' + c._imgUrl + '" alt="Portrait of ' + esc(name) + '" loading="lazy">'
        : '<span class="hero-card__rune" aria-hidden="true">' + runeFor(name) + '</span>';
      return (
        '<div class="hero-card" role="button" tabindex="0" data-idx="' + idx + '" aria-label="View ' + esc(name) + '">' +
          '<div class="hero-card__portrait">' + portrait + '</div>' +
          '<div class="hero-card__info">' +
            '<div class="hero-card__name">' + esc(name) + '</div>' +
            '<div class="hero-card__class">' + esc(identity) + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    app.innerHTML = '<div class="hero-grid">' + cards + '</div>';

    app.addEventListener('click', function (e) {
      var card = e.target.closest('.hero-card');
      if (card) openModal(parseInt(card.dataset.idx, 10));
    });
    app.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        var card = e.target.closest('.hero-card');
        if (card) { e.preventDefault(); openModal(parseInt(card.dataset.idx, 10)); }
      }
    });
  }

  function buildIdentity(d) {
    var parts = [];
    if (d.level)      parts.push('Level ' + d.level);
    if (d.race)       parts.push(d.race);
    if (d.class_name) parts.push(d.class_name);
    return parts.join(' · ');
  }

  var lastFocusedEl = null;

  function onModalKeydown(e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') {
      var overlay = document.getElementById('hero-modal');
      var focusable = Array.from(overlay.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(function (el) { return !el.disabled; });
      if (!focusable.length) { e.preventDefault(); return; }
      var first = focusable[0];
      var last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    }
  }

  function openModal(idx) {
    var c = heroData[idx];
    if (!c) return;
    var d = c.data || {};
    var name = d.name || 'Unknown Hero';

    var portraitHtml = c._imgUrl
      ? '<div class="hero-modal__portrait"><img src="' + c._imgUrl + '" alt="' + esc(name) + '"></div>'
      : '<div class="hero-modal__portrait hero-modal__portrait--placeholder"><span aria-hidden="true">' + runeFor(name) + '</span></div>';

    var meta = [d.alignment, d.background, d.subclass].filter(Boolean).map(esc).join(' · ');
    var sections = '';
    if (d.backstory)  sections += modalSection('Backstory',      d.backstory);
    if (d.appearance) sections += modalSection('Appearance',     d.appearance);
    if (d.traits)     sections += modalSection('Traits & Bonds', d.traits);

    document.getElementById('hero-modal-content').innerHTML =
      portraitHtml +
      '<div class="hero-modal__body">' +
        '<h2 class="hero-modal__name" id="hero-modal-name">' + esc(name) + '</h2>' +
        '<p class="hero-modal__identity">' + esc(buildIdentity(d)) + '</p>' +
        (meta ? '<p class="hero-modal__meta">' + meta + '</p>' : '') +
        (sections || '<p class="hero-modal__empty">This hero\'s story has yet to be written.</p>') +
      '</div>';

    lastFocusedEl = document.activeElement;
    var overlay = document.getElementById('hero-modal');
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onModalKeydown);
    document.getElementById('hero-modal-close').focus();
  }

  function modalSection(title, text) {
    return (
      '<div class="hero-modal__section">' +
        '<h3 class="hero-modal__section-title">' + esc(title) + '</h3>' +
        '<p>' + esc(text) + '</p>' +
      '</div>'
    );
  }

  function bindModal() {
    document.getElementById('hero-modal-close').addEventListener('click', closeModal);
    document.getElementById('hero-modal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }

  function closeModal() {
    document.removeEventListener('keydown', onModalKeydown);
    var overlay = document.getElementById('hero-modal');
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocusedEl) { lastFocusedEl.focus(); lastFocusedEl = null; }
  }

  var RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ'];
  function runeFor(str) {
    var h = 0;
    for (var i = 0; i < (str || '').length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
    return RUNES[Math.abs(h) % RUNES.length];
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
