import { nutritionConfig } from './config'
import { isFiniteNumber, roundTo } from './math'
import type { DebriefSnapshot, GutProposal } from './types'

function safeTolerance(value: number): number {
  if (!isFiniteNumber(value) || value < 0) return 0
  return value
}

export function proposeGutTraining(
  history: DebriefSnapshot[],
  toleranceGPerHour: number,
): GutProposal | null {
  const tolerance = safeTolerance(toleranceGPerHour)
  const eligible = history.filter((item) => {
    if (!isFiniteNumber(item.durationMinutes) || item.durationMinutes < nutritionConfig.gut.minDurationMinutes) {
      return false
    }
    if (!isFiniteNumber(item.carbsGPerHourConsumed) || item.carbsGPerHourConsumed < 0) return false
    if (!isFiniteNumber(item.stomach)) return false
    return true
  })
  if (eligible.length === 0) return null

  const last = eligible[eligible.length - 1] as DebriefSnapshot
  const baseline = roundTo(last.carbsGPerHourConsumed, nutritionConfig.carbs.roundDigits)
  const energy = isFiniteNumber(last.energy) ? last.energy : 0
  let delta = 0
  let reason = 'Estomac moyen : on garde le même palier de glucides.'

  if (last.stomach >= nutritionConfig.gut.stomachExcellent && energy >= nutritionConfig.gut.energyOk) {
    delta = nutritionConfig.gut.stepExcellent
    reason = 'Estomac très confortable : une marche de +10 g/h est proposée.'
  } else if (last.stomach >= nutritionConfig.gut.stomachGood && energy >= nutritionConfig.gut.energyOk) {
    delta = nutritionConfig.gut.stepGood
    reason = 'Estomac confortable : une marche de +5 g/h est proposée.'
  } else if (last.stomach <= nutritionConfig.gut.stomachBad) {
    delta = -nutritionConfig.gut.stepDown
    reason = 'Estomac difficile : on redescend de 10 g/h.'
  }

  const suggested = roundTo(Math.max(0, baseline + delta), nutritionConfig.carbs.roundDigits)
  const requiresConfirmation = suggested > tolerance
  const applicable = requiresConfirmation ? roundTo(tolerance, nutritionConfig.carbs.roundDigits) : suggested
  return {
    baselineGPerHour: baseline,
    suggestedGPerHour: suggested,
    applicableGPerHour: applicable,
    deltaGPerHour: roundTo(suggested - baseline, nutritionConfig.carbs.roundDigits),
    requiresConfirmation,
    reason: requiresConfirmation
      ? `${reason} Cela dépasse la tolérance déclarée : confirmation explicite nécessaire.`
      : reason,
  }
}
