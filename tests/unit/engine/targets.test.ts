import { describe, expect, it } from 'vitest'
import { nutritionConfig } from '@/engine/config'
import { computeTargets, presetTriathlon, resolveEvent } from '@/engine/targets'
import type { Intensity, OutingInput, SessionType, Sport, Sweat, Temperature } from '@/engine/types'

function outing(overrides: Partial<OutingInput> = {}): OutingInput {
  return {
    sport: 'course',
    sessionType: 'course_intermediaire',
    durationMinutes: 180,
    intensity: 'moderee',
    temperature: 'temperee',
    sweat: 'moyenne',
    toleranceGPerHour: 120,
    ...overrides,
  }
}

function codes(result: { warnings: { code: string }[] }) {
  return result.warnings.map((warning) => warning.code)
}

describe('computeTargets', () => {
  it('place une sortie de 3 h, course modérée, au milieu de la fourchette longue', () => {
    const result = computeTargets(outing())
    expect(result.carbsGPerHour).toBe(75)
    expect(result.uncappedCarbsGPerHour).toBe(75)
    expect(result.fluidMlPerHour).toBe(550)
    expect(result.sodiumMgPerHour).toBe(500)
    expect(result.eventMinutes).toBe(180)
    expect(result.fuelingMinutes).toBe(180)
    expect(result.warnings).toEqual([])
  })

  it('couvre chaque sport, type de sortie et intensité dans les fourchettes', () => {
    const sports: Sport[] = ['course', 'trail', 'cyclisme', 'triathlon']
    const sessions: SessionType[] = ['entrainement', 'course_intermediaire', 'objectif_principal']
    const intensities: Intensity[] = ['facile', 'moderee', 'soutenue', 'course']
    const durations = [30, 90, 180]
    for (const sport of sports) {
      for (const sessionType of sessions) {
        for (const intensity of intensities) {
          for (const durationMinutes of durations) {
            const result = computeTargets(
              outing({
                sport,
                sessionType,
                intensity,
                durationMinutes,
                triathlon:
                  sport === 'triathlon'
                    ? { format: 'personnalise', swimMin: 0, t1Min: 0, bikeMin: durationMinutes, t2Min: 0, runMin: 0 }
                    : null,
              }),
            )
            const hours = durationMinutes / 60
            const band =
              hours < 1
                ? nutritionConfig.carbs.bands.under1h
                : hours <= 2
                  ? nutritionConfig.carbs.bands.oneToTwo
                  : nutritionConfig.carbs.bands.over2
            expect(result.carbsGPerHour).toBeGreaterThanOrEqual(band.min)
            expect(result.carbsGPerHour).toBeLessThanOrEqual(band.max)
            expect(result.fluidMlPerHour).toBeGreaterThanOrEqual(nutritionConfig.fluid.min)
            expect(result.fluidMlPerHour).toBeLessThanOrEqual(nutritionConfig.fluid.max)
            expect(result.sodiumMgPerHour).toBeGreaterThanOrEqual(nutritionConfig.sodium.min)
            expect(result.sodiumMgPerHour).toBeLessThanOrEqual(nutritionConfig.sodium.max)
          }
        }
      }
    }
  })

  it('augmente l’eau et le sodium avec la chaleur et la sudation, sans sortir des bornes', () => {
    const temperatures: Temperature[] = ['fraiche', 'temperee', 'chaude']
    const sweats: Sweat[] = ['faible', 'moyenne', 'elevee']
    const fluids: number[] = []
    const sodiums: number[] = []
    for (const temperature of temperatures) {
      for (const sweat of sweats) {
        const result = computeTargets(outing({ temperature, sweat }))
        fluids.push(result.fluidMlPerHour)
        sodiums.push(result.sodiumMgPerHour)
        expect(result.fluidMlPerHour).toBeGreaterThanOrEqual(400)
        expect(result.fluidMlPerHour).toBeLessThanOrEqual(800)
        expect(result.sodiumMgPerHour).toBeGreaterThanOrEqual(300)
        expect(result.sodiumMgPerHour).toBeLessThanOrEqual(800)
      }
    }
    const cool = computeTargets(outing({ temperature: 'fraiche', sweat: 'faible' }))
    const hot = computeTargets(outing({ temperature: 'chaude', sweat: 'elevee' }))
    expect(cool.fluidMlPerHour).toBe(400)
    expect(hot.fluidMlPerHour).toBe(800)
    expect(cool.sodiumMgPerHour).toBe(300)
    expect(hot.sodiumMgPerHour).toBe(800)
    expect(Math.min(...fluids)).toBe(400)
    expect(Math.max(...fluids)).toBe(800)
    expect(Math.min(...sodiums)).toBe(300)
    expect(Math.max(...sodiums)).toBe(800)
  })

  it('donne plus de glucides au vélo qu’à la course, et moins au trail', () => {
    const run = computeTargets(outing({ sport: 'course', sessionType: 'course_intermediaire', intensity: 'moderee' }))
    const bike = computeTargets(outing({ sport: 'cyclisme' }))
    const trail = computeTargets(outing({ sport: 'trail' }))
    expect(bike.carbsGPerHour).toBeGreaterThan(run.carbsGPerHour)
    expect(trail.carbsGPerHour).toBeLessThan(run.carbsGPerHour)
  })

  it('teste plus haut à l’entraînement et reste plus bas sur l’objectif', () => {
    const train = computeTargets(outing({ sessionType: 'entrainement' }))
    const mid = computeTargets(outing({ sessionType: 'course_intermediaire' }))
    const race = computeTargets(outing({ sessionType: 'objectif_principal' }))
    expect(train.carbsGPerHour).toBeGreaterThan(mid.carbsGPerHour)
    expect(mid.carbsGPerHour).toBeGreaterThan(race.carbsGPerHour)
  })

  it('élève les glucides avec l’intensité', () => {
    const easy = computeTargets(outing({ intensity: 'facile' }))
    const moderate = computeTargets(outing({ intensity: 'moderee' }))
    const steady = computeTargets(outing({ intensity: 'soutenue' }))
    const race = computeTargets(outing({ intensity: 'course' }))
    expect(race.carbsGPerHour).toBeGreaterThan(steady.carbsGPerHour)
    expect(steady.carbsGPerHour).toBeGreaterThan(moderate.carbsGPerHour)
    expect(moderate.carbsGPerHour).toBeGreaterThan(easy.carbsGPerHour)
  })

  it('sépare les tranches de durée, y compris les bornes 1 h et 2 h', () => {
    const under = computeTargets(outing({ durationMinutes: 45 }))
    const oneHour = computeTargets(outing({ durationMinutes: 60 }))
    const twoHours = computeTargets(outing({ durationMinutes: 120 }))
    const over = computeTargets(outing({ durationMinutes: 121 }))
    expect(under.carbsGPerHour).toBeLessThanOrEqual(30)
    expect(oneHour.carbsGPerHour).toBeGreaterThanOrEqual(30)
    expect(oneHour.carbsGPerHour).toBeLessThanOrEqual(60)
    expect(twoHours.carbsGPerHour).toBeLessThanOrEqual(60)
    expect(over.carbsGPerHour).toBeGreaterThanOrEqual(60)
  })

  it('plaque la cible sur la tolérance tant que le dépassement n’est pas confirmé', () => {
    const capped = computeTargets(outing({ toleranceGPerHour: 40 }))
    expect(capped.carbsGPerHour).toBe(40)
    expect(capped.uncappedCarbsGPerHour).toBe(75)
    expect(codes(capped)).toContain('ABOVE_TOLERANCE')
    const confirmed = computeTargets(outing({ toleranceGPerHour: 40, allowExceedTolerance: true }))
    expect(confirmed.carbsGPerHour).toBe(75)
    expect(codes(confirmed)).toContain('ABOVE_TOLERANCE')
  })

  it('applique un glucide imposé, y compris au-dessus de la fourchette ou de la tolérance', () => {
    expect(computeTargets(outing({ carbOverrideGPerHour: 50 })).carbsGPerHour).toBe(50)
    const high = computeTargets(outing({ carbOverrideGPerHour: 120, toleranceGPerHour: 150 }))
    expect(high.carbsGPerHour).toBe(120)
    expect(codes(high)).toContain('ABOVE_USUAL_BAND')
    const blocked = computeTargets(outing({ carbOverrideGPerHour: 100, toleranceGPerHour: 60 }))
    expect(blocked.carbsGPerHour).toBe(60)
    const allowed = computeTargets(
      outing({ carbOverrideGPerHour: 100, toleranceGPerHour: 60, allowExceedTolerance: true }),
    )
    expect(allowed.carbsGPerHour).toBe(100)
    const invalid = computeTargets(outing({ carbOverrideGPerHour: -5 }))
    expect(invalid.carbsGPerHour).toBe(75)
    expect(codes(invalid)).toContain('INVALID_OVERRIDE')
    const nan = computeTargets(outing({ carbOverrideGPerHour: Number.NaN }))
    expect(nan.carbsGPerHour).toBe(75)
    expect(codes(nan)).toContain('INVALID_OVERRIDE')
  })

  it('refuse une durée nulle, négative ou non numérique', () => {
    for (const durationMinutes of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = computeTargets(outing({ durationMinutes }))
      expect(result.carbsGPerHour).toBe(0)
      expect(result.fluidMlPerHour).toBe(0)
      expect(result.sodiumMgPerHour).toBe(0)
      expect(codes(result)).toContain('INVALID_DURATION')
    }
  })

  it('signale une durée extrême sans abandonner le calcul', () => {
    const result = computeTargets(outing({ durationMinutes: 24 * 60 + 30 }))
    expect(result.carbsGPerHour).toBeGreaterThan(0)
    expect(codes(result)).toContain('DURATION_EXTREME')
  })

  it('corrige une tolérance invalide ou trop haute', () => {
    const negative = computeTargets(outing({ toleranceGPerHour: -4 }))
    expect(negative.carbsGPerHour).toBe(0)
    expect(codes(negative)).toContain('INVALID_TOLERANCE')
    const nan = computeTargets(outing({ toleranceGPerHour: Number.NaN }))
    expect(nan.carbsGPerHour).toBe(0)
    const huge = computeTargets(outing({ toleranceGPerHour: 400 }))
    expect(codes(huge)).toContain('TOLERANCE_CLAMPED')
    expect(huge.carbsGPerHour).toBe(75)
  })

  it('majore le trail selon le dénivelé et ignore ce dénivelé ailleurs', () => {
    const flat = computeTargets(outing({ sport: 'trail', elevationM: 0 }))
    const hilly = computeTargets(outing({ sport: 'trail', elevationM: 1000 }))
    const huge = computeTargets(outing({ sport: 'trail', elevationM: 100_000 }))
    const negative = computeTargets(outing({ sport: 'trail', elevationM: -200 }))
    const missing = computeTargets(outing({ sport: 'trail', elevationM: null }))
    expect(hilly.carbsGPerHour).toBeGreaterThan(flat.carbsGPerHour)
    expect(huge.carbsGPerHour).toBeGreaterThanOrEqual(hilly.carbsGPerHour)
    expect(negative.carbsGPerHour).toBe(flat.carbsGPerHour)
    expect(missing.carbsGPerHour).toBe(flat.carbsGPerHour)
    const road = computeTargets(outing({ sport: 'course', elevationM: 1500 }))
    const roadFlat = computeTargets(outing({ sport: 'course' }))
    expect(road.carbsGPerHour).toBe(roadFlat.carbsGPerHour)
    expect(codes(road)).toContain('ELEVATION_IGNORED')
  })

  it('retombe sur des facteurs neutres si le sport, l’intensité ou le climat sont inconnus', () => {
    const result = computeTargets(
      outing({
        sport: 'patin' as OutingInput['sport'],
        sessionType: 'loisir' as OutingInput['sessionType'],
        intensity: 'max' as OutingInput['intensity'],
        temperature: 'glaciale' as OutingInput['temperature'],
        sweat: 'nulle' as OutingInput['sweat'],
      }),
    )
    expect(codes(result)).toEqual(
      expect.arrayContaining(['UNKNOWN_SPORT', 'UNKNOWN_SESSION', 'UNKNOWN_INTENSITY', 'UNKNOWN_CLIMATE']),
    )
    expect(result.carbsGPerHour).toBeGreaterThan(0)
  })

  it('calcule un triathlon à partir des segments et prévient si la durée saisie diverge', () => {
    const tri = presetTriathlon('triathlon_70_3')
    const result = computeTargets(
      outing({ sport: 'triathlon', durationMinutes: 10, triathlon: tri }),
    )
    const total = tri.swimMin + tri.t1Min + tri.bikeMin + tri.t2Min + tri.runMin
    expect(result.eventMinutes).toBe(total)
    expect(result.fuelingMinutes).toBe(tri.bikeMin + tri.runMin)
    expect(codes(result)).toContain('DURATION_FROM_SEGMENTS')
    expect(result.carbsGPerHour).toBeGreaterThanOrEqual(60)
  })

  it('signale un triathlon sans segment et une fenêtre de ravitaillement vide', () => {
    const missing = computeTargets(outing({ sport: 'triathlon', durationMinutes: 90, triathlon: null }))
    expect(codes(missing)).toContain('MISSING_TRI_SEGMENTS')
    expect(missing.fuelingMinutes).toBe(90)
    const swimOnly = computeTargets(
      outing({
        sport: 'triathlon',
        durationMinutes: 20,
        triathlon: { format: 'sprint', swimMin: 20, t1Min: 0, bikeMin: 0, t2Min: 0, runMin: 0 },
      }),
    )
    expect(swimOnly.fuelingMinutes).toBe(0)
    expect(codes(swimOnly)).toContain('NO_FUEL_WINDOW')
  })

  it('ramène un segment invalide à zéro et refuse un triathlon de durée nulle', () => {
    const result = computeTargets(
      outing({
        sport: 'triathlon',
        durationMinutes: 30,
        triathlon: { format: 'personnalise', swimMin: -5, t1Min: Number.NaN, bikeMin: 0, t2Min: 0, runMin: 0 },
      }),
    )
    expect(result.carbsGPerHour).toBe(0)
    expect(codes(result)).toContain('INVALID_SEGMENT')
    expect(codes(result)).toContain('INVALID_DURATION')
  })

  it('signale une durée de triathlon extrême', () => {
    const result = computeTargets(
      outing({
        sport: 'triathlon',
        durationMinutes: 2000,
        triathlon: { format: 'personnalise', swimMin: 10, t1Min: 0, bikeMin: 1500, t2Min: 0, runMin: 10 },
      }),
    )
    expect(codes(result)).toContain('DURATION_EXTREME')
    expect(result.carbsGPerHour).toBeGreaterThan(0)
  })

  it('expose un préremplissage pour chaque format de triathlon', () => {
    for (const format of ['sprint', 'olympique', 'triathlon_70_3', 'ironman', 'personnalise'] as const) {
      const preset = presetTriathlon(format)
      expect(preset.format).toBe(format)
      expect(preset.bikeMin).toBeGreaterThan(0)
      expect(preset.runMin).toBeGreaterThan(0)
      const resolved = resolveEvent(outing({ sport: 'triathlon', durationMinutes: 1, triathlon: preset }))
      expect(resolved.ok).toBe(true)
      expect(resolved.fuelingMinutes).toBe(preset.bikeMin + preset.runMin)
    }
  })
})
