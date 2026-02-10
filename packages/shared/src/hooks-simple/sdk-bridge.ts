/**
 * SDK Bridge - Environment variable building for Claude SDK hook integration
 *
 * Maps SDK hook input fields to ROX_* environment variables for command execution.
 */

import { sanitizeForShell } from './security.ts';
import { cleanEnv } from './utils.ts';
import type { AgentEvent, SdkHookInput } from './types.ts';

/**
 * Build environment variables from SDK hook input.
 * Maps SDK input fields to ROX_* environment variables.
 */
export function buildEnvFromSdkInput(event: AgentEvent, input: SdkHookInput): Record<string, string> {
  const env: Record<string, string> = {
    ...cleanEnv(),
    ROX_EVENT: event,
  };

  // Map SDK input fields to env vars based on event type
  // User-provided values are sanitized to prevent shell injection
  switch (event) {
    case 'PreToolUse':
    case 'PostToolUse':
      if (input.tool_name) env.ROX_TOOL_NAME = input.tool_name; // Tool names are internal, not user input
      if (input.tool_input) env.ROX_TOOL_INPUT = sanitizeForShell(JSON.stringify(input.tool_input));
      if (input.tool_response) env.ROX_TOOL_RESPONSE = sanitizeForShell(input.tool_response);
      break;

    case 'PostToolUseFailure':
      if (input.tool_name) env.ROX_TOOL_NAME = input.tool_name;
      if (input.tool_input) env.ROX_TOOL_INPUT = sanitizeForShell(JSON.stringify(input.tool_input));
      if (input.error) env.ROX_ERROR = sanitizeForShell(input.error);
      break;

    case 'UserPromptSubmit':
      // User prompts are user-controlled and must be sanitized
      if (input.prompt) env.ROX_PROMPT = sanitizeForShell(input.prompt);
      break;

    case 'SessionStart':
      if (input.source) env.ROX_SOURCE = input.source; // Internal values
      if (input.model) env.ROX_MODEL = input.model;
      break;

    case 'SubagentStart':
    case 'SubagentStop':
      if (input.agent_id) env.ROX_AGENT_ID = input.agent_id; // Internal values
      if (input.agent_type) env.ROX_AGENT_TYPE = input.agent_type;
      break;

    case 'Notification':
      // Notification content could contain user data
      if (input.message) env.ROX_MESSAGE = sanitizeForShell(input.message);
      if (input.title) env.ROX_TITLE = sanitizeForShell(input.title);
      break;

    // SessionEnd, Stop, PreCompact, PermissionRequest, Setup have no additional fields
    default:
      break;
  }

  return env;
}
