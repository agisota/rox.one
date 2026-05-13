import React, { act, useLayoutEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

let mockedNumPages = 3
let mockedDocumentError: string | null = null
let loadedPdfFiles = new WeakSet<object>()
let documentSuccessCalls = 0

mock.module('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'common.copyPath': 'Copy path',
      'common.rendering': 'Rendering...',
      'overlay.zoomIn': 'Zoom in',
      'overlay.zoomOut': 'Zoom out',
      'preview.loadingPdf': 'Loading PDF...',
    }[key] ?? key),
  }),
}))

mock.module('react-pdf/dist/Page/AnnotationLayer.css', () => ({}))
mock.module('react-pdf/dist/Page/TextLayer.css', () => ({}))
mock.module('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'mock-pdf-worker.js' }))

mock.module('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  Document: ({
    children,
    file,
    loading,
    onLoadError,
    onLoadSuccess,
  }: {
    children: ReactNode
    file: unknown
    loading?: ReactNode
    onLoadError?: (error: Error) => void
    onLoadSuccess?: (result: { numPages: number }) => void
  }) => {
    useLayoutEffect(() => {
      if (file && typeof file === 'object' && !loadedPdfFiles.has(file)) {
        loadedPdfFiles.add(file)
        if (mockedDocumentError) {
          onLoadError?.(new Error(mockedDocumentError))
        } else {
          documentSuccessCalls += 1
          onLoadSuccess?.({ numPages: mockedNumPages })
        }
      }
    }, [file, onLoadError, onLoadSuccess])

    if (!file) return <>{loading}</>
    return <div data-testid="mock-pdf-document">{children}</div>
  },
  Page: ({ pageNumber, scale }: { pageNumber: number; scale: number }) => (
    <div data-testid="mock-pdf-page" data-page-number={String(pageNumber)} data-scale={String(scale)} />
  ),
}))

mock.module('../PreviewOverlay', () => ({
  PreviewOverlay: ({
    children,
    error,
    headerActions,
    isOpen,
  }: {
    children: ReactNode
    error?: { label: string; message: string }
    headerActions?: ReactNode
    isOpen: boolean
  }) => {
    if (!isOpen) return null
    return (
      <section data-testid="preview-overlay">
        <header>{headerActions}</header>
        {error && (
          <div role="alert">
            <strong>{error.label}</strong>
            <span>{error.message}</span>
          </div>
        )}
        <main>{children}</main>
      </section>
    )
  },
}))

mock.module('../ItemNavigator', () => ({
  ItemNavigator: () => null,
}))

mock.module('../CopyButton', () => ({
  CopyButton: ({ title }: { title?: string }) => (
    <button type="button" title={title}>Copy</button>
  ),
}))

const ELEMENT_NODE = 1
const TEXT_NODE = 3
const COMMENT_NODE = 8
const DOCUMENT_NODE = 9

type Listener = (event: MiniEvent) => void

class MiniEvent {
  bubbles: boolean
  cancelable: boolean
  cancelBubble = false
  currentTarget: MiniEventTarget | null = null
  defaultPrevented = false
  target: MiniEventTarget | null = null
  type: string

  constructor(type: string, init: { bubbles?: boolean; cancelable?: boolean } = {}) {
    this.type = type
    this.bubbles = init.bubbles ?? false
    this.cancelable = init.cancelable ?? false
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true
  }

  stopPropagation() {
    this.cancelBubble = true
  }
}

class MiniEventTarget {
  listeners = new Map<string, Set<Listener>>()
  parentNode: MiniNode | null = null

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)?.add(listener)
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatchEvent(event: MiniEvent) {
    if (!event.target) event.target = this

    let current: MiniEventTarget | null = this
    while (current) {
      event.currentTarget = current
      current.listeners.get(event.type)?.forEach(listener => listener(event))
      if (!event.bubbles || event.cancelBubble) break
      current = current.parentNode
    }

    return !event.defaultPrevented
  }
}

class MiniNode extends MiniEventTarget {
  childNodes: MiniNode[] = []
  nodeName = ''
  nodeType = 0
  private nodeValueValue: string | null = null
  ownerDocument: MiniDocument | null = null

  appendChild<T extends MiniNode>(node: T): T {
    return this.insertBefore(node, null)
  }

  insertBefore<T extends MiniNode>(node: T, before: MiniNode | null): T {
    if (node.parentNode) node.parentNode.removeChild(node)
    node.parentNode = this
    node.ownerDocument = this.ownerDocument

    if (!before) {
      this.childNodes.push(node)
      return node
    }

    const index = this.childNodes.indexOf(before)
    if (index === -1) {
      this.childNodes.push(node)
      return node
    }

    this.childNodes.splice(index, 0, node)
    return node
  }

  removeChild<T extends MiniNode>(node: T): T {
    const index = this.childNodes.indexOf(node)
    if (index >= 0) this.childNodes.splice(index, 1)
    node.parentNode = null
    return node
  }

  contains(node: MiniNode | null): boolean {
    if (!node) return false
    if (node === this) return true
    return this.childNodes.some(child => child.contains(node))
  }

  get firstChild() {
    return this.childNodes[0] ?? null
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null
  }

  get nodeValue() {
    return this.nodeValueValue
  }

  set nodeValue(value: string | null) {
    this.nodeValueValue = value
  }

  get textContent(): string {
    return this.childNodes.map(child => child.textContent).join('')
  }

  set textContent(value: string) {
    this.childNodes = []
    if (value) this.appendChild(this.ownerDocument!.createTextNode(value))
  }
}

class MiniText extends MiniNode {
  data: string

  constructor(text: string, ownerDocument: MiniDocument, nodeType = TEXT_NODE, nodeName = '#text') {
    super()
    this.data = text
    this.nodeName = nodeName
    this.nodeType = nodeType
    this.nodeValue = text
    this.ownerDocument = ownerDocument
  }

  get textContent() {
    return this.data
  }

  set textContent(value: string) {
    this.data = value
    this.nodeValue = value
  }

  get nodeValue() {
    return this.data
  }

  set nodeValue(value: string | null) {
    this.data = value ?? ''
  }
}

class MiniElement extends MiniNode {
  attributes = new Map<string, string>()
  dataset: Record<string, string> = {}
  namespaceURI: string
  style: Record<string, string | number> = {}
  tagName: string

  constructor(tagName: string, ownerDocument: MiniDocument, namespaceURI = 'http://www.w3.org/1999/xhtml') {
    super()
    this.nodeType = ELEMENT_NODE
    this.tagName = tagName.toUpperCase()
    this.nodeName = this.tagName
    this.ownerDocument = ownerDocument
    this.namespaceURI = namespaceURI
  }

  click() {
    this.dispatchEvent(new MiniEvent('click', { bubbles: true, cancelable: true }))
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this
  }

  blur() {
    if (this.ownerDocument?.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }

  hasAttribute(name: string) {
    return this.attributes.has(name)
  }

  removeAttribute(name: string) {
    this.attributes.delete(name)
  }

  setAttribute(name: string, value: string) {
    const stringValue = String(value)
    this.attributes.set(name, stringValue)
    if (name === 'class') this.attributes.set('className', stringValue)
    if (name.startsWith('data-')) {
      this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] = stringValue
    }
  }

  querySelector(selector: string): MiniElement | null {
    return this.querySelectorAll(selector)[0] ?? null
  }

  querySelectorAll(selector: string): MiniElement[] {
    const matches: MiniElement[] = []
    const visit = (node: MiniNode) => {
      if (node instanceof MiniElement && node.matches(selector)) matches.push(node)
      node.childNodes.forEach(visit)
    }
    this.childNodes.forEach(visit)
    return matches
  }

  matches(selector: string) {
    if (selector === this.tagName.toLowerCase()) return true
    const attrMatch = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/)
    if (!attrMatch) return false

    const [, attr, expected] = attrMatch
    const actual = this.getAttribute(attr)
    if (expected == null) return actual != null
    return actual === expected
  }
}

class MiniDocument extends MiniNode {
  activeElement: MiniElement
  body: MiniElement
  defaultView: Record<string, unknown>
  documentElement: MiniElement

  constructor() {
    super()
    this.nodeType = DOCUMENT_NODE
    this.nodeName = '#document'
    this.ownerDocument = this
    this.documentElement = new MiniElement('html', this)
    this.body = new MiniElement('body', this)
    this.activeElement = this.body
    this.documentElement.appendChild(this.body)
    this.appendChild(this.documentElement)
    this.defaultView = {}
  }

  createComment(text: string) {
    return new MiniText(text, this, COMMENT_NODE, '#comment')
  }

  createElement(tagName: string) {
    return new MiniElement(tagName, this)
  }

  createElementNS(namespaceURI: string, tagName: string) {
    return new MiniElement(tagName, this, namespaceURI)
  }

  createTextNode(text: string) {
    return new MiniText(text, this)
  }

  querySelector(selector: string) {
    return this.documentElement.querySelector(selector)
  }

  querySelectorAll(selector: string) {
    return this.documentElement.querySelectorAll(selector)
  }
}

let documentRef: MiniDocument
type MountedRoot = { unmount: () => void }

const ABSENT_MINI_DOM_GLOBAL = Symbol('absentMiniDomGlobal')
const MINI_DOM_GLOBAL_KEYS = [
  'document',
  'window',
  'navigator',
  'Node',
  'Text',
  'Element',
  'HTMLElement',
  'HTMLButtonElement',
  'HTMLIFrameElement',
  'SVGElement',
  'Document',
  'Event',
  'MouseEvent',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
] as const

type MiniDomGlobalKey = (typeof MINI_DOM_GLOBAL_KEYS)[number]
let mountedRoots: MountedRoot[] = []
let previousMiniDomGlobals: Partial<Record<MiniDomGlobalKey, unknown | typeof ABSENT_MINI_DOM_GLOBAL>> = {}

function snapshotMiniDomGlobals() {
  const globalRecord = globalThis as Record<MiniDomGlobalKey, unknown>
  previousMiniDomGlobals = {}
  for (const key of MINI_DOM_GLOBAL_KEYS) {
    previousMiniDomGlobals[key] = Object.prototype.hasOwnProperty.call(globalRecord, key)
      ? globalRecord[key]
      : ABSENT_MINI_DOM_GLOBAL
  }
}

function restoreMiniDomGlobals() {
  const globalRecord = globalThis as Record<MiniDomGlobalKey, unknown>
  for (const key of MINI_DOM_GLOBAL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(previousMiniDomGlobals, key)) continue
    const previous = previousMiniDomGlobals[key]
    if (previous === ABSENT_MINI_DOM_GLOBAL) {
      delete globalRecord[key]
    } else {
      globalRecord[key] = previous
    }
  }
  previousMiniDomGlobals = {}
}

function installMiniDom() {
  documentRef = new MiniDocument()

  const windowRef = {
    document: documentRef,
    navigator: { userAgent: 'bun-mini-dom' },
    Node: MiniNode,
    Text: MiniText,
    Element: MiniElement,
    HTMLElement: MiniElement,
    HTMLButtonElement: MiniElement,
    HTMLIFrameElement: MiniElement,
    SVGElement: MiniElement,
    Document: MiniDocument,
    Event: MiniEvent,
    MouseEvent: MiniEvent,
    getComputedStyle: () => ({}),
    performance: { now: () => Date.now() },
    queueMicrotask,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    setTimeout,
    clearTimeout,
    addEventListener: (type: string, listener: Listener) => documentRef.addEventListener(type, listener),
    removeEventListener: (type: string, listener: Listener) => documentRef.removeEventListener(type, listener),
    dispatchEvent: (event: MiniEvent) => documentRef.dispatchEvent(event),
  }

  documentRef.defaultView = windowRef
  Object.assign(globalThis, {
    document: documentRef,
    window: windowRef,
    navigator: windowRef.navigator,
    Node: MiniNode,
    Text: MiniText,
    Element: MiniElement,
    HTMLElement: MiniElement,
    HTMLButtonElement: MiniElement,
    HTMLIFrameElement: MiniElement,
    SVGElement: MiniElement,
    Document: MiniDocument,
    Event: MiniEvent,
    MouseEvent: MiniEvent,
    requestAnimationFrame: windowRef.requestAnimationFrame,
    cancelAnimationFrame: windowRef.cancelAnimationFrame,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
}

function getByLabel(root: MiniElement, label: string) {
  const node = root.querySelector(`[aria-label="${label}"]`)
  if (!node) throw new Error(`Unable to find button with aria-label "${label}"`)
  return node
}

function getByTestId(root: MiniElement, id: string) {
  const node = root.querySelector(`[data-testid="${id}"]`)
  if (!node) throw new Error(`Unable to find [data-testid="${id}"]`)
  return node
}

async function renderOverlay(props: {
  filePath?: string
  loadPdfData?: (path: string) => Promise<Uint8Array>
}) {
  const [{ createRoot }, { PDFPreviewOverlay }] = await Promise.all([
    import('react-dom/client'),
    import('../PDFPreviewOverlay'),
  ])

  const rootElement = documentRef.createElement('div')
  documentRef.body.appendChild(rootElement)
  const root = createRoot(rootElement as unknown as Element)
  mountedRoots.push(root)

  await act(async () => {
    root.render(
      <PDFPreviewOverlay
        isOpen
        onClose={() => undefined}
        filePath={props.filePath ?? '/tmp/sample.pdf'}
        loadPdfData={props.loadPdfData ?? (() => Promise.resolve(new Uint8Array([1, 2, 3])))}
      />
    )
    await Promise.resolve()
  })

  await flushReact()
  await new Promise(resolve => setTimeout(resolve, 20))
  await flushReact()

  return { root, rootElement }
}

async function flushReact(rounds = 10) {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await Promise.resolve()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
}

beforeEach(() => {
  mockedNumPages = 3
  mockedDocumentError = null
  loadedPdfFiles = new WeakSet<object>()
  documentSuccessCalls = 0
  mountedRoots = []
  snapshotMiniDomGlobals()
  installMiniDom()
})

afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots) root.unmount()
  })
  mountedRoots = []
  documentRef.body.childNodes = []
  restoreMiniDomGlobals()
})

describe('PDFPreviewOverlay DOM controls', () => {
  it('drives page navigation and zoom controls with deterministic mocked PDF data', async () => {
    const loadPdfData = mock(() => Promise.resolve(new Uint8Array([1, 2, 3])))
    const { rootElement } = await renderOverlay({ loadPdfData })

    expect(loadPdfData).toHaveBeenCalledWith('/tmp/sample.pdf')
    expect(getByTestId(rootElement, 'mock-pdf-document')).toBeDefined()
    expect(documentSuccessCalls).toBe(1)
    expect(rootElement.textContent).toContain('1 / 3')
    expect(getByTestId(rootElement, 'mock-pdf-page').getAttribute('data-page-number')).toBe('1')
    expect(getByTestId(rootElement, 'mock-pdf-page').getAttribute('data-scale')).toBe('1')

    await act(async () => {
      getByLabel(rootElement, 'Next page').click()
    })
    expect(rootElement.textContent).toContain('2 / 3')
    expect(getByTestId(rootElement, 'mock-pdf-page').getAttribute('data-page-number')).toBe('2')

    await act(async () => {
      getByLabel(rootElement, 'Previous page').click()
    })
    expect(rootElement.textContent).toContain('1 / 3')

    await act(async () => {
      getByLabel(rootElement, 'Zoom in').click()
    })
    expect(rootElement.textContent).toContain('125%')
    expect(getByTestId(rootElement, 'mock-pdf-page').getAttribute('data-scale')).toBe('1.25')

    await act(async () => {
      getByLabel(rootElement, 'Zoom out').click()
    })
    expect(rootElement.textContent).toContain('100%')
    expect(getByTestId(rootElement, 'mock-pdf-page').getAttribute('data-scale')).toBe('1')
  })

  it('renders loading, loader error, and document error states without external providers', async () => {
    let resolvePdf: (data: Uint8Array) => void = () => undefined
    const pendingLoader = new Promise<Uint8Array>((resolve) => {
      resolvePdf = resolve
    })

    const { rootElement: loadingRoot } = await renderOverlay({
      loadPdfData: () => pendingLoader,
    })
    expect(loadingRoot.textContent).toContain('Loading PDF...')

    await act(async () => {
      resolvePdf(new Uint8Array([4, 5, 6]))
      await pendingLoader
    })
    await flushReact()
    expect(loadingRoot.textContent).toContain('1 / 3')

    const { rootElement: loaderErrorRoot } = await renderOverlay({
      filePath: '/tmp/error.pdf',
      loadPdfData: () => Promise.reject(new Error('local loader failed')),
    })
    expect(loaderErrorRoot.querySelector('[role="alert"]')?.textContent).toContain('local loader failed')

    mockedDocumentError = 'mock document parse failed'
    const { rootElement: documentErrorRoot } = await renderOverlay({
      filePath: '/tmp/document-error.pdf',
    })
    expect(documentErrorRoot.querySelector('[role="alert"]')?.textContent).toContain('mock document parse failed')
  })
})
