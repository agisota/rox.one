import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ClipboardCheck,
  FileText,
  ListChecks,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Swords,
  type LucideIcon,
} from 'lucide-react';

import {
  createProductModeIntent,
  getComposerProductModeOverflowActions,
  getComposerProductModePrimaryActions,
  getComposerProductModeOptions,
  isComposerProductModeNavigationKey,
  resolveComposerProductModeKeyboardTarget,
  type ComposerProductModeActionId,
  type ProductMode,
  type ProductModeIntent,
} from './product-mode-toolbar';

export type ProductModeToolbarProps = {
  selectedMode: ProductMode;
  onModeChange: (mode: ProductMode) => void;
  onIntent: (intent: ProductModeIntent) => void;
  disabled?: boolean;
  compactMode?: boolean;
};

const ACTION_ICON_BY_ID: Record<ComposerProductModeActionId, LucideIcon> = {
  'improve-prompt': Sparkles,
  'run-tdd-plan': ListChecks,
  verify: ShieldCheck,
  'tear-down': Swords,
  'build-spec': FileText,
  review: ClipboardCheck,
};

export function ProductModeToolbar({
  selectedMode,
  onModeChange,
  onIntent,
  disabled = false,
  compactMode = false,
}: ProductModeToolbarProps) {
  const { t } = useTranslation();
  const modeOptions = React.useMemo(() => getComposerProductModeOptions(), []);
  const primaryActions = React.useMemo(() => getComposerProductModePrimaryActions(), []);
  const overflowActions = React.useMemo(() => getComposerProductModeOverflowActions(), []);
  const [modePickerOpen, setModePickerOpen] = React.useState(false);
  const [actionMenuOpen, setActionMenuOpen] = React.useState(false);
  const [activeMode, setActiveMode] = React.useState<ProductMode>(selectedMode);
  const toolbarId = React.useId();
  const pickerLabelId = `product-mode-picker-label-${toolbarId}`;
  const selectedModeLabelId = `product-mode-picker-selected-${toolbarId}`;
  const pickerListboxId = `product-mode-picker-listbox-${toolbarId}`;
  const activeOptionId = `${pickerListboxId}-option-${activeMode}`;
  const actionMenuId = `product-mode-action-menu-${toolbarId}`;
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const pickerButtonRef = React.useRef<HTMLButtonElement>(null);
  const pickerListboxRef = React.useRef<HTMLDivElement>(null);
  const actionMenuButtonRef = React.useRef<HTMLButtonElement>(null);
  const actionMenuRef = React.useRef<HTMLDivElement>(null);
  const selectedOption = modeOptions.find(option => option.id === selectedMode) ?? modeOptions[0];

  const focusPickerButton = React.useCallback(() => {
    const focus = () => {
      pickerButtonRef.current?.focus({ preventScroll: true });
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(focus);
      return;
    }

    globalThis.setTimeout(focus, 0);
  }, []);

  const openModePicker = React.useCallback((initialActiveMode: ProductMode) => {
    setActiveMode(initialActiveMode);
    setModePickerOpen(true);
  }, []);

  const handleModeSelect = React.useCallback((mode: ProductMode) => {
    setModePickerOpen(false);
    onModeChange(mode);
  }, [onModeChange]);

  const handleModePickerToggle = React.useCallback(() => {
    if (disabled) return;

    if (modePickerOpen) {
      setModePickerOpen(false);
      return;
    }

    openModePicker(selectedMode);
    setActionMenuOpen(false);
  }, [disabled, modePickerOpen, openModePicker, selectedMode]);

  const handlePickerButtonKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isComposerProductModeNavigationKey(event.key)) return;

    event.preventDefault();
    event.stopPropagation();
    setActionMenuOpen(false);
    openModePicker(resolveComposerProductModeKeyboardTarget(selectedMode, event.key));
  }, [openModePicker, selectedMode]);

  const handleModeListKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isComposerProductModeNavigationKey(event.key)) {
      const navigationKey = event.key;

      event.preventDefault();
      event.stopPropagation();
      setActiveMode(mode => resolveComposerProductModeKeyboardTarget(mode, navigationKey));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      handleModeSelect(activeMode);
      focusPickerButton();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setModePickerOpen(false);
      focusPickerButton();
    }
  }, [activeMode, focusPickerButton, handleModeSelect]);

  const handleActionSelect = React.useCallback((actionId: ComposerProductModeActionId) => {
    setActionMenuOpen(false);
    onIntent(createProductModeIntent(actionId, selectedMode));
  }, [onIntent, selectedMode]);

  const handleActionMenuToggle = React.useCallback(() => {
    if (disabled) return;

    setModePickerOpen(false);
    setActionMenuOpen(open => !open);
  }, [disabled]);

  const handleActionMenuButtonKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown') return;

    event.preventDefault();
    event.stopPropagation();
    setModePickerOpen(false);
    setActionMenuOpen(true);
  }, []);

  React.useEffect(() => {
    if (!modePickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && !toolbarRef.current?.contains(target)) {
        setModePickerOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setModePickerOpen(false);
        focusPickerButton();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusPickerButton, modePickerOpen]);

  React.useEffect(() => {
    if (!actionMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && !toolbarRef.current?.contains(target)) {
        setActionMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setActionMenuOpen(false);
        actionMenuButtonRef.current?.focus({ preventScroll: true });
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionMenuOpen]);

  React.useEffect(() => {
    if (!modePickerOpen || disabled) return;

    pickerListboxRef.current?.focus({ preventScroll: true });
  }, [disabled, modePickerOpen]);

  React.useEffect(() => {
    if (!modePickerOpen) return;

    const activeOption = pickerListboxRef.current?.querySelector<HTMLElement>(
      `[data-product-mode-option="${activeMode}"]`,
    );
    activeOption?.scrollIntoView({ block: 'nearest' });
  }, [activeMode, modePickerOpen]);

  React.useEffect(() => {
    if (disabled) {
      setModePickerOpen(false);
      setActionMenuOpen(false);
    }
  }, [disabled]);

  React.useEffect(() => {
    if (!actionMenuOpen || disabled) return;

    const firstAction = actionMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    firstAction?.focus({ preventScroll: true });
  }, [actionMenuOpen, disabled]);

  React.useEffect(() => {
    if (!modePickerOpen) {
      setActiveMode(selectedMode);
    }
  }, [modePickerOpen, selectedMode]);

  return (
    <div
      ref={toolbarRef}
      className="flex flex-col gap-2 border-b border-border/50 px-2 py-2 sm:flex-row sm:items-center sm:justify-between"
      data-testid="product-mode-toolbar"
    >
      <div className="relative flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={compactMode ? 'sr-only' : 'shrink-0'} id={pickerLabelId}>
          {t('workbench.toolbar.mode')}
        </span>
        <button
          aria-controls={pickerListboxId}
          aria-expanded={modePickerOpen}
          aria-haspopup="listbox"
          aria-keyshortcuts="ArrowDown ArrowUp Home End Enter Space Escape"
          aria-labelledby={`${pickerLabelId} ${selectedModeLabelId}`}
          className="inline-flex h-8 max-w-full min-w-0 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          data-state={modePickerOpen ? 'open' : 'closed'}
          data-testid="product-mode-picker"
          disabled={disabled}
          ref={pickerButtonRef}
          title={selectedOption ? t(selectedOption.descriptionKey) : undefined}
          type="button"
          onClick={handleModePickerToggle}
          onKeyDown={handlePickerButtonKeyDown}
        >
          <span className="max-w-[10rem] truncate" id={selectedModeLabelId}>
            {selectedOption ? t(selectedOption.labelKey) : selectedMode}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${modePickerOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {modePickerOpen && !disabled && (
          <div
            aria-activedescendant={activeOptionId}
            aria-labelledby={pickerLabelId}
            className="absolute left-0 top-9 z-50 max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-modal-small"
            id={pickerListboxId}
            ref={pickerListboxRef}
            role="listbox"
            tabIndex={-1}
            onKeyDown={handleModeListKeyDown}
          >
            {modeOptions.map(option => (
              <button
                key={option.id}
                id={`${pickerListboxId}-option-${option.id}`}
                aria-selected={option.id === selectedMode}
                className={`flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-xs outline-none transition-colors hover:bg-accent focus-visible:bg-accent ${option.id === activeMode ? 'bg-accent ring-1 ring-ring composer-mode-active' : ''}`}
                data-active={option.id === activeMode}
                data-product-mode-option={option.id}
                role="option"
                tabIndex={-1}
                type="button"
                onClick={() => handleModeSelect(option.id)}
                onFocus={() => setActiveMode(option.id)}
                onMouseEnter={() => setActiveMode(option.id)}
              >
                <span className="font-medium text-foreground">{t(option.labelKey)}</span>
                <span className="line-clamp-2 text-muted-foreground">{t(option.descriptionKey)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        aria-label={t('workbench.toolbar.actionsAriaLabel')}
        className="flex min-w-0 flex-wrap items-center gap-1 rounded-md border border-border/60 bg-muted/20 p-1"
        data-testid="product-mode-actions"
        role="group"
      >
        {primaryActions.map(action => {
          const actionLabel = t(action.labelKey);
          const actionDescription = t(action.descriptionKey);
          const ActionIcon = ACTION_ICON_BY_ID[action.id];

          return (
            <button
              key={action.id}
              aria-label={`${actionLabel}: ${actionDescription}`}
              className="inline-flex h-7 max-w-[9.5rem] min-w-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] border border-border/70 bg-background px-2 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              data-product-mode-action={action.id}
              disabled={disabled}
              title={actionDescription}
              type="button"
              onClick={() => handleActionSelect(action.id)}
            >
              <ActionIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{actionLabel}</span>
            </button>
          );
        })}

        <div className="relative">
          <button
            aria-controls={actionMenuId}
            aria-expanded={actionMenuOpen}
            aria-haspopup="menu"
            aria-label={t('workbench.toolbar.moreActionsAriaLabel')}
            className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-transparent px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            data-state={actionMenuOpen ? 'open' : 'closed'}
            data-testid="product-mode-action-overflow"
            disabled={disabled}
            ref={actionMenuButtonRef}
            title={t('workbench.toolbar.moreActionsAriaLabel')}
            type="button"
            onClick={handleActionMenuToggle}
            onKeyDown={handleActionMenuButtonKeyDown}
          >
            <MoreHorizontal aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className={compactMode ? 'sr-only' : 'hidden sm:inline'}>
              {t('workbench.toolbar.moreActions')}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 transition-transform ${actionMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {actionMenuOpen && !disabled && (
            <div
              className="absolute right-0 top-8 z-50 w-72 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-modal-small"
              id={actionMenuId}
              ref={actionMenuRef}
              role="menu"
            >
              {overflowActions.map(action => {
                const actionLabel = t(action.labelKey);
                const actionDescription = t(action.descriptionKey);
                const ActionIcon = ACTION_ICON_BY_ID[action.id];

                return (
                  <button
                    key={action.id}
                    aria-label={`${actionLabel}: ${actionDescription}`}
                    className="flex w-full min-w-0 items-start gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                    data-product-mode-action={action.id}
                    role="menuitem"
                    tabIndex={-1}
                    title={actionDescription}
                    type="button"
                    onClick={() => handleActionSelect(action.id)}
                  >
                    <ActionIcon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{actionLabel}</span>
                      <span className="line-clamp-2 text-muted-foreground">{actionDescription}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
