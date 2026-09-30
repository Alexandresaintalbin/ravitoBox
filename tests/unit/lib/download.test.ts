import { describe, expect, it } from 'vitest'
import { downloadJson, downloadText } from '@/lib/download'

describe('téléchargement', () => {
  it('déclenche un lien de téléchargement JSON puis texte', () => {
    const clicks: string[] = []
    const original = URL.createObjectURL
    const revoke = URL.revokeObjectURL
    URL.createObjectURL = () => 'blob:test'
    URL.revokeObjectURL = () => undefined
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function clickMock() {
      clicks.push(this.download)
    }
    downloadJson('donnees.json', { ok: true })
    downloadText('plan.txt', 'bonjour')
    expect(clicks).toEqual(['donnees.json', 'plan.txt'])
    HTMLAnchorElement.prototype.click = click
    URL.createObjectURL = original
    URL.revokeObjectURL = revoke
  })
})
