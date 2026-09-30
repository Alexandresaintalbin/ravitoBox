import { z } from 'zod'
import { INTENSITIES, SESSION_TYPES, SPORTS, SWEAT_LEVELS, TEMPERATURES, TRI_FORMATS } from '@/engine/types'

const minutes = z.number({ invalid_type_error: 'Durée invalide.' }).int().min(0).max(24 * 60)

export const outingSchema = z
  .object({
    title: z.string().trim().min(1, 'Donnez un nom à la sortie.').max(80),
    sport: z.enum(SPORTS),
    sessionType: z.enum(SESSION_TYPES),
    hours: z.number().int().min(0).max(48),
    minutes: z.number().int().min(0).max(59),
    intensity: z.enum(INTENSITIES),
    temperature: z.enum(TEMPERATURES),
    sweat: z.enum(SWEAT_LEVELS),
    toleranceGPerHour: z.number().min(0).max(200),
    elevationM: z.number().int().min(0).max(20_000).nullable(),
    allowOutsideBox: z.boolean(),
    allowExceedTolerance: z.boolean(),
    carbOverrideGPerHour: z.number().min(0).max(200).nullable(),
    fluidOverrideMlPerHour: z.number().min(0).max(2000).nullable(),
    sodiumOverrideMgPerHour: z.number().min(0).max(2000).nullable(),
    triFormat: z.enum(TRI_FORMATS).nullable(),
    swimMin: minutes,
    t1Min: minutes,
    bikeMin: minutes,
    t2Min: minutes,
    runMin: minutes,
  })
  .superRefine((value, context) => {
    const total = value.hours * 60 + value.minutes
    if (value.sport !== 'triathlon' && total <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hours'],
        message: 'Indiquez une durée supérieure à zéro.',
      })
    }
    if (value.sport === 'trail' && value.elevationM == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['elevationM'],
        message: 'Le dénivelé est utile en trail : mettez 0 s’il est négligeable.',
      })
    }
    if (value.sport === 'triathlon') {
      const segments = value.swimMin + value.t1Min + value.bikeMin + value.t2Min + value.runMin
      if (segments <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bikeMin'],
          message: 'Renseignez au moins un segment du triathlon.',
        })
      }
      if (!value.triFormat) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['triFormat'],
          message: 'Choisissez un format de triathlon.',
        })
      }
    }
  })

export type OutingFormInput = z.infer<typeof outingSchema>
