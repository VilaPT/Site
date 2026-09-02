export function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

export function getOrCreateSessionId(storage = window.localStorage) {
  const currentKey = 'chamaopro_sid';
  const legacyKey = 'fazja_sid';
  let id = storage.getItem(currentKey) || storage.getItem(legacyKey);
  if (!id) {
    id = crypto.randomUUID();
  }
  storage.setItem(currentKey, id);
  storage.removeItem(legacyKey);
  return id;
}

export function daysUntil(dateValue, now = Date.now()) {
  if (!dateValue) return 0;
  return Math.max(0, Math.ceil((new Date(dateValue).getTime() - now) / 86400000));
}
