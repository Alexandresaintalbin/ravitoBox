export const FLAVORS = [
  'citron',
  'pêche',
  'cola',
  'chocolat',
  'orange',
  'fruits rouges',
  'agrume',
  'banane',
  'pomme',
  'neutre',
  'abricot',
  'fruits',
] as const

export type Flavor = (typeof FLAVORS)[number]

export function isKnownFlavor(value: string): value is Flavor {
  return (FLAVORS as readonly string[]).includes(value)
}
