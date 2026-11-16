/* Generated from Lucide (ISC) plus a few label marks drawn for Метка. */
export type SymbolGlyph = {
  t: 'path' | 'line' | 'circle' | 'rect' | 'polygon' | 'polyline'
  d?: string
  x1?: string
  y1?: string
  x2?: string
  y2?: string
  cx?: string
  cy?: string
  r?: string
  x?: string
  y?: string
  width?: string
  height?: string
  rx?: string
  points?: string
}

export type SymbolIcon = {
  id: string
  category: string
  ru: string
  en: string
  filled?: boolean
  glyphs?: SymbolGlyph[]
  svg?: string
}

export const SYMBOL_CATEGORIES: { id: string; ru: string; en: string }[] = [
  {
    "id": "warn",
    "ru": "Предупреждения",
    "en": "Warnings"
  },
  {
    "id": "pack",
    "ru": "Упаковка",
    "en": "Packing"
  },
  {
    "id": "arrow",
    "ru": "Стрелки",
    "en": "Arrows"
  },
  {
    "id": "mark",
    "ru": "Знаки",
    "en": "Marks"
  },
  {
    "id": "tech",
    "ru": "Техника",
    "en": "Devices"
  },
  {
    "id": "weather",
    "ru": "Погода",
    "en": "Weather"
  },
  {
    "id": "shop",
    "ru": "Магазин",
    "en": "Shop"
  },
  {
    "id": "nature",
    "ru": "Природа",
    "en": "Nature"
  },
  {
    "id": "tool",
    "ru": "Инструменты",
    "en": "Tools"
  },
  {
    "id": "people",
    "ru": "Люди",
    "en": "People"
  }
]

export const SYMBOLS: SymbolIcon[] = [
  {
    "id": "triangle-alert",
    "category": "warn",
    "ru": "Треугольник",
    "en": "Warning",
    "glyphs": [
      {
        "t": "path",
        "d": "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
      },
      {
        "t": "path",
        "d": "M12 9v4"
      },
      {
        "t": "path",
        "d": "M12 17h.01"
      }
    ]
  },
  {
    "id": "octagon-alert",
    "category": "warn",
    "ru": "Стоп",
    "en": "Stop",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 16h.01"
      },
      {
        "t": "path",
        "d": "M12 8v4"
      },
      {
        "t": "path",
        "d": "M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"
      }
    ]
  },
  {
    "id": "shield-alert",
    "category": "warn",
    "ru": "Защита",
    "en": "Shield",
    "glyphs": [
      {
        "t": "path",
        "d": "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
      },
      {
        "t": "path",
        "d": "M12 8v4"
      },
      {
        "t": "path",
        "d": "M12 16h.01"
      }
    ]
  },
  {
    "id": "ban",
    "category": "warn",
    "ru": "Запрещено",
    "en": "Prohibited",
    "glyphs": [
      {
        "t": "circle",
        "cx": "12",
        "cy": "12",
        "r": "10"
      },
      {
        "t": "path",
        "d": "M4.929 4.929 19.07 19.071"
      }
    ]
  },
  {
    "id": "circle-alert",
    "category": "warn",
    "ru": "Внимание",
    "en": "Attention",
    "glyphs": [
      {
        "t": "circle",
        "cx": "12",
        "cy": "12",
        "r": "10"
      },
      {
        "t": "line",
        "x1": "12",
        "y1": "8",
        "x2": "12",
        "y2": "12"
      },
      {
        "t": "line",
        "x1": "12",
        "y1": "16",
        "x2": "12.01",
        "y2": "16"
      }
    ]
  },
  {
    "id": "info",
    "category": "warn",
    "ru": "Информация",
    "en": "Info",
    "glyphs": [
      {
        "t": "circle",
        "cx": "12",
        "cy": "12",
        "r": "10"
      },
      {
        "t": "path",
        "d": "M12 16v-4"
      },
      {
        "t": "path",
        "d": "M12 8h.01"
      }
    ]
  },
  {
    "id": "badge-info",
    "category": "warn",
    "ru": "Справка",
    "en": "Notice",
    "glyphs": [
      {
        "t": "path",
        "d": "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
      },
      {
        "t": "line",
        "x1": "12",
        "y1": "16",
        "x2": "12",
        "y2": "12"
      },
      {
        "t": "line",
        "x1": "12",
        "y1": "8",
        "x2": "12.01",
        "y2": "8"
      }
    ]
  },
  {
    "id": "siren",
    "category": "warn",
    "ru": "Сирена",
    "en": "Siren",
    "glyphs": [
      {
        "t": "path",
        "d": "M7 18v-6a5 5 0 1 1 10 0v6"
      },
      {
        "t": "path",
        "d": "M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"
      },
      {
        "t": "path",
        "d": "M21 12h1"
      },
      {
        "t": "path",
        "d": "M18.5 4.5 18 5"
      },
      {
        "t": "path",
        "d": "M2 12h1"
      },
      {
        "t": "path",
        "d": "M12 2v1"
      },
      {
        "t": "path",
        "d": "m4.929 4.929.707.707"
      },
      {
        "t": "path",
        "d": "M12 12v6"
      }
    ]
  },
  {
    "id": "biohazard",
    "category": "warn",
    "ru": "Биологическая опасность",
    "en": "Biohazard",
    "glyphs": [
      {
        "t": "circle",
        "cx": "12",
        "cy": "11.9",
        "r": "2"
      },
      {
        "t": "path",
        "d": "M6.7 3.4c-.9 2.5 0 5.2 2.2 6.7C6.5 9 3.7 9.6 2 11.6"
      },
      {
        "t": "path",
        "d": "m8.9 10.1 1.4.8"
      },
      {
        "t": "path",
        "d": "M17.3 3.4c.9 2.5 0 5.2-2.2 6.7 2.4-1.2 5.2-.6 6.9 1.5"
      },
      {
        "t": "path",
        "d": "m15.1 10.1-1.4.8"
      },
      {
        "t": "path",
        "d": "M16.7 20.8c-2.6-.4-4.6-2.6-4.7-5.3-.2 2.6-2.1 4.8-4.7 5.2"
      },
      {
        "t": "path",
        "d": "M12 13.9v1.6"
      },
      {
        "t": "path",
        "d": "M13.5 5.4c-1-.2-2-.2-3 0"
      },
      {
        "t": "path",
        "d": "M17 16.4c.7-.7 1.2-1.6 1.5-2.5"
      },
      {
        "t": "path",
        "d": "M5.5 13.9c.3.9.8 1.8 1.5 2.5"
      }
    ]
  },
  {
    "id": "radiation",
    "category": "warn",
    "ru": "Радиация",
    "en": "Radiation",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 12h.01"
      },
      {
        "t": "path",
        "d": "M14 15.4641a4 4 0 0 1-4 0L7.52786 19.74597 A 1 1 0 0 0 7.99303 21.16211 10 10 0 0 0 16.00697 21.16211 1 1 0 0 0 16.47214 19.74597z"
      },
      {
        "t": "path",
        "d": "M16 12a4 4 0 0 0-2-3.464l2.472-4.282a1 1 0 0 1 1.46-.305 10 10 0 0 1 4.006 6.94A1 1 0 0 1 21 12z"
      },
      {
        "t": "path",
        "d": "M8 12a4 4 0 0 1 2-3.464L7.528 4.254a1 1 0 0 0-1.46-.305 10 10 0 0 0-4.006 6.94A1 1 0 0 0 3 12z"
      }
    ]
  },
  {
    "id": "package",
    "category": "pack",
    "ru": "Посылка",
    "en": "Parcel",
    "glyphs": [
      {
        "t": "path",
        "d": "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"
      },
      {
        "t": "path",
        "d": "M12 22V12"
      },
      {
        "t": "polyline",
        "points": "3.29 7 12 12 20.71 7"
      },
      {
        "t": "path",
        "d": "m7.5 4.27 9 5.15"
      }
    ]
  },
  {
    "id": "package-open",
    "category": "pack",
    "ru": "Открытая коробка",
    "en": "Open box",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 22v-9"
      },
      {
        "t": "path",
        "d": "M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z"
      },
      {
        "t": "path",
        "d": "M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13"
      },
      {
        "t": "path",
        "d": "M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z"
      }
    ]
  },
  {
    "id": "box",
    "category": "pack",
    "ru": "Коробка",
    "en": "Box",
    "glyphs": [
      {
        "t": "path",
        "d": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
      },
      {
        "t": "path",
        "d": "m3.3 7 8.7 5 8.7-5"
      },
      {
        "t": "path",
        "d": "M12 22V12"
      }
    ]
  },
  {
    "id": "archive",
    "category": "pack",
    "ru": "Архив",
    "en": "Archive",
    "glyphs": [
      {
        "t": "rect",
        "x": "2",
        "y": "3",
        "width": "20",
        "height": "5",
        "rx": "1"
      },
      {
        "t": "path",
        "d": "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"
      },
      {
        "t": "path",
        "d": "M10 12h4"
      }
    ]
  },
  {
    "id": "recycle",
    "category": "pack",
    "ru": "Переработка",
    "en": "Recycling",
    "glyphs": [
      {
        "t": "path",
        "d": "M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"
      },
      {
        "t": "path",
        "d": "M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"
      },
      {
        "t": "path",
        "d": "m14 16-3 3 3 3"
      },
      {
        "t": "path",
        "d": "M8.293 13.596 7.196 9.5 3.1 10.598"
      },
      {
        "t": "path",
        "d": "m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"
      },
      {
        "t": "path",
        "d": "m13.378 9.633 4.096 1.098 1.097-4.096"
      }
    ]
  },
  {
    "id": "trash",
    "category": "pack",
    "ru": "Мусор",
    "en": "Trash",
    "glyphs": [
      {
        "t": "path",
        "d": "M10 11v6"
      },
      {
        "t": "path",
        "d": "M14 11v6"
      },
      {
        "t": "path",
        "d": "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
      },
      {
        "t": "path",
        "d": "M3 6h18"
      },
      {
        "t": "path",
        "d": "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      }
    ]
  },
  {
    "id": "weight",
    "category": "pack",
    "ru": "Вес",
    "en": "Weight",
    "glyphs": [
      {
        "t": "circle",
        "cx": "12",
        "cy": "5",
        "r": "3"
      },
      {
        "t": "path",
        "d": "M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z"
      }
    ]
  },
  {
    "id": "arrow-up",
    "category": "arrow",
    "ru": "Стрелка вверх",
    "en": "Arrow up",
    "glyphs": [
      {
        "t": "path",
        "d": "m5 12 7-7 7 7"
      },
      {
        "t": "path",
        "d": "M12 19V5"
      }
    ]
  },
  {
    "id": "arrow-down",
    "category": "arrow",
    "ru": "Стрелка вниз",
    "en": "Arrow down",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 5v14"
      },
      {
        "t": "path",
        "d": "m19 12-7 7-7-7"
      }
    ]
  },
  {
    "id": "arrow-left",
    "category": "arrow",
    "ru": "Стрелка влево",
    "en": "Arrow left",
    "glyphs": [
      {
        "t": "path",
        "d": "m12 19-7-7 7-7"
      },
      {
        "t": "path",
        "d": "M19 12H5"
      }
    ]
  },
  {
    "id": "arrow-right",
    "category": "arrow",
    "ru": "Стрелка вправо",
    "en": "Arrow right",
    "glyphs": [
      {
        "t": "path",
        "d": "M5 12h14"
      },
      {
        "t": "path",
        "d": "m12 5 7 7-7 7"
      }
    ]
  },
  {
    "id": "arrow-up-right",
    "category": "arrow",
    "ru": "Стрелка наискосок",
    "en": "Arrow up right",
    "glyphs": [
      {
        "t": "path",
        "d": "M7 7h10v10"
      },
      {
        "t": "path",
        "d": "M7 17 17 7"
      }
    ]
  },
  {
    "id": "move-up",
    "category": "arrow",
    "ru": "Верх",
    "en": "This side up",
    "glyphs": [
      {
        "t": "path",
        "d": "M8 6L12 2L16 6"
      },
      {
        "t": "path",
        "d": "M12 2V22"
      }
    ]
  },
  {
    "id": "move-down",
    "category": "arrow",
    "ru": "Низ",
    "en": "This side down",
    "glyphs": [
      {
        "t": "path",
        "d": "M8 18L12 22L16 18"
      },
      {
        "t": "path",
        "d": "M12 2V22"
      }
    ]
  },
  {
    "id": "corner-down-right",
    "category": "arrow",
    "ru": "Поворот",
    "en": "Turn",
    "glyphs": [
      {
        "t": "path",
        "d": "m15 10 5 5-5 5"
      },
      {
        "t": "path",
        "d": "M4 4v7a4 4 0 0 0 4 4h12"
      }
    ]
  },
  {
    "id": "undo-2",
    "category": "arrow",
    "ru": "Возврат",
    "en": "Return",
    "glyphs": [
      {
        "t": "path",
        "d": "M9 14 4 9l5-5"
      },
      {
        "t": "path",
        "d": "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"
      }
    ]
  },
  {
    "id": "tag",
    "category": "mark",
    "ru": "Бирка",
    "en": "Tag",
    "glyphs": [
      {
        "t": "path",
        "d": "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
      },
      {
        "t": "circle",
        "cx": "7.5",
        "cy": "7.5",
        "r": ".5"
      }
    ]
  },
  {
    "id": "bookmark",
    "category": "mark",
    "ru": "Закладка",
    "en": "Bookmark",
    "glyphs": [
      {
        "t": "path",
        "d": "M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"
      }
    ]
  },
  {
    "id": "flag",
    "category": "mark",
    "ru": "Флаг",
    "en": "Flag",
    "glyphs": [
      {
        "t": "path",
        "d": "M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"
      }
    ]
  },
  {
    "id": "hash",
    "category": "mark",
    "ru": "Номер",
    "en": "Number sign",
    "glyphs": [
      {
        "t": "line",
        "x1": "4",
        "y1": "9",
        "x2": "20",
        "y2": "9"
      },
      {
        "t": "line",
        "x1": "4",
        "y1": "15",
        "x2": "20",
        "y2": "15"
      },
      {
        "t": "line",
        "x1": "10",
        "y1": "3",
        "x2": "8",
        "y2": "21"
      },
      {
        "t": "line",
        "x1": "16",
        "y1": "3",
        "x2": "14",
        "y2": "21"
      }
    ]
  },
  {
    "id": "calendar",
    "category": "mark",
    "ru": "Календарь",
    "en": "Calendar",
    "glyphs": [
      {
        "t": "path",
        "d": "M8 2v3"
      },
      {
        "t": "path",
        "d": "M16 2v3"
      },
      {
        "t": "rect",
        "x": "3",
        "y": "3",
        "width": "18",
        "height": "18",
        "rx": "2"
      },
      {
        "t": "path",
        "d": "M3 9h18"
      }
    ]
  },
  {
    "id": "clock",
    "category": "mark",
    "ru": "Часы",
    "en": "Clock",
    "glyphs": [
      {
        "t": "circle",
        "cx": "12",
        "cy": "12",
        "r": "10"
      },
      {
        "t": "path",
        "d": "M12 6v6l4 2"
      }
    ]
  },
  {
    "id": "map-pin",
    "category": "mark",
    "ru": "Место",
    "en": "Place",
    "glyphs": [
      {
        "t": "path",
        "d": "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
      },
      {
        "t": "circle",
        "cx": "12",
        "cy": "10",
        "r": "3"
      }
    ]
  },
  {
    "id": "qr-code",
    "category": "mark",
    "ru": "QR",
    "en": "QR",
    "glyphs": [
      {
        "t": "rect",
        "x": "3",
        "y": "3",
        "width": "5",
        "height": "5",
        "rx": "1"
      },
      {
        "t": "rect",
        "x": "16",
        "y": "3",
        "width": "5",
        "height": "5",
        "rx": "1"
      },
      {
        "t": "rect",
        "x": "3",
        "y": "16",
        "width": "5",
        "height": "5",
        "rx": "1"
      },
      {
        "t": "path",
        "d": "M21 16h-3a2 2 0 0 0-2 2v3"
      },
      {
        "t": "path",
        "d": "M21 21v.01"
      },
      {
        "t": "path",
        "d": "M12 7v3a2 2 0 0 1-2 2H7"
      },
      {
        "t": "path",
        "d": "M3 12h.01"
      },
      {
        "t": "path",
        "d": "M12 3h.01"
      },
      {
        "t": "path",
        "d": "M12 16v.01"
      },
      {
        "t": "path",
        "d": "M16 12h1"
      },
      {
        "t": "path",
        "d": "M21 12v.01"
      },
      {
        "t": "path",
        "d": "M12 21v-1"
      }
    ]
  },
  {
    "id": "barcode",
    "category": "mark",
    "ru": "Штрихкод",
    "en": "Barcode",
    "glyphs": [
      {
        "t": "path",
        "d": "M3 5v14"
      },
      {
        "t": "path",
        "d": "M8 5v14"
      },
      {
        "t": "path",
        "d": "M12 5v14"
      },
      {
        "t": "path",
        "d": "M17 5v14"
      },
      {
        "t": "path",
        "d": "M21 5v14"
      }
    ]
  },
  {
    "id": "star",
    "category": "mark",
    "ru": "Звезда",
    "en": "Star",
    "glyphs": [
      {
        "t": "path",
        "d": "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
      }
    ]
  },
  {
    "id": "heart",
    "category": "mark",
    "ru": "Сердце",
    "en": "Heart",
    "glyphs": [
      {
        "t": "path",
        "d": "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"
      }
    ]
  },
  {
    "id": "check",
    "category": "mark",
    "ru": "Галочка",
    "en": "Check",
    "glyphs": [
      {
        "t": "path",
        "d": "M20 6 9 17l-5-5"
      }
    ]
  },
  {
    "id": "x",
    "category": "mark",
    "ru": "Крестик",
    "en": "Cross",
    "glyphs": [
      {
        "t": "path",
        "d": "M18 6 6 18"
      },
      {
        "t": "path",
        "d": "m6 6 12 12"
      }
    ]
  },
  {
    "id": "camera",
    "category": "tech",
    "ru": "Камера",
    "en": "Camera",
    "glyphs": [
      {
        "t": "path",
        "d": "M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"
      },
      {
        "t": "circle",
        "cx": "12",
        "cy": "13",
        "r": "3"
      }
    ]
  },
  {
    "id": "video",
    "category": "tech",
    "ru": "Видео",
    "en": "Video",
    "glyphs": [
      {
        "t": "path",
        "d": "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"
      },
      {
        "t": "rect",
        "x": "2",
        "y": "6",
        "width": "14",
        "height": "12",
        "rx": "2"
      }
    ]
  },
  {
    "id": "wifi",
    "category": "tech",
    "ru": "Wi‑Fi",
    "en": "Wi-Fi",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 20h.01"
      },
      {
        "t": "path",
        "d": "M2 8.82a15 15 0 0 1 20 0"
      },
      {
        "t": "path",
        "d": "M5 12.859a10 10 0 0 1 14 0"
      },
      {
        "t": "path",
        "d": "M8.5 16.429a5 5 0 0 1 7 0"
      }
    ]
  },
  {
    "id": "bluetooth",
    "category": "tech",
    "ru": "Bluetooth",
    "en": "Bluetooth",
    "glyphs": [
      {
        "t": "path",
        "d": "m7 7 10 10-5 5V2l5 5L7 17"
      }
    ]
  },
  {
    "id": "battery",
    "category": "tech",
    "ru": "Батарея",
    "en": "Battery",
    "glyphs": [
      {
        "t": "path",
        "d": "M 22 14 L 22 10"
      },
      {
        "t": "rect",
        "x": "2",
        "y": "6",
        "width": "16",
        "height": "12",
        "rx": "2"
      }
    ]
  },
  {
    "id": "battery-charging",
    "category": "tech",
    "ru": "Зарядка",
    "en": "Charging",
    "glyphs": [
      {
        "t": "path",
        "d": "m11 7-3 5h4l-3 5"
      },
      {
        "t": "path",
        "d": "M14.856 6H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.935"
      },
      {
        "t": "path",
        "d": "M22 14v-4"
      },
      {
        "t": "path",
        "d": "M5.14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.936"
      }
    ]
  },
  {
    "id": "plug",
    "category": "tech",
    "ru": "Вилка",
    "en": "Plug",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 22v-5"
      },
      {
        "t": "path",
        "d": "M15 8V2"
      },
      {
        "t": "path",
        "d": "M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z"
      },
      {
        "t": "path",
        "d": "M9 8V2"
      }
    ]
  },
  {
    "id": "cpu",
    "category": "tech",
    "ru": "Чип",
    "en": "Chip",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 20v2"
      },
      {
        "t": "path",
        "d": "M12 2v2"
      },
      {
        "t": "path",
        "d": "M17 20v2"
      },
      {
        "t": "path",
        "d": "M17 2v2"
      },
      {
        "t": "path",
        "d": "M2 12h2"
      },
      {
        "t": "path",
        "d": "M2 17h2"
      },
      {
        "t": "path",
        "d": "M2 7h2"
      },
      {
        "t": "path",
        "d": "M20 12h2"
      },
      {
        "t": "path",
        "d": "M20 17h2"
      },
      {
        "t": "path",
        "d": "M20 7h2"
      },
      {
        "t": "path",
        "d": "M7 20v2"
      },
      {
        "t": "path",
        "d": "M7 2v2"
      },
      {
        "t": "rect",
        "x": "4",
        "y": "4",
        "width": "16",
        "height": "16",
        "rx": "2"
      },
      {
        "t": "rect",
        "x": "8",
        "y": "8",
        "width": "8",
        "height": "8",
        "rx": "1"
      }
    ]
  },
  {
    "id": "printer",
    "category": "tech",
    "ru": "Принтер",
    "en": "Printer",
    "glyphs": [
      {
        "t": "path",
        "d": "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
      },
      {
        "t": "path",
        "d": "M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"
      },
      {
        "t": "rect",
        "x": "6",
        "y": "14",
        "width": "12",
        "height": "8",
        "rx": "1"
      }
    ]
  },
  {
    "id": "smartphone",
    "category": "tech",
    "ru": "Телефон",
    "en": "Phone",
    "glyphs": [
      {
        "t": "rect",
        "x": "5",
        "y": "2",
        "width": "14",
        "height": "20",
        "rx": "2"
      },
      {
        "t": "path",
        "d": "M12 18h.01"
      }
    ]
  },
  {
    "id": "headphones",
    "category": "tech",
    "ru": "Наушники",
    "en": "Headphones",
    "glyphs": [
      {
        "t": "path",
        "d": "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"
      }
    ]
  },
  {
    "id": "lightbulb",
    "category": "tech",
    "ru": "Лампа",
    "en": "Lamp",
    "glyphs": [
      {
        "t": "path",
        "d": "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"
      },
      {
        "t": "path",
        "d": "M9 18h6"
      },
      {
        "t": "path",
        "d": "M10 22h4"
      }
    ]
  },
  {
    "id": "thermometer",
    "category": "weather",
    "ru": "Температура",
    "en": "Temperature",
    "glyphs": [
      {
        "t": "path",
        "d": "M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"
      }
    ]
  },
  {
    "id": "thermometer-sun",
    "category": "weather",
    "ru": "Жара",
    "en": "Heat",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 2v2"
      },
      {
        "t": "path",
        "d": "M12 8a4 4 0 0 0-1.645 7.647"
      },
      {
        "t": "path",
        "d": "M2 12h2"
      },
      {
        "t": "path",
        "d": "M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"
      },
      {
        "t": "path",
        "d": "m4.93 4.93 1.41 1.41"
      },
      {
        "t": "path",
        "d": "m6.34 17.66-1.41 1.41"
      }
    ]
  },
  {
    "id": "thermometer-snowflake",
    "category": "weather",
    "ru": "Холод",
    "en": "Cold",
    "glyphs": [
      {
        "t": "path",
        "d": "m10 20-1.25-2.5L6 18"
      },
      {
        "t": "path",
        "d": "M10 4 8.75 6.5 6 6"
      },
      {
        "t": "path",
        "d": "M10.585 15H10"
      },
      {
        "t": "path",
        "d": "M2 12h6.5L10 9"
      },
      {
        "t": "path",
        "d": "M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"
      },
      {
        "t": "path",
        "d": "m4 10 1.5 2L4 14"
      },
      {
        "t": "path",
        "d": "m7 21 3-6-1.5-3"
      },
      {
        "t": "path",
        "d": "m7 3 3 6h2"
      }
    ]
  },
  {
    "id": "sun",
    "category": "weather",
    "ru": "Солнце",
    "en": "Sun",
    "glyphs": [
      {
        "t": "circle",
        "cx": "12",
        "cy": "12",
        "r": "4"
      },
      {
        "t": "path",
        "d": "M12 2v2"
      },
      {
        "t": "path",
        "d": "M12 20v2"
      },
      {
        "t": "path",
        "d": "m4.93 4.93 1.41 1.41"
      },
      {
        "t": "path",
        "d": "m17.66 17.66 1.41 1.41"
      },
      {
        "t": "path",
        "d": "M2 12h2"
      },
      {
        "t": "path",
        "d": "M20 12h2"
      },
      {
        "t": "path",
        "d": "m6.34 17.66-1.41 1.41"
      },
      {
        "t": "path",
        "d": "m19.07 4.93-1.41 1.41"
      }
    ]
  },
  {
    "id": "moon",
    "category": "weather",
    "ru": "Луна",
    "en": "Moon",
    "glyphs": [
      {
        "t": "path",
        "d": "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
      }
    ]
  },
  {
    "id": "cloud",
    "category": "weather",
    "ru": "Облако",
    "en": "Cloud",
    "glyphs": [
      {
        "t": "path",
        "d": "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
      }
    ]
  },
  {
    "id": "cloud-rain",
    "category": "weather",
    "ru": "Дождь",
    "en": "Rain",
    "glyphs": [
      {
        "t": "path",
        "d": "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"
      },
      {
        "t": "path",
        "d": "M16 14v6"
      },
      {
        "t": "path",
        "d": "M8 14v6"
      },
      {
        "t": "path",
        "d": "M12 16v6"
      }
    ]
  },
  {
    "id": "snowflake",
    "category": "weather",
    "ru": "Снег",
    "en": "Snow",
    "glyphs": [
      {
        "t": "path",
        "d": "m10 20-1.25-2.5L6 18"
      },
      {
        "t": "path",
        "d": "M10 4 8.75 6.5 6 6"
      },
      {
        "t": "path",
        "d": "m14 20 1.25-2.5L18 18"
      },
      {
        "t": "path",
        "d": "m14 4 1.25 2.5L18 6"
      },
      {
        "t": "path",
        "d": "m17 21-3-6h-4"
      },
      {
        "t": "path",
        "d": "m17 3-3 6 1.5 3"
      },
      {
        "t": "path",
        "d": "M2 12h6.5L10 9"
      },
      {
        "t": "path",
        "d": "m20 10-1.5 2 1.5 2"
      },
      {
        "t": "path",
        "d": "M22 12h-6.5L14 15"
      },
      {
        "t": "path",
        "d": "m4 10 1.5 2L4 14"
      },
      {
        "t": "path",
        "d": "m7 21 3-6-1.5-3"
      },
      {
        "t": "path",
        "d": "m7 3 3 6h4"
      }
    ]
  },
  {
    "id": "droplet",
    "category": "weather",
    "ru": "Капля",
    "en": "Drop",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"
      }
    ]
  },
  {
    "id": "flame",
    "category": "weather",
    "ru": "Огонь",
    "en": "Fire",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"
      }
    ]
  },
  {
    "id": "wind",
    "category": "weather",
    "ru": "Ветер",
    "en": "Wind",
    "glyphs": [
      {
        "t": "path",
        "d": "M12.8 19.6A2 2 0 1 0 14 16H2"
      },
      {
        "t": "path",
        "d": "M17.5 8a2.5 2.5 0 1 1 2 4H2"
      },
      {
        "t": "path",
        "d": "M9.8 4.4A2 2 0 1 1 11 8H2"
      }
    ]
  },
  {
    "id": "umbrella",
    "category": "weather",
    "ru": "Беречь от влаги",
    "en": "Keep dry",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 13v7a2 2 0 0 0 4 0"
      },
      {
        "t": "path",
        "d": "M12 2v2"
      },
      {
        "t": "path",
        "d": "M20.992 13a1 1 0 0 0 .97-1.274 10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z"
      }
    ]
  },
  {
    "id": "shopping-cart",
    "category": "shop",
    "ru": "Корзина",
    "en": "Cart",
    "glyphs": [
      {
        "t": "path",
        "d": "m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18"
      },
      {
        "t": "path",
        "d": "M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25"
      },
      {
        "t": "circle",
        "cx": "18",
        "cy": "20",
        "r": "2"
      },
      {
        "t": "circle",
        "cx": "8",
        "cy": "20",
        "r": "2"
      }
    ]
  },
  {
    "id": "shopping-bag",
    "category": "shop",
    "ru": "Пакет",
    "en": "Bag",
    "glyphs": [
      {
        "t": "path",
        "d": "M16 10a4 4 0 0 1-8 0"
      },
      {
        "t": "path",
        "d": "M3.103 6.034h17.794"
      },
      {
        "t": "path",
        "d": "M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"
      }
    ]
  },
  {
    "id": "store",
    "category": "shop",
    "ru": "Магазин",
    "en": "Store",
    "glyphs": [
      {
        "t": "path",
        "d": "M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"
      },
      {
        "t": "path",
        "d": "M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"
      },
      {
        "t": "path",
        "d": "M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"
      }
    ]
  },
  {
    "id": "gift",
    "category": "shop",
    "ru": "Подарок",
    "en": "Gift",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 7v14"
      },
      {
        "t": "path",
        "d": "M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"
      },
      {
        "t": "path",
        "d": "M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"
      },
      {
        "t": "rect",
        "x": "3",
        "y": "7",
        "width": "18",
        "height": "4",
        "rx": "1"
      }
    ]
  },
  {
    "id": "truck",
    "category": "shop",
    "ru": "Доставка",
    "en": "Delivery",
    "glyphs": [
      {
        "t": "path",
        "d": "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"
      },
      {
        "t": "path",
        "d": "M15 18H9"
      },
      {
        "t": "path",
        "d": "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"
      },
      {
        "t": "circle",
        "cx": "17",
        "cy": "18",
        "r": "2"
      },
      {
        "t": "circle",
        "cx": "7",
        "cy": "18",
        "r": "2"
      }
    ]
  },
  {
    "id": "circle-check",
    "category": "mark",
    "ru": "Готово",
    "en": "Done",
    "glyphs": [
      {
        "t": "circle",
        "cx": "12",
        "cy": "12",
        "r": "10"
      },
      {
        "t": "path",
        "d": "m16 9-5.5 5.5L8 12"
      }
    ]
  },
  {
    "id": "circle-x",
    "category": "mark",
    "ru": "Брак",
    "en": "Reject",
    "glyphs": [
      {
        "t": "circle",
        "cx": "12",
        "cy": "12",
        "r": "10"
      },
      {
        "t": "path",
        "d": "m15 9-6 6"
      },
      {
        "t": "path",
        "d": "m9 9 6 6"
      }
    ]
  },
  {
    "id": "plus",
    "category": "mark",
    "ru": "Плюс",
    "en": "Plus",
    "glyphs": [
      {
        "t": "path",
        "d": "M5 12h14"
      },
      {
        "t": "path",
        "d": "M12 5v14"
      }
    ]
  },
  {
    "id": "minus",
    "category": "mark",
    "ru": "Минус",
    "en": "Minus",
    "glyphs": [
      {
        "t": "path",
        "d": "M5 12h14"
      }
    ]
  },
  {
    "id": "award",
    "category": "mark",
    "ru": "Награда",
    "en": "Award",
    "glyphs": [
      {
        "t": "path",
        "d": "m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"
      },
      {
        "t": "circle",
        "cx": "12",
        "cy": "8",
        "r": "6"
      }
    ]
  },
  {
    "id": "gem",
    "category": "mark",
    "ru": "Качество",
    "en": "Quality",
    "glyphs": [
      {
        "t": "path",
        "d": "M10.5 3 8 9l4 13 4-13-2.5-6"
      },
      {
        "t": "path",
        "d": "M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"
      },
      {
        "t": "path",
        "d": "M2 9h20"
      }
    ]
  },
  {
    "id": "leaf",
    "category": "nature",
    "ru": "Лист",
    "en": "Leaf",
    "glyphs": [
      {
        "t": "path",
        "d": "M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20"
      },
      {
        "t": "path",
        "d": "M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13"
      }
    ]
  },
  {
    "id": "flower-2",
    "category": "nature",
    "ru": "Цветок",
    "en": "Flower",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"
      },
      {
        "t": "circle",
        "cx": "12",
        "cy": "8",
        "r": "2"
      },
      {
        "t": "path",
        "d": "M12 10v12"
      },
      {
        "t": "path",
        "d": "M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"
      },
      {
        "t": "path",
        "d": "M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"
      }
    ]
  },
  {
    "id": "tree-pine",
    "category": "nature",
    "ru": "Дерево",
    "en": "Tree",
    "glyphs": [
      {
        "t": "path",
        "d": "m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"
      },
      {
        "t": "path",
        "d": "M12 22v-3"
      }
    ]
  },
  {
    "id": "paw-print",
    "category": "nature",
    "ru": "Лапа",
    "en": "Paw",
    "glyphs": [
      {
        "t": "circle",
        "cx": "11",
        "cy": "4",
        "r": "2"
      },
      {
        "t": "circle",
        "cx": "18",
        "cy": "8",
        "r": "2"
      },
      {
        "t": "circle",
        "cx": "20",
        "cy": "16",
        "r": "2"
      },
      {
        "t": "path",
        "d": "M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"
      }
    ]
  },
  {
    "id": "wrench",
    "category": "tool",
    "ru": "Ключ",
    "en": "Wrench",
    "glyphs": [
      {
        "t": "path",
        "d": "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"
      }
    ]
  },
  {
    "id": "hammer",
    "category": "tool",
    "ru": "Молоток",
    "en": "Hammer",
    "glyphs": [
      {
        "t": "path",
        "d": "m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"
      },
      {
        "t": "path",
        "d": "m18 15 4-4"
      },
      {
        "t": "path",
        "d": "m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"
      }
    ]
  },
  {
    "id": "scissors",
    "category": "tool",
    "ru": "Ножницы",
    "en": "Scissors",
    "glyphs": [
      {
        "t": "circle",
        "cx": "6",
        "cy": "6",
        "r": "3"
      },
      {
        "t": "path",
        "d": "M8.12 8.12 12 12"
      },
      {
        "t": "path",
        "d": "M20 4 8.12 15.88"
      },
      {
        "t": "circle",
        "cx": "6",
        "cy": "18",
        "r": "3"
      },
      {
        "t": "path",
        "d": "M14.8 14.8 20 20"
      }
    ]
  },
  {
    "id": "pen",
    "category": "tool",
    "ru": "Ручка",
    "en": "Pen",
    "glyphs": [
      {
        "t": "path",
        "d": "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
      }
    ]
  },
  {
    "id": "pencil",
    "category": "tool",
    "ru": "Карандаш",
    "en": "Pencil",
    "glyphs": [
      {
        "t": "path",
        "d": "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
      },
      {
        "t": "path",
        "d": "m15 5 4 4"
      }
    ]
  },
  {
    "id": "ruler",
    "category": "tool",
    "ru": "Линейка",
    "en": "Ruler",
    "glyphs": [
      {
        "t": "path",
        "d": "M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"
      },
      {
        "t": "path",
        "d": "m14.5 12.5 2-2"
      },
      {
        "t": "path",
        "d": "m11.5 9.5 2-2"
      },
      {
        "t": "path",
        "d": "m8.5 6.5 2-2"
      },
      {
        "t": "path",
        "d": "m17.5 15.5 2-2"
      }
    ]
  },
  {
    "id": "paintbrush",
    "category": "tool",
    "ru": "Кисть",
    "en": "Brush",
    "glyphs": [
      {
        "t": "path",
        "d": "m14.622 17.897-10.68-2.913"
      },
      {
        "t": "path",
        "d": "M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z"
      },
      {
        "t": "path",
        "d": "M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15"
      }
    ]
  },
  {
    "id": "user",
    "category": "people",
    "ru": "Человек",
    "en": "Person",
    "glyphs": [
      {
        "t": "path",
        "d": "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
      },
      {
        "t": "circle",
        "cx": "12",
        "cy": "7",
        "r": "4"
      }
    ]
  },
  {
    "id": "baby",
    "category": "people",
    "ru": "Ребёнок",
    "en": "Child",
    "glyphs": [
      {
        "t": "path",
        "d": "M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"
      },
      {
        "t": "path",
        "d": "M15 12h.01"
      },
      {
        "t": "path",
        "d": "M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"
      },
      {
        "t": "path",
        "d": "M9 12h.01"
      }
    ]
  },
  {
    "id": "utensils",
    "category": "shop",
    "ru": "Еда",
    "en": "Food",
    "glyphs": [
      {
        "t": "path",
        "d": "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"
      },
      {
        "t": "path",
        "d": "M7 2v20"
      },
      {
        "t": "path",
        "d": "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"
      }
    ]
  },
  {
    "id": "coffee",
    "category": "shop",
    "ru": "Кофе",
    "en": "Coffee",
    "glyphs": [
      {
        "t": "path",
        "d": "M10 2v2"
      },
      {
        "t": "path",
        "d": "M14 2v2"
      },
      {
        "t": "path",
        "d": "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"
      },
      {
        "t": "path",
        "d": "M6 2v2"
      }
    ]
  },
  {
    "id": "apple",
    "category": "shop",
    "ru": "Яблоко",
    "en": "Apple",
    "glyphs": [
      {
        "t": "path",
        "d": "M12 6.528V3a1 1 0 0 1 1-1h0"
      },
      {
        "t": "path",
        "d": "M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"
      }
    ]
  },
  {
    "id": "wine",
    "category": "pack",
    "ru": "Хрупкое стекло",
    "en": "Fragile glass",
    "glyphs": [
      {
        "t": "path",
        "d": "M8 22h8"
      },
      {
        "t": "path",
        "d": "M7 10h10"
      },
      {
        "t": "path",
        "d": "M12 15v7"
      },
      {
        "t": "path",
        "d": "M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"
      }
    ]
  },
  {
    "id": "house",
    "category": "mark",
    "ru": "Дом",
    "en": "Home",
    "glyphs": [
      {
        "t": "path",
        "d": "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"
      },
      {
        "t": "path",
        "d": "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      }
    ]
  },
  {
    "id": "key",
    "category": "tool",
    "ru": "Ключ от замка",
    "en": "Key",
    "glyphs": [
      {
        "t": "path",
        "d": "m2 21 9.6-9.6"
      },
      {
        "t": "path",
        "d": "m7.5 15.5 2.3 2.3a1 1 0 0 1 0 1.4l-2.1 2.1a1 1 0 0 1-1.4 0L4 19"
      },
      {
        "t": "circle",
        "cx": "15.5",
        "cy": "7.5",
        "r": "5.5"
      }
    ]
  },
  {
    "id": "lock",
    "category": "mark",
    "ru": "Замок",
    "en": "Lock",
    "glyphs": [
      {
        "t": "rect",
        "x": "3",
        "y": "11",
        "width": "18",
        "height": "11",
        "rx": "2"
      },
      {
        "t": "path",
        "d": "M7 11V7a5 5 0 0 1 10 0v4"
      }
    ]
  },
  {
    "id": "lock-open",
    "category": "mark",
    "ru": "Открыто",
    "en": "Unlocked",
    "glyphs": [
      {
        "t": "rect",
        "x": "3",
        "y": "11",
        "width": "18",
        "height": "11",
        "rx": "2"
      },
      {
        "t": "path",
        "d": "M7 11V7a5 5 0 0 1 9.9-1"
      }
    ]
  },
  {
    "id": "eye",
    "category": "mark",
    "ru": "Смотреть",
    "en": "Look",
    "glyphs": [
      {
        "t": "path",
        "d": "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
      },
      {
        "t": "circle",
        "cx": "12",
        "cy": "12",
        "r": "3"
      }
    ]
  },
  {
    "id": "bell",
    "category": "mark",
    "ru": "Звонок",
    "en": "Bell",
    "glyphs": [
      {
        "t": "path",
        "d": "M10.268 21a2 2 0 0 0 3.464 0"
      },
      {
        "t": "path",
        "d": "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
      }
    ]
  },
  {
    "id": "mail",
    "category": "mark",
    "ru": "Почта",
    "en": "Mail",
    "glyphs": [
      {
        "t": "path",
        "d": "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"
      },
      {
        "t": "rect",
        "x": "2",
        "y": "4",
        "width": "20",
        "height": "16",
        "rx": "2"
      }
    ]
  },
  {
    "id": "phone",
    "category": "tech",
    "ru": "Звонок",
    "en": "Call",
    "glyphs": [
      {
        "t": "path",
        "d": "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"
      }
    ]
  },
  {
    "id": "percent",
    "category": "shop",
    "ru": "Скидка",
    "en": "Discount",
    "glyphs": [
      {
        "t": "line",
        "x1": "19",
        "y1": "5",
        "x2": "5",
        "y2": "19"
      },
      {
        "t": "circle",
        "cx": "6.5",
        "cy": "6.5",
        "r": "2.5"
      },
      {
        "t": "circle",
        "cx": "17.5",
        "cy": "17.5",
        "r": "2.5"
      }
    ]
  },
  {
    "id": "fragile",
    "category": "pack",
    "ru": "Хрупкое",
    "en": "Fragile",
    "glyphs": [
      {
        "t": "path",
        "d": "M8 3h8l-1.4 6.5a3.4 3.4 0 0 1-5.2 0Z"
      },
      {
        "t": "path",
        "d": "M12 13.2V17.5"
      },
      {
        "t": "path",
        "d": "M8.5 21h7"
      }
    ]
  },
  {
    "id": "this-side-up",
    "category": "pack",
    "ru": "Верх коробки",
    "en": "This side up",
    "glyphs": [
      {
        "t": "path",
        "d": "M8 13V6M5.2 8.2 8 5.4l2.8 2.8"
      },
      {
        "t": "path",
        "d": "M16 13V6M13.2 8.2 16 5.4l2.8 2.8"
      },
      {
        "t": "path",
        "d": "M4 17h16M4 20.5h16"
      }
    ]
  },
  {
    "id": "no-stack",
    "category": "pack",
    "ru": "Не ставить друг на друга",
    "en": "Do not stack",
    "glyphs": [
      {
        "t": "path",
        "d": "M4 6h16v4H4zM6 13h12v4H6zM6 4.5 18 19.5"
      }
    ]
  },
  {
    "id": "laurel",
    "category": "mark",
    "ru": "Лавр",
    "en": "Laurel",
    "filled": true,
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 120\"><g fill=\"#111\"><rect x=\"22\" y=\"4\" width=\"4\" height=\"112\" rx=\"2\"/><ellipse cx=\"14\" cy=\"24\" rx=\"11\" ry=\"5\" transform=\"rotate(-42 14 24)\"/><ellipse cx=\"34\" cy=\"24\" rx=\"11\" ry=\"5\" transform=\"rotate(42 34 24)\"/><ellipse cx=\"12\" cy=\"44\" rx=\"12\" ry=\"5\" transform=\"rotate(-50 12 44)\"/><ellipse cx=\"36\" cy=\"44\" rx=\"12\" ry=\"5\" transform=\"rotate(50 36 44)\"/><ellipse cx=\"13\" cy=\"64\" rx=\"11\" ry=\"5\" transform=\"rotate(-46 13 64)\"/><ellipse cx=\"35\" cy=\"64\" rx=\"11\" ry=\"5\" transform=\"rotate(46 35 64)\"/><ellipse cx=\"15\" cy=\"84\" rx=\"10\" ry=\"4.5\" transform=\"rotate(-36 15 84)\"/><ellipse cx=\"33\" cy=\"84\" rx=\"10\" ry=\"4.5\" transform=\"rotate(36 33 84)\"/><ellipse cx=\"18\" cy=\"100\" rx=\"8\" ry=\"4\" transform=\"rotate(-28 18 100)\"/><ellipse cx=\"30\" cy=\"100\" rx=\"8\" ry=\"4\" transform=\"rotate(28 30 100)\"/></g></svg>"
  },
  {
    "id": "drone",
    "category": "tech",
    "ru": "Дрон",
    "en": "Drone",
    "glyphs": [
      {
        "t": "circle",
        "cx": "12",
        "cy": "12",
        "r": "2.2"
      },
      {
        "t": "path",
        "d": "M12 9.5V6M12 14.5V18M9.5 12H6M14.5 12H18"
      },
      {
        "t": "circle",
        "cx": "5",
        "cy": "5",
        "r": "2"
      },
      {
        "t": "circle",
        "cx": "19",
        "cy": "5",
        "r": "2"
      },
      {
        "t": "circle",
        "cx": "5",
        "cy": "19",
        "r": "2"
      },
      {
        "t": "circle",
        "cx": "19",
        "cy": "19",
        "r": "2"
      },
      {
        "t": "path",
        "d": "M6.4 6.4 9.2 9.2M17.6 6.4 14.8 9.2M6.4 17.6 9.2 14.8M17.6 17.6 14.8 14.8"
      }
    ]
  }
]

function attrs(glyph: SymbolGlyph, ink: string, filled: boolean): string {
  const stroke = filled ? 'none' : ink
  const fill = filled ? ink : 'none'
  const parts = [`stroke="${stroke}"`, `fill="${fill}"`, 'stroke-width="2"', 'stroke-linecap="round"', 'stroke-linejoin="round"']
  for (const key of ['d', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'points'] as const) {
    const value = glyph[key]
    if (value) parts.push(`${key}="${value}"`)
  }
  return parts.join(' ')
}

export function symbolSvg(icon: SymbolIcon, ink = '#000000'): string {
  if (icon.svg) return icon.svg.replaceAll('#111', ink)
  const body = (icon.glyphs ?? [])
    .map((glyph) => `<${glyph.t} ${attrs(glyph, ink, !!icon.filled)} />`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}

export function iconById(id: string): SymbolIcon | undefined {
  return SYMBOLS.find((icon) => icon.id === id)
}

export function searchSymbols(query: string, category: string): SymbolIcon[] {
  const q = query.trim().toLowerCase()
  return SYMBOLS.filter((icon) => {
    if (category && category !== 'all' && icon.category !== category) return false
    if (!q) return true
    return icon.ru.toLowerCase().includes(q) || icon.en.toLowerCase().includes(q) || icon.id.includes(q)
  })
}
