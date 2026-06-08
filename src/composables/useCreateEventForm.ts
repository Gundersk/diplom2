/**
 * Состояние формы создания/редактирования события: даты, валидация, цвет фона.
 * Опции полей — в data/createEventFormOptions.ts, сохранение события — в useEventGalleryApp.
 */
import { computed, ref, watch } from 'vue'
import { ACTIVE_AUTOMATIC_TEMPLATE_IDS } from '../services/automaticAchievementService'
import {
  DEFAULT_CREATE_TIMEZONE_ID,
  formatTimezoneLabel,
  getDefaultRsvpStyleId,
  softBackgroundColors,
  titleStyleOptions,
} from '../data/createEventFormOptions'
import type { BackgroundMediaType, CreateEventForm } from '../types/event'
import {
  buildDateTimeFromParts,
  createDefaultEndParts,
  filterHoursFrom,
  filterMinutesFrom,
  getNowParts,
  hourOptions,
  minuteOptions,
} from '../utils/createEventDateTime'
import { isValidEventTitle, isValidUserName } from '../utils/textLimits'

export type CreateEventFormAssetDefaults = {
  coverAssetId: string
  backgroundAssetId: string
  backgroundMediaType: BackgroundMediaType
}

export function buildEmptyCreateEventForm(
  hostAlias: string,
  assets: CreateEventFormAssetDefaults,
): CreateEventForm {
  const now = getNowParts()
  const endDefault = createDefaultEndParts(now.date, now.hour, now.minute)

  return {
    title: '',
    titleStyle: titleStyleOptions[0].id,
    description: '',
    startDate: now.date,
    startHour: now.hour,
    startMinute: now.minute,
    endDate: endDefault.date,
    endHour: endDefault.hour,
    endMinute: endDefault.minute,
    timezone: DEFAULT_CREATE_TIMEZONE_ID,
    hostAlias,
    location: '',
    participantLimit: '',
    coverAssetId: assets.coverAssetId,
    backgroundAssetId: assets.backgroundAssetId,
    backgroundMode: 'asset',
    backgroundMediaType: assets.backgroundMediaType,
    backgroundColor: softBackgroundColors[0],
    textTheme: 'light',
    uploadedCoverUrl: null,
    uploadedBackgroundUrl: null,
    infoBlocks: [],
    paymentEnabled: false,
    costPerPerson: '',
    paymentDestination: '',
    paymentComment: '',
    allowGuestInvites: false,
    rsvpStyle: getDefaultRsvpStyleId(),
    automaticExpanded: false,
    personalExpanded: false,
    groupExpanded: false,
    automaticTemplateIds: [...ACTIVE_AUTOMATIC_TEMPLATE_IDS],
    selectedPersonalTemplateIds: [],
    selectedGroupTemplateIds: [],
    templateVisibility: {},
  }
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const sat = saturation / 100
  const light = lightness / 100
  const chroma = sat * Math.min(light, 1 - light)
  const channel = (offset: number) => {
    const segment = (offset + hue / 30) % 12
    const color = light - chroma * Math.max(Math.min(segment - 3, 9 - segment, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }

  return `#${channel(0)}${channel(8)}${channel(4)}`
}

function hexToHsl(hex: string) {
  const normalized = hex.replace('#', '')
  const source =
    normalized.length === 3
      ? normalized
          .split('')
          .map((item) => item + item)
          .join('')
      : normalized
  const red = Number.parseInt(source.slice(0, 2), 16) / 255
  const green = Number.parseInt(source.slice(2, 4), 16) / 255
  const blue = Number.parseInt(source.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0
  const lightness = (max + min) / 2
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))

  if (delta !== 0) {
    switch (max) {
      case red:
        hue = ((green - blue) / delta) % 6
        break
      case green:
        hue = (blue - red) / delta + 2
        break
      default:
        hue = (red - green) / delta + 4
        break
    }
    hue *= 60
    if (hue < 0) hue += 360
  }

  return {
    h: Math.round(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  }
}

export type UseCreateEventFormDeps = {
  getHostAlias: () => string
  getAssetDefaults: () => CreateEventFormAssetDefaults
}

export function useCreateEventForm(deps: UseCreateEventFormDeps) {
  const createEventForm = ref<CreateEventForm>(
    buildEmptyCreateEventForm(deps.getHostAlias(), deps.getAssetDefaults()),
  )
  const backgroundColorHue = ref(28)

  function resetForm() {
    createEventForm.value = buildEmptyCreateEventForm(deps.getHostAlias(), deps.getAssetDefaults())
  }

  function clampEndDateTime() {
    if (!createEventForm.value.startDate || !createEventForm.value.endDate) return

    if (createEventForm.value.endDate < createEventForm.value.startDate) {
      createEventForm.value.endDate = createEventForm.value.startDate
    }

    if (createEventForm.value.endDate === createEventForm.value.startDate) {
      if (Number(createEventForm.value.endHour) < Number(createEventForm.value.startHour)) {
        createEventForm.value.endHour = createEventForm.value.startHour
      }
      if (
        createEventForm.value.endHour === createEventForm.value.startHour &&
        Number(createEventForm.value.endMinute) < Number(createEventForm.value.startMinute)
      ) {
        createEventForm.value.endMinute = createEventForm.value.startMinute
      }
    }
  }

  function enforceCreateDateTimeRules() {
    clampEndDateTime()
  }

  const startDateTime = computed(() =>
    buildDateTimeFromParts(
      createEventForm.value.startDate,
      createEventForm.value.startHour,
      createEventForm.value.startMinute,
    ),
  )

  const endDateTime = computed(() =>
    buildDateTimeFromParts(
      createEventForm.value.endDate,
      createEventForm.value.endHour,
      createEventForm.value.endMinute,
    ),
  )

  const endBeforeStart = computed(
    () => new Date(endDateTime.value).getTime() < new Date(startDateTime.value).getTime(),
  )

  const canSaveEvent = computed(
    () =>
      isValidEventTitle(createEventForm.value.title) &&
      isValidUserName(createEventForm.value.hostAlias || deps.getHostAlias()) &&
      Boolean(createEventForm.value.startDate) &&
      Boolean(createEventForm.value.endDate) &&
      !endBeforeStart.value,
  )

  const availableEndHours = computed(() => {
    if (!createEventForm.value.endDate) return hourOptions
    if (createEventForm.value.endDate > createEventForm.value.startDate) return hourOptions
    return filterHoursFrom(createEventForm.value.startHour)
  })

  const availableEndMinutes = computed(() => {
    if (!createEventForm.value.endDate || createEventForm.value.endDate > createEventForm.value.startDate) {
      return minuteOptions
    }
    if (Number(createEventForm.value.endHour) > Number(createEventForm.value.startHour)) return minuteOptions
    return filterMinutesFrom(createEventForm.value.startMinute)
  })

  const previewTimezoneLabel = computed(() => formatTimezoneLabel(createEventForm.value.timezone))

  watch(
    () => [
      createEventForm.value.startDate,
      createEventForm.value.startHour,
      createEventForm.value.startMinute,
    ],
    () => {
      clampEndDateTime()
    },
  )

  watch(
    () => [
      createEventForm.value.endDate,
      createEventForm.value.endHour,
      createEventForm.value.endMinute,
    ],
    () => {
      clampEndDateTime()
    },
  )

  function applyBackgroundColor(color: string) {
    createEventForm.value.backgroundColor = color
    const hsl = hexToHsl(color)
    backgroundColorHue.value = hsl.h
  }

  function updateBackgroundFromHue() {
    createEventForm.value.backgroundColor = hslToHex(backgroundColorHue.value, 68, 88)
  }

  function setCreatePaymentEnabled(enabled: boolean) {
    createEventForm.value.paymentEnabled = enabled

    if (!enabled) {
      createEventForm.value.costPerPerson = ''
      createEventForm.value.paymentDestination = ''
      createEventForm.value.paymentComment = ''
    }
  }

  return {
    createEventForm,
    backgroundColorHue,
    resetForm,
    enforceCreateDateTimeRules,
    applyBackgroundColor,
    updateBackgroundFromHue,
    setCreatePaymentEnabled,
    hourOptions,
    minuteOptions,
    availableEndHours,
    availableEndMinutes,
    startDateTime,
    endDateTime,
    endBeforeStart,
    canSaveEvent,
    previewTimezoneLabel,
  }
}
