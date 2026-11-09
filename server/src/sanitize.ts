export function sanitizeText(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .slice(0, 5000); // Max 5000 chars per text element
}

export function sanitizeUserName(name?: string): string {
  if (!name) return 'Anonymous';
  const clean = name.trim().replace(/[<>]/g, '').slice(0, 30);
  return clean || 'Anonymous';
}

