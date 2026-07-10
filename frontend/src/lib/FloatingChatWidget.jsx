import { useState } from 'react'
import ChatPanel from './ChatPanel'
import { ChatIcon, CloseIcon } from './ui'

// US-E6-02: floating assistant accessible from every page.
export function FloatingChatWidget() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-overlay)] dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Assistant RH</p>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Fermer"
            >
              <CloseIcon />
            </button>
          </div>
          <ChatPanel compact />
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Assistant RH"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-[var(--shadow-raised)] hover:bg-primary-700"
      >
        <ChatIcon className="h-6 w-6" />
      </button>
    </>
  )
}
