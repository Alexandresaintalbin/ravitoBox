export const SPORTS = ['course', 'trail', 'cyclisme', 'triathlon'] as const
export type Sport = (typeof SPORTS)[number]

export const SESSION_TYPES = [
  'entrainement',
  'course_intermediaire',
  'objectif_principal',
] as const
export type SessionType = (typeof SESSION_TYPES)[number]

export const INTENSITIES = ['facile', 'moderee', 'soutenue', 'course'] as const
export type Intensity = (typeof INTENSITIES)[number]

export const TEMPERATURES = ['fraiche', 'temperee', 'chaude'] as const
export type Temperature = (typeof TEMPERATURES)[number]

export const SWEAT_LEVELS = ['faible', 'moyenne', 'elevee'] as const
export type Sweat = (typeof SWEAT_LEVELS)[number]

export const PRODUCT_TYPES = [
  'gel',
  'boisson',
  'barre',
  'compote',
  'pate_de_fruit',
  'capsule_sel',
  'eau',
  'autre',
] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

export const TRI_FORMATS = [
  'sprint',
  'olympique',
  'triathlon_70_3',
  'ironman',
  'personnalise',
] as const
export type TriFormat = (typeof TRI_FORMATS)[number]

export const SEGMENTS = ['effort', 'natation', 't1', 'velo', 't2', 'course_a_pied'] as const
export type SegmentId = (typeof SEGMENTS)[number]

export interface TriathlonInput {
  format: TriFormat
  swimMin: number
  t1Min: number
  bikeMin: number
  t2Min: number
  runMin: number
}

export interface OutingInput {
  sport: Sport
  sessionType: SessionType
  durationMinutes: number
  intensity: Intensity
  temperature: Temperature
  sweat: Sweat
  toleranceGPerHour: number
  elevationM?: number | null
  triathlon?: TriathlonInput | null
  carbOverrideGPerHour?: number | null
  allowExceedTolerance?: boolean
}

export interface Warning {
  code: string
  message: string
}

export interface HourlyTargets {
  carbsGPerHour: number
  fluidMlPerHour: number
  sodiumMgPerHour: number
  uncappedCarbsGPerHour: number
  eventMinutes: number
  fuelingMinutes: number
  warnings: Warning[]
}

export interface DebriefSnapshot {
  carbsGPerHourConsumed: number
  stomach: number
  energy: number
  thirst: number
  durationMinutes: number
}

export interface GutProposal {
  baselineGPerHour: number
  suggestedGPerHour: number
  applicableGPerHour: number
  deltaGPerHour: number
  requiresConfirmation: boolean
  reason: string
}

export interface PlannerProduct {
  id: string
  name: string
  type: ProductType
  flavor: string | null
  carbsG: number
  sodiumMg: number
  caffeineMg: number
  volumeMl: number
  stock: number | null
  inBox: boolean
  excluded?: boolean
  favorite?: boolean
  preferredFlavor?: boolean
}

export interface PlanIntake {
  minute: number
  segment: SegmentId
  productId: string
  productName: string
  productType: ProductType
  quantity: number
  carbsG: number
  fluidMl: number
  sodiumMg: number
  caffeineMg: number
  cumulativeCarbsG: number
  cumulativeFluidMl: number
  cumulativeSodiumMg: number
}

export interface ShoppingLine {
  productId: string
  name: string
  toBring: number
  missing: number
  inBox: boolean
}

export interface SegmentSummary {
  segment: SegmentId
  startMinute: number
  endMinute: number
  carbRateGPerHour: number
  fluidRateMlPerHour: number
  sodiumRateMgPerHour: number
  fuel: boolean
}

export interface PlanTotals {
  carbsG: number
  fluidMl: number
  sodiumMg: number
  caffeineMg: number
}

export interface GeneratedPlan {
  intakes: PlanIntake[]
  totals: PlanTotals
  targetsTotal: { carbsG: number; fluidMl: number; sodiumMg: number }
  coverage: { carbs: number; fluid: number; sodium: number }
  shoppingList: ShoppingLine[]
  segments: SegmentSummary[]
  warnings: Warning[]
}

export interface Adjustment {
  id: string
  field: 'carbs' | 'fluid' | 'sodium' | 'note'
  label: string
  detail: string
  current: number | null
  proposed: number | null
  requiresConfirmation: boolean
}

export interface AdjustmentInput {
  stomach: number
  energy: number
  thirst: number
  carbsGPerHour: number
  fluidMlPerHour: number
  sodiumMgPerHour: number
  toleranceGPerHour: number
}
