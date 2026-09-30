export function minutesToParts(totalMinutes: number): { hours: number; minutes: number } {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return { hours: 0, minutes: 0 }
  const rounded = Math.round(totalMinutes)
  return { hours: Math.floor(rounded / 60), minutes: rounded % 60 }
}

export function partsToMinutes(hours: number, minutes: number): number {
  const h = Number.isFinite(hours) ? Math.max(0, Math.trunc(hours)) : 0
  const m = Number.isFinite(minutes) ? Math.max(0, Math.trunc(minutes)) : 0
  return h * 60 + m
}

export function formatDuration(totalMinutes: number): string {
  const { hours, minutes } = minutesToParts(totalMinutes)
  if (hours === 0) return `${minutes} min`
  return `${hours} h ${String(minutes).padStart(2, '0')}`
}

export function formatGrams(value: number): string {
  if (!Number.isFinite(value)) return '— g'
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} g`
}

export function formatMl(value: number): string {
  if (!Number.isFinite(value)) return '— ml'
  return `${Math.round(value)} ml`
}

export function formatMg(value: number): string {
  if (!Number.isFinite(value)) return '— mg'
  return `${Math.round(value)} mg`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'date inconnue'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}
