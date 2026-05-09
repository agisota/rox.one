import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

import {
  createProductModeIntent,
  getComposerProductModeActions,
  getComposerProductModeOptions,
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

export function ProductModeToolbar({
  selectedMode,
  onModeChange,
  onIntent,
  disabled = false,
  compactMode = false,
}: ProductModeToolbarProps) {
  const { t } = useTranslation();
  const modeOptions = React.useMemo(() => getComposerProductModeOptions(), []);
  const actions = React.useMemo(() => getComposerProductModeActions(), []);
  const [modePickerOpen, setModePickerOpen] = React.useState(false);
  const toolbarId = React.useId();
  const pickerLabelId = `product-mode-picker-label-${toolbarId}`;
  const pickerListboxId = `product-mode-picker-listbox-${toolbarId}`;
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const selectedOption = modeOptions.find(option => option.id === selectedMode) ?? modeOptions[0];

  const handleModeSelect = React.useCallback((mode: ProductMode) => {
    setModePickerOpen(false);
    onModeChange(mode);
  }, [onModeChange]);

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
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [modePickerOpen]);

  React.useEffect(() => {
    if (disabled) {
      setModePickerOpen(false);
    }
  }, [disabled]);

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
          aria-label={t('workbench.toolbar.modeAriaLabel')}
          aria-labelledby={pickerLabelId}
          className="inline-flex h-8 max-w-full min-w-0 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          data-state={modePickerOpen ? 'open' : 'closed'}
          data-testid="product-mode-picker"
          disabled={disabled}
          title={selectedOption ? t(selectedOption.descriptionKey) : undefined}
          type="button"
          onClick={() => setModePickerOpen(open => !open)}
        >
          <span className="max-w-[10rem] truncate">{selectedOption ? t(selectedOption.labelKey) : selectedMode}</span>
          <ChevronDown
            aria-hidden="true"
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${modePickerOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {modePickerOpen && !disabled && (
          <div
            aria-labelledby={pickerLabelId}
            className="absolute left-0 top-9 z-50 max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-modal-small"
            id={pickerListboxId}
            role="listbox"
          >
            {modeOptions.map(option => (
              <button
                key={option.id}
                aria-selected={option.id === selectedMode}
                className="flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-xs outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                data-product-mode-option={option.id}
                role="option"
                type="button"
                onClick={() => handleModeSelect(option.id)}
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
        className="flex min-w-0 flex-wrap items-center gap-1"
        role="group"
      >
        {actions.map(action => {
          const actionLabel = t(action.labelKey);
          const actionDescription = t(action.descriptionKey);

          return (
            <button
              key={action.id}
              aria-label={`${actionLabel}: ${actionDescription}`}
              className="whitespace-nowrap rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              data-product-mode-action={action.id}
              disabled={disabled}
              title={actionDescription}
              type="button"
              onClick={() => onIntent(createProductModeIntent(action.id, selectedMode))}
            >
              {actionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
