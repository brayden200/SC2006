export const formatPrice = (value: number | null) => value === null ? 'Unknown' : `$${value.toFixed(2)}`;
export const timeAgo = (value: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
};
export const toLocalInput = (date = new Date(Date.now() + 60 * 60_000)) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};
