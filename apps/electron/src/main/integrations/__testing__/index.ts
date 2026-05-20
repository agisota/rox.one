/**
 * PZD-80: Public surface of the integrations test-double module.
 *
 * Import-only — no production code should reach into this folder.
 */
export {
  MockWebContentsView,
  type MockWebContents,
  type MockWindowOpenDetails,
  type MockWindowOpenHandler,
  type MockWindowOpenResult,
} from './mock-web-contents-view'

export { MockBrowserWindow } from './mock-browser-window'

export {
  disposeMocks,
  mockManifest,
  mockWebContentsViewFor,
  type IntegrationManifest,
  type MockSecureWebContentsView,
} from './factories'
