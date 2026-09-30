import { z } from 'zod'
import { PRODUCT_TYPES } from '@/engine/types'

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères maximum.`)
    .optional()
    .transform((value) => (value ? value : null))

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(120, '120 caractères maximum.'),
  brand: optionalText(80, 'Marque'),
  productType: z.enum(PRODUCT_TYPES, { required_error: 'Le type est requis.', invalid_type_error: 'Type inconnu.' }),
  flavor: optionalText(40, 'Saveur'),
  carbsG: z.number({ invalid_type_error: 'Glucides invalides.' }).min(0, 'Les glucides ne peuvent pas être négatifs.').max(500),
  sodiumMg: z.number({ invalid_type_error: 'Sodium invalide.' }).min(0).max(10_000),
  caffeineMg: z.number({ invalid_type_error: 'Caféine invalide.' }).min(0).max(1_000),
  volumeMl: z.number({ invalid_type_error: 'Volume invalide.' }).min(0).max(5_000).nullable(),
})

export const boxQuantitySchema = z.number().int().min(0, 'La quantité ne peut pas être négative.').max(9999)

export type ProductInput = z.infer<typeof productSchema>
