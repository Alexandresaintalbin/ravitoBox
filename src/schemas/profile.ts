import { z } from 'zod'
import { SPORTS } from '@/engine/types'
import { FLAVORS } from '@/lib/flavors'

export const profileSchema = z.object({
  pseudo: z.string().trim().min(2, 'Le pseudo doit contenir au moins 2 caractères.').max(40, '40 caractères maximum.'),
  weightKg: z
    .number({ invalid_type_error: 'Le poids doit être un nombre.' })
    .gt(0, 'Le poids doit être positif.')
    .lt(400, 'Le poids doit rester inférieur à 400 kg.')
    .nullable(),
  primarySport: z.enum(SPORTS).nullable(),
  toleranceGPerHour: z
    .number({ invalid_type_error: 'La tolérance doit être un nombre.' })
    .min(0, 'La tolérance ne peut pas être négative.')
    .max(200, 'La tolérance est plafonnée à 200 g/h.'),
  preferredFlavors: z.array(z.enum(FLAVORS)).max(12, '12 saveurs maximum.'),
})

export type ProfileInput = z.infer<typeof profileSchema>
