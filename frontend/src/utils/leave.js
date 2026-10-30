export function formatBalance(remaining, total) {
  const fmt = (n) => (n == null ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${fmt(remaining)}/${fmt(total)}`;
}