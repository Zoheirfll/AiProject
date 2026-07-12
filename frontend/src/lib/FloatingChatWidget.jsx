import { useEffect, useRef, useState } from 'react'
import ChatPanel from './ChatPanel'
import { ChatIcon, CloseIcon, SparkleIcon } from './ui'

// US-E6-02: floating assistant accessible from every page.
export function FloatingChatWidget() {
  const [open, setOpen] = useState(false)
  const launcherRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        launcherRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Assistant RH"
          className="fixed bottom-24 right-4 left-4 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-overlay)] sm:left-auto sm:right-6 sm:w-96 sm:max-w-[calc(100vw-3rem)] dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-linear-to-r from-primary-50 to-white px-4 py-3 dark:border-slate-700 dark:from-primary-900/20 dark:to-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white">
                <SparkleIcon className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Assistant RH</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              aria-label="Fermer l'assistant"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="min-h-0 flex-1 px-4 pb-4">
            <ChatPanel compact />
          </div>
        </div>
      )}
      <button
        ref={launcherRef}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Fermer l\'assistant RH' : 'Ouvrir l\'assistant RH'}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary-600 text-white shadow-[var(--shadow-raised)] transition-transform hover:scale-105 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 motion-reduce:hover:scale-100 dark:focus-visible:ring-offset-slate-900"
      >
        {open ? <CloseIcon className="h-6 w-6" /> : <ChatIcon className="h-6 w-6" />}
      </button>
    </>
  )
}
