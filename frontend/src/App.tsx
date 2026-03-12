import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Navbar from './components/Navbar'
import SoraBuilder from './components/SoraBuilder'
import DmaEvaluator from './components/DmaEvaluator'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

export default function App() {
  const [tab, setTab] = useState<'sora' | 'dma'>('sora')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  return (
    <div className="relative min-h-screen text-slate-900 dark:text-slate-100">
      <div className="flex flex-col min-h-screen">
        <Navbar activeTab={tab} onTabChange={setTab} dark={dark} onToggleTheme={() => setDark(d => !d)} />

        <main className="flex-1 py-6">
          <AnimatePresence mode="wait">
            {tab === 'sora' ? (
              <motion.div key="sora" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                <SoraBuilder onToast={addToast} />
              </motion.div>
            ) : (
              <motion.div key="dma" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                <DmaEvaluator onToast={addToast} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="text-center py-4 text-[11px] text-slate-400 dark:text-slate-600">
          DroneComply &middot; EASA SORA 2.5 &middot; {new Date().getFullYear()}
        </footer>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium border
                ${t.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/80 dark:border-emerald-800/50 dark:text-emerald-300'
                  : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/80 dark:border-red-800/50 dark:text-red-300'}`}>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
