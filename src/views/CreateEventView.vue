<script setup lang="ts">
// Форма создания и редактирования события: поля, обложка, фон, RSVP и медали.
import { useEventGallery } from '../composables/eventGalleryContext'

const app = useEventGallery()
</script>

<template>
  <main
    class="create-page-shell"
    :class="[app.getEventTextThemeClass(app.createResolvedTextTheme), app.getEventBackgroundScrimClassForForm()]"
  >
    <div class="create-page-background" :style="app.createBackgroundStyle">
      <video
        v-if="app.createEventForm.backgroundMode === 'asset' && app.selectedBackgroundAsset?.kind === 'video'"
        class="create-background-video"
        :src="app.selectedBackgroundAsset.src"
        autoplay
        muted
        loop
        playsinline
      ></video>
      <div class="create-page-glass"></div>
    </div>

    <header class="create-topbar" aria-label="Создание события">
      <a class="brand home-brand" href="#" aria-label="Создание события — Галерея событий" @click.prevent="app.closeCreateEvent">
        <span class="brand-mark">EG</span>
        <span>Галерея событий</span>
      </a>
      <div class="create-topbar-actions">
        <button class="secondary-button compact-action" type="button" @click="app.closeCreateEvent">
          {{ app.editingEventId ? 'Назад' : 'На главную' }}
        </button>
      </div>
    </header>

    <section class="create-canvas">
      <form class="create-stream" @submit.prevent="app.saveEvent">
        <p v-if="app.editingEventId" class="create-mode-note">Редактирование события</p>
        <section id="create-core" class="create-primary-card create-theme-surface">
          <textarea
            v-model="app.createEventForm.title"
            class="title-input"
            :class="app.getTitleStyleClass(app.createEventForm.titleStyle)"
            rows="1"
            :maxlength="app.EVENT_TITLE_MAX_LENGTH"
            placeholder="Событие без названия"
            required
          ></textarea>
          <div class="title-style-row">
            <button
              v-for="option in app.titleStyleOptions"
              :key="option.id"
              class="title-style-chip"
              :class="{ active: app.createEventForm.titleStyle === option.id }"
              type="button"
              @click="app.createEventForm.titleStyle = option.id"
            >
              {{ option.label }}
            </button>
          </div>

          <div class="create-core-stack">
            <div class="datetime-card">
              <label class="stream-field">
                <span>Дата начала</span>
                <input v-model="app.createEventForm.startDate" type="date" required />
              </label>
              <div class="time-select-card">
                <span>Время начала</span>
                <div class="time-select-row">
                  <select v-model="app.createEventForm.startHour" class="time-select">
                    <option v-for="hour in app.hourOptions" :key="`start-hour-${hour}`" :value="hour">
                      {{ hour }}
                    </option>
                  </select>
                  <span class="time-divider">:</span>
                  <select v-model="app.createEventForm.startMinute" class="time-select">
                    <option v-for="minute in app.minuteOptions" :key="`start-minute-${minute}`" :value="minute">
                      {{ minute }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div class="datetime-card optional-field">
              <label class="stream-field">
                <span>Дата окончания</span>
                <input v-model="app.createEventForm.endDate" :min="app.createEventForm.startDate" type="date" />
              </label>
              <div class="time-select-card">
                <span>Время окончания</span>
                <div class="time-select-row">
                  <select v-model="app.createEventForm.endHour" class="time-select">
                    <option v-for="hour in app.availableEndHours" :key="`end-hour-${hour}`" :value="hour">
                      {{ hour }}
                    </option>
                  </select>
                  <span class="time-divider">:</span>
                  <select v-model="app.createEventForm.endMinute" class="time-select">
                    <option v-for="minute in app.availableEndMinutes" :key="`end-minute-${minute}`" :value="minute">
                      {{ minute }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <label class="stream-field host-field">
              <span>Проводит</span>
              <div class="stream-inline-row">
                <div class="stream-avatar-card">
                  <span
                    class="stream-avatar"
                    :class="{ filled: app.hasCurrentUserAvatarVisual() }"
                    :style="app.getAvatarStyle(app.getCurrentUserAvatarUrlForDocuments(), app.currentUser.avatarFileId || app.currentUser.updatedAt)"
                  >
                    {{ app.hasCurrentUserAvatarVisual() ? '' : app.currentUser.initials }}
                  </span>
                </div>
                <input
                  v-model="app.createEventForm.hostAlias"
                  type="text"
                  placeholder="Имя организатора"
                  :maxlength="app.USER_NAME_MAX_LENGTH"
                />
              </div>
            </label>
            <label class="stream-field">
              <span>Часовой пояс</span>
              <select v-model="app.createEventForm.timezone" class="timezone-select">
                <option v-for="timezone in app.russianTimezoneOptions" :key="timezone.id" :value="timezone.id">
                  {{ timezone.label }}
                </option>
              </select>
            </label>
            <label class="stream-field">
              <span>Место</span>
              <input v-model="app.createEventForm.location" type="text" placeholder="Где пройдет событие?" />
            </label>
            <label class="stream-field">
              <span>Максимум участников</span>
              <input
                v-model="app.createEventForm.participantLimit"
                type="number"
                min="1"
                placeholder="Без ограничения"
              />
            </label>
            <section class="payment-shell">
              <div class="payment-switch-row">
                <span>Платность события</span>
                <div class="payment-switcher">
                  <button
                    class="payment-switch-option"
                    :class="{ active: !app.createEventForm.paymentEnabled }"
                    type="button"
                    @click="app.setCreatePaymentEnabled(false)"
                  >
                    Бесплатно
                  </button>
                  <button
                    class="payment-switch-option"
                    :class="{ active: app.createEventForm.paymentEnabled }"
                    type="button"
                    @click="app.setCreatePaymentEnabled(true)"
                  >
                    Платно
                  </button>
                </div>
              </div>

              <div v-if="app.createEventForm.paymentEnabled" class="payment-fields-grid">
                <label class="stream-field">
                  <span>Стоимость с человека</span>
                  <input v-model="app.createEventForm.costPerPerson" type="text" placeholder="300 ₽" />
                </label>
                <label class="stream-field">
                  <span>Куда переводить</span>
                  <input v-model="app.createEventForm.paymentDestination" type="text" placeholder="Сбер +7..." />
                </label>
                <label class="stream-field">
                  <span>Комментарий к оплате</span>
                  <input v-model="app.createEventForm.paymentComment" type="text" placeholder="Например, за еду и аренду" />
                </label>
              </div>
            </section>

            <label class="stream-inline-toggle">
              <input v-model="app.createEventForm.allowGuestInvites" type="checkbox" />
              <span>Гости могут приглашать других</span>
            </label>

            <p v-if="app.endBeforeStart" class="validation-note">
              Окончание не может быть раньше начала.
            </p>
          </div>
        </section>

        <section id="create-links" class="create-panel-shell">
          <div class="quick-tag-row">
            <button
              v-for="option in app.quickInfoOptions"
              :key="option.value"
              class="quick-tag-chip"
              type="button"
              @click="
                app.createEventForm.infoBlocks = [
                  ...app.createEventForm.infoBlocks,
                  { id: app.createId('block'), type: option.value, icon: option.emoji, title: option.label, description: '', link: '' },
                ]
              "
            >
              + {{ option.label }}
            </button>
            <button
              class="quick-tag-chip"
              type="button"
              @click="
                app.createEventForm.infoBlocks = [
                  ...app.createEventForm.infoBlocks,
                  { id: app.createId('block'), type: 'other', icon: '📝', title: '', description: '', link: '' },
                ]
              "
            >
              + Свой тег
            </button>
          </div>

          <div v-if="app.createEventForm.infoBlocks.length" class="inline-info-editor">
            <article v-for="block in app.createEventForm.infoBlocks" :key="block.id" class="inline-tag-card">
              <div class="inline-tag-head">
                <span class="tag-icon">{{ block.icon }}</span>
                <template v-if="block.type === 'other'">
                  <input v-model="block.title" type="text" placeholder="Название тега" />
                </template>
                <strong v-else>{{ block.title }}</strong>
                <button class="ghost-inline-button" type="button" @click="app.removeInfoBlock(block.id)">×</button>
              </div>
              <input v-model="block.link" type="url" placeholder="Вставьте ссылку" />
            </article>
          </div>
        </section>

        <section id="create-description" class="create-panel-shell create-panel-soft create-theme-surface">
          <label class="description-area">
            <textarea
              v-model="app.createEventForm.description"
              rows="4"
              placeholder="Описание события"
            ></textarea>
          </label>
        </section>

        <section id="create-achievements" class="create-panel-shell achievement-stream-section">
          <article class="achievement-block-shell" :class="{ collapsed: !app.createEventForm.automaticExpanded }">
            <div class="achievement-block-header">
              <button
                class="accordion-button"
                type="button"
                @click="app.createEventForm.automaticExpanded = !app.createEventForm.automaticExpanded"
              >
                Автоматические достижения
              </button>
              <div class="selected-pill-row">
                <div
                  v-for="template in app.selectedAutomaticTemplates"
                  :key="template.id"
                  class="selected-pill-wrap"
                >
                  <button
                    class="selected-achievement-pill"
                    :style="{ '--medal-tone': template.tone }"
                    :data-achievement-popover-key="app.getCreateAchievementKey('automatic', template.id)"
                    type="button"
                    @click="app.toggleCreateAchievementPopover(app.getCreateAchievementKey('automatic', template.id), $event)"
                  >
                    <span class="selected-pill-icon">{{ template.icon }}</span>
                    <span class="selected-pill-text">{{ template.title }}</span>
                  </button>
                  <button
                    class="selected-pill-remove"
                    type="button"
                    @click.stop="app.removeSelectedAchievement(template.id, 'automatic')"
                  >
                    ×
                  </button>
                </div>
              </div>
              <button
                class="achievement-collapse-button"
                type="button"
                @click="app.createEventForm.automaticExpanded = !app.createEventForm.automaticExpanded"
              >
                {{ app.createEventForm.automaticExpanded ? '–' : '+' }}
              </button>
            </div>

            <div v-if="app.createEventForm.automaticExpanded" class="achievement-available-list">
              <article
                v-for="template in app.availableAutomaticTemplates"
                :key="template.id"
                class="available-achievement-card"
                :class="{
                  'is-hint': template.visibility === 'hint',
                  'is-hidden': template.visibility === 'hidden',
                }"
              >
                <span class="available-achievement-icon" :style="{ '--medal-tone': template.tone }">
                  {{ template.icon }}
                </span>
                <div class="available-achievement-copy">
                  <strong>{{ template.title }}</strong>
                  <p>{{ template.description }}</p>
                  <small v-if="template.visibility === 'hint'" class="achievement-visibility-note">Условие скрыто</small>
                  <small v-else-if="template.visibility === 'hidden'" class="achievement-visibility-note">Полностью скрыто</small>
                </div>
                <div class="available-achievement-actions">
                  <button class="secondary-button compact-action wide" type="button" @click="app.toggleAutomaticTemplate(template.id)">
                    Выбрать
                  </button>
                </div>
              </article>
              <p v-if="!app.availableAutomaticTemplates.length" class="achievement-empty-note">
                Все автоматические достижения уже выбраны.
              </p>
            </div>
          </article>

          <article class="achievement-block-shell" :class="{ collapsed: !app.createEventForm.personalExpanded }">
            <div class="achievement-block-header">
              <button
                class="accordion-button"
                type="button"
                @click="app.createEventForm.personalExpanded = !app.createEventForm.personalExpanded"
              >
                Личные медали
              </button>
              <div class="selected-pill-row">
                <div
                  v-for="template in app.selectedPersonalTemplates"
                  :key="template.id"
                  class="selected-pill-wrap"
                >
                  <button
                    class="selected-achievement-pill"
                    :style="{ '--medal-tone': template.tone }"
                    :data-achievement-popover-key="app.getCreateAchievementKey('personal', template.id)"
                    type="button"
                    @click="app.toggleCreateAchievementPopover(app.getCreateAchievementKey('personal', template.id), $event)"
                  >
                    <span class="selected-pill-icon">{{ template.icon }}</span>
                    <span class="selected-pill-text">{{ template.title }}</span>
                  </button>
                  <button
                    class="selected-pill-remove"
                    type="button"
                    @click.stop="app.removeSelectedAchievement(template.id, 'personal')"
                  >
                    ×
                  </button>
                </div>
              </div>
              <button
                class="achievement-collapse-button"
                type="button"
                @click="app.createEventForm.personalExpanded = !app.createEventForm.personalExpanded"
              >
                {{ app.createEventForm.personalExpanded ? '–' : '+' }}
              </button>
            </div>

            <div v-if="app.createEventForm.personalExpanded" class="achievement-available-wrap">
              <div class="achievement-toolbar">
                <span class="achievement-toolbar-pill">Из шаблонов</span>
                <button class="ghost-button compact-action" type="button" @click="app.openMedalBuilder('personal')">
                  Создать
                </button>
              </div>

              <div class="achievement-available-list">
                <article
                  v-for="template in app.availablePersonalTemplates"
                  :key="template.id"
                  class="available-achievement-card"
                  :class="{
                    'is-hint': template.visibility === 'hint',
                    'is-hidden': template.visibility === 'hidden',
                  }"
                >
                  <span class="available-achievement-icon" :style="{ '--medal-tone': template.tone }">
                    {{ template.icon }}
                  </span>
                  <div class="available-achievement-copy">
                    <strong>{{ template.title }}</strong>
                    <p>{{ template.description }}</p>
                    <small v-if="template.visibility === 'hint'" class="achievement-visibility-note">Условие скрыто</small>
                    <small v-else-if="template.visibility === 'hidden'" class="achievement-visibility-note">Полностью скрыто</small>
                  </div>
                  <div class="available-achievement-actions">
                    <button class="secondary-button compact-action wide" type="button" @click="app.toggleManualTemplate(template.id, 'personal')">
                      Выбрать
                    </button>
                    <button class="template-delete-button" type="button" @click="app.deleteTemplate(template.id)">
                      Удалить
                    </button>
                  </div>
                </article>
                <p v-if="!app.availablePersonalTemplates.length" class="achievement-empty-note">
                  Пока пусто. Добавленные медали будут появляться здесь и удаляться по клику.
                </p>
              </div>
            </div>
          </article>

          <article class="achievement-block-shell" :class="{ collapsed: !app.createEventForm.groupExpanded }">
            <div class="achievement-block-header">
              <button
                class="accordion-button"
                type="button"
                @click="app.createEventForm.groupExpanded = !app.createEventForm.groupExpanded"
              >
                Групповые медали
              </button>
              <div class="selected-pill-row">
                <div
                  v-for="template in app.selectedGroupTemplates"
                  :key="template.id"
                  class="selected-pill-wrap"
                >
                  <button
                    class="selected-achievement-pill"
                    :style="{ '--medal-tone': template.tone }"
                    :data-achievement-popover-key="app.getCreateAchievementKey('group', template.id)"
                    type="button"
                    @click="app.toggleCreateAchievementPopover(app.getCreateAchievementKey('group', template.id), $event)"
                  >
                    <span class="selected-pill-icon">{{ template.icon }}</span>
                    <span class="selected-pill-text">{{ template.title }}</span>
                  </button>
                  <button
                    class="selected-pill-remove"
                    type="button"
                    @click.stop="app.removeSelectedAchievement(template.id, 'group')"
                  >
                    ×
                  </button>
                </div>
              </div>
              <button
                class="achievement-collapse-button"
                type="button"
                @click="app.createEventForm.groupExpanded = !app.createEventForm.groupExpanded"
              >
                {{ app.createEventForm.groupExpanded ? '–' : '+' }}
              </button>
            </div>

            <div v-if="app.createEventForm.groupExpanded" class="achievement-available-wrap">
              <div class="achievement-toolbar">
                <span class="achievement-toolbar-pill">Из шаблонов</span>
                <button class="ghost-button compact-action" type="button" @click="app.openMedalBuilder('group')">
                  Создать
                </button>
              </div>

              <div class="achievement-available-list">
                <article
                  v-for="template in app.availableGroupTemplates"
                  :key="template.id"
                  class="available-achievement-card"
                  :class="{
                    'is-hint': template.visibility === 'hint',
                    'is-hidden': template.visibility === 'hidden',
                  }"
                >
                  <span class="available-achievement-icon" :style="{ '--medal-tone': template.tone }">
                    {{ template.icon }}
                  </span>
                  <div class="available-achievement-copy">
                    <strong>{{ template.title }}</strong>
                    <p>{{ template.description }}</p>
                    <small v-if="template.visibility === 'hint'" class="achievement-visibility-note">Условие скрыто</small>
                    <small v-else-if="template.visibility === 'hidden'" class="achievement-visibility-note">Полностью скрыто</small>
                  </div>
                  <div class="available-achievement-actions">
                    <button class="secondary-button compact-action wide" type="button" @click="app.toggleManualTemplate(template.id, 'group')">
                      Выбрать
                    </button>
                    <button class="template-delete-button" type="button" @click="app.deleteTemplate(template.id)">
                      Удалить
                    </button>
                  </div>
                </article>
                <p v-if="!app.availableGroupTemplates.length" class="achievement-empty-note">
                  Здесь будут медали для всей компании.
                </p>
              </div>
            </div>
          </article>
        </section>

        <div class="create-submit-row">
          <button class="secondary-button" type="button" @click="app.closeCreateEvent">Назад</button>
          <button class="primary-button" :disabled="!app.canSaveEvent || app.eventSaveInProgress" type="submit">
            {{ app.eventSaveInProgress ? 'Сохранение…' : app.editingEventId ? 'Сохранить изменения' : 'Добавить событие' }}
          </button>
        </div>
      </form>

      <aside class="create-side-stage">
        <section id="create-cover" class="cover-stage">
          <button class="cover-change-button" type="button" @click="app.coverPickerOpen = true">
            <template v-if="app.selectedCoverAsset">
              <img
                class="cover-stage-image"
                :src="app.selectedCoverAsset.src"
                :alt="app.selectedCoverAsset.label"
                decoding="async"
              />
            </template>
            <span v-else class="cover-stage-fallback">Выбери обложку</span>
          </button>
          <p class="cover-stage-note">Нажми на картинку, чтобы выбрать другую обложку или загрузить свою.</p>
        </section>

        <section id="create-rsvp" class="rsvp-panel">
          <div class="rsvp-panel-head">
            <strong>Настройки RSVP</strong>
          </div>
          <div class="rsvp-style-row">
            <button
              v-for="option in app.rsvpStyleOptions"
              :key="option.id"
              class="rsvp-style-chip"
              :class="{ active: app.createEventForm.rsvpStyle === option.id }"
              type="button"
              @click="app.createEventForm.rsvpStyle = option.id"
            >
              <span>{{ option.emoji }}</span>
              {{ option.label }}
            </button>
          </div>
          <div class="rsvp-preview-row rsvp-preview-row-labeled" :data-style="app.createEventForm.rsvpStyle">
            <div
              v-for="choice in app.getRsvpChoices(app.createEventForm.rsvpStyle)"
              :key="`${app.createEventForm.rsvpStyle}-${choice.id}`"
              class="rsvp-preview-option"
            >
              <span class="rsvp-preview-bubble">{{ choice.symbol }}</span>
              <span class="rsvp-preview-option-label">{{ choice.label }}</span>
            </div>
          </div>
        </section>

        <section id="create-assets" class="asset-browser">
          <div class="asset-browser-group">
            <strong>Фон страницы</strong>
            <div class="background-mode-row">
              <button
                class="background-mode-button"
                :class="{ active: app.createEventForm.backgroundMode === 'asset' }"
                type="button"
                @click="app.createEventForm.backgroundMode = 'asset'; app.createEventForm.backgroundMediaType = app.getAssetBackgroundMediaType(app.getAssetById(app.backgroundAssetOptions, app.createEventForm.backgroundAssetId))"
              >
                Из подборки
              </button>
              <button
                class="background-mode-button"
                :class="{ active: app.createEventForm.backgroundMode === 'color' }"
                type="button"
                @click="app.createEventForm.backgroundMode = 'color'"
              >
                Цвет
              </button>
            </div>

            <div v-if="app.createEventForm.backgroundMode === 'asset'" class="asset-strip backgrounds">
              <button
                v-for="asset in app.backgroundAssetOptions"
                :key="asset.id"
                class="asset-thumb background-thumb"
                :class="{ active: app.createEventForm.backgroundAssetId === asset.id && !app.createEventForm.uploadedBackgroundUrl }"
                type="button"
                @click="app.selectPresetBackground(asset)"
              >
                <template v-if="asset.kind === 'image'">
                  <img :src="asset.src" :alt="asset.label" />
                </template>
                <template v-else>
                  <video :src="asset.src" muted autoplay loop playsinline></video>
                </template>
              </button>
            </div>
            <div v-else class="custom-color-panel">
              <div class="custom-color-head">
                <strong>Свой цвет</strong>
              </div>
              <div
                class="custom-color-preview"
                :style="{ background: app.createEventForm.backgroundColor }"
              ></div>
              <label class="custom-color-hue">
                <span>Оттенок</span>
                <input
                  v-model.number="app.backgroundColorHue"
                  class="hue-slider"
                  type="range"
                  min="0"
                  max="360"
                  @input="app.updateBackgroundFromHue"
                />
              </label>
              <div class="color-swatch-row">
                <button
                  v-for="color in app.softBackgroundColors"
                  :key="color"
                  class="color-swatch"
                  :class="{ active: app.createEventForm.backgroundColor === color }"
                  :style="{ background: color }"
                  type="button"
                  :aria-label="`Цвет ${color}`"
                  @click="app.applyBackgroundColor(color)"
                ></button>
              </div>
            </div>
            <label v-if="app.createEventForm.backgroundMode === 'asset'" class="upload-chip small">
              Свой фон
              <input
                type="file"
                accept="image/*,video/mp4,video/webm,.mp4,.webm"
                hidden
                @change="app.handleBackgroundUpload"
              />
            </label>
          </div>

          <div class="asset-browser-group text-theme-group">
            <strong>Тема текста</strong>
            <div class="text-theme-row">
              <button
                v-for="option in app.eventTextThemeOptions"
                :key="option.id"
                class="text-theme-chip"
                :class="{ active: app.createEventForm.textTheme === option.id }"
                type="button"
                @click="app.createEventForm.textTheme = option.id"
              >
                {{ option.label }}
              </button>
            </div>
            <p class="text-theme-hint">
              Сейчас: {{ app.getResolvedTextThemeLabel(app.createResolvedTextTheme) }}.
              Меняет цвет текста и лёгкую подложку блоков, не общий фон события.
            </p>
          </div>
        </section>
      </aside>

      <nav class="create-side-bar" aria-label="Быстрые действия">
        <button class="side-action-button" type="button" @click="app.scrollToCreateSection('create-assets')">
          <span>🎬</span>
          <small>Тема</small>
        </button>
        <button class="side-action-button" type="button" @click="app.scrollToCreateSection('create-rsvp')">
          <span>{{ app.getRsvpStyleOption(app.createEventForm.rsvpStyle).emoji }}</span>
          <small>RSVP</small>
        </button>
        <button class="side-action-button" type="button" @click="app.openGuestPreview">
          <span>👁</span>
          <small>Просмотр</small>
        </button>
      </nav>
    </section>

    <div v-if="app.coverPickerOpen" class="cover-picker-overlay" @click.self="app.coverPickerOpen = false">
      <section class="cover-picker-sheet" aria-modal="true" role="dialog" aria-labelledby="cover-picker-title">
        <button class="cover-picker-close" type="button" @click="app.coverPickerOpen = false">×</button>
        <div class="cover-picker-head">
          <h3 id="cover-picker-title">Выбор обложки</h3>
          <input
            v-model="app.coverSearchQuery"
            class="cover-search-input"
            type="text"
            placeholder="Найти картинку..."
          />
        </div>

        <div class="cover-picker-tabs" role="tablist" aria-label="Тип обложки">
          <button
            type="button"
            role="tab"
            class="cover-picker-tab"
            :class="{ active: app.coverPickerTab === 'posters' }"
            :aria-selected="app.coverPickerTab === 'posters'"
            @click="app.coverPickerTab = 'posters'"
          >
            Постеры
          </button>
          <button
            type="button"
            role="tab"
            class="cover-picker-tab"
            :class="{ active: app.coverPickerTab === 'gifs' }"
            :aria-selected="app.coverPickerTab === 'gifs'"
            @click="app.coverPickerTab = 'gifs'"
          >
            GIF
          </button>
        </div>

        <div v-if="app.activeCoverPickerAssets.length" class="cover-picker-section">
          <div class="cover-picker-grid">
            <button
              v-for="asset in app.activeCoverPickerAssets"
              :key="asset.id"
              class="cover-picker-tile"
              :class="{ active: app.createEventForm.coverAssetId === asset.id && !app.createEventForm.uploadedCoverUrl }"
              type="button"
              @click="app.selectPresetCover(asset.id)"
            >
              <img :src="asset.src" :alt="asset.label" decoding="async" />
            </button>
          </div>
        </div>
        <p v-else class="cover-picker-empty">Ничего не найдено. Попробуйте другой запрос.</p>

        <label class="cover-upload-tile">
          Загрузить свою обложку
          <input type="file" accept="image/*,.gif" hidden @change="app.handleCoverUpload" />
        </label>
      </section>
    </div>

    <div v-if="app.medalBuilderOpen" class="medal-builder-overlay" @click.self="app.medalBuilderOpen = false">
      <section class="medal-builder-dialog" aria-modal="true" role="dialog" aria-labelledby="medal-builder-title">
        <div class="section-title-row">
          <h3 id="medal-builder-title">{{ app.medalForm.scope === 'group' ? 'Групповая медаль' : 'Личная медаль' }}</h3>
          <button class="ghost-inline-button" type="button" @click="app.medalBuilderOpen = false">Закрыть</button>
        </div>

        <div class="form-field-grid">
          <label class="field-block field-span-2">
            <span>Название *</span>
            <input v-model="app.medalForm.title" type="text" placeholder="Например, Лучший образ" />
          </label>
          <label class="field-block field-span-2">
            <span>Описание *</span>
            <textarea v-model="app.medalForm.description" rows="3" placeholder="За что выдается эта медаль"></textarea>
          </label>
          <div class="field-block field-span-2 emoji-picker-field">
            <span>Эмодзи</span>
            <button
              class="emoji-picker-trigger"
              type="button"
              @click="app.emojiPickerOpen = !app.emojiPickerOpen"
            >
              <span class="emoji-picker-current">{{ app.medalForm.icon || '🏅' }}</span>
              <span>Выбрать эмодзи</span>
            </button>
            <div v-if="app.emojiPickerOpen" class="emoji-picker-popover">
              <emoji-picker class="medal-emoji-picker" @emoji-click="app.onEmojiPickerSelect"></emoji-picker>
            </div>
            <div class="emoji-quick-row">
              <button
                v-for="emoji in app.emojiPickerOptions"
                :key="emoji"
                class="emoji-picker-option"
                :class="{ active: app.medalForm.icon === emoji }"
                type="button"
                @click="app.medalForm.icon = emoji"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </div>

        <div class="medal-preview-row">
          <span class="medal-card-preview" :style="{ '--medal-tone': app.medalForm.tone }">
            {{ app.medalForm.icon || '🏅' }}
          </span>
          <div class="medal-preview-copy">
            <strong>{{ app.medalForm.title || 'Название медали' }}</strong>
            <p>{{ app.medalForm.description || 'Описание появится здесь.' }}</p>
          </div>
        </div>

        <div class="medal-tone-row">
          <span>Фон медали</span>
          <div class="tone-swatch-row">
            <button
              v-for="tone in app.medalToneOptions"
              :key="tone"
              class="tone-swatch"
              :class="{ active: app.medalForm.tone === tone }"
              :style="{ background: `linear-gradient(135deg, ${tone})` }"
              type="button"
              @click="app.medalForm.tone = tone"
            ></button>
            <label class="tone-color-picker" title="Свой цвет медали">
              <input
                type="color"
                :value="app.getMedalTonePrimary(app.medalForm.tone)"
                @input="app.setMedalToneFromColor(($event.target as HTMLInputElement).value)"
              />
              <span>Свой</span>
            </label>
          </div>
        </div>

        <div class="medal-visibility-row">
          <span>Видимость</span>
          <div class="medal-visibility-actions">
            <button
              class="secondary-button compact-action"
              :class="{ active: app.medalForm.visibility === 'visible' }"
              type="button"
              @click="app.medalForm.visibility = 'visible'"
            >
              Открытое
            </button>
            <button
              class="secondary-button compact-action"
              :class="{ active: app.medalForm.visibility === 'hint' }"
              type="button"
              @click="app.medalForm.visibility = 'hint'"
            >
              Скрыть условие
            </button>
            <button
              class="secondary-button compact-action"
              :class="{ active: app.medalForm.visibility === 'hidden' }"
              type="button"
              @click="app.medalForm.visibility = 'hidden'"
            >
              Скрыть полностью
            </button>
          </div>
        </div>

        <label class="toggle-card">
          <input v-model="app.medalForm.saveAsTemplate" type="checkbox" />
          <span>Сохранить как шаблон для будущих событий</span>
        </label>

        <div class="create-actions">
          <button class="secondary-button" type="button" @click="app.medalBuilderOpen = false">Отмена</button>
          <button class="primary-button" type="button" @click="app.saveCustomMedal">Сохранить медаль</button>
        </div>
      </section>
    </div>
  </main>
</template>
