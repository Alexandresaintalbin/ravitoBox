import { z } from 'zod'

export const consumedSchema = z.object({
  productId: z.string().uuid('Produit invalide.'),
  productName: z.string().min(1),
  quantity: z.number().int().min(0).max(99),
})

export const debriefSchema = z.object({
  energy: z.number().int().min(1, 'Notez l’énergie de 1 à 5.').max(5),
  stomach: z.number().int().min(1, 'Notez l’estomac de 1 à 5.').max(5),
  thirst: z.number().int().min(1, 'Notez la soif de 1 à 5.').max(5),
  notes: z.string().trim().max(2000, '2000 caractères maximum.'),
  consumed: z.array(consumedSchema).max(80),
})

export const deleteAccountSchema = z.object({
  confirmation: z.literal('SUPPRIMER', {
    errorMap: () => ({ message: 'Saisissez SUPPRIMER pour confirmer.' }),
  }),
})

export type DebriefInput = z.infer<typeof debriefSchema>
export type ConsumedInput = z.infer<typeof consumedSchema>
