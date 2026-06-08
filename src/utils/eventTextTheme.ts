/**
 * Выбор светлой/тёмной темы текста на карточке события.
 * Режим auto опирается на относительную яркость фона (WCAG relative luminance).
 */
import type { EventTextThemeSetting, GalleryEvent, ResolvedEventTextTheme } from '../types/event'

export type EventTextThemeSource = Pick<
  GalleryEvent,
  'textTheme' | 'backgroundMode' | 'backgroundColor' | 'backgroundStart' | 'backgroundMediaType' | 'backgroundLuminance'
>

/** Порог яркости: выше — тёмный текст, ниже — светлый. */
const LIGHT_TEXT_LUMINANCE_THRESHOLD = 0.55

function channelToLinear(channel: number) {
  const normalized = channel / 255
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

function getRelativeLuminance(red: number, green: number, blue: number) {
  const r = channelToLinear(red)
  const g = channelToLinear(green)
  const b = channelToLinear(blue)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function parseHexColor(value: string) {
  const normalized = value.trim().replace('#', '')
  if (!/^[0-9a-f]{3,8}$/i.test(normalized)) {
    return null
  }

  if (normalized.length === 3) {
    const [r, g, b] = normalized.split('')
    return {
      r: Number.parseInt(r + r, 16),
      g: Number.parseInt(g + g, 16),
      b: Number.parseInt(b + b, 16),
    }
  }

  if (normalized.length === 6 || normalized.length === 8) {
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    }
  }

  return null
}

function parseRgbColor(value: string) {
  const match = value.trim().match(/^rgba?\(([^)]+)\)$/i)
  if (!match) return null

  const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()))
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) {
    return null
  }

  return {
    r: parts[0],
    g: parts[1],
    b: parts[2],
  }
}

function parseHslColor(value: string) {
  const match = value.trim().match(/^hsla?\(([^)]+)\)$/i)
  if (!match) return null

  const parts = match[1].split(',').map((part) => part.trim())
  if (parts.length < 3) return null

  const hue = Number.parseFloat(parts[0])
  const saturation = Number.parseFloat(parts[1]) / 100
  const lightness = Number.parseFloat(parts[2]) / 100
  if ([hue, saturation, lightness].some((part) => Number.isNaN(part))) {
    return null
  }

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const huePrime = hue / 60
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1))
  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (huePrime >= 0 && huePrime < 1) {
    r1 = chroma
    g1 = x
  } else if (huePrime < 2) {
    r1 = x
    g1 = chroma
  } else if (huePrime < 3) {
    g1 = chroma
    b1 = x
  } else if (huePrime < 4) {
    g1 = x
    b1 = chroma
  } else if (huePrime < 5) {
    r1 = x
    b1 = chroma
  } else {
    r1 = chroma
    b1 = x
  }

  const matchValue = lightness - chroma / 2
  return {
    r: Math.round((r1 + matchValue) * 255),
    g: Math.round((g1 + matchValue) * 255),
    b: Math.round((b1 + matchValue) * 255),
  }
}

export function getColorLuminance(color?: string | null) {
  if (!color) return null

  const trimmed = color.trim()
  const rgb =
    (trimmed.startsWith('#') ? parseHexColor(trimmed) : null) ??
    parseRgbColor(trimmed) ??
    parseHslColor(trimmed)

  if (!rgb) return null

  return getRelativeLuminance(rgb.r, rgb.g, rgb.b)
}

function resolveBackgroundLuminance(event: EventTextThemeSource) {
  if (typeof event.backgroundLuminance === 'number' && Number.isFinite(event.backgroundLuminance)) {
    return event.backgroundLuminance
  }

  if (event.backgroundMode === 'color') {
    const luminance = getColorLuminance(event.backgroundColor || event.backgroundStart)
    if (luminance !== null) {
      return luminance
    }
  }

  if (event.backgroundStart?.startsWith('#')) {
    const luminance = getColorLuminance(event.backgroundStart)
    if (luminance !== null) {
      return luminance
    }
  }

  const rgbLuminance = getColorLuminance(event.backgroundStart)
  if (rgbLuminance !== null) {
    return rgbLuminance
  }

  // Для медиа-фона без явного цвета — усреднённая тёмная яркость
  if (
    event.backgroundMediaType === 'image' ||
    event.backgroundMediaType === 'gif' ||
    event.backgroundMediaType === 'video'
  ) {
    return 0.35
  }

  return null
}

function resolveAutoTextTheme(event: EventTextThemeSource): ResolvedEventTextTheme {
  const luminance = resolveBackgroundLuminance(event)
  if (luminance !== null) {
    return luminance >= LIGHT_TEXT_LUMINANCE_THRESHOLD ? 'dark' : 'light'
  }

  return 'light'
}

export function normalizeEventTextThemeSetting(value?: string | null): EventTextThemeSetting {
  if (value === 'light' || value === 'dark' || value === 'auto') {
    return value
  }
  return 'auto'
}

export function resolveEventTextTheme(event: EventTextThemeSource): ResolvedEventTextTheme {
  const setting = normalizeEventTextThemeSetting(event.textTheme)

  if (setting === 'light') {
    return 'light'
  }

  if (setting === 'dark') {
    return 'dark'
  }

  return resolveAutoTextTheme(event)
}

export function getEventTextThemeClass(theme: ResolvedEventTextTheme) {
  return theme === 'dark' ? 'event-text-dark' : 'event-text-light'
}

/** Затемнение/осветление общего фона — только от яркости фона, не от темы текста. */
export function getEventBackgroundScrimClass(event: EventTextThemeSource) {
  const luminance = resolveBackgroundLuminance(event)
  if (luminance !== null && luminance >= LIGHT_TEXT_LUMINANCE_THRESHOLD) {
    return 'event-bg-bright'
  }
  return 'event-bg-dark'
}
