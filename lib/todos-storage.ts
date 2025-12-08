import type { Todo, TodoUpsertPayload } from "@/types/todos"

const STORAGE_KEY = "todos-data"

function getStoredTodos(): Record<string, Todo> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveStoredTodos(todos: Record<string, Todo>) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
}

export function getTodo(date: string): Todo | null {
  const todos = getStoredTodos()
  return todos[date] ?? null
}

export function getAllTodos(): Todo[] {
  const todos = getStoredTodos()
  return Object.values(todos).sort((a, b) => b.date.localeCompare(a.date))
}

export function getDatesWithTodos(): string[] {
  const todos = getStoredTodos()
  return Object.keys(todos).sort().reverse()
}

export function upsertTodo(payload: TodoUpsertPayload): Todo {
  const todos = getStoredTodos()
  const existing = todos[payload.date]
  const now = Date.now()
  
  const todo: Todo = {
    date: payload.date,
    content: payload.content,
    plainText: payload.plainText,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  
  todos[payload.date] = todo
  saveStoredTodos(todos)
  return todo
}

export function deleteTodo(date: string): boolean {
  const todos = getStoredTodos()
  if (!todos[date]) return false
  delete todos[date]
  saveStoredTodos(todos)
  return true
}

