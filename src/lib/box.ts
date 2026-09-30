import type { PlannerProduct } from '@/engine/types'
import type { Product } from '@/lib/mappers'

export interface BoxItem {
  productId: string
  quantity: number
  excluded: boolean
}

export interface BoxEntry {
  product: Product
  quantity: number
  excluded: boolean
  favorite: boolean
}

export function mergeBox(products: Product[], items: BoxItem[], favoriteIds: string[]): BoxEntry[] {
  const favorites = new Set(favoriteIds)
  const byId = new Map(products.map((product) => [product.id, product]))
  return items
    .flatMap((item) => {
      const product = byId.get(item.productId)
      if (!product) return []
      return [
        {
          product,
          quantity: item.quantity,
          excluded: item.excluded,
          favorite: favorites.has(item.productId),
        },
      ]
    })
    .sort((a, b) => a.product.name.localeCompare(b.product.name, 'fr'))
}

export function toPlannerProducts(
  entries: BoxEntry[],
  catalog: Product[],
  preferredFlavors: string[],
  allowOutsideBox: boolean,
): PlannerProduct[] {
  const inBox = new Set(entries.map((entry) => entry.product.id))
  const preferred = new Set(preferredFlavors.map((flavor) => flavor.toLowerCase()))
  const fromBox: PlannerProduct[] = entries.map((entry) => ({
    id: entry.product.id,
    name: entry.product.name,
    type: entry.product.type,
    flavor: entry.product.flavor,
    carbsG: entry.product.carbsG,
    sodiumMg: entry.product.sodiumMg,
    caffeineMg: entry.product.caffeineMg,
    volumeMl: entry.product.volumeMl ?? 0,
    stock: entry.quantity,
    inBox: true,
    excluded: entry.excluded,
    favorite: entry.favorite,
    preferredFlavor: entry.product.flavor ? preferred.has(entry.product.flavor.toLowerCase()) : false,
    carbsKnown: entry.product.carbsKnown !== false,
    sodiumKnown: entry.product.sodiumKnown !== false,
    caffeineKnown: entry.product.caffeineKnown !== false,
    verified: entry.product.verified,
    brand: entry.product.brand,
    imagePath: entry.product.imagePath ?? null,
  }))
  if (!allowOutsideBox) return fromBox
  const outside: PlannerProduct[] = catalog
    .filter((product) => !inBox.has(product.id))
    .map((product) => ({
      id: product.id,
      name: product.name,
      type: product.type,
      flavor: product.flavor,
      carbsG: product.carbsG,
      sodiumMg: product.sodiumMg,
      caffeineMg: product.caffeineMg,
      volumeMl: product.volumeMl ?? 0,
      stock: null,
      inBox: false,
      excluded: false,
      favorite: false,
      preferredFlavor: product.flavor ? preferred.has(product.flavor.toLowerCase()) : false,
      carbsKnown: product.carbsKnown !== false,
      sodiumKnown: product.sodiumKnown !== false,
      caffeineKnown: product.caffeineKnown !== false,
      verified: product.verified,
      brand: product.brand,
      imagePath: product.imagePath ?? null,
    }))
  return [...fromBox, ...outside]
}
