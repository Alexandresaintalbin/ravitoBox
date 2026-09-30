export type StorageActor = 'anon' | 'user' | 'admin'
export type StorageAction = 'read' | 'write' | 'delete'

export function canAccessProductImage(input: {
  actor: StorageActor
  userId: string | null
  path: string
  action: StorageAction
}): boolean {
  const parts = input.path.split('/').filter(Boolean)
  if (parts.some((part) => part === '..')) return false
  if (input.action === 'read') return parts.length >= 2
  const [folder, owner] = parts
  if (folder === 'catalog') return input.actor === 'admin' && parts.length >= 2
  if (folder === 'users') {
    return input.actor === 'user' && Boolean(input.userId) && owner === input.userId && parts.length >= 3
  }
  return false
}
