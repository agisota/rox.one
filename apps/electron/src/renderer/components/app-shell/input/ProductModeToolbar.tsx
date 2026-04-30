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

  return (
    <div
      className="flex flex-col gap-2 border-b border-border/50 px-2 py-2 sm:flex-row sm:items-center sm:justify-between"
      data-testid="product-mode-toolbar"
    >
      <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={compactMode ? 'sr-only' : 'shrink-0'}>{t('workbench.toolbar.mode')}</span>
        <select
          aria-label={t('workbench.toolbar.modeAriaLabel')}
          className="h-8 max-w-full rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground shadow-sm outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
          data-testid="product-mode-select"
          disabled={disabled}
          value={selectedMode}
          onChange={(event) => onModeChange(event.target.value as ProductMode)}
        >
          {modeOptions.map(option => (
            <option key={option.id} value={option.id} title={t(option.descriptionKey)}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>

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
