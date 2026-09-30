export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function lookupFactor(
  table: Record<string, number>,
  key: string,
  fallback: number,
): { factor: number; known: boolean } {
  if (Object.prototype.hasOwnProperty.call(table, key)) {
    const value = table[key]
    if (value == null) return { factor: fallback, known: false }
    return { factor: value, known: true }
  }
  return { factor: fallback, known: false }
}

export function warn(code: string, message: string) {
  return { code, message }
}
