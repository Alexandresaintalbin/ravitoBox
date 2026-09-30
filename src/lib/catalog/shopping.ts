import type { ShoppingLine } from '@/engine/types'

export interface ShoppingGroup {
  brand: string
  lines: ShoppingLine[]
}

export function groupShopping(lines: ShoppingLine[]): ShoppingGroup[] {
  const map = new Map<string, ShoppingLine[]>()
  for (const line of lines) {
    if (line.missing <= 0) continue
    const brand = line.brand?.trim() || 'Sans marque'
    const group = map.get(brand) ?? []
    group.push(line)
    map.set(brand, group)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
    .map(([brand, grouped]) => ({ brand, lines: grouped }))
}

export function shoppingText(lines: ShoppingLine[]): string {
  const groups = groupShopping(lines)
  if (groups.length === 0) return 'Rien à acheter : le stock couvre le plan.'
  const parts = ['Liste de courses']
  for (const group of groups) {
    parts.push(group.brand)
    for (const line of group.lines) parts.push(`- ${line.name} × ${line.missing}`)
  }
  return parts.join('\n')
}
