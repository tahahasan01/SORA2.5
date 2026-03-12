import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, AlertTriangle, ShieldCheck, ChevronDown, Weight, Gauge, Ruler,
  Mountain, Users, ArrowUpDown, Zap, Shield, Battery, Clock, Radio,
  Eye, FileText, Minus, Sparkles, TrendingDown, Activity, Target, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { api } from '../api/client'
import type { SoraRequest, SoraResponse } from '../types'

/* ── Presets — one-click real-world scenarios ── */

type Preset = { label: string; desc: string; values: SoraRequest }

const PRESETS: Preset[] = [
  {
    label: 'DJI Mini 3',
    desc: 'Lightweight camera drone — hobby use in a park',
    values: {
      mtom_grams: 249, max_speed_ms: 16, characteristic_dimension_m: 0.25,
      altitude_m: 30, population_density_band: 'sparsely_populated', arc: 'ARC-a',
      drone_type: 'DJI Mini 3', propulsion_type: 'electric', endurance_min: 38, flight_frequency: 'occasional',
      operational_scenario: 'VLOS', mitigation_m1: 'none', mitigation_m2: 'none', mitigation_m3: 'none',
    },
  },
  {
    label: 'DJI Mavic 3',
    desc: 'Professional photo/video over a city neighborhood',
    values: {
      mtom_grams: 958, max_speed_ms: 21, characteristic_dimension_m: 0.38,
      altitude_m: 50, population_density_band: 'populated', arc: 'ARC-b',
      drone_type: 'DJI Mavic 3 Pro', propulsion_type: 'electric', endurance_min: 43, flight_frequency: 'frequent',
      operational_scenario: 'VLOS', mitigation_m1: 'low', mitigation_m2: 'none', mitigation_m3: 'none',
    },
  },
  {
    label: 'Delivery Drone',
    desc: 'Package delivery in suburban area with parachute',
    values: {
      mtom_grams: 5900, max_speed_ms: 29, characteristic_dimension_m: 1.17,
      altitude_m: 80, population_density_band: 'populated', arc: 'ARC-c',
      drone_type: 'Wing W198', propulsion_type: 'electric', endurance_min: 20, flight_frequency: 'frequent',
      operational_scenario: 'BVLOS', mitigation_m1: 'medium', mitigation_m2: 'high', mitigation_m3: 'medium',
    },
  },
  {
    label: 'Inspection Drone',
    desc: 'Industrial inspection — power lines / bridges in rural area',
    values: {
      mtom_grams: 6470, max_speed_ms: 21, characteristic_dimension_m: 0.81,
      altitude_m: 100, population_density_band: 'controlled_ground', arc: 'ARC-a',
      drone_type: 'DJI Matrice 350 RTK', propulsion_type: 'electric', endurance_min: 55, flight_frequency: 'occasional',
      operational_scenario: 'extended_VLOS', mitigation_m1: 'high', mitigation_m2: 'low', mitigation_m3: 'low',
    },
  },
  {
    label: 'Event Coverage',
    desc: 'Filming over a concert / sports event crowd',
    values: {
      mtom_grams: 3995, max_speed_ms: 26, characteristic_dimension_m: 0.68,
      altitude_m: 60, population_density_band: 'gathering', arc: 'ARC-b',
      drone_type: 'DJI Inspire 3', propulsion_type: 'electric', endurance_min: 28, flight_frequency: 'rare',
      operational_scenario: 'VLOS', mitigation_m1: 'medium', mitigation_m2: 'medium', mitigation_m3: 'high',
    },
  },
]

/* ── Static data ── */

const POP_BANDS = [
  { value: 'controlled_ground' as const, label: 'Controlled Ground', desc: 'No uninvolved persons', icon: ShieldCheck },
  { value: 'sparsely_populated' as const, label: 'Sparsely Populated', desc: 'Few people expected', icon: Users },
  { value: 'populated' as const, label: 'Populated Area', desc: 'Urban / suburban', icon: Users },
  { value: 'gathering' as const, label: 'Gathering', desc: 'Crowds / events', icon: AlertTriangle },
]

const ARC_OPTIONS = ['ARC-a', 'ARC-b', 'ARC-c', 'ARC-d'] as const
const MIT_OPTIONS = ['none', 'low', 'medium', 'high'] as const
const PROP_OPTIONS = ['electric', 'combustion', 'hybrid'] as const
const FREQ_OPTIONS = ['rare', 'occasional', 'frequent'] as const
const OPS_OPTIONS = ['VLOS', 'BVLOS', 'extended_VLOS'] as const

function categoryStyle(cat: string | null) {
  const c = (cat ?? '').toLowerCase()
  if (c === 'technical') return { cls: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30', label: 'Technical' }
  if (c === 'human') return { cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30', label: 'Human Factors' }
  if (c === 'operational') return { cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30', label: 'Operator' }
  return { cls: 'bg-slate-500/15 text-slate-500 border border-slate-500/20', label: cat ?? '—' }
}

function robustnessColor(level: string) {
  const l = level.toLowerCase()
  if (l === 'optional' || l === 'o') return 'bg-slate-500/30 text-slate-300 border border-slate-500/20'
  if (l === 'low' || l === 'l') return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20'
  if (l === 'medium' || l === 'm') return 'bg-amber-500/20 text-amber-400 border border-amber-500/20'
  if (l === 'high' || l === 'h') return 'bg-red-500/20 text-red-400 border border-red-500/20'
  return 'bg-slate-500/30 text-slate-300 border border-slate-500/20'
}

function robustnessLabel(level: string) {
  const l = level.toLowerCase()
  if (l === 'o') return 'Optional'
  if (l === 'l') return 'Low'
  if (l === 'm') return 'Medium'
  if (l === 'h') return 'High'
  return level
}

function sailColor(sail: number) {
  if (sail <= 2) return { ring: 'emerald', bg: 'from-emerald-500 to-emerald-400', text: 'text-emerald-400', label: 'LOW RISK' }
  if (sail <= 4) return { ring: 'amber', bg: 'from-amber-500 to-amber-400', text: 'text-amber-400', label: 'MEDIUM RISK' }
  return { ring: 'red', bg: 'from-red-500 to-red-400', text: 'text-red-400', label: 'HIGH RISK' }
}

/* ── Component ── */

export default function SoraBuilder({ onToast }: { onToast: (msg: string, type: 'success' | 'error') => void }) {
  const [form, setForm] = useState<SoraRequest>({
    drone_type: undefined,
    mtom_grams: 900,
    max_speed_ms: 19,
    characteristic_dimension_m: 0.4,
    altitude_m: 50,
    population_density_band: 'populated',
    arc: 'ARC-b',
    mitigation_m1: 'none',
    mitigation_m2: 'none',
    mitigation_m3: 'none',
  })
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SoraResponse | null>(null)
  const [showTrace, setShowTrace] = useState(false)
  const [useFriendly, setUseFriendly] = useState(false) // false = g, m/s, m; true = kg, km/h, m
  const submitRef = useRef<HTMLButtonElement>(null)

  const set = <K extends keyof SoraRequest>(k: K, v: SoraRequest[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    setActivePreset(null)
  }

  const submit = useCallback(async (data?: SoraRequest) => {
    setLoading(true)
    try {
      const res = await api.soraCalculate(data ?? form)
      setResult(res)
      onToast('SORA assessment complete', 'success')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Assessment failed', 'error')
    } finally {
      setLoading(false)
    }
  }, [form, onToast])

  const pickPreset = (p: Preset) => {
    setForm(p.values)
    setActivePreset(p.label)
    setResult(null)
    submit(p.values)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* ── FORM PANEL (3 cols) ── */}
      <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
        className="xl:col-span-3 space-y-6">

        {/* Header */}
        <div className="glass rounded-xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Flight Risk Assessment
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Describe your drone and flight plan — we'll calculate the SORA 2.5 risk level.</p>
        </div>

        {/* ── Quick-Start Presets ── */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <SectionLabel icon={<Sparkles size={16} />} text="Quick start" />
          <p className="text-sm text-slate-400 dark:text-slate-500 -mt-1">
            Not sure what to fill in? Pick a scenario to auto-run the assessment.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {PRESETS.map(p => (
              <button key={p.label}
                onClick={() => pickPreset(p)}
                className={`group p-4 rounded-2xl border text-left transition-all duration-300
                  ${activePreset === p.label
                    ? 'border-indigo-500/60 bg-indigo-50 dark:bg-indigo-500/15 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                    : 'border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02] hover:border-indigo-400 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'}`}>
                <div className={`text-sm font-semibold transition-colors
                  ${activePreset === p.label ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300'}`}>{p.label}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-snug">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── UAS Specifications ── */}
        <div className="glass rounded-2xl p-6 space-y-5">
          <SectionLabel icon={<Zap size={16} />} text="About your drone" />
          <div className="flex items-center justify-between -mt-2">
            <p className="text-xs text-slate-500 dark:text-slate-500">Weight, speed, dimensions, and max altitude.</p>
            <button onClick={() => setUseFriendly(f => !f)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              {useFriendly ? <ToggleRight size={16} className="text-indigo-500" /> : <ToggleLeft size={16} />}
              {useFriendly ? 'kg / km/h' : 'g / m/s'}
            </button>
          </div>

          {/* Drone Type */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Drone model
            </label>
            <input type="text" value={form.drone_type ?? ''}
              onChange={e => set('drone_type', e.target.value || undefined)}
              placeholder="e.g. DJI Mini 3, Custom Build"
              className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition" />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <NumberField icon={<Weight size={18} />}
              label={useFriendly ? 'MTOM (kg)' : 'MTOM (grams)'}
              value={useFriendly ? +(form.mtom_grams / 1000).toFixed(3) : form.mtom_grams}
              onChange={v => set('mtom_grams', useFriendly ? Math.round(v * 1000) : v)}
              min={0} max={useFriendly ? 25 : 25000} step={useFriendly ? 0.01 : 1} />
            <NumberField icon={<Gauge size={18} />}
              label={useFriendly ? 'Max Speed (km/h)' : 'Max Speed (m/s)'}
              value={useFriendly ? +((form.max_speed_ms * 3.6).toFixed(1)) : form.max_speed_ms}
              onChange={v => set('max_speed_ms', useFriendly ? +(v / 3.6).toFixed(2) : v)}
              min={0} max={useFriendly ? 360 : 100} step={useFriendly ? 0.1 : 1} />
            <NumberField icon={<Ruler size={18} />} label="Dimension (m)" value={form.characteristic_dimension_m}
              onChange={v => set('characteristic_dimension_m', v)} min={0} max={10} step={0.01} />
            <NumberField icon={<Mountain size={18} />} label="Altitude (m)" value={form.altitude_m}
              onChange={v => set('altitude_m', v)} min={0} max={120} />
          </div>

          {/* Extended UAS fields */}
          <div className="grid grid-cols-3 gap-4">
            <SelectField icon={<Battery size={16} />} label="Propulsion" value={form.propulsion_type ?? ''}
              onChange={v => set('propulsion_type', (v || undefined) as SoraRequest['propulsion_type'])}
              options={[{ value: '', label: '—' }, ...PROP_OPTIONS.map(o => ({ value: o, label: capitalize(o) }))]} />
            <NumberField icon={<Clock size={16} />} label="Endurance (min)" value={form.endurance_min ?? 0}
              onChange={v => set('endurance_min', v || undefined)} min={0} max={600} />
            <SelectField icon={<Radio size={16} />} label="Frequency" value={form.flight_frequency ?? ''}
              onChange={v => set('flight_frequency', (v || undefined) as SoraRequest['flight_frequency'])}
              options={[{ value: '', label: '—' }, ...FREQ_OPTIONS.map(o => ({ value: o, label: capitalize(o) }))]} />
          </div>
        </div>

        {/* ── Population Density ── */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <SectionLabel icon={<Users size={16} />} text="Where are you flying?" />
          <p className="text-xs text-slate-400 dark:text-slate-500 -mt-1">Pick the option that best describes the area below the drone.</p>
          <div className="grid grid-cols-2 gap-4">
            {POP_BANDS.map(b => (
              <button key={b.value} onClick={() => set('population_density_band', b.value)}
                className={`relative p-4 rounded-2xl border text-left transition-all duration-300
                  ${form.population_density_band === b.value
                    ? 'border-indigo-500/50 bg-indigo-50 dark:bg-indigo-500/10 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/15 hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}>
                <b.icon size={20} className={form.population_density_band === b.value ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'} />
                <div className={`text-base font-medium mt-2 ${form.population_density_band === b.value ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                  {b.label}
                </div>
                <div className="text-xs text-slate-500 mt-1">{b.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Airspace & Scenario ── */}
        <div className="glass rounded-2xl p-6 space-y-5">
          <SectionLabel icon={<ArrowUpDown size={16} />} text="Airspace & operations" />
          <p className="text-xs text-slate-400 dark:text-slate-500 -mt-2">ARC-a is uncontrolled airspace (safest). VLOS means you can see the drone at all times.</p>
          <div className="grid grid-cols-3 gap-4">
            <SelectField icon={<ArrowUpDown size={16} />} label="Air Risk Class" value={form.arc}
              onChange={v => set('arc', v as SoraRequest['arc'])}
              options={ARC_OPTIONS.map(o => ({ value: o, label: o }))} />
            <SelectField icon={<Eye size={16} />} label="Op. Scenario" value={form.operational_scenario ?? ''}
              onChange={v => set('operational_scenario', (v || undefined) as SoraRequest['operational_scenario'])}
              options={[{ value: '', label: '—' }, ...OPS_OPTIONS.map(o => ({ value: o, label: o.replace('_', ' ') }))]} />
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Country code
              </label>
              <input type="text" maxLength={2} placeholder="US" value={form.country_code ?? ''}
                onChange={e => set('country_code', e.target.value.toUpperCase() || undefined)}
                className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition uppercase" />
            </div>
          </div>
        </div>

        {/* ── GRC Mitigations ── */}
        <div className="glass rounded-2xl p-6 space-y-5">
          <SectionLabel icon={<Minus size={16} />} text="Safety mitigations" />
          <p className="text-xs text-slate-400 dark:text-slate-500 -mt-2">Measures that reduce ground risk — flight path restrictions, parachutes, and emergency plans.</p>
          <div className="grid grid-cols-3 gap-4">
            <MitigationField label="M1 — Strategic" desc="Reduce population exposure"
              value={form.mitigation_m1 ?? 'none'} onChange={v => set('mitigation_m1', v as SoraRequest['mitigation_m1'])} />
            <MitigationField label="M2 — Effects" desc="Parachute / frangibility"
              value={form.mitigation_m2 ?? 'none'} onChange={v => set('mitigation_m2', v as SoraRequest['mitigation_m2'])} />
            <MitigationField label="M3 — ERP" desc="Emergency Response Plan"
              value={form.mitigation_m3 ?? 'none'} onChange={v => set('mitigation_m3', v as SoraRequest['mitigation_m3'])} />
          </div>
        </div>

        {/* Submit */}
        <motion.button ref={submitRef} whileTap={{ scale: 0.98 }} onClick={() => submit()} disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {loading ? <span className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Send size={20} /> Run Assessment</>}
        </motion.button>
      </motion.div>

      {/* ── RESULTS PANEL (2 cols) ── */}
      <div className="xl:col-span-2">
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div key="results" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }} className="space-y-5 sticky top-20">

              {/* ── Hero SAIL Score ── */}
              <div className="glass rounded-3xl p-8 text-center gradient-border relative overflow-hidden">
                <div className="absolute inset-0 opacity-10"
                  style={{ background: `radial-gradient(circle at 50% 30%, ${result.sail <= 2 ? '#10b981' : result.sail <= 4 ? '#f59e0b' : '#ef4444'}40, transparent 70%)` }} />
                <div className="relative">
                  {typeof (result.input_parameters as Record<string, unknown>)?.drone_type === 'string' && (
                    <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-full px-3 py-1 mb-4">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{String((result.input_parameters as Record<string, unknown>).drone_type)}</span>
                    </div>
                  )}
                  <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Assessment Result</div>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, delay: 0.2 }}
                    className={`inline-flex items-center justify-center w-28 h-28 rounded-full border-4 mb-4
                      ${result.sail <= 2 ? 'border-emerald-500/60 shadow-[0_0_40px_rgba(16,185,129,0.3)]'
                        : result.sail <= 4 ? 'border-amber-500/60 shadow-[0_0_40px_rgba(245,158,11,0.3)]'
                        : 'border-red-500/60 shadow-[0_0_40px_rgba(239,68,68,0.3)]'}`}>
                    <div>
                      <div className={`text-4xl font-black ${sailColor(result.sail).text}`}>{result.sail}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-400 font-semibold uppercase">SAIL</div>
                    </div>
                  </motion.div>
                  <div className={`text-sm font-bold uppercase tracking-widest ${sailColor(result.sail).text}`}>
                    {sailColor(result.sail).label}
                  </div>
                  {/* SAIL gauge bar */}
                  <div className="mt-5 relative h-2.5 rounded-full bg-slate-200 dark:bg-white/[0.06] overflow-hidden">
                    <motion.div initial={{ width: 0 }}
                      animate={{ width: `${(result.sail / 6) * 100}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                      className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${sailColor(result.sail).bg}`} />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-400 dark:text-slate-600 font-medium">
                    <span>SAIL I</span><span>III</span><span>SAIL VI</span>
                  </div>
                </div>
              </div>

              {/* ── Key Metrics ── */}
              <div className="grid grid-cols-2 gap-4">
                <MetricCard icon={<Target size={18} />} label="Initial GRC" value={result.initial_grc.toString()} color="blue" />
                <MetricCard icon={<TrendingDown size={18} />} label="Final GRC" value={result.final_grc.toString()}
                  color={result.final_grc < result.initial_grc ? 'emerald' : 'blue'}
                  badge={result.final_grc < result.initial_grc ? `−${result.initial_grc - result.final_grc}` : undefined} />
                <MetricCard icon={<Zap size={18} />} label="Kinetic Energy" value={result.kinetic_energy_j != null ? `${result.kinetic_energy_j.toFixed(0)} J` : '—'} color="cyan" />
                <MetricCard icon={<Activity size={18} />} label="Air Risk Class" value={result.arc}
                  color={result.arc === 'ARC-a' ? 'emerald' : result.arc === 'ARC-b' ? 'cyan' : result.arc === 'ARC-c' ? 'amber' : 'red'}
                  badge={result.arc === 'ARC-a' ? 'Low' : result.arc === 'ARC-b' ? 'Medium' : result.arc === 'ARC-c' ? 'High' : 'Very High'} />
              </div>

              {/* Bypass badge */}
              {result.bypass_applied && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-2xl p-4 flex items-center gap-3 border border-emerald-500/30 bg-emerald-500/5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <ShieldCheck size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-emerald-400">Sub-250g Bypass Active</div>
                    <div className="text-xs text-slate-500">Drone qualifies for simplified assessment</div>
                  </div>
                </motion.div>
              )}

              {/* ── GRC Mitigation Flow ── */}
              {(result.m1_reduction + result.m2_reduction + result.m3_reduction > 0) && (
                <div className="glass rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <TrendingDown size={16} className="text-emerald-400" /> GRC Reduction Breakdown
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <div className="text-center px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <div className="text-xl font-bold text-blue-400">{result.initial_grc}</div>
                        <div className="text-[10px] text-slate-500 font-medium">iGRC</div>
                      </div>
                      {result.m1_reduction > 0 && <>
                        <div className="text-slate-600">→</div>
                        <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
                          <div className="text-base font-bold text-cyan-400">−{result.m1_reduction}</div>
                          <div className="text-[9px] text-slate-500 font-semibold">M1</div>
                        </div>
                      </>}
                      {result.m2_reduction > 0 && <>
                        <div className="text-slate-600">→</div>
                        <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                          <div className="text-base font-bold text-amber-400">−{result.m2_reduction}</div>
                          <div className="text-[9px] text-slate-500 font-semibold">M2</div>
                        </div>
                      </>}
                      {result.m3_reduction > 0 && <>
                        <div className="text-slate-600">→</div>
                        <div className="px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-center">
                          <div className="text-base font-bold text-violet-400">−{result.m3_reduction}</div>
                          <div className="text-[9px] text-slate-500 font-semibold">M3</div>
                        </div>
                      </>}
                      <div className="text-slate-600">→</div>
                      <div className="text-center px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="text-xl font-bold text-emerald-400">{result.final_grc}</div>
                        <div className="text-[10px] text-slate-500 font-medium">Final</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* OSO Table */}
              {result.oso_requirements.length > 0 && (
                <div className="glass rounded-2xl overflow-hidden">
                  <div className="p-5 pb-3">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      Operational Safety Objectives
                      <span className="ml-2 text-xs font-normal text-slate-500">({result.oso_requirements.length})</span>
                    </h3>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-slate-500 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
                          <th className="text-left py-3 px-5 font-semibold">#</th>
                          <th className="text-left py-3 pr-3 font-semibold">Objective</th>
                          <th className="text-left py-3 px-3 font-semibold">Category</th>
                          <th className="text-center py-3 px-5 font-semibold">Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.oso_requirements.map((oso, i) => (
                          <motion.tr key={i} initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                            className="border-b border-slate-100 dark:border-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                            <td className="py-3 px-5 text-sm text-slate-500 font-mono">OSO #{oso.oso_number}</td>
                            <td className="py-3 pr-3 text-sm text-slate-600 dark:text-slate-300">{oso.title}</td>
                            <td className="py-3 px-3">
                              <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide ${categoryStyle(oso.category).cls}`}>
                                {categoryStyle(oso.category).label}
                              </span>
                            </td>
                            <td className="py-3 px-5 text-center">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${robustnessColor(oso.robustness)}`}>
                                {robustnessLabel(oso.robustness)}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Assumptions */}
              {result.assumptions.length > 0 && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Assumptions & Flags</h3>
                  <ul className="space-y-2">
                    {result.assumptions.map((a, i) => (
                      <li key={i} className="text-sm text-slate-500 dark:text-slate-400 flex items-start gap-2.5">
                        <span className="text-indigo-500 dark:text-cyan-500 mt-1">●</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Country flags */}
              {result.country_flags.length > 0 && (
                <div className="glass rounded-2xl p-5 border border-amber-500/10">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-400" /> Country-Specific Flags
                  </h3>
                  <ul className="space-y-2.5">
                    {result.country_flags.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-amber-300">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <span>{f.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Traceability (collapsible) */}
              <div className="glass rounded-2xl overflow-hidden">
                <button onClick={() => setShowTrace(t => !t)}
                  className="w-full flex items-center justify-between p-5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
                  <span className="flex items-center gap-2">
                    <FileText size={16} className="text-indigo-500 dark:text-cyan-500" />
                    Audit Trail
                    <span className="text-xs font-normal text-slate-500">({result.traceability.length} steps)</span>
                  </span>
                  <ChevronDown size={16} className={`transition-transform duration-300 ${showTrace ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showTrace && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      className="overflow-hidden">
                      <div className="px-5 pb-5 space-y-3 max-h-[400px] overflow-y-auto">
                        {result.traceability.map((t, i) => (
                          <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            className="flex gap-3 items-start">
                            <span className="shrink-0 w-7 h-7 rounded-lg bg-indigo-50 dark:bg-cyan-500/10 text-indigo-500 dark:text-cyan-400 flex items-center justify-center font-mono text-xs font-bold">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-slate-600 dark:text-slate-300">{t.description}</span>
                              {t.rule_source && <span className="text-xs text-slate-400 dark:text-slate-600 block mt-0.5">↳ {t.rule_source}</span>}
                            </div>
                            {t.value && <span className="shrink-0 text-sm text-indigo-500 dark:text-cyan-400 font-mono font-bold">{t.value}</span>}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass rounded-xl p-14 flex flex-col items-center justify-center text-center h-full min-h-[500px] sticky top-20">
              <div
                className="h-20 w-20 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] flex items-center justify-center mb-6">
                <Shield size={36} className="text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">No results yet</h3>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-3 max-w-sm leading-relaxed">
                Pick a preset above, or fill in the form and click <strong className="text-slate-600 dark:text-slate-300">Run Assessment</strong>.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
      <span className="text-slate-400 dark:text-slate-400">{icon}</span>{text}
    </label>
  )
}

function NumberField({ icon, label, value, onChange, min, max, step = 1 }: {
  icon: React.ReactNode; label: string; value: number
  onChange: (v: number) => void; min: number; max: number; step?: number
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        {icon}{label}
      </label>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
    </div>
  )
}

function SelectField({ icon, label, value, onChange, options }: {
  icon: React.ReactNode; label: string; value: string
  onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        {icon}{label}
      </label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      </div>
    </div>
  )
}

function MitigationField({ label, desc, value, onChange }: {
  label: string; desc: string; value: string; onChange: (v: string) => void
}) {
  const colorMap: Record<string, string> = {
    none: 'border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-white/[0.02]',
    low: 'border-cyan-500/40 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10',
    medium: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
    high: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
  }
  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{desc}</div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {MIT_OPTIONS.map(opt => (
          <button key={opt} onClick={() => onChange(opt)}
            className={`px-1.5 py-2 rounded-lg text-xs font-semibold capitalize border transition-all
              ${value === opt
                ? colorMap[opt]
                : 'border-transparent text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}>
            {opt === 'none' ? '—' : opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, color, badge }: { icon: React.ReactNode; label: string; value: string; color: string; badge?: string }) {
  const gradients: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20',
    slate: 'from-slate-500/20 to-slate-500/5 border-slate-500/20',
  }
  const textColors: Record<string, string> = {
    emerald: 'text-emerald-400', cyan: 'text-cyan-400', blue: 'text-blue-400',
    violet: 'text-violet-400', amber: 'text-amber-400', red: 'text-red-400', slate: 'text-slate-400',
  }
  const glowColors: Record<string, string> = {
    emerald: 'shadow-emerald-500/10', cyan: 'shadow-cyan-500/10', blue: 'shadow-blue-500/10',
    violet: 'shadow-violet-500/10', amber: 'shadow-amber-500/10', red: 'shadow-red-500/10', slate: '',
  }
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl border bg-gradient-to-br p-4 ${gradients[color] ?? gradients.slate} ${glowColors[color] ?? ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={textColors[color] ?? 'text-white'}>{icon}</span>
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${textColors[color] ?? 'text-white'}`}>{value}</div>
      {badge && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
          {badge}
        </span>
      )}
    </motion.div>
  )
}
