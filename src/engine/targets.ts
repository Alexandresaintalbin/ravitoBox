import { nutritionConfig } from './config'
import { clamp, isFiniteNumber, lookupFactor, roundTo, warn } from './math'
import type { HourlyTargets, OutingInput, TriathlonInput, Warning } from './types'

interface CarbBand {
  min: number
  max: number
  train: number
  intermediate: number
  race: number
}

export interface ResolvedEvent {
  ok: boolean
  minutes: number
  fuelingMinutes: number
}

function zeroTargets(warnings: Warning[]): HourlyTargets {
  return {
    carbsGPerHour: 0,
    fluidMlPerHour: 0,
    sodiumMgPerHour: 0,
    uncappedCarbsGPerHour: 0,
    eventMinutes: 0,
    fuelingMinutes: 0,
    warnings,
  }
}

function sanitizeSegment(value: number, warnings: Warning[], label: string): number {
  if (!isFiniteNumber(value) || value < 0) {
    warnings.push(
      warn('INVALID_SEGMENT', `La durée du segment « ${label} » est invalide et a été remise à zéro.`),
    )
    return 0
  }
  return value
}

export function presetTriathlon(format: TriathlonInput['format']): TriathlonInput {
  const preset = nutritionConfig.triathlonPresets[format]
  return { format, ...preset }
}

export function resolveEvent(input: OutingInput): ResolvedEvent & { warnings: Warning[] } {
  const warnings: Warning[] = []
  if (input.sport === 'triathlon' && input.triathlon) {
    const swim = sanitizeSegment(input.triathlon.swimMin, warnings, 'natation')
    const t1 = sanitizeSegment(input.triathlon.t1Min, warnings, 'transition 1')
    const bike = sanitizeSegment(input.triathlon.bikeMin, warnings, 'vélo')
    const t2 = sanitizeSegment(input.triathlon.t2Min, warnings, 'transition 2')
    const run = sanitizeSegment(input.triathlon.runMin, warnings, 'course à pied')
    const minutes = swim + t1 + bike + t2 + run
    if (
      isFiniteNumber(input.durationMinutes) &&
      Math.abs(input.durationMinutes - minutes) > 1
    ) {
      warnings.push(
        warn(
          'DURATION_FROM_SEGMENTS',
          'La durée retenue est la somme des segments du triathlon.',
        ),
      )
    }
    if (minutes <= 0) {
      warnings.push(warn('INVALID_DURATION', 'La durée de la sortie doit être supérieure à zéro.'))
      return { ok: false, minutes: 0, fuelingMinutes: 0, warnings }
    }
    if (minutes > nutritionConfig.duration.extremeMinutes) {
      warnings.push(
        warn('DURATION_EXTREME', 'La durée dépasse 24 h : vérifiez la saisie avant de vous fier au plan.'),
      )
    }
    return { ok: true, minutes, fuelingMinutes: bike + run, warnings }
  }

  if (input.sport === 'triathlon' && !input.triathlon) {
    warnings.push(
      warn(
        'MISSING_TRI_SEGMENTS',
        'Les durées par segment ne sont pas renseignées : la durée totale est utilisée telle quelle.',
      ),
    )
  }

  if (!isFiniteNumber(input.durationMinutes) || input.durationMinutes <= 0) {
    warnings.push(warn('INVALID_DURATION', 'La durée de la sortie doit être supérieure à zéro.'))
    return { ok: false, minutes: 0, fuelingMinutes: 0, warnings }
  }
  if (input.durationMinutes > nutritionConfig.duration.extremeMinutes) {
    warnings.push(
      warn('DURATION_EXTREME', 'La durée dépasse 24 h : vérifiez la saisie avant de vous fier au plan.'),
    )
  }
  return {
    ok: true,
    minutes: input.durationMinutes,
    fuelingMinutes: input.durationMinutes,
    warnings,
  }
}

function selectBand(hours: number): CarbBand {
  if (hours < nutritionConfig.duration.shortBandHours) return nutritionConfig.carbs.bands.under1h
  if (hours <= nutritionConfig.duration.mediumBandHours) return nutritionConfig.carbs.bands.oneToTwo
  return nutritionConfig.carbs.bands.over2
}

function sessionPoint(band: CarbBand, session: string, warnings: Warning[]): number {
  if (session === 'entrainement') return band.train
  if (session === 'objectif_principal') return band.race
  if (session === 'course_intermediaire') return band.intermediate
  warnings.push(
    warn('UNKNOWN_SESSION', 'Type de sortie inconnu : le milieu de fourchette est utilisé.'),
  )
  return band.intermediate
}

function elevationBonus(elevationM: number | null | undefined): number {
  if (!isFiniteNumber(elevationM) || elevationM <= 0) return 0
  const { stepMeters, bonusPerStep, maxBonus } = nutritionConfig.carbs.elevation
  return Math.min(maxBonus, (elevationM / stepMeters) * bonusPerStep)
}

function resolveTolerance(value: number, warnings: Warning[]): number {
  if (!isFiniteNumber(value) || value < 0) {
    warnings.push(
      warn('INVALID_TOLERANCE', 'La tolérance digestive est invalide : elle est considérée comme nulle.'),
    )
    return 0
  }
  if (value > nutritionConfig.carbs.toleranceMax) {
    warnings.push(
      warn(
        'TOLERANCE_CLAMPED',
        `La tolérance est plafonnée à ${nutritionConfig.carbs.toleranceMax} g/h.`,
      ),
    )
    return nutritionConfig.carbs.toleranceMax
  }
  return value
}

function climateFactor(
  table: Readonly<Record<string, number>>,
  key: string,
  label: string,
  warnings: Warning[],
): number {
  const found = lookupFactor(table as Record<string, number>, key, nutritionConfig.planner.fallbackFactor)
  if (!found.known) {
    warnings.push(warn('UNKNOWN_CLIMATE', `${label} inconnu : le facteur tempéré est utilisé.`))
  }
  return found.factor
}

export function computeTargets(input: OutingInput): HourlyTargets {
  const event = resolveEvent(input)
  const warnings = [...event.warnings]
  if (!event.ok) return zeroTargets(warnings)

  const tolerance = resolveTolerance(input.toleranceGPerHour, warnings)
  const band = selectBand(event.minutes / 60)
  const base = sessionPoint(band, input.sessionType, warnings)
  const sport = lookupFactor(
    nutritionConfig.carbs.sportFactor as Record<string, number>,
    input.sport,
    nutritionConfig.planner.fallbackFactor,
  )
  if (!sport.known) {
    warnings.push(warn('UNKNOWN_SPORT', 'Sport inconnu : le facteur de la course à pied est utilisé.'))
  }
  const intensity = lookupFactor(
    nutritionConfig.carbs.intensityFactor as Record<string, number>,
    input.intensity,
    nutritionConfig.planner.fallbackFactor,
  )
  if (!intensity.known) {
    warnings.push(warn('UNKNOWN_INTENSITY', 'Intensité inconnue : le facteur modéré est utilisé.'))
  }

  let carbs = base * sport.factor * intensity.factor
  if (input.sport === 'trail') {
    const bonus = elevationBonus(input.elevationM)
    if (bonus > 0) carbs *= 1 + bonus
  } else if (isFiniteNumber(input.elevationM) && input.elevationM > 0) {
    warnings.push(
      warn('ELEVATION_IGNORED', 'Le dénivelé ne modifie les glucides que pour le trail.'),
    )
  }

  carbs = clamp(carbs, band.min, band.max)
  const uncapped = roundTo(carbs, nutritionConfig.carbs.roundDigits)
  let applied = uncapped

  if (input.carbOverrideGPerHour != null) {
    if (!isFiniteNumber(input.carbOverrideGPerHour) || input.carbOverrideGPerHour < 0) {
      warnings.push(
        warn('INVALID_OVERRIDE', 'Le glucide imposé est invalide : la cible calculée est conservée.'),
      )
    } else {
      applied = roundTo(input.carbOverrideGPerHour, nutritionConfig.carbs.roundDigits)
      if (applied > band.max) {
        warnings.push(
          warn(
            'ABOVE_USUAL_BAND',
            'La cible imposée dépasse la fourchette habituelle pour cette durée.',
          ),
        )
      }
    }
  }

  if (applied > tolerance) {
    warnings.push(
      warn(
        'ABOVE_TOLERANCE',
        `La cible (${applied} g/h) dépasse la tolérance digestive (${tolerance} g/h).`,
      ),
    )
    if (!input.allowExceedTolerance) applied = roundTo(tolerance, nutritionConfig.carbs.roundDigits)
  }

  const fluidFactorT = climateFactor(
    nutritionConfig.fluid.temperature,
    input.temperature,
    'Température',
    warnings,
  )
  const fluidFactorS = climateFactor(nutritionConfig.fluid.sweat, input.sweat, 'Sudation', warnings)
  const sodiumFactorT = climateFactor(
    nutritionConfig.sodium.temperature,
    input.temperature,
    'Température',
    warnings,
  )
  const sodiumFactorS = climateFactor(nutritionConfig.sodium.sweat, input.sweat, 'Sudation', warnings)

  const fluid = Math.round(
    clamp(
      nutritionConfig.fluid.baseMlPerHour * fluidFactorT * fluidFactorS,
      nutritionConfig.fluid.min,
      nutritionConfig.fluid.max,
    ),
  )
  const sodium = Math.round(
    clamp(
      nutritionConfig.sodium.baseMgPerHour * sodiumFactorT * sodiumFactorS,
      nutritionConfig.sodium.min,
      nutritionConfig.sodium.max,
    ),
  )

  if (event.fuelingMinutes <= 0) {
    warnings.push(
      warn(
        'NO_FUEL_WINDOW',
        'Aucun segment ne permet de se ravitailler (natation et transitions uniquement).',
      ),
    )
  }

  return {
    carbsGPerHour: applied,
    fluidMlPerHour: fluid,
    sodiumMgPerHour: sodium,
    uncappedCarbsGPerHour: uncapped,
    eventMinutes: event.minutes,
    fuelingMinutes: event.fuelingMinutes,
    warnings,
  }
}
