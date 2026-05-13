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
  type FileAuditSinkRetention,
  createFileAuditSink,
} from './file-audit-sink.ts'

export {
  DEFAULT_MAX_AGE_MS,
  DEFAULT_MAX_FILES,
  type EnforceRetentionOptions,
  type EnforceRetentionResult,
  type RetentionFsDeps,
  enforceRetention,
  enforceRetentionOnDisk,
  isRotatedAuditFile,
} from './audit-retention.ts'

export {
  DEFAULT_HOST_LOG_DIR_NAME,
  DEFAULT_HOST_LOG_FILE_NAME,
  DEFAULT_HOST_MAX_AGE_MS,
  DEFAULT_HOST_MAX_FILES,
  type CreateFileSinkArgs,
  type CreateHostAuditProducerOptions,
  type HostAuditChain,
  type HostRetentionOptions,
  createHostAuditProducer,
} from './host.ts'
