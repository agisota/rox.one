import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { PromptRewriteOutput } from '@rox-agent/shared/workbench';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useRegisterModal } from '../../../context/ModalContext';

export type PromptRewriteDialogStatus = 'idle' | 'loading' | 'success' | 'error';

export interface PromptRewriteDialogProps {
  open: boolean;
  status: PromptRewriteDialogStatus;
  output?: PromptRewriteOutput;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onAccept: (editedPrompt?: string) => void;
  onRetry?: () => void;
  onSendToSpecBuilder: (output: PromptRewriteOutput) => void;
}

export function PromptRewriteDialog({
  open,
  status,
  output,
  error,
  onOpenChange,
  onAccept,
  onRetry,
  onSendToSpecBuilder,
}: PromptRewriteDialogProps) {
  const { t } = useTranslation();
  const [editedPrompt, setEditedPrompt] = React.useState(output?.rewrittenPrompt ?? '');

  React.useEffect(() => {
    setEditedPrompt(output?.rewrittenPrompt ?? '');
  }, [output?.rewrittenPrompt]);

  useRegisterModal(open, () => onOpenChange(false));

  const canUseOutput = status === 'success' && output != null;
  const canAccept = canUseOutput && editedPrompt.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workbench.rewrite.dialog.title')}</DialogTitle>
          <DialogDescription>{t('workbench.rewrite.dialog.description')}</DialogDescription>
        </DialogHeader>

        {status === 'loading' ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {t('workbench.rewrite.loading')}
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="font-medium">{t('workbench.rewrite.errorTitle')}</div>
            <div>{error ?? t('workbench.rewrite.errors.providerFailed')}</div>
          </div>
        ) : null}

        {canUseOutput ? (
          <div className="grid gap-4 md:grid-cols-2">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {t('workbench.rewrite.originalPrompt')}
              </h3>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm">
                {output.originalPrompt}
              </pre>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {t('workbench.rewrite.rewrittenPrompt')}
              </h3>
              <textarea
                aria-label={t('workbench.rewrite.rewrittenPrompt')}
                className="min-h-72 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={editedPrompt}
                onChange={(event) => setEditedPrompt(event.target.value)}
              />
            </section>
            <section className="space-y-2 md:col-span-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {t('workbench.rewrite.diff')}
              </h3>
              <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm md:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('workbench.rewrite.before')}
                  </div>
                  <pre className="whitespace-pre-wrap text-muted-foreground">{output.originalPrompt}</pre>
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('workbench.rewrite.after')}
                  </div>
                  <pre className="whitespace-pre-wrap">{editedPrompt}</pre>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <DialogFooter>
          {status === 'error' && onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              {t('workbench.rewrite.retry')}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          {canUseOutput ? (
            <Button variant="outline" onClick={() => onSendToSpecBuilder(output)}>
              {t('workbench.rewrite.sendToSpecBuilder')}
            </Button>
          ) : null}
          <Button disabled={!canAccept} onClick={() => onAccept(editedPrompt)}>
            {t('workbench.rewrite.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
