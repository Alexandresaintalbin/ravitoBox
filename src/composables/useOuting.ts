import { computed, ref } from 'vue'
import { buildPlan, computeTargets, presetTriathlon, proposeGutTraining, type DebriefSnapshot, type GeneratedPlan, type HourlyTargets, type PlannerProduct } from '@/engine'
import { partsToMinutes } from '@/lib/format'
import { outingSchema, type OutingFormInput } from '@/schemas/outing'

export function emptyOuting(tolerance = 60): OutingFormInput {
  return {
    title: 'Sortie longue',
    sport: 'course',
    sessionType: 'entrainement',
    hours: 2,
    minutes: 30,
    intensity: 'moderee',
    temperature: 'temperee',
    sweat: 'moyenne',
    toleranceGPerHour: tolerance,
    elevationM: null,
    allowOutsideBox: false,
    allowExceedTolerance: false,
    carbOverrideGPerHour: null,
    fluidOverrideMlPerHour: null,
    sodiumOverrideMgPerHour: null,
    triFormat: null,
    swimMin: 0,
    t1Min: 0,
    bikeMin: 0,
    t2Min: 0,
    runMin: 0,
  }
}

export function applyTriFormat(form: OutingFormInput, format: NonNullable<OutingFormInput['triFormat']>): OutingFormInput {
  const preset = presetTriathlon(format)
  const total = preset.swimMin + preset.t1Min + preset.bikeMin + preset.t2Min + preset.runMin
  return {
    ...form,
    sport: 'triathlon',
    triFormat: format,
    swimMin: preset.swimMin,
    t1Min: preset.t1Min,
    bikeMin: preset.bikeMin,
    t2Min: preset.t2Min,
    runMin: preset.runMin,
    hours: Math.floor(total / 60),
    minutes: total % 60,
  }
}

export function durationOf(form: OutingFormInput): number {
  if (form.sport === 'triathlon') return form.swimMin + form.t1Min + form.bikeMin + form.t2Min + form.runMin
  return partsToMinutes(form.hours, form.minutes)
}

export interface OutingDraftResult {
  targets: HourlyTargets | null
  plan: GeneratedPlan | null
  fieldErrors: Record<string, string>
  formError: string | null
}

export function useOuting(initial: OutingFormInput) {
  const form = ref<OutingFormInput>({ ...initial })
  const targets = ref<HourlyTargets | null>(null)
  const plan = ref<GeneratedPlan | null>(null)
  const fieldErrors = ref<Record<string, string>>({})
  const formError = ref<string | null>(null)
  const gut = ref<ReturnType<typeof proposeGutTraining>>(null)

  const durationMinutes = computed(() => durationOf(form.value))

  function setFormat(format: NonNullable<OutingFormInput['triFormat']>) {
    form.value = applyTriFormat(form.value, format)
  }

  function refreshGut(history: DebriefSnapshot[]) {
    gut.value = proposeGutTraining(history, form.value.toleranceGPerHour)
  }

  function acceptGut(confirmExceed: boolean) {
    if (!gut.value) return
    if (gut.value.requiresConfirmation && !confirmExceed) {
      form.value.carbOverrideGPerHour = gut.value.applicableGPerHour
      form.value.allowExceedTolerance = false
      return
    }
    form.value.carbOverrideGPerHour = gut.value.suggestedGPerHour
    form.value.allowExceedTolerance = gut.value.requiresConfirmation && confirmExceed
  }

  function ignoreGut() {
    form.value.carbOverrideGPerHour = null
    form.value.allowExceedTolerance = false
  }

  function generate(products: PlannerProduct[]): boolean {
    fieldErrors.value = {}
    formError.value = null
    const parsed = outingSchema.safeParse(form.value)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        if (!fieldErrors.value[key]) fieldErrors.value[key] = issue.message
      }
      plan.value = null
      targets.value = null
      return false
    }
    const duration = durationOf(parsed.data)
    const nextTargets = computeTargets({
      sport: parsed.data.sport,
      sessionType: parsed.data.sessionType,
      durationMinutes: duration,
      intensity: parsed.data.intensity,
      temperature: parsed.data.temperature,
      sweat: parsed.data.sweat,
      toleranceGPerHour: parsed.data.toleranceGPerHour,
      elevationM: parsed.data.sport === 'trail' ? parsed.data.elevationM : null,
      triathlon:
        parsed.data.sport === 'triathlon' && parsed.data.triFormat
          ? {
              format: parsed.data.triFormat,
              swimMin: parsed.data.swimMin,
              t1Min: parsed.data.t1Min,
              bikeMin: parsed.data.bikeMin,
              t2Min: parsed.data.t2Min,
              runMin: parsed.data.runMin,
            }
          : null,
      carbOverrideGPerHour: parsed.data.carbOverrideGPerHour,
      allowExceedTolerance: parsed.data.allowExceedTolerance,
    })
    const adjusted = {
      ...nextTargets,
      fluidMlPerHour: parsed.data.fluidOverrideMlPerHour ?? nextTargets.fluidMlPerHour,
      sodiumMgPerHour: parsed.data.sodiumOverrideMgPerHour ?? nextTargets.sodiumMgPerHour,
    }
    targets.value = adjusted
    plan.value = buildPlan({
      sport: parsed.data.sport,
      durationMinutes: duration,
      targets: adjusted,
      products,
      allowOutsideBox: parsed.data.allowOutsideBox,
      triathlon:
        parsed.data.sport === 'triathlon' && parsed.data.triFormat
          ? {
              format: parsed.data.triFormat,
              swimMin: parsed.data.swimMin,
              t1Min: parsed.data.t1Min,
              bikeMin: parsed.data.bikeMin,
              t2Min: parsed.data.t2Min,
              runMin: parsed.data.runMin,
            }
          : null,
    })
    return true
  }

  return {
    form,
    targets,
    plan,
    fieldErrors,
    formError,
    gut,
    durationMinutes,
    setFormat,
    refreshGut,
    acceptGut,
    ignoreGut,
    generate,
  }
}
