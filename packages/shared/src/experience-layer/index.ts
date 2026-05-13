/**
 * Experience Layer kernel — public barrel (M.9 T270).
 * Followups: T271 (renderer hook), T272 (server emit), T080 (spine mapping).
 */

export * from './experience-id.ts';
export * from './experience-state.ts';
export * from './experience-event.ts';
// `Result` is defined in both `experience-id.ts` and `experience-reducer.ts`;
// they are the same shape. Explicitly re-export the reducer-side members to
// avoid the ambiguous re-export warning while keeping `Result` reachable
// from the id barrel.
export { reducer, type TransitionError } from './experience-reducer.ts';
export * from './experience-bind.ts';
