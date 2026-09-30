import { describe, expect, it } from 'vitest'
import { clamp, isFiniteNumber, lookupFactor, roundTo } from '@/engine/math'

describe('math', () => {
  it('reconnaît les nombres finis', () => {
    expect(isFiniteNumber(1)).toBe(true)
    expect(isFiniteNumber(0)).toBe(true)
    expect(isFiniteNumber(Number.NaN)).toBe(false)
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isFiniteNumber('1')).toBe(false)
    expect(isFiniteNumber(null)).toBe(false)
  })

  it('borne une valeur', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-2, 0, 10)).toBe(0)
    expect(clamp(12, 0, 10)).toBe(10)
  })

  it('arrondit au nombre de décimales demandé', () => {
    expect(roundTo(1.26, 1)).toBe(1.3)
    expect(roundTo(1.24, 1)).toBe(1.2)
    expect(roundTo(10.4, 0)).toBe(10)
  })

  it('lit un facteur connu, un facteur absent, ou une valeur vide', () => {
    expect(lookupFactor({ course: 1 }, 'course', 2)).toEqual({ factor: 1, known: true })
    expect(lookupFactor({ course: 0 }, 'course', 2)).toEqual({ factor: 0, known: true })
    expect(lookupFactor({ course: 1 }, 'trail', 2)).toEqual({ factor: 2, known: false })
    const hole: Record<string, number> = { course: 1 }
    delete hole.course
    Object.defineProperty(hole, 'course', { value: undefined, enumerable: true })
    expect(lookupFactor(hole, 'course', 3)).toEqual({ factor: 3, known: false })
  })
})
