import { describe, it, expect, afterEach } from 'bun:test';
import { isDevRuntime, isDeveloperFeedbackEnabled } from '../feature-flags.ts';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  ROX_DEBUG: process.env.ROX_DEBUG,
  ROX_FEATURE_DEVELOPER_FEEDBACK: process.env.ROX_FEATURE_DEVELOPER_FEEDBACK,
};

afterEach(() => {
  if (ORIGINAL_ENV.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;

  if (ORIGINAL_ENV.ROX_DEBUG === undefined) delete process.env.ROX_DEBUG;
  else process.env.ROX_DEBUG = ORIGINAL_ENV.ROX_DEBUG;

  if (ORIGINAL_ENV.ROX_FEATURE_DEVELOPER_FEEDBACK === undefined) delete process.env.ROX_FEATURE_DEVELOPER_FEEDBACK;
  else process.env.ROX_FEATURE_DEVELOPER_FEEDBACK = ORIGINAL_ENV.ROX_FEATURE_DEVELOPER_FEEDBACK;
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
});
