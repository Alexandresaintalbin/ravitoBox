import { z } from 'zod'

export const emailSchema = z
  .string({ required_error: 'L’e-mail est requis.' })
  .trim()
  .min(1, 'L’e-mail est requis.')
  .email('Adresse e-mail invalide.')

export const passwordSchema = z
  .string({ required_error: 'Le mot de passe est requis.' })
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(72, 'Le mot de passe ne peut pas dépasser 72 caractères.')

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  pseudo: z.string().trim().min(2, 'Le pseudo doit contenir au moins 2 caractères.').max(40, '40 caractères maximum.'),
  invitationCode: z
    .string()
    .trim()
    .max(40, '40 caractères maximum.')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
})

export function signupSchemaFor(mode: 'closed' | 'invite' | 'open') {
  if (mode !== 'invite') return signupSchema
  return signupSchema.superRefine((value, context) => {
    if (!value.invitationCode || value.invitationCode.length < 6) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['invitationCode'],
        message: 'Un code d’invitation d’au moins 6 caractères est requis.',
      })
    }
  })
}

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Le mot de passe est requis.'),
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const passwordPairSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1, 'Confirmez le mot de passe.'),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    message: 'Les mots de passe ne correspondent pas.',
  })

export const emailChangeSchema = z.object({
  email: emailSchema,
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type PasswordPairInput = z.infer<typeof passwordPairSchema>
export type EmailChangeInput = z.infer<typeof emailChangeSchema>
