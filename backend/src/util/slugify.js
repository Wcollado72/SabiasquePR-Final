const DIACRITICS = new RegExp('[̀-ͯ]', 'g');

function slugify(text) {
  return text
    .toString()
    .normalize('NFD').replace(DIACRITICS, '') // quita acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

module.exports = { slugify };
