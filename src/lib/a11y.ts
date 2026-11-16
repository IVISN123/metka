const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function focusableIn(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.closest('[hidden]')) return false
    if (el.getAttribute('aria-hidden') === 'true') return false
    return el.tabIndex >= 0
  })
}

/** Next index when Tab wraps inside a dialog. `current` is -1 when focus is on the container. */
export function nextFocusIndex(current: number, count: number, shift: boolean): number {
  if (count <= 0) return 0
  if (current < 0) return shift ? count - 1 : 0
  if (shift) return current <= 0 ? count - 1 : current - 1
  return current >= count - 1 ? 0 : current + 1
}

export function menuMove(key: string, index: number, count: number): number | 'close' | null {
  if (count <= 0) return key === 'Escape' ? 'close' : null
  if (key === 'Escape') return 'close'
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key === 'ArrowDown') return (Math.max(index, -1) + 1) % count
  if (key === 'ArrowUp') return index <= 0 ? count - 1 : index - 1
  return null
}
