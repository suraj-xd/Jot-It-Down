"use client"

import { create } from "zustand"
import { format } from "date-fns"
import type { Todo, TodoUpsertPayload } from "@/types/todos"
import * as storage from "@/lib/todos-storage"

interface TodosState {
  todos: Map<string, Todo>
  datesWithTodos: string[]
  selectedDate: string
  isLoading: boolean

  setSelectedDate: (date: string) => void

  fetchTodo: (date: string) => Todo | null
  fetchDates: () => void
  fetchTodos: () => void

  upsertTodo: (payload: TodoUpsertPayload) => Todo
  deleteTodo: (date: string) => boolean

  reset: () => void
}

const getToday = () => format(new Date(), "yyyy-MM-dd")

export const useTodosStore = create<TodosState>((set, get) => ({
  todos: new Map(),
  datesWithTodos: [],
  selectedDate: getToday(),
  isLoading: false,

  setSelectedDate: (date) => {
    set({ selectedDate: date })
    get().fetchTodo(date)
  },

  fetchTodo: (date) => {
    const cached = get().todos.get(date)
    if (cached) return cached

    const todo = storage.getTodo(date)
    if (todo) {
      set((state) => {
        const newTodos = new Map(state.todos)
        newTodos.set(date, todo)
        return { todos: newTodos }
      })
    }
    return todo
  },

  fetchDates: () => {
    const dates = storage.getDatesWithTodos()
    set({ datesWithTodos: dates })
  },

  fetchTodos: () => {
    set({ isLoading: true })
    const todosList = storage.getAllTodos()
    const todosMap = new Map<string, Todo>()
    for (const todo of todosList) {
      todosMap.set(todo.date, todo)
    }
    set({ todos: todosMap, isLoading: false })
  },

  upsertTodo: (payload) => {
    const todo = storage.upsertTodo(payload)
    set((state) => {
      const newTodos = new Map(state.todos)
      newTodos.set(todo.date, todo)
      const newDates = state.datesWithTodos.includes(todo.date)
        ? state.datesWithTodos
        : [todo.date, ...state.datesWithTodos].sort().reverse()
      return { todos: newTodos, datesWithTodos: newDates }
    })
    return todo
  },

  deleteTodo: (date) => {
    const success = storage.deleteTodo(date)
    if (success) {
      set((state) => {
        const newTodos = new Map(state.todos)
        newTodos.delete(date)
        return {
          todos: newTodos,
          datesWithTodos: state.datesWithTodos.filter((d) => d !== date),
        }
      })
    }
    return success
  },

  reset: () => {
    set({
      todos: new Map(),
      datesWithTodos: [],
      selectedDate: getToday(),
      isLoading: false,
    })
  },
}))

