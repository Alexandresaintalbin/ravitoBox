export interface AppError {
  message?: string
  code?: string
  status?: number
}

function textOf(error: unknown): { message: string; code: string; status: number } {
  if (typeof error === 'string') return { message: error, code: '', status: 0 }
  if (error instanceof Error) {
    const extra = error as Error & { code?: string; status?: number }
    return { message: extra.message, code: extra.code ?? '', status: extra.status ?? 0 }
  }
  if (error && typeof error === 'object') {
    const record = error as AppError
    return {
      message: record.message ?? '',
      code: record.code ?? '',
      status: record.status ?? 0,
    }
  }
  return { message: '', code: '', status: 0 }
}

export function toUserMessage(error: unknown): string {
  const { message, code, status } = textOf(error)
  const normalized = message.toLowerCase()
  if (!message && !code && !status) return 'Une erreur inattendue est survenue.'
  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Le serveur est injoignable. Vérifiez votre connexion et réessayez.'
  }
  if (
    status === 401 ||
    code === 'PGRST301' ||
    normalized.includes('jwt expired') ||
    normalized.includes('invalid refresh token') ||
    normalized.includes('session')
  ) {
    return 'Votre session a expiré. Reconnectez-vous.'
  }
  if (code === '23505' || normalized.includes('already registered') || normalized.includes('already been registered')) {
    return 'Un compte existe déjà avec cette adresse e-mail.'
  }
  if (code === '42501' || normalized.includes('permission denied') || normalized.includes('row-level security') || status === 403) {
    return 'Vous n’avez pas le droit d’effectuer cette action.'
  }
  if (normalized.includes('invalid login credentials')) {
    return 'E-mail ou mot de passe incorrect.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirmez votre e-mail avant de vous connecter.'
  }
  if (normalized.includes('error sending confirmation email') || normalized.includes('error sending recovery email')) {
    return 'L’e-mail n’a pas pu être envoyé. Réessayez dans un instant.'
  }
  if (normalized.includes('password')) {
    return 'Le mot de passe n’est pas accepté. Utilisez au moins 8 caractères.'
  }
  if (message) return message
  return 'Une erreur inattendue est survenue.'
}
