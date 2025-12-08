"use client"

import { useEffect, useState, useCallback } from "react"
import { Clock, Trash2 } from "lucide-react"

interface DigitalTimerProps {
  initialSeconds: number
  label?: string
  onComplete?: () => void
  onDelete?: () => void
}

export function DigitalTimer({ initialSeconds, label, onComplete, onDelete }: DigitalTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(true)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) return

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false)
          setIsComplete(true)
          onComplete?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, secondsLeft, onComplete])

  const formatTime = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return {
        display: `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
        hasHours: true,
      }
    }
    return {
      display: `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      hasHours: false,
    }
  }, [])

  const { display, hasHours } = formatTime(secondsLeft)

  const reset = () => {
    setSecondsLeft(initialSeconds)
    setIsRunning(true)
    setIsComplete(false)
  }

  const togglePause = () => {
    if (!isComplete) {
      setIsRunning(!isRunning)
    }
  }

  return (
    <div className="digital-timer-wrapper" contentEditable={false}>
      <div className={`digital-timer-container ${isComplete ? "timer-complete" : ""}`}>
        <div className="digital-timer-frame">
          {onDelete && (
            <button onClick={onDelete} className="timer-delete-btn" title="Delete timer">
              <Trash2 size={14} />
            </button>
          )}
          <div className="digital-timer-screen">
            <div className={`digital-timer-display ${hasHours ? "has-hours" : ""}`}>
              {display.split("").map((char, i) => (
                <span key={i} className={char === ":" ? "timer-colon" : "timer-digit"}>
                  {char}
                </span>
              ))}
            </div>
          </div>
        </div>
        {label && (
          <div className="digital-timer-label">
            <Clock size={14} />
            <span>{label}</span>
          </div>
        )}
        <div className="digital-timer-controls">
          <button onClick={togglePause} className="timer-btn">
            {isComplete ? "Done!" : isRunning ? "Pause" : "Resume"}
          </button>
          <button onClick={reset} className="timer-btn timer-btn-reset">
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

export function parseTimerInput(text: string): { seconds: number; label: string } | null {
  const patterns = [
    { regex: /^>\s*(\d+)\s*(?:hours?|hrs?)\s*timer$/i, multiplier: 3600 },
    { regex: /^>\s*(\d+)\s*(?:minutes?|mins?)\s*timer$/i, multiplier: 60 },
    { regex: /^>\s*(\d+)\s*(?:seconds?|secs?)\s*timer$/i, multiplier: 1 },
  ]

  for (const { regex, multiplier } of patterns) {
    const match = text.trim().match(regex)
    if (match) {
      const value = parseInt(match[1], 10)
      const seconds = value * multiplier
      let label = ""
      if (multiplier === 3600) label = `${value} hour${value > 1 ? "s" : ""}`
      else if (multiplier === 60) label = `${value} min${value > 1 ? "s" : ""}`
      else label = `${value} sec${value > 1 ? "s" : ""}`
      return { seconds, label }
    }
  }
  return null
}
