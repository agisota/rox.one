import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Spinner } from "@rox-one/ui"

/* =============================================================================
   ADD WORKSPACE PRIMITIVES

   Shared components for consistent styling across the Add Workspace flow.
   These primitives ensure:
   - Unified visual design across all steps
   - Easy global style updates
   - Consistent spacing and typography
============================================================================= */

// =============================================================================
// CONTAINER
// =============================================================================

interface AddWorkspaceContainerProps {
  children: React.ReactNode
  className?: string
}

/**
 * AddWorkspaceContainer - Main container for workspace creation steps
 *
 * Provides:
 * - Fixed width (28rem)
 * - Background with rounded corners
 * - Strong shadow for elevation
 * - Consistent padding
 */
export function AddWorkspaceContainer({ children, className }: AddWorkspaceContainerProps) {
  return (
    <div className={cn("relative w-full max-w-[30rem]", className)}>
      <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-accent/10 blur-3xl opacity-80" />
      <div
        className={cn(
          "relative flex w-full flex-col items-center overflow-hidden rounded-[24px]",
          "border border-border/50 bg-background/92 px-8 py-8 shadow-strong backdrop-blur-xl",
          "supports-[backdrop-filter]:bg-background/84"
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/35 to-transparent" />
        {children}
      </div>
    </div>
  )
}

// =============================================================================
// STEP HEADER
// =============================================================================

interface AddWorkspaceStepHeaderProps {
  /** The main title */
  title: string
  /** Optional description below the title */
  description?: React.ReactNode
  className?: string
}

/**
 * AddWorkspaceStepHeader - Title and description for workspace steps
 *
 * Always center-aligned with tight spacing for visual consistency.
 */
export function AddWorkspaceStepHeader({
  title,
  description,
  className
}: AddWorkspaceStepHeaderProps) {
  return (
    <div className={cn("text-center", className)}>
      <div className="mb-3 inline-flex items-center rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground shadow-minimal">
        ROX ONE
      </div>
      <h1 className="text-[24px] font-semibold tracking-tight leading-[1.1] text-foreground">
        {title}
      </h1>
      {description && (
        <p className="mx-auto mt-2 max-w-[26rem] text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}

// =============================================================================
// BUTTONS
// =============================================================================

interface AddWorkspacePrimaryButtonProps extends Omit<ButtonProps, 'variant' | 'children'> {
  children?: React.ReactNode
  loading?: boolean
  loadingText?: string
}

/**
 * AddWorkspacePrimaryButton - Primary action button for workspace flow
 *
 * Used for main actions like "Create", "Open", etc.
 * Includes loading state with spinner.
 */
export function AddWorkspacePrimaryButton({
  children = 'Continue',
  loading,
  loadingText,
  className,
  disabled,
  ...props
}: AddWorkspacePrimaryButtonProps) {
  return (
    <Button
      className={cn("w-full", className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="mr-2" />
          {loadingText || children}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

interface AddWorkspaceSecondaryButtonProps extends Omit<ButtonProps, 'variant'> {
  children?: React.ReactNode
}

/**
 * AddWorkspaceSecondaryButton - Secondary action button for workspace flow
 *
 * Used for actions like "Browse", or inline actions within forms.
 */
export function AddWorkspaceSecondaryButton({
  children,
  className,
  ...props
}: AddWorkspaceSecondaryButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn("bg-background shadow-minimal", className)}
      {...props}
    >
      {children}
    </Button>
  )
}
