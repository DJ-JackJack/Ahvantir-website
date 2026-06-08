/* recently_synced.js
   Reads the most recent sync-logs/YYYY-MM-DD.md at build time and returns
   { date, added: [slug,...], updated: [slug,...], removed: [slug,...] }
   so recently-added.njk can cross-reference against collections.allArticles. */
const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../sync-logs');

module.exports = function () {
  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(function (f) { return /^\d{4}-\d{2}-\d{2}\.md$/.test(f); })
      .sort()
      .reverse();

    if (!files.length) return empty();

    const latestDate = files[0].replace('.md', '');
    const content    = fs.readFileSync(path.join(LOG_DIR, files[0]), 'utf8');

    const added   = [];
    const updated = [];
    const removed = [];

    let inChanges = false;
    for (const line of content.split('\n')) {
      if (/^## Article Changes/.test(line)) { inChanges = true; continue; }
      if (inChanges && /^## /.test(line))   { inChanges = false; }
      if (!inChanges) continue;

      // Lines look like:  - **Added:**   `filename.md`
      const addM = line.match(/\*\*Added:\*\*\s+`(.+?)\.md`/);
      const updM = line.match(/\*\*Updated:\*\*\s+`(.+?)\.md`/);
      const remM = line.match(/\*\*Removed:\*\*\s+`(.+?)\.md`/);

      if (addM) added.push(addM[1]);
      if (updM) updated.push(updM[1]);
      if (remM) removed.push(remM[1]);
    }

    return { date: latestDate, added, updated, removed };
  } catch (_) {
    return empty();
  }
};

function empty() {
  return { date: null, added: [], updated: [], removed: [] };
}
