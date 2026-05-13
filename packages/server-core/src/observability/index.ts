/**
 * `@rox-one/server-core` observability barrel.
 *
 * This module exposes server-side *consumer* implementations of the M.14
 * observability surface defined in `@rox-one/shared/observability`. The
 * canonical taxonomy (audit events, log levels, correlation ids) lives in
 * the shared package; hosts compose those with concrete sinks like
 * `FileAuditSink` at boot.
 */

export {
  type FileAuditSinkHandle,
  type FileAuditSinkOptions,
  createFileAuditSink,
} from './file-audit-sink.ts'
