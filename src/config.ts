/**
 * Локальная конфигурация копии проекта.
 * Frontend MVP работает без БД; строка ниже — для будущего backend.
 */
export const localAppUrl = import.meta.env.VITE_APP_URL ?? 'http://localhost:5180'

/**
 * Локальная строка подключения (не удалённый сервер).
 * SQL Server LocalDB — типичный вариант для диплома на Windows.
 */
export const databaseConnectionString =
  import.meta.env.VITE_DATABASE_URL ??
  'Server=(localdb)\\MSSQLLocalDB;Database=EventGallery_Local;Trusted_Connection=True;TrustServerCertificate=True'
