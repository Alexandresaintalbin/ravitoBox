import type { GeneratedPlan } from './types'

export function formatMinute(minute: number): string {
  const safe = Number.isFinite(minute) ? Math.max(0, Math.round(minute)) : 0
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

export function formatPlanText(title: string, plan: GeneratedPlan): string {
  const lines = [
    title.trim() || 'Plan ravitoBox',
    `Glucides : ${plan.totals.carbsG} / ${plan.targetsTotal.carbsG} g`,
    `Eau : ${plan.totals.fluidMl} / ${plan.targetsTotal.fluidMl} ml`,
    `Sodium : ${plan.totals.sodiumMg} / ${plan.targetsTotal.sodiumMg} mg`,
    '',
    'Déroulement',
  ]
  if (plan.intakes.length === 0) {
    lines.push('Aucune prise planifiée.')
  } else {
    for (const intake of plan.intakes) {
      const segment = intake.segment === 'effort' ? '' : ` [${intake.segment}]`
      lines.push(
        `${formatMinute(intake.minute)}${segment} — ${intake.productName} (${intake.carbsG} g, ${intake.fluidMl} ml, ${intake.sodiumMg} mg)`,
      )
    }
  }
  if (plan.shoppingList.length > 0) {
    lines.push('', 'À emporter')
    for (const line of plan.shoppingList) {
      if (line.toBring > 0) lines.push(`- ${line.name} × ${line.toBring}`)
    }
    const missing = plan.shoppingList.filter((line) => line.missing > 0)
    if (missing.length > 0) {
      lines.push('', 'Manque dans la Box')
      for (const line of missing) lines.push(`- ${line.name} × ${line.missing}`)
    }
  }
  if (plan.warnings.length > 0) {
    lines.push('', 'Avertissements')
    for (const warning of plan.warnings) lines.push(`- ${warning.message}`)
  }
  lines.push(
    '',
    'Repères indicatifs : à valider avec un diététicien du sport et à tester à l’entraînement.',
  )
  return lines.join('\n')
}
