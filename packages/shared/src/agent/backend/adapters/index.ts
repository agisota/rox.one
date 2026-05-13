/**
 * Provider Adapters — M.7 T241-adapters.
 *
 * Barrel for the fake provider implementations. Real adapters that wrap LLM
 * SDKs land in T242 and will be re-exported from here when they arrive.
 */

export {
  FakeAnthropicAdapter,
  createFakeAnthropicAdapter,
  type FakeAnthropicAdapterOptions,
  type FakeAnthropicCannedResponse,
  type FakeAnthropicFailureMode,
} from './fake-anthropic-adapter.ts';

export {
  FakeOpenAiAdapter,
  createFakeOpenAiAdapter,
  type FakeOpenAiAdapterOptions,
  type FakeOpenAiCannedResponse,
  type FakeOpenAiFailureMode,
} from './fake-openai-adapter.ts';
