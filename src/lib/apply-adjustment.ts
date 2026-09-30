import type { Adjustment } from '@/engine'
import type { OutingFormInput } from '@/schemas/outing'

export function applyAdjustment(
  form: OutingFormInput,
  adjustment: Adjustment,
  confirmExceed: boolean,
): { form: OutingFormInput; applied: boolean; reason: string } {
  if (adjustment.field === 'note' || adjustment.proposed == null) {
    return { form, applied: false, reason: 'Cette note ne modifie pas les chiffres.' }
  }
  if (adjustment.requiresConfirmation && !confirmExceed) {
    return { form, applied: false, reason: 'Cochez la confirmation pour dépasser la tolérance.' }
  }
  if (adjustment.field === 'carbs') {
    return {
      form: {
        ...form,
        carbOverrideGPerHour: adjustment.proposed,
        allowExceedTolerance: adjustment.requiresConfirmation,
      },
      applied: true,
      reason: 'La cible de glucides est prête pour la prochaine sortie.',
    }
  }
  if (adjustment.field === 'fluid') {
    return {
      form: { ...form, fluidOverrideMlPerHour: adjustment.proposed },
      applied: true,
      reason: 'Le volume d’eau est prêt pour la prochaine sortie.',
    }
  }
  return {
    form: { ...form, sodiumOverrideMgPerHour: adjustment.proposed },
    applied: true,
    reason: 'La cible de sodium est prête pour la prochaine sortie.',
  }
}
