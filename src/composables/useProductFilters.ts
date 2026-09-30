import { computed, ref, type Ref } from 'vue'

export interface FilterableProduct {
  name: string
  type: string
  flavor: string | null
}

export function filterProducts<T extends FilterableProduct>(
  products: T[],
  filters: { type: string; flavor: string; query: string },
  preferred: string[],
): T[] {
  const query = filters.query.trim().toLowerCase()
  const preferredSet = new Set(preferred.map((flavor) => flavor.toLowerCase()))
  return products
    .filter((product) => (filters.type === 'tous' ? true : product.type === filters.type))
    .filter((product) => (filters.flavor === 'toutes' ? true : (product.flavor ?? '').toLowerCase() === filters.flavor.toLowerCase()))
    .filter((product) => (query ? product.name.toLowerCase().includes(query) || (product.flavor ?? '').toLowerCase().includes(query) : true))
    .slice()
    .sort((a, b) => {
      const aPreferred = a.flavor ? preferredSet.has(a.flavor.toLowerCase()) : false
      const bPreferred = b.flavor ? preferredSet.has(b.flavor.toLowerCase()) : false
      if (aPreferred !== bPreferred) return aPreferred ? -1 : 1
      return a.name.localeCompare(b.name, 'fr')
    })
}

export function useProductFilters<T extends FilterableProduct>(source: Ref<T[]>, preferred: Ref<string[]>) {
  const type = ref('tous')
  const flavor = ref('toutes')
  const query = ref('')
  const filtered = computed(() =>
    filterProducts(source.value, { type: type.value, flavor: flavor.value, query: query.value }, preferred.value),
  )
  return { type, flavor, query, filtered }
}
