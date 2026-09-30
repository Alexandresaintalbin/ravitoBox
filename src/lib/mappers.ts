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
  barcode?: string | null
  servingLabel?: string | null
  servingSize?: number | null
  servingUnit?: 'g' | 'ml' | null
  carbsPer100?: number | null
  sugarsG?: number | null
  sugarsPer100?: number | null
  energyKj?: number | null
  energyKjPer100?: number | null
  sodiumPer100?: number | null
  caffeinePer100?: number | null
  imagePath?: string | null
  imageCredit?: string | null
  source?: 'off' | 'manual' | 'user'
  sourceUrl?: string | null
  dataQuality?: 'complete' | 'incomplete'
  verified?: boolean
  buyUrl?: string | null
  indicativePriceEur?: number | null
  offLastModified?: string | null
  originId?: string | null
  carbsKnown?: boolean
  sodiumKnown?: boolean
  caffeineKnown?: boolean
}

type ProfileRow = Database['public']['Tables']['profiles']['Row']

export interface MappableProduct {
  id: string
  name: string
  brand: string | null
  product_type: ProductType
  flavor: string | null
  carbs_g: number | string | null
  sodium_mg?: number | string | null
  caffeine_mg?: number | string | null
  volume_ml?: number | string | null
  scope: 'catalog' | 'custom'
  owner_id: string | null
  barcode?: string | null
  serving_label?: string | null
  serving_size?: number | string | null
  serving_unit?: string | null
  carbs_per_100?: number | string | null
  sugars_g?: number | string | null
  sugars_per_100?: number | string | null
  energy_kj?: number | string | null
  energy_kj_per_100?: number | string | null
  sodium_per_100?: number | string | null
  caffeine_per_100?: number | string | null
  image_path?: string | null
  image_credit?: string | null
  source?: string | null
  source_url?: string | null
  data_quality?: string | null
  verified?: boolean | null
  buy_url?: string | null
  indicative_price_eur?: number | string | null
  off_last_modified?: string | null
  origin_id?: string | null
  carbs_known?: boolean | null
}

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

function sourceOf(value: string | null | undefined): Product['source'] {
  if (value === 'off' || value === 'user' || value === 'manual') return value
  return 'manual'
}

function unitOf(value: string | null | undefined): 'g' | 'ml' | null {
  if (value === 'g' || value === 'ml') return value
  return null
}

export function mapProduct(row: MappableProduct): Product {
  const sodiumKnown = row.sodium_mg != null
  const caffeineKnown = row.caffeine_mg != null
  const carbsKnown = row.carbs_known !== false && row.carbs_g != null
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
    barcode: row.barcode ?? null,
    servingLabel: row.serving_label ?? null,
    servingSize: asNullableNumber(row.serving_size),
    servingUnit: unitOf(row.serving_unit),
    carbsPer100: asNullableNumber(row.carbs_per_100),
    sugarsG: asNullableNumber(row.sugars_g),
    sugarsPer100: asNullableNumber(row.sugars_per_100),
    energyKj: asNullableNumber(row.energy_kj),
    energyKjPer100: asNullableNumber(row.energy_kj_per_100),
    sodiumPer100: asNullableNumber(row.sodium_per_100),
    caffeinePer100: asNullableNumber(row.caffeine_per_100),
    imagePath: row.image_path ?? null,
    imageCredit: row.image_credit ?? null,
    source: sourceOf(row.source),
    sourceUrl: row.source_url ?? null,
    dataQuality: row.data_quality === 'complete' ? 'complete' : 'incomplete',
    verified: row.verified === true,
    buyUrl: row.buy_url ?? null,
    indicativePriceEur: asNullableNumber(row.indicative_price_eur),
    offLastModified: row.off_last_modified ?? null,
    originId: row.origin_id ?? null,
    carbsKnown,
    sodiumKnown,
    caffeineKnown,
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
