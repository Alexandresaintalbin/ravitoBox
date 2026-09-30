import { describe, expect, it } from 'vitest'
import { proposeGutTraining } from '@/engine/gut'
import type { DebriefSnapshot } from '@/engine/types'

function snap(overrides: Partial<DebriefSnapshot> = {}): DebriefSnapshot {
  return {
    carbsGPerHourConsumed: 60,
    stomach: 4,
    energy: 4,
    thirst: 3,
    durationMinutes: 120,
    ...overrides,
  }
}

describe('proposeGutTraining', () => {
  it('ne propose rien sans historique exploitable', () => {
    expect(proposeGutTraining([], 80)).toBeNull()
    expect(
      proposeGutTraining(
        [
          snap({ durationMinutes: 20 }),
          snap({ carbsGPerHourConsumed: -1 }),
          snap({ stomach: Number.NaN }),
          snap({ durationMinutes: Number.NaN }),
        ],
        80,
      ),
    ).toBeNull()
  })

  it('monte de 10 g/h si l’estomac était excellent, de 5 s’il était bon', () => {
    const excellent = proposeGutTraining([snap({ stomach: 5, energy: 3, carbsGPerHourConsumed: 60 })], 90)
    expect(excellent).toMatchObject({
      baselineGPerHour: 60,
      suggestedGPerHour: 70,
      applicableGPerHour: 70,
      deltaGPerHour: 10,
      requiresConfirmation: false,
    })
    expect(excellent?.reason).toContain('+10')
    const good = proposeGutTraining([snap({ stomach: 4, energy: 5 })], 90)
    expect(good?.suggestedGPerHour).toBe(65)
    expect(good?.deltaGPerHour).toBe(5)
  })

  it('maintient le palier si l’énergie n’a pas suivi ou si l’estomac est moyen', () => {
    const tired = proposeGutTraining([snap({ stomach: 5, energy: 2 })], 90)
    expect(tired?.deltaGPerHour).toBe(0)
    expect(tired?.reason).toContain('même palier')
    const mid = proposeGutTraining([snap({ stomach: 3, energy: 5 })], 90)
    expect(mid?.suggestedGPerHour).toBe(60)
    const missingEnergy = proposeGutTraining([snap({ stomach: 4, energy: Number.NaN })], 90)
    expect(missingEnergy?.deltaGPerHour).toBe(0)
  })

  it('redescend de 10 g/h, sans passer sous zéro, si l’estomac a souffert', () => {
    const bad = proposeGutTraining([snap({ stomach: 2, carbsGPerHourConsumed: 55 })], 90)
    expect(bad?.suggestedGPerHour).toBe(45)
    expect(bad?.deltaGPerHour).toBe(-10)
    const worse = proposeGutTraining([snap({ stomach: 1, carbsGPerHourConsumed: 4 })], 90)
    expect(worse?.suggestedGPerHour).toBe(0)
    expect(worse?.deltaGPerHour).toBe(-4)
  })

  it('demande une confirmation explicite pour dépasser la tolérance', () => {
    const proposal = proposeGutTraining([snap({ stomach: 5, carbsGPerHourConsumed: 70 })], 75)
    expect(proposal?.suggestedGPerHour).toBe(80)
    expect(proposal?.applicableGPerHour).toBe(75)
    expect(proposal?.requiresConfirmation).toBe(true)
    expect(proposal?.reason).toContain('confirmation')
    const exact = proposeGutTraining([snap({ stomach: 4, carbsGPerHourConsumed: 70 })], 75)
    expect(exact?.suggestedGPerHour).toBe(75)
    expect(exact?.requiresConfirmation).toBe(false)
  })

  it('ignore une tolérance invalide et s’appuie sur la dernière sortie assez longue', () => {
    const proposal = proposeGutTraining(
      [snap({ carbsGPerHourConsumed: 40, stomach: 5 }), snap({ durationMinutes: 10, carbsGPerHourConsumed: 90 })],
      Number.NaN,
    )
    expect(proposal?.baselineGPerHour).toBe(40)
    expect(proposal?.suggestedGPerHour).toBe(50)
    expect(proposal?.applicableGPerHour).toBe(0)
    expect(proposal?.requiresConfirmation).toBe(true)
  })
})
