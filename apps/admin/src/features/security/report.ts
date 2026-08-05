/**
 * Курируемый отчёт о безопасности платформы OrzuX.
 *
 * Это честное описание реально реализованных механизмов защиты (в коде и
 * инфраструктуре). Статусы:
 *  - "active"       — реализовано и работает всегда (на уровне кода/БД);
 *  - "configurable" — реализовано, но включается настройкой ENV/провайдера;
 *  - "recommended"  — ещё не сделано, рекомендуется усилить.
 */

export type SecurityStatus = "active" | "configurable" | "recommended";

export type SecurityControl = {
  name: string;
  /** Для чего нужно. */
  purpose: string;
  /** Как реализовано. */
  how: string;
  status: SecurityStatus;
  /** Где в коде/инфраструктуре (для инженеров). */
  reference?: string;
};

export type SecurityCategory = {
  id: string;
  title: string;
  description: string;
  controls: SecurityControl[];
};

export const SECURITY_STATUS_LABEL: Record<SecurityStatus, string> = {
  active: "Активно",
  configurable: "Требует настройки",
  recommended: "Рекомендуется",
};

export const SECURITY_REPORT_INTRO =
  "Обзор того, как OrzuX защищает данные клиентов от взлома, мошенничества и атак. Ниже — какие механизмы используются, для чего и как они реализованы.";

export const SECURITY_CATEGORIES: SecurityCategory[] = [
  {
    id: "encryption",
    title: "Шифрование и секреты",
    description: "Как хранятся и защищаются токены, ключи и чувствительные данные.",
    controls: [
      {
        name: "Шифрование секретов AES-256-GCM",
        purpose:
          "Токены интеграций и API-ключи клиентов хранятся в БД в зашифрованном виде, а не открытым текстом.",
        how: "Симметричное шифрование AES-256-GCM с ключом ENCRYPTION_KEY. Значения шифруются перед записью и расшифровываются только на сервере.",
        status: "active",
        reference: "packages/secrets/src/crypto.ts",
      },
      {
        name: "Ротация ключа шифрования без даунтайма",
        purpose:
          "Позволяет менять мастер-ключ без простоя: новые данные шифруются новым ключом, старые ещё читаются предыдущим.",
        how: "Поддержка ENCRYPTION_KEY + ENCRYPTION_KEY_PREVIOUS и функция перешифровки всех секретов (скрипт rotate:secrets).",
        status: "active",
        reference: "packages/secrets/src/crypto.ts, scripts/rotate-secrets.ts",
      },
      {
        name: "Хранилище секретов с аудит-логом",
        purpose:
          "Централизованное управление ключами платформы с историей изменений (кто и когда менял).",
        how: "Раздел «API ключи» в админке пишет журнал доступа и изменений.",
        status: "active",
        reference: "apps/admin/src/features/secrets, @orzu/secrets",
      },
    ],
  },
  {
    id: "auth",
    title: "Аутентификация и доступ",
    description: "Кто и как получает доступ, и как изолированы данные разных бизнесов.",
    controls: [
      {
        name: "Supabase Auth",
        purpose: "Безопасный вход пользователей (email/пароль, magic link).",
        how: "Аутентификация и сессии через Supabase Auth с httpOnly-cookie.",
        status: "active",
      },
      {
        name: "Защита входа от перебора (CASA 1.1.1)",
        purpose:
          "Ограничение частоты попыток входа, временная блокировка после неудачных паролей, лимит с одного IP.",
        how: "Redis (Upstash): мин. 3 с между попытками на email, блокировка на 15 мин после 5 ошибок, до 30 попыток с IP / 15 мин; Cloudflare Turnstile на форме входа. В prod без Redis вход блокируется (fail-closed).",
        status: "configurable",
        reference:
          "src/lib/security/auth-brute-force.ts, src/features/auth/actions/sign-in-with-email.ts",
      },
      {
        name: "Защита OTP и сброса пароля (CASA 1.3.4)",
        purpose:
          "Ограничение перебора кодов подтверждения email и восстановления пароля.",
        how: "До 5 неверных проверок кода на email за 15 мин; не более 5 запросов сброса пароля в час на email.",
        status: "configurable",
        reference:
          "src/features/auth/actions/verify-email-otp.ts, verify-recovery-otp.ts, request-password-reset.ts",
      },
      {
        name: "CASA / ESOF evidence (аутентификация и сессии)",
        purpose:
          "Сопоставление требований аудита (1.1.x, 1.3.x, 2.x) с реализацией для загрузки доказательств.",
        how: "Таблица ID → статус → код/настройки Supabase.",
        status: "active",
        reference: "docs/security/casa-authentication-evidence.md",
      },
      {
        name: "Row Level Security (RLS)",
        purpose:
          "Изоляция арендаторов: один бизнес физически не может прочитать данные другого.",
        how: "Политики RLS на уровне PostgreSQL + автотесты изоляции арендаторов.",
        status: "active",
        reference: "supabase/migrations, tests/security/rls-isolation.test.ts",
      },
      {
        name: "Защита админ-панели",
        purpose:
          "Доступ к админке только у платформенных администраторов из таблицы platform_admins.",
        how: "Middleware проверяет пользователя и роль на каждый запрос; серверные экшены дополнительно требуют requirePlatformAdmin().",
        status: "active",
        reference: "apps/admin/src/middleware.ts, lib/supabase/server.ts",
      },
      {
        name: "Ревокация OAuth-токенов при отключении",
        purpose:
          "При отключении Google/Gmail refresh-токен отзывается, а не остаётся жить.",
        how: "Вызов revokeGoogleToken при disconnect Gmail и Google Calendar.",
        status: "active",
        reference: "src/lib/google/revoke.ts",
      },
    ],
  },
  {
    id: "webhooks",
    title: "Защита вебхуков и API",
    description: "Как отбиваются поддельные запросы и злоупотребления публичными эндпоинтами.",
    controls: [
      {
        name: "Проверка подписи/секрета вебхуков",
        purpose:
          "Гарантия, что входящие вебхуки действительно от Telegram, Twilio и Stripe, а не от злоумышленника.",
        how: "Проверка секрета Telegram, подписи Twilio и подписи Stripe до обработки запроса.",
        status: "active",
        reference: "src/app/api/webhooks/*, src/services/telegram.service.ts",
      },
      {
        name: "Timing-safe сравнение секретов",
        purpose:
          "Защита от timing-атак при сверке секретов (cron, вебхуки).",
        how: "Постоянное по времени сравнение (crypto.timingSafeEqual) вместо обычного ===.",
        status: "active",
        reference: "src/lib/cron/run-authorized-cron.ts",
      },
      {
        name: "Распределённый rate limiting",
        purpose:
          "Ограничение частоты запросов к публичным эндпоинтам (чат-виджет, запись, TTS) — защита от перебора и DoS.",
        how: "Лимиты по IP через Upstash Redis; общий helper checkRateLimit.",
        status: "configurable",
        reference: "src/lib/rate-limit/index.ts (нужен Upstash Redis)",
      },
    ],
  },
  {
    id: "bots",
    title: "Защита от ботов",
    description: "Как отсекаются автоматические регистрации и спам через публичные формы.",
    controls: [
      {
        name: "Cloudflare Turnstile",
        purpose:
          "Защита форм регистрации/входа и публичной записи от ботов и автоматических атак.",
        how: "Виджет Turnstile на клиенте + серверная проверка токена (fail-open, если ключи не заданы).",
        status: "configurable",
        reference:
          "src/lib/security/turnstile.ts (нужны NEXT_PUBLIC_TURNSTILE_SITE_KEY и TURNSTILE_SECRET_KEY)",
      },
    ],
  },
  {
    id: "storage",
    title: "Хранилище файлов",
    description: "Где и как хранятся медиа, записи и загрузки клиентов.",
    controls: [
      {
        name: "Cloudflare R2 с presigned URL",
        purpose:
          "Крупные файлы (медиа, голос, видео, логотипы) хранятся приватно; доступ выдаётся временными подписанными ссылками.",
        how: "S3-совместимый R2, приватные бакеты, presigned URL на скачивание/загрузку с ограниченным сроком жизни.",
        status: "configurable",
        reference: "src/lib/storage/r2.ts, src/lib/storage/media-storage.ts",
      },
      {
        name: "Разделение хранения данных",
        purpose:
          "Пользователи и их данные — в Supabase; крупные файлы — в R2. Меньше поверхность риска и egress-затрат.",
        how: "Провайдер-осознанные ссылки (префикс r2::) маршрутизируют операции в R2 или Supabase.",
        status: "active",
        reference: "src/utils/storage-ref.ts",
      },
    ],
  },
  {
    id: "data",
    title: "Данные и приватность",
    description: "Как соблюдаются приватность и корректная очистка данных.",
    controls: [
      {
        name: "Очистка данных при отключении канала",
        purpose:
          "При отключении канала связанные диалоги удаляются, чтобы не оставлять «висящие» данные клиентов.",
        how: "purgeChannelConversations вызывается во всех сценариях disconnect.",
        status: "active",
      },
      {
        name: "Google Limited Use disclosure",
        purpose:
          "Соответствие политике Google по использованию пользовательских данных.",
        how: "Раздел о работе с данными Google добавлен в юридические страницы.",
        status: "active",
        reference: "Legal pages",
      },
    ],
  },
  {
    id: "infra",
    title: "Инфраструктура и мониторинг",
    description: "Транспорт, наблюдаемость и контроль качества релизов.",
    controls: [
      {
        name: "HTTPS и хостинг",
        purpose: "Шифрование трафика и защищённая доставка приложения.",
        how: "Развёртывание на Vercel с TLS и edge-CDN для статики.",
        status: "active",
      },
      {
        name: "Аудит-лог действий администраторов",
        purpose: "Прозрачность: кто из админов что сделал.",
        how: "Журнал действий с фильтрами и экспортом в разделе «Аудит».",
        status: "active",
        reference: "apps/admin/src/features/audit",
      },
      {
        name: "Мониторинг ошибок (Error Intelligence)",
        purpose: "Раннее обнаружение сбоев и подозрительной активности.",
        how: "Сбор и анализ ошибок в разделе Errors админки.",
        status: "active",
        reference: "apps/admin/src/features/error-intelligence",
      },
      {
        name: "CI с проверками безопасности",
        purpose: "Не допускать регрессий: типы, линт и security-тесты на каждый PR.",
        how: "GitHub Actions запускает typecheck, lint и тесты (включая RLS и auth вебхуков).",
        status: "active",
        reference: ".github/workflows/ci.yml",
      },
    ],
  },
];

export type SecurityRecommendation = {
  title: string;
  detail: string;
};

export const SECURITY_RECOMMENDATIONS: SecurityRecommendation[] = [
  {
    title: "Заголовки безопасности (CSP, HSTS)",
    detail:
      "Добавить строгие HTTP-заголовки (Content-Security-Policy, HSTS, X-Frame-Options) для защиты от XSS и clickjacking.",
  },
  {
    title: "Двухфакторная аутентификация (2FA)",
    detail:
      "Включить 2FA для администраторов платформы и предложить её бизнес-владельцам.",
  },
  {
    title: "Плановая ротация ключей",
    detail:
      "Регламент периодической ротации ENCRYPTION_KEY и ключей интеграций (раз в квартал/полгода).",
  },
  {
    title: "Оповещения о подозрительной активности",
    detail:
      "Алерты на всплески неудачных входов, срабатываний rate-limit и ошибок вебхуков.",
  },
];

export function summarizeSecurity(categories: SecurityCategory[]): Record<
  SecurityStatus,
  number
> {
  const summary: Record<SecurityStatus, number> = {
    active: 0,
    configurable: 0,
    recommended: 0,
  };

  for (const category of categories) {
    for (const control of category.controls) {
      summary[control.status] += 1;
    }
  }

  return summary;
}
