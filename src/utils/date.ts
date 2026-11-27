export function localDate(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-')
}
export function displayDate(date: string) {
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long' }).format(new Date(date + 'T00:00:00'))
}
export function validDate(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(date + 'T00:00:00Z')
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date
}
