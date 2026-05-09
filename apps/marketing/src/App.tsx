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
import type { CSSProperties } from 'react'
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

const terminalRelease = {
  version: '0.9.1',
  manifestUrl: 'https://app.rox.one/electron/latest/manifest.json',
  baseUrl: 'https://app.rox.one/electron/latest',
}

const terminalDownloads = [
  {
    title: 'macOS Apple Silicon DMG',
    subtitle: 'Для Mac на M1, M2, M3 и M4',
    fileName: 'ROX-ONE-arm64.dmg',
    size: '328 MB',
    sha256: 'd4e75a4359c3decfdb98845b51d6831415e5c64ec5b06ddfd6eda512b23848ab',
    action: 'Скачать DMG',
  },
  {
    title: 'macOS Apple Silicon ZIP',
    subtitle: 'Для auto-update feed и ручной распаковки',
    fileName: 'ROX-ONE-arm64.zip',
    size: '317 MB',
    sha256: '3a124e2619c9880051716132e345d22badd61301a01c9e2ef275cc90d0ecc19f',
    action: 'Скачать ZIP',
  },
]

const releaseFacts = [
  'Публичный feed: app.rox.one/electron/latest',
  'Актуальная сборка: macOS arm64 v0.9.1',
  'Installer scripts: shell + PowerShell',
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
                  <a className="button primary download-button" href={`${terminalRelease.baseUrl}/${download.fileName}`}>
                    <MonitorDown aria-hidden="true" />
                    <span>{download.action}</span>
                  </a>
                </article>
              ))}
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
