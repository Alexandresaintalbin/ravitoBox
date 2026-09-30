import { describe, expect, it } from 'vitest'
import { emailChangeSchema, forgotPasswordSchema, loginSchema, passwordPairSchema, signupSchema, signupSchemaFor } from '@/schemas/auth'
import { deleteAccountSchema, debriefSchema } from '@/schemas/debrief'
import { outingSchema } from '@/schemas/outing'
import { productSchema, boxQuantitySchema } from '@/schemas/product'
import { profileSchema } from '@/schemas/profile'
import { emptyOuting } from '@/composables/useOuting'

describe('schémas d’authentification', () => {
  it('accepte une inscription valide et refuse les cas limites', () => {
    expect(signupSchema.safeParse({ email: 'ada@exemple.fr', password: 'secret123', pseudo: 'Ada' }).success).toBe(true)
    expect(signupSchemaFor('invite').safeParse({ email: 'ada@exemple.fr', password: 'secret123', pseudo: 'Ada', invitationCode: 'AB12CD' }).success).toBe(true)
    expect(signupSchemaFor('invite').safeParse({ email: 'ada@exemple.fr', password: 'secret123', pseudo: 'Ada' }).success).toBe(false)
    expect(signupSchemaFor('open').safeParse({ email: 'ada@exemple.fr', password: 'secret123', pseudo: 'Ada' }).success).toBe(true)
    expect(signupSchemaFor('closed').safeParse({ email: 'ada@exemple.fr', password: 'secret123', pseudo: 'Ada' }).success).toBe(true)
    expect(signupSchema.safeParse({ email: 'pas-un-email', password: 'secret123', pseudo: 'Ada' }).success).toBe(false)
    expect(signupSchema.safeParse({ email: 'ada@exemple.fr', password: 'court', pseudo: 'Ada' }).success).toBe(false)
    expect(signupSchema.safeParse({ email: 'ada@exemple.fr', password: 'x'.repeat(73), pseudo: 'Ada' }).success).toBe(false)
    expect(signupSchema.safeParse({ email: 'ada@exemple.fr', password: 'secret123', pseudo: 'A' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'ada@exemple.fr', password: 'x' }).success).toBe(true)
    expect(forgotPasswordSchema.safeParse({ email: 'ada@exemple.fr' }).success).toBe(true)
    expect(passwordPairSchema.safeParse({ password: 'secret123', confirm: 'secret123' }).success).toBe(true)
    expect(passwordPairSchema.safeParse({ password: 'secret123', confirm: 'autre' }).success).toBe(false)
    expect(passwordPairSchema.safeParse({ password: 'secret123', confirm: '' }).success).toBe(false)
    expect(emailChangeSchema.safeParse({ email: 'ada@exemple.fr' }).success).toBe(true)
  })
})

describe('schéma profil', () => {
  it('borne le poids, la tolérance et les saveurs', () => {
    expect(
      profileSchema.safeParse({
        pseudo: 'Ada',
        weightKg: null,
        primarySport: null,
        toleranceGPerHour: 60,
        preferredFlavors: ['citron'],
      }).success,
    ).toBe(true)
    expect(profileSchema.safeParse({ pseudo: 'A', weightKg: 70, primarySport: 'course', toleranceGPerHour: 60, preferredFlavors: [] }).success).toBe(false)
    expect(profileSchema.safeParse({ pseudo: 'Ada', weightKg: 0, primarySport: 'course', toleranceGPerHour: 60, preferredFlavors: [] }).success).toBe(false)
    expect(profileSchema.safeParse({ pseudo: 'Ada', weightKg: 400, primarySport: 'trail', toleranceGPerHour: -1, preferredFlavors: [] }).success).toBe(false)
    expect(profileSchema.safeParse({ pseudo: 'Ada', weightKg: 70, primarySport: 'course', toleranceGPerHour: 201, preferredFlavors: [] }).success).toBe(false)
    expect(profileSchema.safeParse({ pseudo: 'Ada', weightKg: 'lourd', primarySport: 'velo', toleranceGPerHour: 60, preferredFlavors: ['menthe'] }).success).toBe(false)
  })
})

describe('schéma produit', () => {
  it('normalise les textes vides et refuse les valeurs négatives', () => {
    const parsed = productSchema.safeParse({
      name: 'Gel maison',
      brand: '',
      productType: 'gel',
      flavor: '  ',
      carbsG: 22,
      sodiumMg: 40,
      caffeineMg: 0,
      volumeMl: null,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.brand).toBeNull()
      expect(parsed.data.flavor).toBeNull()
    }
    expect(productSchema.safeParse({ name: '', brand: 'x'.repeat(81), productType: 'inconnu', flavor: 'citron', carbsG: -1, sodiumMg: 0, caffeineMg: 0, volumeMl: 10 }).success).toBe(false)
    expect(boxQuantitySchema.safeParse(0).success).toBe(true)
    expect(boxQuantitySchema.safeParse(-1).success).toBe(false)
    expect(boxQuantitySchema.safeParse(10_000).success).toBe(false)
  })
})

describe('schéma de sortie', () => {
  it('exige une durée, un dénivelé en trail et des segments en triathlon', () => {
    const base = emptyOuting()
    expect(outingSchema.safeParse(base).success).toBe(true)
    expect(outingSchema.safeParse({ ...base, hours: 0, minutes: 0 }).success).toBe(false)
    expect(outingSchema.safeParse({ ...base, sport: 'trail', elevationM: null }).success).toBe(false)
    expect(outingSchema.safeParse({ ...base, sport: 'trail', elevationM: 800 }).success).toBe(true)
    expect(outingSchema.safeParse({ ...base, sport: 'triathlon', triFormat: null }).success).toBe(false)
    expect(
      outingSchema.safeParse({
        ...base,
        sport: 'triathlon',
        triFormat: 'triathlon_70_3',
        swimMin: 40,
        t1Min: 5,
        bikeMin: 180,
        t2Min: 4,
        runMin: 110,
      }).success,
    ).toBe(true)
  })
})

describe('schéma de débrief', () => {
  it('borne les sensations et la confirmation de suppression', () => {
    expect(
      debriefSchema.safeParse({
        energy: 3,
        stomach: 4,
        thirst: 2,
        notes: 'ras',
        consumed: [{ productId: '00000000-0000-4000-8000-000000000001', productName: 'Gel', quantity: 1 }],
      }).success,
    ).toBe(true)
    expect(debriefSchema.safeParse({ energy: 0, stomach: 3, thirst: 3, notes: '', consumed: [] }).success).toBe(false)
    expect(debriefSchema.safeParse({ energy: 3, stomach: 3, thirst: 6, notes: 'x'.repeat(2001), consumed: [] }).success).toBe(false)
    expect(deleteAccountSchema.safeParse({ confirmation: 'SUPPRIMER' }).success).toBe(true)
    expect(deleteAccountSchema.safeParse({ confirmation: 'oui' }).success).toBe(false)
  })
})
