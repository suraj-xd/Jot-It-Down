"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Placeholder from "@tiptap/extension-placeholder"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import { Extension } from "@tiptap/core"
import { InputRule } from "@tiptap/core"
import { format, isToday, parseISO, addDays, subDays } from "date-fns"
import { useTodosStore } from "@/store/todos"
import { cn } from "@/lib/utils"
import { TimerNode, StickyNoteNode, parseTimerInput, parseStickyNoteInput } from "@/lib/tiptap-extensions"
import { Timer, StickyNote as StickyNoteIcon, ChevronLeft, ChevronRight } from "lucide-react"

const TodoExtension = Extension.create({
  name: "todoExtension",
  addInputRules() {
    return [
      new InputRule({
        find: /^-\s$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).toggleTaskList().run()
        },
      }),
      new InputRule({
        find: /^\[\]\s$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).toggleTaskList().run()
        },
      }),
    ]
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("taskItem")) {
          return this.editor.chain().focus().sinkListItem("taskItem").run()
        }
        return false
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("taskItem")) {
          return this.editor.chain().focus().liftListItem("taskItem").run()
        }
        return false
      },
      Enter: () => {
        const { state } = this.editor
        const { $from } = state.selection
        const lineStart = $from.start()
        const lineText = state.doc.textBetween(lineStart, $from.pos, "\n")
        
        const timerData = parseTimerInput(lineText)
        if (timerData) {
          this.editor.chain()
            .deleteRange({ from: lineStart, to: $from.pos })
            .insertContent({
              type: "timerNode",
              attrs: { seconds: timerData.seconds, label: timerData.label },
            })
            .run()
          return true
        }

        const stickyData = parseStickyNoteInput(lineText)
        if (stickyData) {
          this.editor.chain()
            .deleteRange({ from: lineStart, to: $from.pos })
            .insertContent({
              type: "stickyNoteNode",
              attrs: { 
                content: stickyData.content, 
                color: stickyData.color || "yellow",
                title: stickyData.title || "",
              },
            })
            .run()
          return true
        }

        return false
      },
    }
  },
})

interface TodoEditorProps {
  className?: string
}

type JSONContent = {
  type?: string
  content?: JSONContent[]
}

export function TodoEditor({ className }: TodoEditorProps) {
  const { selectedDate, setSelectedDate, todos, upsertTodo, fetchTodo } = useTodosStore()
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentTodo = todos.get(selectedDate)
  const lastSavedContent = useRef<string>("")
  const isLoadingContent = useRef(false)
  const [activeFilter, setActiveFilter] = useState<"todos" | "links" | null>(null)
  const [showMobileActions, setShowMobileActions] = useState(false)

  const hasTodos = useMemo(() => {
    if (!currentTodo?.content) return false
    try {
      const doc = JSON.parse(currentTodo.content) as JSONContent
      const walk = (node: JSONContent | undefined): boolean => {
        if (!node) return false
        if (node.type === "taskItem") return true
        if (Array.isArray(node.content)) {
          return node.content.some((child) => walk(child))
        }
        return false
      }
      return walk(doc)
    } catch {
      return false
    }
  }, [currentTodo])

  const collectedLinks = useMemo(() => {
    const plain = currentTodo?.plainText ?? ""
    const matches = plain.match(/https?:\/\/[^\s]+/g) ?? []
    const unique = Array.from(new Set(matches))
    return unique.map((url) => {
      try {
        const parsed = new URL(url)
        return { url, domain: parsed.hostname.replace(/^www\./, "") }
      } catch {
        return { url, domain: "link" }
      }
    })
  }, [currentTodo])

  const hasLinks = collectedLinks.length > 0

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: true,
        HTMLAttributes: {
          class: "text-[#b6d7ff] underline-offset-2 hover:text-white",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-md max-w-full mt-2 mb-4 border border-[#2f2927] bg-[#201b19] p-2",
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "todo-list",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "todo-item",
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing... Type '- ' to create a task",
      }),
      TodoExtension,
      TimerNode,
      StickyNoteNode,
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[400px] text-[#e8e8e8] text-base leading-relaxed",
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false

        const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"))
        if (!imageItem) return false

        const file = imageItem.getAsFile()
        if (!file) return false

        event.preventDefault()
        const reader = new FileReader()
        reader.onload = () => {
          const src = reader.result?.toString()
          if (src) {
            editor?.chain().focus().setImage({ src }).run()
          }
        }
        reader.readAsDataURL(file)
        return true
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isLoadingContent.current) return
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        const content = JSON.stringify(ed.getJSON())
        const plainText = ed.getText()
        const json = ed.getJSON() as JSONContent
        const walkImage = (node: JSONContent): boolean => {
          if (node.type === "image") return true
          if (node.content) return node.content.some(walkImage)
          return false
        }
        const hasImage = !!json.content?.some(walkImage)
        const hasText = !!plainText.trim()
        if (content !== lastSavedContent.current && (hasText || hasImage)) {
          lastSavedContent.current = content
          upsertTodo({ date: selectedDate, content, plainText })
        }
      }, 800)
    },
    immediatelyRender: false,
  })

  const addTimer = (minutes: number) => {
    const seconds = minutes * 60
    const label = minutes >= 60 
      ? `${Math.floor(minutes / 60)} hour${Math.floor(minutes / 60) > 1 ? "s" : ""}` 
      : `${minutes} min${minutes > 1 ? "s" : ""}`
    editor?.chain().focus().insertContent({
      type: "timerNode",
      attrs: { seconds, label },
    }).run()
    setShowMobileActions(false)
  }

  const addStickyNote = (color: string = "yellow") => {
    editor?.chain().focus().insertContent({
      type: "stickyNoteNode",
      attrs: { content: "", color, title: "" },
    }).run()
    setShowMobileActions(false)
  }

  useEffect(() => {
    fetchTodo(selectedDate)
  }, [selectedDate, fetchTodo])

  useEffect(() => {
    if (!editor) return
    
    const todoContent = currentTodo?.content
    if (todoContent === lastSavedContent.current) return
    
    isLoadingContent.current = true
    if (currentTodo) {
      try {
        const content = JSON.parse(currentTodo.content)
        lastSavedContent.current = currentTodo.content
        editor.commands.setContent(content)
      } catch {
        editor.commands.setContent(currentTodo.content)
      }
    } else {
      lastSavedContent.current = ""
      editor.commands.setContent("")
    }
    setTimeout(() => {
      isLoadingContent.current = false
    }, 100)
  }, [currentTodo, editor])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))
        } else if (e.key === "ArrowRight") {
          e.preventDefault()
          setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedDate, setSelectedDate])

  const displayDate = parseISO(selectedDate)
  const isTodayDate = isToday(displayDate)

  const goToPrevDay = () => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))
  const goToNextDay = () => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))

  return (
    <div className={cn("flex flex-col md:flex-row flex-1 h-full overflow-y-auto scrollbar-hidden", className)}>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#2f2927] sticky top-0 bg-[#1D1715] z-10">
        <button onClick={goToPrevDay} className="p-2 text-[#888] hover:text-white cursor-pointer">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="text-[#e8e8e8] text-sm font-medium">
            {format(displayDate, "MMM d, yyyy")}
          </div>
          {isTodayDate && <div className="text-[#767676] text-xs">Today</div>}
        </div>
        <button onClick={goToNextDay} className="p-2 text-[#888] hover:text-white cursor-pointer">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block w-40 shrink-0 pr-6 text-right">
        <div className="sticky top-0.5 pt-12">
          <div className="text-[#534E4C] text-sm">
            {format(displayDate, "MMM d, yyyy")}
          </div>
          {isTodayDate && (
            <div className="text-[#767676] text-xs mt-0.5">Today</div>
          )}
          {(hasTodos || hasLinks) && (
            <div className="mt-3 flex items-center justify-end gap-2">
              {hasTodos && (
                <button
                  onClick={() => setActiveFilter(activeFilter === "todos" ? null : "todos")}
                  className={cn(
                    "h-7 px-3 rounded-full text-xs border transition-colors cursor-pointer",
                    activeFilter === "todos"
                      ? "bg-[#2c2624] border-[#3a3432] text-[#e8e8e8]"
                      : "border-[#2c2624] text-[#777] hover:text-[#cfcfcf] hover:border-[#3a3432]"
                  )}
                >
                  Todos
                </button>
              )}
              {hasLinks && (
                <button
                  onClick={() => setActiveFilter(activeFilter === "links" ? null : "links")}
                  className={cn(
                    "h-7 px-3 rounded-full text-xs border transition-colors cursor-pointer",
                    activeFilter === "links"
                      ? "bg-[#2c2624] border-[#3a3432] text-[#e8e8e8]"
                      : "border-[#2c2624] text-[#777] hover:text-[#cfcfcf] hover:border-[#3a3432]"
                  )}
                >
                  Links
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pt-4 md:pt-12 pb-24 md:pb-8 px-4 md:px-0 min-h-0 scrollbar-hidden max-w-5xl mr-auto">
        {/* Mobile Filters */}
        {(hasTodos || hasLinks) && (
          <div className="md:hidden flex items-center gap-2 mb-4">
            {hasTodos && (
              <button
                onClick={() => setActiveFilter(activeFilter === "todos" ? null : "todos")}
                className={cn(
                  "h-7 px-3 rounded-full text-xs border transition-colors cursor-pointer",
                  activeFilter === "todos"
                    ? "bg-[#2c2624] border-[#3a3432] text-[#e8e8e8]"
                    : "border-[#2c2624] text-[#777] hover:text-[#cfcfcf] hover:border-[#3a3432]"
                )}
              >
                Todos
              </button>
            )}
            {hasLinks && (
              <button
                onClick={() => setActiveFilter(activeFilter === "links" ? null : "links")}
                className={cn(
                  "h-7 px-3 rounded-full text-xs border transition-colors cursor-pointer",
                  activeFilter === "links"
                    ? "bg-[#2c2624] border-[#3a3432] text-[#e8e8e8]"
                    : "border-[#2c2624] text-[#777] hover:text-[#cfcfcf] hover:border-[#3a3432]"
                )}
              >
                Links
              </button>
            )}
          </div>
        )}

        {activeFilter === "links" ? (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {collectedLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-[#2f2927] bg-[#201b19] p-4 transition-colors hover:border-[#3a3432] hover:bg-[#27211f]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="h-8 w-8 rounded-md bg-[#2a2422] border border-[#2f2927] flex items-center justify-center shrink-0 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://icons.duckduckgo.com/ip3/${link.domain}.ico`}
                          alt=""
                          className="h-5 w-5"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${link.domain}&sz=64`
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-[#e8e8e8] wrap-break-word">
                          {link.domain}
                        </div>
                        <div className="text-xs text-[#8f8f8f] wrap-break-word mt-1 line-clamp-2">
                          {link.url}
                        </div>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <EditorContent
            editor={editor}
            className={cn("h-full scrollbar-hidden pb-20", activeFilter === "todos" && "filter-todos-only")}
          />
        )}
      </div>

      {/* Mobile Action Buttons */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1D1715] border-t border-[#2f2927] p-3 z-20">
        {showMobileActions ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#888]">Add Timer</span>
              <div className="flex gap-2">
                {[5, 10, 15, 25, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => addTimer(mins)}
                    className="px-3 py-1.5 rounded-lg bg-[#2a2422] border border-[#3a3432] text-xs text-[#e8e8e8] hover:bg-[#3a3432] cursor-pointer"
                  >
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#888]">Add Note</span>
              <div className="flex gap-2">
                {(["yellow", "pink", "blue", "green", "purple"] as const).map((color) => (
                  <button
                    key={color}
                    onClick={() => addStickyNote(color)}
                    className="w-7 h-7 rounded-lg border border-[#3a3432] cursor-pointer"
                    style={{
                      background: color === "yellow" ? "#facc15" 
                        : color === "pink" ? "#f472b6"
                        : color === "blue" ? "#60a5fa"
                        : color === "green" ? "#4ade80"
                        : "#c084fc"
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowMobileActions(false)}
              className="w-full py-2 text-xs text-[#888] hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => setShowMobileActions(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#2a2422] border border-[#3a3432] text-sm text-[#e8e8e8] hover:bg-[#3a3432] cursor-pointer"
            >
              <Timer size={16} />
              Timer
            </button>
            <button
              onClick={() => setShowMobileActions(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#2a2422] border border-[#3a3432] text-sm text-[#e8e8e8] hover:bg-[#3a3432] cursor-pointer"
            >
              <StickyNoteIcon size={16} />
              Note
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        .todo-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .todo-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin: 0.5rem 0;
          padding: 0.25rem 0;
        }
        
        .todo-item > label {
          flex-shrink: 0;
          margin-top: 0.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .todo-item > label input[type="checkbox"] {
          appearance: none;
          width: 1.25rem;
          height: 1.25rem;
          border: 2px solid #444;
          border-radius: 0.375rem;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }
        
        .todo-item > label input[type="checkbox"]:hover {
          border-color: #666;
        }
        
        .todo-item > label input[type="checkbox"]:checked {
          background: #444;
          border-color: #444;
        }
        
        .todo-item > label input[type="checkbox"]:checked::after {
          content: "✓";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #e8e8e8;
          font-size: 0.75rem;
          font-weight: bold;
        }
        
        .todo-item > div {
          flex: 1;
          min-width: 0;
        }
        
        .todo-item > div p {
          margin: 0;
        }
        
        .todo-item[data-checked="true"] > div {
          text-decoration: line-through;
          opacity: 0.5;
        }
        
        .todo-list .todo-list {
          margin-left: 1.5rem;
        }

        @media (min-width: 768px) {
          .todo-list .todo-list {
            margin-left: 2rem;
          }
        }

        .ProseMirror a {
          color: inherit;
        }

        .ProseMirror hr {
          border: none;
          border-top: 1px solid #2f2927;
          margin: 1.5rem 0;
        }
        
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #555;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        .filter-todos-only .ProseMirror > *:not(ul.todo-list):not(ol.todo-list) {
          display: none;
        }

        /* Digital Timer Styles */
        .digital-timer-wrapper {
          margin: 1.5rem 0;
          user-select: none;
        }

        .digital-timer-container {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .digital-timer-frame {
          position: relative;
          background: linear-gradient(145deg, #e8e8e8, #f5f5f5);
          padding: 12px;
          border-radius: 20px;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.3),
            inset 0 2px 0 rgba(255, 255, 255, 0.8),
            inset 0 -2px 0 rgba(0, 0, 0, 0.1);
        }

        .timer-delete-btn {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #ef4444;
          border: 2px solid #1D1715;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 10;
        }

        .digital-timer-wrapper:hover .timer-delete-btn {
          opacity: 1;
        }

        .digital-timer-screen {
          background: linear-gradient(180deg, #c8d0c8 0%, #b8c0b8 100%);
          padding: 16px 20px;
          border-radius: 12px;
          box-shadow: 
            inset 0 4px 8px rgba(0, 0, 0, 0.15),
            inset 0 -2px 4px rgba(255, 255, 255, 0.3);
        }

        @media (min-width: 768px) {
          .digital-timer-screen {
            padding: 20px 28px;
          }
        }

        .digital-timer-display {
          font-family: 'Orbitron', 'Courier New', monospace;
          font-size: 2.5rem;
          font-weight: 700;
          color: #1a2a1a;
          letter-spacing: 2px;
          text-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
        }

        @media (min-width: 768px) {
          .digital-timer-display {
            font-size: 3.5rem;
          }
        }

        .digital-timer-display.has-hours {
          font-size: 1.75rem;
        }

        @media (min-width: 768px) {
          .digital-timer-display.has-hours {
            font-size: 2.5rem;
          }
        }

        .timer-digit {
          display: inline-block;
          min-width: 0.65em;
          text-align: center;
        }

        .timer-colon {
          display: inline-block;
          min-width: 0.3em;
          text-align: center;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }

        .timer-complete .timer-colon {
          animation: none;
          opacity: 1;
        }

        .timer-complete .digital-timer-screen {
          background: linear-gradient(180deg, #a8d8a8 0%, #90c890 100%);
        }

        .digital-timer-label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #888;
          font-size: 0.875rem;
        }

        .digital-timer-controls {
          display: flex;
          gap: 8px;
        }

        .timer-btn {
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 500;
          background: #2a2422;
          color: #e8e8e8;
          border: 1px solid #3a3432;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .timer-btn:hover {
          background: #3a3432;
          border-color: #4a4442;
        }

        .timer-btn-reset {
          background: transparent;
          border-color: #3a3432;
          color: #888;
        }

        .timer-btn-reset:hover {
          background: #2a2422;
          color: #e8e8e8;
        }

        /* Sticky Note Styles */
        .sticky-note-wrapper {
          margin: 1rem 0;
          display: inline-block;
          user-select: none;
        }

        @media (min-width: 768px) {
          .sticky-note-wrapper {
            margin: 1.5rem 0;
          }
        }

        .sticky-note-draggable {
          position: absolute;
        }

        .sticky-note {
          position: relative;
          width: 180px;
          min-height: 150px;
          padding: 20px 12px 12px;
          transform: rotate(-1deg);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        @media (min-width: 768px) {
          .sticky-note {
            width: 220px;
            min-height: 180px;
            padding: 24px 16px 16px;
          }
        }

        .sticky-note:hover {
          transform: rotate(0deg) scale(1.02);
        }

        .sticky-note-delete {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.2);
          border: none;
          color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s, background 0.2s;
          z-index: 10;
        }

        .sticky-note:hover .sticky-note-delete {
          opacity: 1;
        }

        .sticky-note-delete:hover {
          background: rgba(239, 68, 68, 0.8);
          color: white;
        }

        .sticky-note-tape {
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%) rotate(2deg);
          width: 50px;
          height: 20px;
          opacity: 0.8;
          border-radius: 2px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        @media (min-width: 768px) {
          .sticky-note-tape {
            width: 60px;
            height: 24px;
          }
        }

        .sticky-note-content {
          position: relative;
          z-index: 1;
        }

        .sticky-note-textarea {
          width: 100%;
          min-height: 110px;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          font-family: 'Caveat', cursive;
          font-size: 1.1rem;
          font-weight: 500;
          line-height: 1.5;
        }

        @media (min-width: 768px) {
          .sticky-note-textarea {
            min-height: 140px;
            font-size: 1.25rem;
          }
        }

        .sticky-note-textarea::placeholder {
          opacity: 0.5;
        }

        .sticky-note-fold {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 16px 16px;
          border-color: transparent transparent rgba(0, 0, 0, 0.1) transparent;
        }

        @media (min-width: 768px) {
          .sticky-note-fold {
            border-width: 0 0 20px 20px;
          }
        }

        .sticky-note-title {
          text-align: center;
          color: #888;
          font-size: 0.75rem;
          margin-top: 8px;
        }
      `}</style>
    </div>
  )
}
