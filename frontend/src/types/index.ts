/* ── SORA types ──────────────────────── */
export interface SoraRequest {
  mtom_grams: number
  max_speed_ms: number
  characteristic_dimension_m: number
  population_density_band: 'controlled_ground' | 'sparsely_populated' | 'populated' | 'gathering'
  arc: 'ARC-a' | 'ARC-b' | 'ARC-c' | 'ARC-d'
  altitude_m: number
  country_code?: string
  drone_type?: string
  propulsion_type?: 'electric' | 'combustion' | 'hybrid'
  endurance_min?: number
  flight_frequency?: 'rare' | 'occasional' | 'frequent'
  operational_scenario?: 'VLOS' | 'BVLOS' | 'extended_VLOS'
  mitigation_m1?: 'none' | 'low' | 'medium' | 'high'
  mitigation_m2?: 'none' | 'low' | 'medium' | 'high'
  mitigation_m3?: 'none' | 'low' | 'medium' | 'high'
}

export interface OsoRequirement {
  oso_number: number
  title: string
  category: string | null
  robustness: 'O' | 'L' | 'M' | 'H'
}

export interface CountryFlag {
  rule_key: string
  description: string
}

export interface TraceEntry {
  step: string
  description: string
  rule_source: string | null
  value: string
}

export interface SoraResponse {
  bypass_applied: boolean
  kinetic_energy_j: number | null
  igrc: number
  sail: number
  arc: string
  oso_requirements: OsoRequirement[]
  country_flags: CountryFlag[]
  input_parameters: Record<string, unknown>
  initial_grc: number
  final_grc: number
  m1_reduction: number
  m2_reduction: number
  m3_reduction: number
  traceability: TraceEntry[]
  assumptions: string[]
}

/* ── DMA types ───────────────────────── */

export interface DmaQuestionOut {
  id: string
  question_key: string
  question_text: string
  weight: number
}

export interface DmaDimensionQuestions {
  dimension_id: string
  dimension_name: string
  description: string
  questions: DmaQuestionOut[]
}

export interface DmaResponseIn {
  question_id: string
  score: number
}

export interface DmaAssessRequest {
  organization: string
  responses: DmaResponseIn[]
}

export interface DmaDimensionScoreOut {
  dimension: string
  score: number
  percentage: number
  maturity_level: string
}

export interface DmaAssessResult {
  assessment_id: string
  organization: string
  dimension_scores: Record<string, number>
  overall_score: number
  maturity_level: string
  breakdown: DmaDimensionScoreOut[]
}

/* legacy evaluate */
export interface DmaEvalRequest {
  dimension: string
  scores: Record<string, number>
}

export interface DmaEvalResponse {
  dimension: string
  raw_weighted_score: number
  max_weighted_score: number
  normalised_pct: number
  maturity_level: number
  maturity_label: string
}

/* ── Health ───────────────────────────── */
export interface HealthResponse {
  status: string
  version: string
}
