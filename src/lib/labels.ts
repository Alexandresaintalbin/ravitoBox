import type { ProductType, SegmentId, SessionType, Sport } from '@/engine/types'

export const sportLabels: Record<Sport, string> = {
  course: 'Course à pied',
  trail: 'Trail',
  cyclisme: 'Cyclisme',
  triathlon: 'Triathlon',
}

export const sessionLabels: Record<SessionType, string> = {
  entrainement: 'Entraînement / sortie longue',
  course_intermediaire: 'Course intermédiaire',
  objectif_principal: 'Objectif principal',
}

export const productTypeLabels: Record<ProductType, string> = {
  gel: 'Gel',
  boisson: 'Boisson',
  barre: 'Barre',
  compote: 'Compote',
  pate_de_fruit: 'Pâte de fruits',
  capsule_sel: 'Capsule de sel',
  eau: 'Eau',
  autre: 'Autre',
}

export const segmentLabels: Record<SegmentId, string> = {
  effort: 'Effort',
  natation: 'Natation',
  t1: 'T1',
  velo: 'Vélo',
  t2: 'T2',
  course_a_pied: 'Course à pied',
}

export const intensityLabels = {
  facile: 'Facile',
  moderee: 'Modérée',
  soutenue: 'Soutenue',
  course: 'Allure course',
} as const

export const temperatureLabels = {
  fraiche: 'Fraîche',
  temperee: 'Tempérée',
  chaude: 'Chaude',
} as const

export const sweatLabels = {
  faible: 'Faible',
  moyenne: 'Moyenne',
  elevee: 'Élevée',
} as const

export const triFormatLabels = {
  sprint: 'Sprint',
  olympique: 'Olympique',
  triathlon_70_3: '70.3',
  ironman: 'Ironman',
  personnalise: 'Personnalisé',
} as const
