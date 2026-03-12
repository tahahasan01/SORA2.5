import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, BarChart3, Layers, Building2, Loader2, CheckCircle2, Info, Award, Hash, ClipboardList, Shield } from 'lucide-react'
import { api } from '../api/client'
import type { DmaDimensionQuestions, DmaAssessResult } from '../types'

const SCORE_LABELS = ['', 'Not Implemented', 'Initial', 'Developing', 'Established', 'Optimized']
const SCORE_COLORS = ['', 'bg-red-500/30 border-red-500/40 text-red-300',
  'bg-amber-500/20 border-amber-500/30 text-amber-300',
  'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
  'bg-cyan-500/20 border-cyan-500/30 text-cyan-300',
  'bg-emerald-500/20 border-emerald-500/30 text-emerald-300']

const ORG_SUGGESTIONS = [
  'Acme Drone Services', 'City of Oslo', 'Deutsche Post DHL', 'Amazon Prime Air',
  'Zipline International', 'Wing Aviation', 'Matternet', 'Flytrex',
]

export default function DmaEvaluator({ onToast }: { onToast: (msg: string, type: 'success' | 'error') => void }) {
  const [dimensions, setDimensions] = useState<DmaDimensionQuestions[]>([])
  const [orgName, setOrgName] = useState('')
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [loadingQs, setLoadingQs] = useState(true)
  const [result, setResult] = useState<DmaAssessResult | null>(null)
  const [expandedDim, setExpandedDim] = useState<number>(0)

  useEffect(() => {
    api.dmaGetQuestions()
      .then(d => { setDimensions(d); setLoadingQs(false) })
      .catch(() => { onToast('Failed to load questionnaire', 'error'); setLoadingQs(false) })
  }, [])

  const setScore = (qId: string, score: number) =>
    setAnswers(prev => ({ ...prev, [qId]: score }))

  const totalQuestions = dimensions.reduce((n, d) => n + d.questions.length, 0)
  const answeredCount = Object.keys(answers).length
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0

  // Per-dimension progress
  const dimProgress = (dim: DmaDimensionQuestions) => {
    const answered = dim.questions.filter(q => answers[q.id] !== undefined).length
    return dim.questions.length > 0 ? (answered / dim.questions.length) * 100 : 0
  }

  const submit = async () => {
    if (answeredCount === 0) { onToast('Answer at least one question', 'error'); return }
    if (!orgName.trim()) { onToast('Enter an organization name', 'error'); return }
    setLoading(true)
    try {
      const responses = Object.entries(answers).map(([question_id, score]) => ({ question_id, score }))
      const res = await api.dmaAssess({ organization: orgName.trim(), responses })
      setResult(res)
      onToast(`Assessment complete — ${res.maturity_level}`, 'success')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Assessment failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loadingQs) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-violet-400" size={40} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* ── QUESTIONNAIRE (3 cols) ── */}
      <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
        className="xl:col-span-3 space-y-6">

        {/* Header */}
        <div className="glass rounded-xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Maturity Assessment
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Rate your organization across {dimensions.length} dimensions ({totalQuestions} questions). Scale: 1 (Not Implemented) → 5 (Optimized).
          </p>

          {/* Org name input */}
          <div className="mt-5">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Organization name
            </label>
            <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
              placeholder="Enter your company or organization name…"
              className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition" />
            <div className="flex flex-wrap gap-2 mt-2">
              {ORG_SUGGESTIONS.slice(0, 4).map(name => (
                <button key={name} onClick={() => setOrgName(name)}
                  className={`text-xs px-3 py-1 rounded-lg border transition-all ${orgName === name
                    ? 'border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300'
                    : 'border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-white/15 hover:text-slate-600 dark:hover:text-slate-400'}`}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-violet-400" />
                {answeredCount} / {totalQuestions} answered
              </span>
              <span className="font-semibold text-violet-400">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-white/[0.06] overflow-hidden">
              <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }}
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400" />
            </div>
          </div>
        </div>

        {/* Dimension navigation chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {dimensions.map((dim, di) => {
            const dp = dimProgress(dim)
            return (
              <button key={dim.dimension_id} onClick={() => setExpandedDim(di)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all
                  ${expandedDim === di
                    ? 'border-violet-500/50 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300 shadow-lg shadow-violet-500/10'
                    : 'border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02] text-slate-400 hover:border-slate-300 dark:hover:border-white/15 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <span className={`h-5 w-5 rounded-md text-[10px] font-bold flex items-center justify-center
                  ${dp === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/20 text-violet-300'}`}>
                  {dp === 100 ? '✓' : di + 1}
                </span>
                {dim.dimension_name}
              </button>
            )
          })}
        </div>

        {/* Dimensions — show expanded one prominently, rest collapsed */}
        {dimensions.map((dim, di) => {
          const isOpen = expandedDim === di
          const dp = dimProgress(dim)
          return (
            <motion.div key={dim.dimension_id} layout
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: di * 0.05 }}
              className={`glass rounded-2xl overflow-hidden transition-all ${isOpen ? 'ring-1 ring-violet-500/20' : ''}`}>
              {/* Dimension header — always visible, clickable */}
              <button onClick={() => setExpandedDim(di)}
                className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-sm font-bold
                    ${dp === 100
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                      : 'bg-gradient-to-br from-purple-500/30 to-violet-500/30 text-purple-300 border border-purple-500/20'}`}>
                    {dp === 100 ? '✓' : di + 1}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{dim.dimension_name}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{dim.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {dim.questions.filter(q => answers[q.id] !== undefined).length}/{dim.questions.length}
                    </div>
                  </div>
                  <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-white/[0.06] overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${dp === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
                      style={{ width: `${dp}%` }} />
                  </div>
                </div>
              </button>

              {/* Questions — collapsible */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                    <div className="px-6 pb-6 space-y-5 border-t border-slate-100 dark:border-white/5 pt-4">
                      {dim.questions.map((q, qi) => {
                        const selected = answers[q.id]
                        return (
                          <div key={q.id} className="space-y-3">
                            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed flex items-start gap-2">
                              <span className="text-xs text-slate-400 dark:text-slate-600 font-mono mt-0.5 shrink-0">{qi + 1}.</span>
                              {q.question_text}
                            </p>
                            <div className="flex gap-2 ml-5">
                              {[1, 2, 3, 4, 5].map(s => (
                                <button key={s} onClick={() => setScore(q.id, s)}
                                  title={SCORE_LABELS[s]}
                                  className={`group relative px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200
                                    ${selected === s
                                      ? SCORE_COLORS[s]
                                      : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-white/15 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}>
                                  {s}
                                  {/* Tooltip on hover */}
                                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-white/10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    {SCORE_LABELS[s]}
                                  </span>
                                </button>
                              ))}
                              {selected && (
                                <span className="ml-2 text-xs text-slate-500 self-center font-medium">{SCORE_LABELS[selected]}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {/* Next dimension button */}
                      {di < dimensions.length - 1 && (
                        <button onClick={() => setExpandedDim(di + 1)}
                          className="text-sm text-violet-400 hover:text-violet-300 font-medium transition-colors flex items-center gap-1.5 ml-5 mt-2">
                          Next: {dimensions[di + 1].dimension_name} →
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}

        {/* Submit */}
        <motion.button whileTap={{ scale: 0.98 }} onClick={submit} disabled={loading || answeredCount === 0}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {loading ? <span className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Send size={20} /> Submit Assessment</>}
        </motion.button>
      </motion.div>

      {/* ── RESULTS PANEL (2 cols) ── */}
      <div className="xl:col-span-2">
        <div className="sticky top-20">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div key="results" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }} className="space-y-5">

                {/* Hero maturity card */}
                <div className="glass rounded-3xl p-8 text-center gradient-border relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10"
                    style={{ background: `radial-gradient(circle at 50% 30%, ${maturityGlow(result.maturity_level)}40, transparent 70%)` }} />
                  <div className="relative">
                    <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Organizational Maturity</div>
                    <MaturityRing pct={result.overall_score} label={result.maturity_level} />
                    <div className="mt-4">
                      <div className="text-2xl font-black text-slate-900 dark:text-white">{result.maturity_level}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{result.organization}</div>
                    </div>
                  </div>
                </div>

                {/* Dimension breakdown */}
                <div className="glass rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <BarChart3 size={16} className="text-violet-400" /> Dimension Breakdown
                  </h3>
                  {result.breakdown.map((d, i) => (
                    <motion.div key={d.dimension} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{d.dimension}</span>
                        <span className="text-slate-400 text-xs font-semibold">{d.percentage.toFixed(0)}% · {d.maturity_level}</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 dark:bg-white/[0.06] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${d.percentage}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.1 }}
                          className={`h-full rounded-full ${barColor(d.percentage)}`} />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Score grid */}
                <div className="grid grid-cols-2 gap-4">
                  <ScoreCard icon={<Award size={18} />} label="Overall %" value={`${result.overall_score.toFixed(0)}%`} />
                  <ScoreCard icon={<Shield size={18} />} label="Maturity" value={result.maturity_level} />
                  <ScoreCard icon={<Hash size={18} />} label="Dimensions" value={result.breakdown.length.toString()} />
                  <ScoreCard icon={<ClipboardList size={18} />} label="Responses" value={answeredCount.toString()} />
                </div>

                {/* Assessment ID */}
                <div className="glass rounded-2xl p-4 text-center">
                  <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Assessment ID</span>
                  <div className="text-sm font-mono text-slate-500 dark:text-slate-400 mt-1 break-all">{result.assessment_id}</div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass rounded-xl p-14 flex flex-col items-center justify-center text-center min-h-[500px]">
                <div
                  className="h-20 w-20 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] flex items-center justify-center mb-6">
                  <BarChart3 size={36} className="text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">Maturity Report</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-3 max-w-sm leading-relaxed">
                  Complete the questionnaire and click <strong className="text-slate-600 dark:text-slate-300">Submit Assessment</strong> to generate a report.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function maturityGlow(level: string): string {
  const colors: Record<string, string> = {
    'Initial': '#ef4444', 'Developing': '#f59e0b', 'Defined': '#06b6d4',
    'Managed': '#8b5cf6', 'Optimized': '#10b981',
  }
  return colors[level] ?? '#64748b'
}

function barColor(pct: number): string {
  if (pct >= 80) return 'bg-gradient-to-r from-emerald-500 to-emerald-400'
  if (pct >= 60) return 'bg-gradient-to-r from-cyan-500 to-cyan-400'
  if (pct >= 40) return 'bg-gradient-to-r from-amber-500 to-amber-400'
  return 'bg-gradient-to-r from-red-500 to-red-400'
}

function MaturityRing({ pct, label }: { pct: number; label: string }) {
  const radius = 70
  const stroke = 10
  const circ = 2 * Math.PI * radius
  const frac = Math.min(Math.max(pct / 100, 0), 1)
  const offset = circ - frac * circ

  const color = maturityGlow(label)

  return (
    <svg width="180" height="180" viewBox="0 0 180 180" className="mx-auto">
      <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      <motion.circle cx="90" cy="90" r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        transform="rotate(-90 90 90)"
        filter={`drop-shadow(0 0 8px ${color}40)`} />
      <text x="90" y="85" textAnchor="middle" fill="white" fontSize="32" fontWeight="800">
        {pct.toFixed(0)}%
      </text>
      <text x="90" y="110" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="500">{label}</text>
    </svg>
  )
}

function ScoreCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-purple-500/15 bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-purple-400">{icon}</span>
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-purple-400">{value}</div>
    </motion.div>
  )
}
