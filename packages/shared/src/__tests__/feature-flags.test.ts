import { describe, it, expect, afterEach } from 'bun:test';
import { isDevRuntime, isDeveloperFeedbackEnabled, isRoxAgentsCliEnabled, isEmbeddedServerEnabled } from '../feature-flags.ts';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  ROX_DEBUG: process.env.ROX_DEBUG,
  ROX_FEATURE_DEVELOPER_FEEDBACK: process.env.ROX_FEATURE_DEVELOPER_FEEDBACK,
  ROX_FEATURE_ROX_AGENTS_CLI: process.env.ROX_FEATURE_ROX_AGENTS_CLI,
  ROX_FEATURE_EMBEDDED_SERVER: process.env.ROX_FEATURE_EMBEDDED_SERVER,
};

afterEach(() => {
  if (ORIGINAL_ENV.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;

  if (ORIGINAL_ENV.ROX_DEBUG === undefined) delete process.env.ROX_DEBUG;
  else process.env.ROX_DEBUG = ORIGINAL_ENV.ROX_DEBUG;

  if (ORIGINAL_ENV.ROX_FEATURE_DEVELOPER_FEEDBACK === undefined) delete process.env.ROX_FEATURE_DEVELOPER_FEEDBACK;
  else process.env.ROX_FEATURE_DEVELOPER_FEEDBACK = ORIGINAL_ENV.ROX_FEATURE_DEVELOPER_FEEDBACK;

  if (ORIGINAL_ENV.ROX_FEATURE_ROX_AGENTS_CLI === undefined) delete process.env.ROX_FEATURE_ROX_AGENTS_CLI;
  else process.env.ROX_FEATURE_ROX_AGENTS_CLI = ORIGINAL_ENV.ROX_FEATURE_ROX_AGENTS_CLI;

  if (ORIGINAL_ENV.ROX_FEATURE_EMBEDDED_SERVER === undefined) delete process.env.ROX_FEATURE_EMBEDDED_SERVER;
  else process.env.ROX_FEATURE_EMBEDDED_SERVER = ORIGINAL_ENV.ROX_FEATURE_EMBEDDED_SERVER;
});

describe('feature-flags runtime helpers', () => {
  it('isDevRuntime returns true for explicit dev NODE_ENV', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ROX_DEBUG;

    expect(isDevRuntime()).toBe(true);
  });

  it('isDevRuntime returns true for ROX_DEBUG override', () => {
    process.env.NODE_ENV = 'production';
    process.env.ROX_DEBUG = '1';

    expect(isDevRuntime()).toBe(true);
  });

  it('isDeveloperFeedbackEnabled honors explicit override false', () => {
    process.env.NODE_ENV = 'development';
    process.env.ROX_FEATURE_DEVELOPER_FEEDBACK = '0';

    expect(isDeveloperFeedbackEnabled()).toBe(false);
  });

  it('isDeveloperFeedbackEnabled honors explicit override true', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ROX_DEBUG;
    process.env.ROX_FEATURE_DEVELOPER_FEEDBACK = '1';

    expect(isDeveloperFeedbackEnabled()).toBe(true);
  });

  it('isDeveloperFeedbackEnabled falls back to dev runtime when no override', () => {
    process.env.NODE_ENV = 'production';
    process.env.ROX_DEBUG = '1';
    delete process.env.ROX_FEATURE_DEVELOPER_FEEDBACK;

    expect(isDeveloperFeedbackEnabled()).toBe(true);
  });

  it('isRoxAgentsCliEnabled defaults to false when no override is set', () => {
    delete process.env.ROX_FEATURE_ROX_AGENTS_CLI;

    expect(isRoxAgentsCliEnabled()).toBe(false);
  });

  it('isRoxAgentsCliEnabled honors explicit override true', () => {
    process.env.ROX_FEATURE_ROX_AGENTS_CLI = '1';

    expect(isRoxAgentsCliEnabled()).toBe(true);
  });

  it('isRoxAgentsCliEnabled honors explicit override false', () => {
    process.env.ROX_FEATURE_ROX_AGENTS_CLI = '0';

    expect(isRoxAgentsCliEnabled()).toBe(false);
  });

  it('isEmbeddedServerEnabled defaults to false when no override is set', () => {
    delete process.env.ROX_FEATURE_EMBEDDED_SERVER;

    expect(isEmbeddedServerEnabled()).toBe(false);
  });

  it('isEmbeddedServerEnabled honors explicit override true', () => {
    process.env.ROX_FEATURE_EMBEDDED_SERVER = '1';

    expect(isEmbeddedServerEnabled()).toBe(true);
  });

  it('isEmbeddedServerEnabled honors explicit override false', () => {
    process.env.ROX_FEATURE_EMBEDDED_SERVER = '0';

    expect(isEmbeddedServerEnabled()).toBe(false);
  });
});
