import { describe, expect, it } from 'vitest'
import { proposeAdjustments } from '@/engine/adjustments'
import type { AdjustmentInput } from '@/engine/types'

function input(overrides: Partial<AdjustmentInput> = {}): AdjustmentInput {
  return {
    stomach: 3,
    energy: 3,
    thirst: 3,
    carbsGPerHour: 60,
    fluidMlPerHour: 550,
    sodiumMgPerHour: 500,
    toleranceGPerHour: 90,
    ...overrides,
  }
}

describe('proposeAdjustments', () => {
  it('refuse un débrief incomplet', () => {
    const notes = proposeAdjustments(input({ stomach: Number.NaN }))
    expect(notes).toHaveLength(1)
    expect(notes[0]?.id).toBe('invalid')
    expect(proposeAdjustments(input({ fluidMlPerHour: Number.POSITIVE_INFINITY }))[0]?.id).toBe('invalid')
  })

  it('propose de garder la stratégie quand les sensations sont neutres', () => {
    const notes = proposeAdjustments(input())
    expect(notes.map((note) => note.id)).toEqual(['keep'])
  })

  it('descend les glucides si l’estomac a été pénible, sans passer sous zéro', () => {
    const down = proposeAdjustments(input({ stomach: 1, carbsGPerHour: 60 }))
    expect(down.find((note) => note.id === 'carbs-down')?.proposed).toBe(50)
    const floor = proposeAdjustments(input({ stomach: 2, carbsGPerHour: 6 }))
    expect(floor.find((note) => note.id === 'carbs-down')?.proposed).toBe(0)
  })

  it('monte les glucides si l’énergie a manqué, avec confirmation au-delà de la tolérance', () => {
    const up = proposeAdjustments(input({ stomach: 4, energy: 2, carbsGPerHour: 60, toleranceGPerHour: 90 }))
    const note = up.find((item) => item.id === 'carbs-up')
    expect(note?.proposed).toBe(65)
    expect(note?.requiresConfirmation).toBe(false)
    const blocked = proposeAdjustments(input({ stomach: 5, energy: 1, carbsGPerHour: 88, toleranceGPerHour: 90 }))
    expect(blocked.find((item) => item.id === 'carbs-up')?.requiresConfirmation).toBe(true)
  })

  it('augmente boisson et sodium quand la soif est haute, ou signale le plafond', () => {
    const up = proposeAdjustments(input({ thirst: 5, fluidMlPerHour: 550, sodiumMgPerHour: 500 }))
    expect(up.find((note) => note.id === 'fluid-up')?.proposed).toBe(650)
    expect(up.find((note) => note.id === 'sodium-up')?.proposed).toBe(580)
    const ceiling = proposeAdjustments(input({ thirst: 4, fluidMlPerHour: 800, sodiumMgPerHour: 800 }))
    expect(ceiling.map((note) => note.id)).toEqual(expect.arrayContaining(['fluid-ceiling', 'sodium-ceiling']))
  })

  it('réduit boisson et sodium quand la soif est basse, ou signale le plancher', () => {
    const down = proposeAdjustments(input({ thirst: 1, fluidMlPerHour: 600, sodiumMgPerHour: 500 }))
    expect(down.find((note) => note.id === 'fluid-down')?.proposed).toBe(550)
    expect(down.find((note) => note.id === 'sodium-down')?.proposed).toBe(460)
    const floor = proposeAdjustments(input({ thirst: 2, fluidMlPerHour: 400, sodiumMgPerHour: 300 }))
    expect(floor.map((note) => note.id)).toEqual(expect.arrayContaining(['fluid-floor', 'sodium-floor']))
  })

  it('peut combiner un ajustement digestif et un ajustement de soif', () => {
    const notes = proposeAdjustments(input({ stomach: 1, thirst: 5 }))
    expect(notes.map((note) => note.id)).toEqual(expect.arrayContaining(['carbs-down', 'fluid-up', 'sodium-up']))
  })
})
