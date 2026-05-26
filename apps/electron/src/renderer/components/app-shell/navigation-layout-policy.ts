import { isDesignNavigation, type NavigationState } from '../../../shared/types'

export function shouldSuppressNavigatorForNavigation(state: NavigationState | null | undefined): boolean {
  return !!state && isDesignNavigation(state)
}
