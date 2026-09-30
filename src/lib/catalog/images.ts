export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path || /^https?:\/\//i.test(path)) return null
  const clean = path.replace(/^\/+/, '')
  if (!clean || clean.includes('..')) return null
  return `/storage/v1/object/public/product-images/${clean}`
}

export function variantPath(path: string, variant: 'thumb' | 'detail'): string {
  if (variant === 'detail') return path
  if (path.endsWith('-thumb.webp')) return path
  if (path.endsWith('.webp')) return path.replace(/\.webp$/, '-thumb.webp')
  return `${path}-thumb.webp`
}

export function imageAlt(name: string): string {
  const trimmed = name.trim()
  return trimmed || 'Produit'
}
