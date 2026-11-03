export type IconDef = { id: string; svg: string }

const laurel = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 120">
  <g fill="#111">
    <rect x="22" y="4" width="4" height="112" rx="2"/>
    <ellipse cx="14" cy="24" rx="11" ry="5" transform="rotate(-42 14 24)"/>
    <ellipse cx="34" cy="24" rx="11" ry="5" transform="rotate(42 34 24)"/>
    <ellipse cx="12" cy="44" rx="12" ry="5" transform="rotate(-50 12 44)"/>
    <ellipse cx="36" cy="44" rx="12" ry="5" transform="rotate(50 36 44)"/>
    <ellipse cx="13" cy="64" rx="11" ry="5" transform="rotate(-46 13 64)"/>
    <ellipse cx="35" cy="64" rx="11" ry="5" transform="rotate(46 35 64)"/>
    <ellipse cx="15" cy="84" rx="10" ry="4.5" transform="rotate(-36 15 84)"/>
    <ellipse cx="33" cy="84" rx="10" ry="4.5" transform="rotate(36 33 84)"/>
    <ellipse cx="18" cy="100" rx="8" ry="4" transform="rotate(-28 18 100)"/>
    <ellipse cx="30" cy="100" rx="8" ry="4" transform="rotate(28 30 100)"/>
  </g>
</svg>`

function strokeIcon(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}

export const ICONS: IconDef[] = [
  { id: 'laurel', svg: laurel },
  {
    id: 'drone',
    svg: strokeIcon(
      '<circle cx="12" cy="12" r="2.2"/><path d="M12 9.5V6M12 14.5V18M9.5 12H6M14.5 12H18"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M6.4 6.4 9.2 9.2M17.6 6.4 14.8 9.2M6.4 17.6 9.2 14.8M17.6 17.6 14.8 14.8"/>',
    ),
  },
  {
    id: 'camera',
    svg: strokeIcon('<path d="M4 8h3l1.5-2h7L17 8h3v10H4z"/><circle cx="12" cy="13" r="3.2"/>'),
  },
  {
    id: 'gimbal',
    svg: strokeIcon('<rect x="8" y="3" width="8" height="3" rx="1"/><path d="M12 6v3"/><rect x="6" y="9" width="12" height="7" rx="1"/><circle cx="12" cy="16" r="3"/><path d="M10 20v2M14 20v2"/>'),
  },
  { id: 'bolt', svg: strokeIcon('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>') },
  { id: 'tag', svg: strokeIcon('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="8" cy="8" r="1.2" fill="#111"/>') },
  { id: 'box', svg: strokeIcon('<path d="M3 8 12 4l9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/>') },
  { id: 'check', svg: strokeIcon('<circle cx="12" cy="12" r="8"/><path d="m8.5 12.2 2.3 2.3 4.7-5"/>') },
  { id: 'alert', svg: strokeIcon('<path d="M12 3 2.8 19h18.4z"/><path d="M12 9v4M12 16.5h.01"/>') },
  { id: 'arrow', svg: strokeIcon('<path d="M4 12h14M13 6l6 6-6 6"/>') },
  { id: 'star', svg: strokeIcon('<path d="m12 3 2.4 5.2 5.6.6-4.2 3.8 1.2 5.5L12 15.8 6.9 18.1l1.2-5.5L4 8.8l5.6-.6z"/>') },
  { id: 'lock', svg: strokeIcon('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>') },
  { id: 'pin', svg: strokeIcon('<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"/><circle cx="12" cy="11" r="1.6"/>') },
  { id: 'wrench', svg: strokeIcon('<path d="M14.5 6.5a4 4 0 0 0-5.6 5.6L4 17l3 3 4.9-4.9a4 4 0 0 0 5.6-5.6L15 12l-3-3z"/>') },
  { id: 'crosshair', svg: strokeIcon('<circle cx="12" cy="12" r="6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>') },
  { id: 'recycle', svg: strokeIcon('<path d="M7 19H4l2-4M17 19h3l-2-4M8 7l2-3 2 3M7 11l-3 2M17 11l3 2"/>') },
]

export function iconById(id: string): IconDef | undefined {
  return ICONS.find((icon) => icon.id === id)
}
