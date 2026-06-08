/**
 * Утилиты даты и времени для формы создания события.
 * Работают с локальным календарём и строками формата YYYY-MM-DD / HH:MM.
 */
export function padNumber(value: number) {
  return String(value).padStart(2, '0')
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getNowParts() {
  const now = new Date()
  return {
    date: getLocalDateString(now),
    hour: padNumber(now.getHours()),
    minute: padNumber(now.getMinutes()),
  }
}

/** Конец события по умолчанию — через 4 часа после начала. */
export function createDefaultEndParts(startDate: string, startHour: string, startMinute: string) {
  const endDate = new Date(`${startDate}T${startHour}:${startMinute}:00`)
  endDate.setHours(endDate.getHours() + 4)

  return {
    date: getLocalDateString(endDate),
    hour: padNumber(endDate.getHours()),
    minute: padNumber(endDate.getMinutes()),
  }
}

export function buildDateTimeFromParts(date: string, hour: string, minute: string) {
  return `${date}T${hour}:${minute}`
}

export const hourOptions = Array.from({ length: 24 }, (_, index) => padNumber(index))
export const minuteOptions = Array.from({ length: 60 }, (_, index) => padNumber(index))

export function filterHoursFrom(minHour: string, hours: readonly string[] = hourOptions) {
  return hours.filter((hour) => Number(hour) >= Number(minHour))
}

export function filterMinutesFrom(minMinute: string, minutes: readonly string[] = minuteOptions) {
  return minutes.filter((minute) => Number(minute) >= Number(minMinute))
}
