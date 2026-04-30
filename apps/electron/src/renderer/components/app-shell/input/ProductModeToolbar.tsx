import * as React from 'react';
import { useTranslation } from 'react-i18next';

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
  const selectedOption = modeOptions.find(option => option.id === selectedMode) ?? modeOptions[0];

  const handleModeSelect = React.useCallback((mode: ProductMode) => {
    setModePickerOpen(false);
    onModeChange(mode);
  }, [onModeChange]);

  return (
    <div
      className="flex flex-col gap-2 border-b border-border/50 px-2 py-2 sm:flex-row sm:items-center sm:justify-between"
      data-testid="product-mode-toolbar"
    >
      <div className="relative flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={compactMode ? 'sr-only' : 'shrink-0'} id="product-mode-picker-label">
          {t('workbench.toolbar.mode')}
        </span>
        <button
          aria-expanded={modePickerOpen}
          aria-haspopup="listbox"
          aria-label={t('workbench.toolbar.modeAriaLabel')}
          aria-labelledby="product-mode-picker-label"
          className="inline-flex h-8 max-w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground shadow-sm outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="product-mode-picker"
          disabled={disabled}
          type="button"
          onClick={() => setModePickerOpen(open => !open)}
        >
          <span className="max-w-[10rem] truncate">{selectedOption ? t(selectedOption.labelKey) : selectedMode}</span>
          <span aria-hidden="true" className="text-muted-foreground">v</span>
        </button>
        {modePickerOpen && !disabled && (
          <div
            aria-labelledby="product-mode-picker-label"
            className="absolute left-0 top-9 z-50 max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
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
        {actions.map(action => (
          <button
            key={action.id}
            aria-label={t(action.ariaLabelKey)}
            className="rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            data-product-mode-action={action.id}
            disabled={disabled}
            type="button"
            onClick={() => onIntent(createProductModeIntent(action.id, selectedMode))}
          >
            {t(action.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
