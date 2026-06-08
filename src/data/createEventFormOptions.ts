/**
 * Справочники и значения по умолчанию для формы создания события.
 * Часовые пояса, стили RSVP/заголовка, типы инфо-блоков и палитра фона.
 */
import type { EventInfoBlockType, TimezoneOption } from '../types/event'

export const infoBlockTypeOptions: Array<{ emoji: string; label: string; value: EventInfoBlockType }> = [
  { value: 'dress-code', label: 'Дресс-код', emoji: '👔' },
  { value: 'playlist', label: 'Плейлист', emoji: '🎵' },
  { value: 'bring', label: 'Что взять', emoji: '👜' },
  { value: 'schedule', label: 'Расписание', emoji: '🕒' },
  { value: 'payment', label: 'Реквизиты', emoji: '💸' },
  { value: 'other', label: 'Другое', emoji: '📝' },
]

/** Быстрые кнопки добавления инфо-блока на форме. */
export const quickInfoOptions = infoBlockTypeOptions.filter((option) =>
  ['playlist', 'dress-code', 'bring'].includes(option.value),
)

export const rsvpStyleOptions = [
  { id: 'icons', label: 'Иконки', emoji: '👍' },
  { id: 'bloom', label: 'Цветение', emoji: '🌷' },
  { id: 'party', label: 'Вечеринка', emoji: '🎉' },
  { id: 'hearts', label: 'Сердечки', emoji: '💖' },
]

export const titleStyleOptions = [
  { id: 'classic', label: 'Классика' },
  { id: 'eclectic', label: 'Эклектика' },
  { id: 'fancy', label: 'Изящный' },
  { id: 'literary', label: 'Литературный' },
]

export const eventTextThemeOptions: Array<{ id: 'light' | 'dark'; label: string }> = [
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
]

export const russianTimezoneOptions: TimezoneOption[] = [
  { id: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { id: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { id: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { id: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { id: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { id: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { id: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { id: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { id: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { id: 'Asia/Sakhalin', label: 'Сахалин (UTC+11)' },
  { id: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { id: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
]

export const softBackgroundColors = [
  '#ffd8d8',
  '#ffdcb8',
  '#ffe8a8',
  '#d6f0b4',
  '#cdeee2',
  '#d9e8ff',
  '#e6dcff',
  '#f6d9f6',
]

export const DEFAULT_CREATE_TIMEZONE_ID = 'Asia/Yekaterinburg'

export function formatTimezoneLabel(timezoneId: string) {
  return (
    russianTimezoneOptions.find((option) => option.id === timezoneId)?.label ??
    russianTimezoneOptions[3].label
  )
}

export function getDefaultRsvpStyleId() {
  return rsvpStyleOptions[2]?.id ?? rsvpStyleOptions[0].id
}

export function getInfoBlockTypeLabel(type: EventInfoBlockType, fallbackTitle = '') {
  return infoBlockTypeOptions.find((option) => option.value === type)?.label ?? fallbackTitle
}
