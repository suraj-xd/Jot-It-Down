"use client"

import { useEffect, useRef } from "react"
import Lenis from "lenis"
import { TodoEditor } from "@/components/todos/todo-editor"
import { DatePicker } from "@/components/todos/date-picker"
import { HelpDialog } from "@/components/help-dialog"
import { useTodosStore } from "@/store/todos"

export default function TodosPage() {
  const { fetchDates, fetchTodos, reset } = useTodosStore()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchDates()
    fetchTodos()
    return () => reset()
  }, [fetchDates, fetchTodos, reset])

  useEffect(() => {
    if (!wrapperRef.current || !contentRef.current) return
    
    const lenis = new Lenis({
      wrapper: wrapperRef.current,
      content: contentRef.current,
      duration: 0.5,
      smoothWheel: true,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)

    return () => lenis.destroy()
  }, [])

  return (
    <div className="flex h-screen bg-[#1D1715] overflow-hidden w-full relative">
      <div ref={wrapperRef} className="flex-1 flex w-full max-w-4xl mx-auto overflow-y-auto scrollbar-hidden">
        <div ref={contentRef} className="flex-1 flex w-full">
          <TodoEditor />
        </div>
      </div>
      <DatePicker />
      <HelpDialog />
    </div>
  )
}

