import type { ProductType, Sport } from '@/engine/types'
import { asNullableNumber, asNumber } from '@/lib/numbers'
import type { Database } from '@/types/database'

export interface Profile {
  id: string
  pseudo: string
  weightKg: number | null
  primarySport: Sport | null
  toleranceGPerHour: number
  preferredFlavors: string[]
  role: 'user' | 'admin'
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: string
  name: string
  brand: string | null
  type: ProductType
  flavor: string | null
  carbsG: number
  sodiumMg: number
  caffeineMg: number
  volumeMl: number | null
  scope: 'catalog' | 'custom'
  ownerId: string | null
}

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    pseudo: row.pseudo,
    weightKg: asNullableNumber(row.weight_kg),
    primarySport: row.primary_sport,
    toleranceGPerHour: asNumber(row.tolerance_g_per_h),
    preferredFlavors: row.preferred_flavors ?? [],
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    type: row.product_type,
    flavor: row.flavor,
    carbsG: asNumber(row.carbs_g),
    sodiumMg: asNumber(row.sodium_mg),
    caffeineMg: asNumber(row.caffeine_mg),
    volumeMl: asNullableNumber(row.volume_ml),
    scope: row.scope,
    ownerId: row.owner_id,
  }
}

export function profileToUpdate(profile: Pick<Profile, 'pseudo' | 'weightKg' | 'primarySport' | 'toleranceGPerHour' | 'preferredFlavors'>) {
  return {
    pseudo: profile.pseudo,
    weight_kg: profile.weightKg,
    primary_sport: profile.primarySport,
    tolerance_g_per_h: profile.toleranceGPerHour,
    preferred_flavors: profile.preferredFlavors,
  }
}
