"use client"

import { useEffect } from "react"
import { TodoEditor } from "@/components/todos/todo-editor"
import { DatePicker } from "@/components/todos/date-picker"
import { HelpDialog } from "@/components/help-dialog"
import { useTodosStore } from "@/store/todos"

export default function TodosPage() {
  const { fetchDates, fetchTodos, reset } = useTodosStore()

  useEffect(() => {
    fetchDates()
    fetchTodos()
    return () => reset()
  }, [fetchDates, fetchTodos, reset])

  return (
    <div className="flex h-screen bg-[#1D1715] overflow-hidden w-full relative">
      <div className="flex-1 flex w-full max-w-4xl mx-auto overflow-y-auto scrollbar-hidden">
        <div className="flex-1 flex w-full">
          <TodoEditor />
        </div>
      </div>
      <DatePicker />
      <HelpDialog />
    </div>
  )
}

