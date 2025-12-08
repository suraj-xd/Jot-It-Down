"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

export function HelpDialog() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
      if (e.key === "/" && e.metaKey) {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#2a2422] border border-[#3a3432] text-[#888] hover:text-[#e8e8e8] hover:border-[#4a4442] transition-all flex items-center justify-center text-base md:text-lg font-medium shadow-lg z-40 cursor-pointer"
      >
        ?
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-[#1a1716] border border-[#2f2927] rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#2f2927]">
              <h2 className="text-[#e8e8e8] font-medium">Quick Guide</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#666] hover:text-[#e8e8e8] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-5">
              <section>
                <h3 className="text-[#888] text-xs uppercase tracking-wider mb-3">Shortcuts</h3>
                <div className="space-y-2">
                  <ShortcutRow keys={["⌘", "←"]} description="Previous day" />
                  <ShortcutRow keys={["⌘", "→"]} description="Next day" />
                  <ShortcutRow keys={["⌘", "/"]} description="Toggle this guide" />
                  <ShortcutRow keys={["Tab"]} description="Indent task" />
                  <ShortcutRow keys={["⇧", "Tab"]} description="Outdent task" />
                </div>
              </section>

              <section>
                <h3 className="text-[#888] text-xs uppercase tracking-wider mb-3">Create Tasks</h3>
                <div className="space-y-2">
                  <TypeRow trigger="- " description="Create a task" hasEnter={false} />
                  <TypeRow trigger="[] " description="Create a task (alt)" hasEnter={false} />
                </div>
              </section>

              <section>
                <h3 className="text-[#888] text-xs uppercase tracking-wider mb-3">Timers</h3>
                <p className="text-[#555] text-xs mb-2">Type and press Enter</p>
                <div className="space-y-2">
                  <TypeRow trigger="> 5 mins timer" description="5 minute timer" />
                  <TypeRow trigger="> 1 hour timer" description="1 hour timer" />
                  <TypeRow trigger="> 30 secs timer" description="30 second timer" />
                </div>
              </section>

              <section>
                <h3 className="text-[#888] text-xs uppercase tracking-wider mb-3">Sticky Notes</h3>
                <p className="text-[#555] text-xs mb-2">Type and press Enter</p>
                <div className="space-y-2">
                  <TypeRow trigger="> sticky: text" description="Yellow note" />
                  <TypeRow trigger="> note: text" description="Yellow note (alt)" />
                  <TypeRow trigger="> sticky: [pink] text" description="Colored note" />
                </div>
                <p className="text-[#555] text-xs mt-2">
                  Colors: yellow, pink, blue, green, purple
                </p>
              </section>

              <section>
                <h3 className="text-[#888] text-xs uppercase tracking-wider mb-3">Other</h3>
                <div className="space-y-2 text-sm text-[#999]">
                  <div className="flex items-start gap-2">
                    <span className="text-[#666]">•</span>
                    <span>Paste images directly</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#666]">•</span>
                    <span>URLs auto-link</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#666]">•</span>
                    <span>Filter by Todos or Links</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#666]">•</span>
                    <span>Hover to delete timers/notes</span>
                  </div>
                </div>
              </section>

              <section className="md:hidden">
                <h3 className="text-[#888] text-xs uppercase tracking-wider mb-3">Mobile</h3>
                <div className="space-y-2 text-sm text-[#999]">
                  <div className="flex items-start gap-2">
                    <span className="text-[#666]">•</span>
                    <span>Use buttons at bottom to add timers/notes</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#666]">•</span>
                    <span>Swipe header arrows to change days</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="min-w-[24px] h-6 px-1.5 rounded bg-[#2a2422] border border-[#3a3432] text-[#999] text-xs flex items-center justify-center font-mono"
          >
            {key}
          </kbd>
        ))}
      </div>
      <span className="text-sm text-[#888]">{description}</span>
    </div>
  )
}

function TypeRow({ trigger, description, hasEnter = true }: { trigger: string; description: string; hasEnter?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <code className="text-xs text-[#b6d7ff] bg-[#1e2a38] px-2 py-1 rounded font-mono">
          {trigger}
        </code>
        {hasEnter && (
          <kbd className="h-5 px-1.5 rounded bg-[#2a2422] border border-[#3a3432] text-[#666] text-[10px] flex items-center justify-center">
            ↵
          </kbd>
        )}
      </div>
      <span className="text-sm text-[#888] text-right">{description}</span>
    </div>
  )
}
