export type ToastItem = { id: number; text: string }

const listeners = new Set<(items: ToastItem[]) => void>()
let items: ToastItem[] = []
let nextId = 1

function emit() {
  for (const listener of listeners) listener(items)
}

export function toast(text: string) {
  const id = nextId++
  items = [...items, { id, text }]
  emit()
  window.setTimeout(() => {
    items = items.filter((item) => item.id !== id)
    emit()
  }, 3400)
}

export function subscribeToasts(listener: (items: ToastItem[]) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToasts() {
  return items
}
