/**
 * Seules valeurs numériques du moteur de ravitaillement.
 * targets.ts, gut.ts, adjustments.ts et planner.ts lisent ce fichier :
 * aucun seuil n'y est recopié en dur.
 *
 * Repères (ordres de grandeur à individualiser, pas une prescription) :
 * - Glucides : Jeukendrup, Sports Medicine 2014 ; position de l'ISSN
 *   (Kerksick et al.). Environ 30 à 60 g/h entre 1 et 2 h, jusqu'à environ
 *   90 g/h au-delà lorsque plusieurs transporteurs sont utilisés
 *   (glucose + fructose). Sous 1 h, l'apport reste optionnel : 0 à 30 g/h.
 * - Eau : la position de l'ACSM individualise l'hydratation (pesée, soif, conditions).
 *   La fourchette 0,4 à 0,8 L/h est un ordre de grandeur courant, à valider
 *   pour chaque personne, pas une recommandation personnelle de l'ACSM.
 *   Elle est modulée ici selon la chaleur et la sudation.
 * - Sodium : même famille de repères, souvent 300 à 600 mg/h, élargi ici
 *   jusqu'à 800 mg/h quand chaleur et sudation élevée se cumulent.
 * - Le cyclisme secoue moins le tube digestif que la course à pied : facteur > 1.
 * - Le trail ajoute des à-coups et un dénivelé : facteur < 1, plus une
 *   heuristique de +2 % par tranche de 500 m, plafonnée.
 * - Entraînement : haut de fourchette, pour tester l'estomac.
 *   Course intermédiaire : milieu. Objectif principal : bas de fourchette,
 *   on ne découvre rien le jour J.
 * - Gut training : +5 g/h si l'estomac a bien réagi, +10 g/h s'il a très bien
 *   réagi, −10 g/h s'il a souffert. Jamais au-delà de la tolérance déclarée
 *   sans confirmation explicite.
 */
export const nutritionConfig = {
  duration: {
    shortBandHours: 1,
    mediumBandHours: 2,
    extremeMinutes: 24 * 60,
    minFuelWindowMinutes: 15,
  },
  carbs: {
    bands: {
      under1h: { min: 0, max: 30, train: 25, intermediate: 15, race: 10 },
      oneToTwo: { min: 30, max: 60, train: 55, intermediate: 45, race: 35 },
      over2: { min: 60, max: 90, train: 80, intermediate: 75, race: 65 },
    },
    sportFactor: {
      course: 1,
      trail: 0.92,
      cyclisme: 1.12,
      triathlon: 1,
    },
    intensityFactor: {
      facile: 0.88,
      moderee: 1,
      soutenue: 1.06,
      course: 1.1,
    },
    elevation: {
      stepMeters: 500,
      bonusPerStep: 0.02,
      maxBonus: 0.16,
    },
    toleranceMax: 200,
    roundDigits: 1,
  },
  fluid: {
    baseMlPerHour: 550,
    min: 400,
    max: 800,
    temperature: { fraiche: 0.8, temperee: 1, chaude: 1.25 },
    sweat: { faible: 0.8, moyenne: 1, elevee: 1.25 },
  },
  sodium: {
    baseMgPerHour: 500,
    min: 300,
    max: 800,
    temperature: { fraiche: 0.8, temperee: 1, chaude: 1.25 },
    sweat: { faible: 0.75, moyenne: 1, elevee: 1.35 },
  },
  gut: {
    minDurationMinutes: 45,
    stomachExcellent: 5,
    stomachGood: 4,
    stomachBad: 2,
    stepExcellent: 10,
    stepGood: 5,
    stepDown: 10,
    energyOk: 3,
  },
  adjustments: {
    stomachBad: 2,
    stomachGood: 4,
    energyLow: 2,
    energyOk: 3,
    thirstHigh: 4,
    thirstLow: 2,
    carbStepDown: 10,
    carbStepUp: 5,
    fluidStepUp: 100,
    fluidStepDown: 50,
    sodiumStepUp: 80,
    sodiumStepDown: 40,
  },
  planner: {
    minSpacingMinutes: 15,
    typicalPortionCarbsG: 25,
    maxSpacingMinutes: 30,
    leadInMinutes: 10,
    endBufferMinutes: 5,
    coverageThreshold: 0.85,
    carbGapG: 8,
    fluidGapMl: 150,
    sodiumGapMg: 200,
    caffeineCautionMg: 200,
    saltEvery: 4,
    triathlon: {
      runCarbFactor: 0.75,
      maxInstantCarbRate: 110,
    },
    fallbackFactor: 1,
  },
  triathlonPresets: {
    sprint: { swimMin: 15, t1Min: 2, bikeMin: 35, t2Min: 2, runMin: 22 },
    olympique: { swimMin: 30, t1Min: 3, bikeMin: 75, t2Min: 2, runMin: 48 },
    triathlon_70_3: { swimMin: 40, t1Min: 6, bikeMin: 180, t2Min: 5, runMin: 115 },
    ironman: { swimMin: 75, t1Min: 10, bikeMin: 330, t2Min: 8, runMin: 250 },
    personnalise: { swimMin: 20, t1Min: 3, bikeMin: 60, t2Min: 2, runMin: 30 },
  },
} as const

export type NutritionConfig = typeof nutritionConfig
