/**
 * Cross-subdomain session storage for Supabase auth.
 *
 * Signing in on ahvantir.world should sign you in on dawnbreak.ahvantir.world
 * too. It does not by default: Supabase keeps the session in localStorage, and
 * browsers scope localStorage per origin, so the two sites cannot see each
 * other's key. One account, two sign-ins.
 *
 * This stores the session in a cookie on the PARENT domain instead. A cookie
 * set on `.ahvantir.world` is readable by every subdomain under it, so one
 * sign-in covers both sites and the site switcher just works.
 *
 * Passed to `createClient` as its `auth.storage`. Nothing else changes: the
 * same session shape goes in and comes out, and every caller is unaffected.
 *
 * ## This file must stay byte-identical on both sites
 *
 * Both sites read the same cookies, so the name, the chunking and the encoding
 * have to agree exactly. If one copy is "improved", the two stop reading each
 * other's session and the only symptom is being asked to sign in twice again,
 * with nothing in the console to explain it. Copy it; do not edit one side.
 *
 * ## Three things this has to get right
 *
 * **Falling back off-domain.** A cookie for `.ahvantir.world` cannot be set on
 * `localhost`, so `npm run dev` would silently store nothing and log you out on
 * every reload. When the page is not served from under the parent domain this
 * defers to localStorage, which is exactly the old behaviour.
 *
 * **Chunking.** A Supabase session is JSON with a JWT in it and routinely
 * exceeds the ~4KB a single cookie holds. It is split across numbered cookies
 * and reassembled on read, the same shape Supabase's own server-side helper
 * uses.
 *
 * **Clearing stale chunks.** A shorter session written over a longer one must
 * delete the chunks it no longer needs. Miss that and the leftovers are read
 * back as trailing garbage, producing a corrupt session that survives a reload
 * and cannot be cleared by signing out. This is the failure mode worth testing,
 * and it is tested.
 *
 * ## Security
 *
 * No worse than localStorage and no better: both are readable by any script on
 * the page, and neither can be hardened further, because the client itself has
 * to read the token. `HttpOnly` is not available for the same reason. `Secure`
 * and `SameSite=Lax` are set.
 *
 * Note that a `.ahvantir.world` cookie is sent to EVERY subdomain, including
 * the Foundry tunnel. That is a deliberate, accepted trade -- see the repo's
 * docs -- not an oversight.
 */
(function (global) {
  "use strict";

  /** The domain the session is shared across. */
  var PARENT_DOMAIN = "ahvantir.world";

  /**
   * Bytes per cookie. Browsers cap a cookie at roughly 4096 bytes INCLUDING
   * its name and attributes, so this leaves room for both rather than sitting
   * at the limit and failing on the longest key.
   */
  var CHUNK = 3000;

  /** How many chunks to look for before giving up. Far above any real session. */
  var MAX_CHUNKS = 20;

  /* ------------------------------------------------------------ pure helpers */

  /** Split a value into cookie-sized pieces. Never returns an empty array. */
  function chunk(value) {
    var out = [];
    for (var i = 0; i < value.length; i += CHUNK) out.push(value.slice(i, i + CHUNK));
    return out.length ? out : [""];
  }

  /**
   * Is this host allowed to set a cookie on the parent domain?
   *
   * True for the domain itself and anything under it, false for localhost, an
   * IP, or a preview host -- where the browser would silently drop the cookie.
   * Matching on a leading dot prevents `notahvantir.world` from qualifying.
   */
  function canUseCookies(hostname) {
    if (!hostname) return false;
    return hostname === PARENT_DOMAIN || hostname.endsWith("." + PARENT_DOMAIN);
  }

  /* ---------------------------------------------------------- cookie plumbing */

  function readCookie(doc, name) {
    var parts = (doc.cookie || "").split(";");
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      var eq = part.indexOf("=");
      if (eq === -1) continue;
      if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
    }
    return null;
  }

  function writeCookie(doc, name, value) {
    doc.cookie = name + "=" + encodeURIComponent(value) +
      "; domain=." + PARENT_DOMAIN +
      "; path=/; max-age=31536000; SameSite=Lax; Secure";
  }

  function deleteCookie(doc, name) {
    doc.cookie = name + "=; domain=." + PARENT_DOMAIN +
      "; path=/; max-age=0; SameSite=Lax; Secure";
  }

  /* ------------------------------------------------------------ the adapter */

  /**
   * @param {Document} doc
   * @param {Storage|null} fallback - localStorage, or null where unavailable
   *   (a browser with cookies and storage both blocked, or a bot).
   * @param {string} hostname
   */
  function createAuthStorage(doc, fallback, hostname) {
    var useCookies = canUseCookies(hostname);

    function clearChunks(key, from) {
      for (var i = from; i < MAX_CHUNKS; i++) {
        if (readCookie(doc, key + "." + i) === null) break;
        deleteCookie(doc, key + "." + i);
      }
    }

    return {
      getItem: function (key) {
        if (!useCookies) return fallback ? fallback.getItem(key) : null;

        // Unchunked value, written when the session fits in one cookie.
        var single = readCookie(doc, key);
        if (single !== null) return single;

        var parts = [];
        for (var i = 0; i < MAX_CHUNKS; i++) {
          var part = readCookie(doc, key + "." + i);
          if (part === null) break;
          parts.push(part);
        }
        if (parts.length) return parts.join("");

        /*
         * Nothing in cookies. Adopt an existing localStorage session if there
         * is one, so deploying this does not sign out everyone who is already
         * logged in -- they would have no idea why, and no way to tell it from
         * a bug. Migrated on first read and left in place; `removeItem` clears
         * both, so signing out still signs out.
         */
        var legacy = fallback ? fallback.getItem(key) : null;
        if (legacy !== null) this.setItem(key, legacy);
        return legacy;
      },

      setItem: function (key, value) {
        if (!useCookies) { if (fallback) fallback.setItem(key, value); return; }

        var parts = chunk(value);
        if (parts.length === 1) {
          writeCookie(doc, key, parts[0]);
          clearChunks(key, 0);           // a previously chunked session
          return;
        }
        deleteCookie(doc, key);          // a previously unchunked session
        for (var i = 0; i < parts.length; i++) writeCookie(doc, key + "." + i, parts[i]);
        // Anything left from a LONGER previous session would otherwise be read
        // back as trailing garbage on the next load.
        clearChunks(key, parts.length);
      },

      removeItem: function (key) {
        if (fallback) { try { fallback.removeItem(key); } catch (e) { /* blocked */ } }
        if (!useCookies) return;
        deleteCookie(doc, key);
        clearChunks(key, 0);
      },
    };
  }

  var api = {
    createAuthStorage: createAuthStorage,
    // Exported for tests. Not part of the storage interface.
    _chunk: chunk,
    _canUseCookies: canUseCookies,
    PARENT_DOMAIN: PARENT_DOMAIN,
    CHUNK: CHUNK,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.AhvantirAuthStorage = api;
})(typeof window !== "undefined" ? window : this);
