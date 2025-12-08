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
      new InputRule({
        find: /^>\s*\d+\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)\s*timer\s*$/i,
        handler: ({ range, match, chain }) => {
          const timerData = parseTimerInput(match[0])
          if (timerData) {
            chain()
              .deleteRange(range)
              .insertContent({
                type: "timerNode",
                attrs: { seconds: timerData.seconds, label: timerData.label },
              })
              .run()
          }
        },
      }),
      new InputRule({
        find: /^>\s*(?:sticky|note)(?:\s*:\s*|\s+).+\s*$/i,
        handler: ({ range, match, chain }) => {
          const stickyData = parseStickyNoteInput(match[0])
          if (stickyData) {
            chain()
              .deleteRange(range)
              .insertContent({
                type: "stickyNoteNode",
                attrs: { 
                  content: stickyData.content, 
                  color: stickyData.color || "yellow",
                  title: stickyData.title || "",
                },
              })
              .run()
          }
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

  return (
    <div className={cn("flex flex-1 h-full overflow-y-auto scrollbar-hidden", className)}>
      <div className="w-40 shrink-0 pr-6 text-right">
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

      <div className="flex-1 pt-12 pb-8 min-h-0 scrollbar-hidden max-w-5xl mr-auto">
        {activeFilter === "links" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
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
          margin-left: 2rem;
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
      `}</style>
    </div>
  )
}

