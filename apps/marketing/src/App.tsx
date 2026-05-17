import {
  ArrowRight,
  CheckCircle2,
  Code2,
  DatabaseZap,
  FileText,
  GitBranch,
  MonitorDown,
  Play,
  PlugZap,
  ShieldCheck,
  TerminalSquare,
  UsersRound,
  Workflow,
} from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import appIcon from './assets/pzdrk.png'

const sessions = [
  { name: 'Подключить CRM-источник', status: 'В работе', tone: 'green' },
  { name: 'Собрать навык поддержки', status: 'Проверка', tone: 'amber' },
  { name: 'Подготовить релиз', status: 'Готово', tone: 'blue' },
]

const features = [
  {
    icon: <GitBranch aria-hidden="true" />,
    title: 'Сессии как продуктовый конвейер',
    body: 'Параллельные агентные задачи, статусы, ветвление, история решений и понятный handoff между людьми и агентами.',
  },
  {
    icon: <PlugZap aria-hidden="true" />,
    title: 'Источники без интеграционного долга',
    body: 'MCP JSON, OpenAPI, документы, URL и внутренние базы превращаются в управляемые инструменты для рабочих сценариев.',
  },
  {
    icon: <Workflow aria-hidden="true" />,
    title: 'Навыки, которые живут дольше промпта',
    body: 'Сохраняйте повторяемые playbook-и, запускайте фоновые сессии и закрепляйте удачные действия как командные workflows.',
  },
]

const proofs = [
  'Единая рабочая область для людей, агентов и источников',
  'Русский интерфейс для операционных команд и внедрения',
  'Локальный контроль, self-host сценарии и корпоративные контуры',
]

function buildLiveSignals(version: string): Array<{ label: string; value: string }> {
  return [
    { label: 'Desktop feed', value: `v${version} live` },
    { label: 'Download host', value: 'app.rox.one' },
    { label: 'Runtime language', value: 'RU first' },
    { label: 'Distribution', value: 'Cloudflare' },
  ]
}

const productPillars = [
  {
    icon: <DatabaseZap aria-hidden="true" />,
    title: 'Sources',
    body: 'Подключайте CRM, базы, документы и API как продуктовые источники, а не как одноразовые скрипты.',
  },
  {
    icon: <UsersRound aria-hidden="true" />,
    title: 'Workspaces',
    body: 'Разделяйте команды, роли, рабочие очереди и артефакты без потери контекста между сессиями.',
  },
  {
    icon: <ShieldCheck aria-hidden="true" />,
    title: 'Control',
    body: 'Оставляйте критичные данные внутри выбранного контура и проверяйте результат до передачи в продакшен.',
  },
]

const useCases = [
  'Поддержка и back-office: разбор заявок, поиск контекста, подготовка ответов',
  'Product ops: исследования, changelog, спецификации, QA и релизные чек-листы',
  'Интеграционные команды: безопасное подключение API, MCP и внутренних знаний',
]

const adoptionSteps = [
  {
    title: 'Подключите источники',
    body: 'Начните с API, MCP, папок и рабочих документов. ROX ONE держит источники рядом с сессиями, а не в отдельной интеграционной свалке.',
  },
  {
    title: 'Запустите управляемые сессии',
    body: 'Каждая задача получает статус, журнал, артефакты, evidence и следующий шаг. Это снижает риск потерять решение в истории чата.',
  },
  {
    title: 'Упакуйте повторяемое',
    body: 'Удачные промпты, проверки и agent packages становятся навыками, которые можно запускать повторно и улучшать по фактам.',
  },
  {
    title: 'Проверяйте перед передачей',
    body: 'Readiness, VDI, risk gates и журнал действий показывают, что именно готово, что заблокировано и где нужен человек.',
  },
]

const experienceTiles = [
  {
    title: 'Долгие миссии',
    body: 'План, журнал, blockers и evidence для задач, которые нельзя держать в одном чате.',
    metric: 'mission log',
  },
  {
    title: 'Арена агентов',
    body: 'Сравнение агентов и skill-паков по качеству, стоимости, риску и готовности.',
    metric: 'quality gates',
  },
  {
    title: 'Центр миссий',
    body: 'Единое место запуска командных сценариев, watchers, approvals и повторных прогонов.',
    metric: 'run center',
  },
  {
    title: 'Прогресс',
    body: 'VDI, readiness, XP и история улучшений превращают проверенную работу в измеримый прогресс.',
    metric: 'VDI / XP',
  },
  {
    title: 'Карта квестов',
    body: 'Цепочки unlock-ов, зависимости и следующий лучший шаг без ручного восстановления контекста.',
    metric: 'quest graph',
  },
  {
    title: 'Кузница агентов',
    body: 'Упаковка удачных сценариев в reusable packages с trust score и risk gates.',
    metric: 'agent packs',
  },
]

const runSteps = [
  { label: 'План выката', value: 86 },
  { label: 'Интеграция API', value: 68 },
  { label: 'Проверка сборки', value: 94 },
]

const RELEASE_FEED_BASE_URL = 'https://app.rox.one/electron/latest'
const RELEASE_FEED_MANIFEST_URL = `${RELEASE_FEED_BASE_URL}/manifest.json`

type TerminalDownload = {
  title: string
  subtitle: string
  url: string
  fileName: string
  size: string
  sha256: string
  action: string
}

type TerminalRelease = {
  version: string
  manifestUrl: string
}

type ManifestBinary = {
  url?: string
  sha256?: string
  size?: number
  filename?: string
}

type ManifestPayload = {
  version?: string
  binaries?: Record<string, ManifestBinary>
}

// Fallback data — rendered while the live manifest is fetching, or if the
// fetch fails. Mirrors the last shipped release so the page never appears
// broken even if app.rox.one is unreachable.
const fallbackTerminalRelease: TerminalRelease = {
  version: '0.9.2',
  manifestUrl: RELEASE_FEED_MANIFEST_URL,
}

const fallbackTerminalDownloads: TerminalDownload[] = [
  {
    title: 'macOS Apple Silicon DMG',
    subtitle: 'Для Mac на M1, M2, M3 и M4',
    url: `${RELEASE_FEED_BASE_URL}/ROX-ONE-arm64.dmg`,
    fileName: 'ROX-ONE-arm64.dmg',
    size: '320.1 MB',
    sha256: '687376ea2c29710c7006956fe6f12934df3860fc5c6628b64955a37bf93a144c',
    action: 'Скачать DMG',
  },
  {
    title: 'macOS Apple Silicon ZIP',
    subtitle: 'Для auto-update feed и ручной распаковки',
    url: `${RELEASE_FEED_BASE_URL}/ROX-ONE-arm64.zip`,
    fileName: 'ROX-ONE-arm64.zip',
    size: '309.4 MB',
    sha256: '8050c770eaaeaf5eb93ac4099e84eda71d885d55cf48d5829469a5846296b25f',
    action: 'Скачать ZIP',
  },
]

const platformLabels: Record<string, { title: string; subtitle: string }> = {
  'darwin-arm64': { title: 'macOS Apple Silicon', subtitle: 'Для Mac на M1, M2, M3 и M4' },
  'darwin-x64': { title: 'macOS Intel', subtitle: 'Для Mac на Intel-процессорах' },
  'linux-x64': { title: 'Linux x64', subtitle: 'AppImage для большинства дистрибутивов' },
  'linux-arm64': { title: 'Linux ARM64', subtitle: 'AppImage для ARM-систем' },
  'win32-x64': { title: 'Windows x64', subtitle: 'Установщик NSIS для Windows 10 / 11' },
  'win32-arm64': { title: 'Windows ARM64', subtitle: 'Установщик для устройств на ARM' },
}

const platformOrder = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'win32-x64', 'win32-arm64']

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(unitIndex >= 2 ? 1 : 0)} ${units[unitIndex]}`
}

function actionLabelForFile(fileName: string): string {
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1).toUpperCase() : ''
  switch (ext) {
    case 'DMG':
    case 'ZIP':
    case 'EXE':
    case 'DEB':
    case 'RPM':
      return `Скачать ${ext}`
    case 'APPIMAGE':
      return 'Скачать AppImage'
    default:
      return 'Скачать'
  }
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/i
const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9._-]+$/

function isHttpUrl(value: string): boolean {
  // URL constructor + protocol allowlist; rejects javascript:, data:, file:, etc.
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function isValidBinary(binary: ManifestBinary): binary is Required<Pick<ManifestBinary, 'filename' | 'sha256'>> &
  ManifestBinary {
  if (typeof binary.filename !== 'string' || !SAFE_FILENAME_PATTERN.test(binary.filename)) return false
  if (typeof binary.sha256 !== 'string' || !SHA256_PATTERN.test(binary.sha256)) return false
  if (binary.size !== undefined && (!Number.isFinite(binary.size) || binary.size <= 0)) return false
  if (binary.url !== undefined && !isHttpUrl(binary.url)) return false
  return true
}

function manifestToDownloads(manifest: ManifestPayload): TerminalDownload[] {
  const binaries = manifest.binaries ?? {}
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const key of platformOrder) {
    if (binaries[key]) {
      ordered.push(key)
      seen.add(key)
    }
  }
  for (const key of Object.keys(binaries)) {
    if (!seen.has(key)) ordered.push(key)
  }

  const downloads: TerminalDownload[] = []
  for (const key of ordered) {
    const binary = binaries[key]
    if (!binary || !isValidBinary(binary)) continue
    const label = platformLabels[key] ?? { title: key, subtitle: 'Сборка из release feed' }
    const fileUrl = binary.url ?? `${RELEASE_FEED_BASE_URL}/${binary.filename}`
    downloads.push({
      title: label.title,
      subtitle: label.subtitle,
      url: fileUrl,
      fileName: binary.filename,
      size: typeof binary.size === 'number' ? formatBytes(binary.size) : '—',
      sha256: binary.sha256,
      action: actionLabelForFile(binary.filename),
    })
  }
  return downloads
}

function useTerminalRelease(): { release: TerminalRelease; downloads: TerminalDownload[] } {
  const [release, setRelease] = useState<TerminalRelease>(fallbackTerminalRelease)
  const [downloads, setDownloads] = useState<TerminalDownload[]>(fallbackTerminalDownloads)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        // Trust the worker's Cache-Control: public, max-age=60 — the page
        // already shows fallback data instantly, and a 1-minute stale
        // manifest is fine for marketing copy. Browser cache short-circuits
        // a network call on every page load.
        const response = await fetch(RELEASE_FEED_MANIFEST_URL, {
          signal: controller.signal,
        })
        if (!response.ok) return
        const payload = (await response.json()) as ManifestPayload
        if (controller.signal.aborted) return
        const liveDownloads = manifestToDownloads(payload)
        if (liveDownloads.length === 0) return
        setDownloads(liveDownloads)
        if (typeof payload.version === 'string' && payload.version.length > 0) {
          setRelease({
            version: payload.version,
            manifestUrl: RELEASE_FEED_MANIFEST_URL,
          })
        }
      } catch (err) {
        // Aborts (unmount, StrictMode double-invoke) are expected and silent.
        // Other failures (network, JSON parse) also fall through silently —
        // the fallback constants keep the page usable when app.rox.one is down.
        if ((err as { name?: string })?.name === 'AbortError') return
      }
    })()
    return () => {
      controller.abort()
    }
  }, [])

  return { release, downloads }
}

const trustChecks = [
  'download URLs не завязаны на private GitHub cookies',
  'manifest.json доступен как машинно-проверяемый источник версии',
  'SHA-256 опубликованы рядом с download CTA',
  'переходы /login и /account остаются на продуктовой зоне app.rox.one',
]

function ProductDemo() {
  return (
    <div className="demo-shell" aria-label="Анимированный предпросмотр приложения ROX ONE">
      <div className="demo-window">
        <div className="demo-topbar">
          <div className="traffic-lights" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="demo-brand">
            <img src={appIcon} alt="" />
            <span>ROX ONE</span>
          </div>
          <div className="demo-status">Живая рабочая область</div>
        </div>

        <div className="demo-grid">
          <aside className="demo-sidebar" aria-label="Предпросмотр списка сессий">
            <div className="demo-section-label">Сессии</div>
            {sessions.map((session, index) => (
              <div className={`session-row ${session.tone}`} key={session.name} style={{ '--delay': `${index * 0.16}s` } as CSSProperties}>
                <span className="session-dot" />
                <div>
                  <strong>{session.name}</strong>
                  <small>{session.status}</small>
                </div>
              </div>
            ))}
            <div className="source-stack">
              <div className="demo-section-label">Источники</div>
              <div className="source-chip">CRM</div>
              <div className="source-chip">Docs</div>
              <div className="source-chip">Postgres</div>
            </div>
          </aside>

          <main className="demo-chat" aria-label="Предпросмотр агентной сессии">
            <div className="message user-message">
              <span>Подключи API поддержки, создай навык и подготовь план выката.</span>
            </div>
            <div className="message agent-message">
              <div className="agent-line">
                <CheckCircle2 aria-hidden="true" />
                <span>Схема источника проверена</span>
              </div>
              <div className="tool-card">
                <Code2 aria-hidden="true" />
                <div>
                  <strong>Сгенерирована интеграция</strong>
                  <small>Аутентификация OpenAPI, точки доступа и типизированные инструменты</small>
                </div>
              </div>
              <div className="run-steps" aria-hidden="true">
                {runSteps.map((step, index) => (
                  <div className="run-step" key={step.label} style={{ '--progress': `${step.value}%`, '--delay': `${index * 0.12}s` } as CSSProperties}>
                    <span>{step.label}</span>
                    <i />
                  </div>
                ))}
              </div>
              <div className="diff-preview" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="terminal-card">
              <TerminalSquare aria-hidden="true" />
              <code>rox check workspace --release</code>
              <strong>готово</strong>
            </div>
          </main>

          <aside className="demo-inspector" aria-label="Предпросмотр деталей рабочей области">
            <div className="inspector-card">
              <div className="demo-section-label">Автоматизация</div>
              <strong>Когда метка станет «На проверке»</strong>
              <small>Создать последующую сессию и приложить изменённые файлы.</small>
            </div>
            <div className="inspector-card">
              <div className="demo-section-label">Артефакты</div>
              <div className="artifact-row">
                <FileText aria-hidden="true" />
                <span>launch-plan.md</span>
              </div>
              <div className="artifact-row">
                <FileText aria-hidden="true" />
                <span>api-source.json</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export function App() {
  const { release: terminalRelease, downloads: terminalDownloads } = useTerminalRelease()
  const liveSignals = buildLiveSignals(terminalRelease.version)
  const releaseFacts = [
    'Публичный feed: app.rox.one/electron/latest',
    `Актуальная версия: v${terminalRelease.version}`,
    'Installer scripts: shell + PowerShell',
  ]

  return (
    <div className="site-shell">
      <header className="nav">
        <a className="nav-brand" href="#top" aria-label="Главная ROX ONE">
          <img src={appIcon} alt="" />
          <span>ROX ONE</span>
        </a>
        <nav aria-label="Основная навигация">
          <a href="#product">Продукт</a>
          <a href="#use-cases">Кейсы</a>
          <a href="#experience">Опыт</a>
          <a href="#download">Скачать</a>
          <a href="#install">Self-host</a>
          <a href="/login">Войти</a>
          <a className="nav-cta" href="/login?tab=register">Начать</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <ProductDemo />
          <div className="hero-content">
            <div className="hero-kicker">
              <img src={appIcon} alt="" />
              <span>Product OS для агентных операций</span>
            </div>
            <h1 id="hero-title">ROX ONE</h1>
            <p>
              Продуктовая платформа для команд, которые внедряют AI-агентов в реальные процессы:
              источники, сессии, навыки, автоматизации, desktop terminal и контроль результата
              в одном интерфейсе.
            </p>
            <div className="hero-actions" aria-label="Основные действия">
              <a className="button primary" href="/login?tab=register">
                <ArrowRight aria-hidden="true" />
                <span>Начать бесплатно</span>
              </a>
              <a className="button secondary" href="/login">
                <Play aria-hidden="true" />
                <span>Войти в workspace</span>
              </a>
              <a className="button secondary" href="#download">
                <MonitorDown aria-hidden="true" />
                <span>Скачать терминал</span>
              </a>
            </div>
            <div className="live-strip" aria-label="Текущий статус ROX ONE">
              {liveSignals.map((signal) => (
                <div className="live-signal" key={signal.label}>
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="proof-band" aria-label="Ключевые свойства продукта">
          {proofs.map((proof) => (
            <div className="proof-item" key={proof}>
              <CheckCircle2 aria-hidden="true" />
              <span>{proof}</span>
            </div>
          ))}
        </section>

        <section className="section product-section" id="product" aria-labelledby="product-title">
          <div className="section-heading">
            <span>Платформа, не чат-обёртка</span>
            <h2 id="product-title">ROX ONE собирает агентную работу в продуктовую систему с понятными слоями.</h2>
          </div>
          <div className="pillar-grid">
            {productPillars.map((pillar) => (
              <article className="pillar-card" key={pillar.title}>
                <div className="feature-icon">{pillar.icon}</div>
                <span>{pillar.title}</span>
                <h3>{pillar.body}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="features" aria-labelledby="features-title">
          <div className="section-heading">
            <span>Для операционных команд</span>
            <h2 id="features-title">Все, что обычно расползается по промптам и скриптам, становится управляемой сессией.</h2>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="use-case-band" id="use-cases" aria-labelledby="use-cases-title">
          <div>
            <span className="section-eyebrow">Use cases</span>
            <h2 id="use-cases-title">Когда AI уже нужен не для демо, а для повторяемой работы.</h2>
          </div>
          <div className="use-case-list">
            {useCases.map((useCase) => (
              <div className="use-case-row" key={useCase}>
                <CheckCircle2 aria-hidden="true" />
                <span>{useCase}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section adoption-section" id="workflow" aria-labelledby="workflow-title">
          <div className="section-heading">
            <span>Как внедрять</span>
            <h2 id="workflow-title">ROX ONE закрывает путь от источника до проверенного результата без ручной пересборки контекста.</h2>
          </div>
          <div className="adoption-grid">
            {adoptionSteps.map((step, index) => (
              <article className="adoption-card" key={step.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section experience-section" id="experience" aria-labelledby="experience-title">
          <div className="section-heading">
            <span>Опыт в desktop app</span>
            <h2 id="experience-title">Шесть рабочих вкладок превращают агентные сессии в наблюдаемую систему.</h2>
          </div>
          <div className="experience-grid">
            {experienceTiles.map((tile) => (
              <article className="experience-card" key={tile.title}>
                <span>{tile.metric}</span>
                <h3>{tile.title}</h3>
                <p>{tile.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="download-section" id="download" aria-labelledby="download-title">
          <div className="section-heading">
            <span>Desktop terminal</span>
            <h2 id="download-title">ROX ONE Terminal v{terminalRelease.version} доступен через live install/update feed.</h2>
          </div>
          <div className="download-layout">
            <div className="download-intro">
              <p>
                Скачайте нативное приложение ROX ONE Terminal. Сборка использует бренд ROX ONE,
                bundle id <code>com.rox.one</code> и поставляется через публичный release feed
                на <code>app.rox.one</code>.
              </p>
              <div className="release-facts" aria-label="Состояние релиза">
                {releaseFacts.map((fact) => (
                  <div className="release-fact" key={fact}>
                    <CheckCircle2 aria-hidden="true" />
                    <span>{fact}</span>
                  </div>
                ))}
              </div>
              <a className="repo-link release-link" href={terminalRelease.manifestUrl}>
                <GitBranch aria-hidden="true" />
                <span>Проверить live manifest</span>
                <ArrowRight aria-hidden="true" />
              </a>
            </div>
            <div className="download-grid">
              {terminalDownloads.map((download) => (
                <article className="download-card" key={download.fileName}>
                  <div className="download-card-header">
                    <div className="feature-icon">
                      <MonitorDown aria-hidden="true" />
                    </div>
                    <div>
                      <h3>{download.title}</h3>
                      <p>{download.subtitle}</p>
                    </div>
                  </div>
                  <dl className="download-meta">
                    <div>
                      <dt>Файл</dt>
                      <dd>{download.fileName}</dd>
                    </div>
                    <div>
                      <dt>Размер</dt>
                      <dd>{download.size}</dd>
                    </div>
                    <div>
                      <dt>SHA-256</dt>
                      <dd className="checksum">{download.sha256}</dd>
                    </div>
                  </dl>
                  <a className="button primary download-button" href={download.url}>
                    <MonitorDown aria-hidden="true" />
                    <span>{download.action}</span>
                  </a>
                </article>
              ))}
              <article className="download-card trust-card">
                <div className="download-card-header">
                  <div className="feature-icon">
                    <ShieldCheck aria-hidden="true" />
                  </div>
                  <div>
                    <h3>Проверяемая поставка</h3>
                    <p>Сайт показывает то, что реально отдаёт release feed.</p>
                  </div>
                </div>
                <div className="trust-list">
                  {trustChecks.map((check) => (
                    <div className="trust-row" key={check}>
                      <CheckCircle2 aria-hidden="true" />
                      <span>{check}</span>
                    </div>
                  ))}
                </div>
                <a className="button secondary download-button" href={terminalRelease.manifestUrl}>
                  <GitBranch aria-hidden="true" />
                  <span>Открыть manifest</span>
                </a>
              </article>
            </div>
          </div>
        </section>

        <section className="install-section" id="install" aria-labelledby="install-title">
          <div>
            <span className="section-eyebrow">Self-host ready</span>
            <h2 id="install-title">Запускайте ROX ONE там, где живут ваши процессы и данные.</h2>
            <p>
              Локальная установка подходит для пилота, а серверный режим — для долгих сессий,
              общей инфраструктуры и командного доступа без потери контроля над контуром.
            </p>
          </div>
          <div className="install-panel">
            <div className="command-block">
              <span>macOS / Linux</span>
              <code>curl -fsSL https://app.rox.one/install-app.sh | bash</code>
            </div>
            <div className="command-block">
              <span>Windows PowerShell</span>
              <code>irm https://app.rox.one/install-app.ps1 | iex</code>
            </div>
            <a className="repo-link" href="/login?tab=register">
              <ShieldCheck aria-hidden="true" />
              <span>Создать workspace</span>
              <ArrowRight aria-hidden="true" />
            </a>
            <a className="repo-link" href="/login">
              <MonitorDown aria-hidden="true" />
              <span>Открыть продуктовый вход</span>
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}
