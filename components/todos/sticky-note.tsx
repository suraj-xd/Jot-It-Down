"use client"

import { useState, useRef, useEffect } from "react"

interface StickyNoteProps {
  content: string
  title?: string
  color?: "yellow" | "pink" | "blue" | "green" | "purple"
  onChange?: (content: string) => void
}

const colorMap = {
  yellow: {
    bg: "linear-gradient(135deg, #fef08a 0%, #fde047 50%, #facc15 100%)",
    tape: "#facc15",
    shadow: "rgba(250, 204, 21, 0.3)",
    text: "#4338ca",
  },
  pink: {
    bg: "linear-gradient(135deg, #fbcfe8 0%, #f9a8d4 50%, #f472b6 100%)",
    tape: "#f472b6",
    shadow: "rgba(244, 114, 182, 0.3)",
    text: "#7c3aed",
  },
  blue: {
    bg: "linear-gradient(135deg, #bfdbfe 0%, #93c5fd 50%, #60a5fa 100%)",
    tape: "#60a5fa",
    shadow: "rgba(96, 165, 250, 0.3)",
    text: "#1e3a8a",
  },
  green: {
    bg: "linear-gradient(135deg, #bbf7d0 0%, #86efac 50%, #4ade80 100%)",
    tape: "#4ade80",
    shadow: "rgba(74, 222, 128, 0.3)",
    text: "#166534",
  },
  purple: {
    bg: "linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 50%, #c084fc 100%)",
    tape: "#c084fc",
    shadow: "rgba(192, 132, 252, 0.3)",
    text: "#581c87",
  },
}

export function StickyNote({ content, title, color = "yellow", onChange }: StickyNoteProps) {
  const [text, setText] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const colors = colorMap[color]

  useEffect(() => {
    setText(content)
  }, [content])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setText(newText)
    onChange?.(newText)
  }

  return (
    <div className="sticky-note-wrapper" contentEditable={false}>
      <div
        className="sticky-note"
        style={{
          background: colors.bg,
          boxShadow: `4px 4px 15px ${colors.shadow}, 0 0 0 1px rgba(0,0,0,0.05)`,
        }}
      >
        <div className="sticky-note-tape" style={{ background: colors.tape }} />
        <div className="sticky-note-content">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            className="sticky-note-textarea"
            style={{ color: colors.text }}
            placeholder="Write something..."
          />
        </div>
        <div className="sticky-note-fold" />
      </div>
      {title && <div className="sticky-note-title">{title}</div>}
    </div>
  )
}

export function parseStickyNoteInput(text: string): { content: string; color?: string; title?: string } | null {
  const match = text.trim().match(/^>\s*(?:sticky|note)(?:\s*:\s*|\s+)(.+)$/i)
  if (match) {
    const rawContent = match[1].trim()
    const colorMatch = rawContent.match(/^\[(yellow|pink|blue|green|purple)\]\s*/i)
    if (colorMatch) {
      return {
        content: rawContent.slice(colorMatch[0].length),
        color: colorMatch[1].toLowerCase(),
      }
    }
    return { content: rawContent }
  }
  return null
}
