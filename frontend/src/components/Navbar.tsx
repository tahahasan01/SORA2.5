import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { api } from '../api/client'

interface NavbarProps {
  activeTab: 'sora' | 'dma'
  onTabChange: (tab: 'sora' | 'dma') => void
  dark: boolean
  onToggleTheme: () => void
}

export default function Navbar({ activeTab, onTabChange, dark, onToggleTheme }: NavbarProps) {
  const [apiOnline, setApiOnline] = useState(false)

  useEffect(() => {
    const check = () => api.health().then(() => setApiOnline(true)).catch(() => setApiOnline(false))
    check()
    const id = setInterval(check, 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 bg-white/80 dark:bg-[#0a0b12]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.06]">
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-md bg-indigo-600 flex items-center justify-center text-[11px] font-black text-white tracking-tight">
          DC
        </div>
        <span className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">DroneComply</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">2.5</span>
      </div>

      <div className="flex gap-0.5 bg-slate-100 dark:bg-white/[0.03] rounded-lg p-0.5 border border-slate-200 dark:border-white/[0.04]">
        {(['sora', 'dma'] as const).map(id => (
          <button key={id} onClick={() => onTabChange(id)}
            className={`relative px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors
              ${activeTab === id ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            {activeTab === id && (
              <motion.div layoutId="tab-bg"
                className="absolute inset-0 rounded-md bg-white dark:bg-white/[0.07] shadow-sm dark:shadow-none"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            )}
            <span className="relative">{id === 'sora' ? 'SORA Builder' : 'Maturity Assessment'}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onToggleTheme}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Toggle theme">
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${apiOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {apiOnline ? 'Online' : 'Offline'}
        </div>
      </div>
    </nav>
  )
}
