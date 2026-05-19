export type ResizeAutoScrollBehavior = 'none' | 'instant' | 'smooth'

export interface ResizeAutoScrollInput {
  isFocusedPanel: boolean
  isStickToBottom: boolean
}

/**
 * Decide whether transcript growth should auto-follow the newest output.
 *
 * Background panels should keep following only while they are already at the
 * bottom. Once a user scrolls a background/second/third panel up, resize events
 * from streaming content must not snap that history view back down.
 */
export function getResizeAutoScrollBehavior({
  isFocusedPanel,
  isStickToBottom,
}: ResizeAutoScrollInput): ResizeAutoScrollBehavior {
  if (!isStickToBottom) return 'none'
  return isFocusedPanel ? 'smooth' : 'instant'
}
