import type { ProductType } from '@/engine/types'
import type { Product } from '@/lib/mappers'

export interface ProductVisual {
  name: string
  type: ProductType
  imagePath: string | null
}

export function visualsFrom(products: Array<Pick<Product, 'id' | 'name' | 'type' | 'imagePath'>>): Record<string, ProductVisual> {
  const visuals: Record<string, ProductVisual> = {}
  for (const product of products) {
    visuals[product.id] = {
      name: product.name,
      type: product.type,
      imagePath: product.imagePath ?? null,
    }
  }
  return visuals
}
