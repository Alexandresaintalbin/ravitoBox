import type { RejectedProduct } from '@/lib/catalog/convert'

export interface ImportReport {
  added: number
  updated: number
  skippedVerified: number
  rejected: RejectedProduct[]
  imageWarnings: { barcode: string; reason: string }[]
  brokenLines: number
}

export function emptyReport(): ImportReport {
  return { added: 0, updated: 0, skippedVerified: 0, rejected: [], imageWarnings: [], brokenLines: 0 }
}

export function recordUpsert(report: ImportReport, status: 'inserted' | 'updated' | 'skipped_verified'): void {
  if (status === 'inserted') report.added += 1
  else if (status === 'updated') report.updated += 1
  else report.skippedVerified += 1
}

export function formatReport(report: ImportReport): string {
  const lines = [
    `Ajoutés : ${report.added}`,
    `Mis à jour : ${report.updated}`,
    `Ignorés (vérifiés) : ${report.skippedVerified}`,
    `Rejetés : ${report.rejected.length}`,
    `Images en échec : ${report.imageWarnings.length}`,
    `Lignes illisibles : ${report.brokenLines}`,
  ]
  const reasons = new Map<string, number>()
  for (const item of report.rejected) reasons.set(item.reason, (reasons.get(item.reason) ?? 0) + 1)
  for (const [reason, count] of reasons) lines.push(`- ${reason} : ${count}`)
  for (const warning of report.imageWarnings) lines.push(`- image ${warning.barcode} : ${warning.reason}`)
  return lines.join('\n')
}
