import { nutritionConfig } from './config'
import { clamp, isFiniteNumber, roundTo } from './math'
import type { Adjustment, AdjustmentInput } from './types'

function invalid(input: AdjustmentInput): boolean {
  return (
    !isFiniteNumber(input.stomach) ||
    !isFiniteNumber(input.energy) ||
    !isFiniteNumber(input.thirst) ||
    !isFiniteNumber(input.carbsGPerHour) ||
    !isFiniteNumber(input.fluidMlPerHour) ||
    !isFiniteNumber(input.sodiumMgPerHour) ||
    !isFiniteNumber(input.toleranceGPerHour)
  )
}

export function proposeAdjustments(input: AdjustmentInput): Adjustment[] {
  if (invalid(input)) {
    return [
      {
        id: 'invalid',
        field: 'note',
        label: 'Données insuffisantes',
        detail: 'Le débrief est incomplet : aucun ajustement n’est proposé.',
        current: null,
        proposed: null,
        requiresConfirmation: false,
      },
    ]
  }

  const cfg = nutritionConfig.adjustments
  const notes: Adjustment[] = []
  const tolerance = Math.max(0, input.toleranceGPerHour)

  if (input.stomach <= cfg.stomachBad) {
    const proposed = roundTo(Math.max(0, input.carbsGPerHour - cfg.carbStepDown), 1)
    notes.push({
      id: 'carbs-down',
      field: 'carbs',
      label: 'Descendre les glucides',
      detail: 'L’estomac a été pénible. Mieux vaut alléger la prochaine sortie.',
      current: input.carbsGPerHour,
      proposed,
      requiresConfirmation: false,
    })
  } else if (input.stomach >= cfg.stomachGood && input.energy <= cfg.energyLow) {
    const proposed = roundTo(input.carbsGPerHour + cfg.carbStepUp, 1)
    notes.push({
      id: 'carbs-up',
      field: 'carbs',
      label: 'Monter les glucides',
      detail: 'L’estomac a suivi mais l’énergie a manqué. Une petite marche est envisageable.',
      current: input.carbsGPerHour,
      proposed,
      requiresConfirmation: proposed > tolerance,
    })
  }

  if (input.thirst >= cfg.thirstHigh) {
    const fluid = Math.round(
      clamp(input.fluidMlPerHour + cfg.fluidStepUp, nutritionConfig.fluid.min, nutritionConfig.fluid.max),
    )
    const sodium = Math.round(
      clamp(
        input.sodiumMgPerHour + cfg.sodiumStepUp,
        nutritionConfig.sodium.min,
        nutritionConfig.sodium.max,
      ),
    )
    if (fluid !== Math.round(input.fluidMlPerHour)) {
      notes.push({
        id: 'fluid-up',
        field: 'fluid',
        label: 'Boire davantage',
        detail: 'La soif est restée haute : augmentez le volume horaire.',
        current: input.fluidMlPerHour,
        proposed: fluid,
        requiresConfirmation: false,
      })
    } else {
      notes.push({
        id: 'fluid-ceiling',
        field: 'note',
        label: 'Hydratation déjà au plafond',
        detail: 'La soif est haute, mais la cible est déjà au maximum recommandé.',
        current: input.fluidMlPerHour,
        proposed: fluid,
        requiresConfirmation: false,
      })
    }
    if (sodium !== Math.round(input.sodiumMgPerHour)) {
      notes.push({
        id: 'sodium-up',
        field: 'sodium',
        label: 'Renforcer le sodium',
        detail: 'Une soif marquée va souvent avec des pertes de sel plus hautes.',
        current: input.sodiumMgPerHour,
        proposed: sodium,
        requiresConfirmation: false,
      })
    } else {
      notes.push({
        id: 'sodium-ceiling',
        field: 'note',
        label: 'Sodium déjà au plafond',
        detail: 'La cible de sodium est déjà au maximum recommandé.',
        current: input.sodiumMgPerHour,
        proposed: sodium,
        requiresConfirmation: false,
      })
    }
  } else if (input.thirst <= cfg.thirstLow) {
    const fluid = Math.round(
      clamp(input.fluidMlPerHour - cfg.fluidStepDown, nutritionConfig.fluid.min, nutritionConfig.fluid.max),
    )
    const sodium = Math.round(
      clamp(
        input.sodiumMgPerHour - cfg.sodiumStepDown,
        nutritionConfig.sodium.min,
        nutritionConfig.sodium.max,
      ),
    )
    if (fluid !== Math.round(input.fluidMlPerHour)) {
      notes.push({
        id: 'fluid-down',
        field: 'fluid',
        label: 'Alléger la boisson',
        detail: 'Peu de soif : le volume peut redescendre légèrement.',
        current: input.fluidMlPerHour,
        proposed: fluid,
        requiresConfirmation: false,
      })
    } else {
      notes.push({
        id: 'fluid-floor',
        field: 'note',
        label: 'Hydratation déjà au plancher',
        detail: 'La cible de boisson est déjà au minimum recommandé.',
        current: input.fluidMlPerHour,
        proposed: fluid,
        requiresConfirmation: false,
      })
    }
    if (sodium !== Math.round(input.sodiumMgPerHour)) {
      notes.push({
        id: 'sodium-down',
        field: 'sodium',
        label: 'Alléger le sodium',
        detail: 'Peu de soif : le sodium peut redescendre un peu.',
        current: input.sodiumMgPerHour,
        proposed: sodium,
        requiresConfirmation: false,
      })
    } else {
      notes.push({
        id: 'sodium-floor',
        field: 'note',
        label: 'Sodium déjà au plancher',
        detail: 'La cible de sodium est déjà au minimum recommandé.',
        current: input.sodiumMgPerHour,
        proposed: sodium,
        requiresConfirmation: false,
      })
    }
  }

  if (notes.length === 0) {
    notes.push({
      id: 'keep',
      field: 'note',
      label: 'Garder la stratégie',
      detail: 'Rien dans ce débrief ne justifie de changer les cibles.',
      current: null,
      proposed: null,
      requiresConfirmation: false,
    })
  }

  return notes
}
