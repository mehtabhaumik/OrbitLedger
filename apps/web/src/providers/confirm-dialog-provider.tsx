'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ConfirmTone = 'default' | 'danger';

type ConfirmDialogOptions = {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type PromptDialogOptions = ConfirmDialogOptions & {
  defaultValue?: string;
  inputLabel?: string;
  placeholder?: string;
  required?: boolean;
};

type ActiveDialog =
  | (ConfirmDialogOptions & {
      kind: 'confirm';
      resolve: (value: boolean) => void;
    })
  | (PromptDialogOptions & {
      kind: 'prompt';
      resolve: (value: string | null) => void;
    });

type ConfirmDialogContextValue = {
  confirm(options: ConfirmDialogOptions): Promise<boolean>;
  prompt(options: PromptDialogOptions): Promise<string | null>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [promptTouched, setPromptTouched] = useState(false);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setPromptTouched(false);
      setPromptValue('');
      setActiveDialog({
        ...options,
        kind: 'confirm',
        resolve,
      });
    });
  }, []);

  const prompt = useCallback((options: PromptDialogOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptTouched(false);
      setPromptValue(options.defaultValue ?? '');
      setActiveDialog({
        ...options,
        kind: 'prompt',
        resolve,
      });
    });
  }, []);

  const value = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);
  const promptError =
    activeDialog?.kind === 'prompt' && activeDialog.required && promptTouched && !promptValue.trim()
      ? 'Add a reason before continuing.'
      : null;

  function closeDialog() {
    if (!activeDialog) {
      return;
    }
    if (activeDialog.kind === 'confirm') {
      activeDialog.resolve(false);
    } else {
      activeDialog.resolve(null);
    }
    setActiveDialog(null);
  }

  function submitDialog() {
    if (!activeDialog) {
      return;
    }
    if (activeDialog.kind === 'prompt') {
      setPromptTouched(true);
      if (activeDialog.required && !promptValue.trim()) {
        return;
      }
      activeDialog.resolve(promptValue.trim());
    } else {
      activeDialog.resolve(true);
    }
    setActiveDialog(null);
  }

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {activeDialog ? (
        <div className="ol-confirm-backdrop" role="presentation" onMouseDown={closeDialog}>
          <section
            aria-modal="true"
            className="ol-confirm-card"
            data-tone={activeDialog.tone ?? 'default'}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="ol-confirm-header">
              <span className="ol-confirm-mark" aria-hidden="true" />
              <div>
                <h2>{activeDialog.title}</h2>
                <p>{activeDialog.message}</p>
              </div>
            </div>
            {activeDialog.detail ? <p className="ol-confirm-detail">{activeDialog.detail}</p> : null}
            {activeDialog.kind === 'prompt' ? (
              <label className="ol-field">
                <span>{activeDialog.inputLabel ?? 'Reason'}</span>
                <textarea
                  autoFocus
                  className={promptError ? 'ol-input ol-input--error' : 'ol-input'}
                  onChange={(event) => setPromptValue(event.target.value)}
                  onBlur={() => setPromptTouched(true)}
                  placeholder={activeDialog.placeholder}
                  rows={4}
                  value={promptValue}
                />
                {promptError ? <small className="ol-field-error">{promptError}</small> : null}
              </label>
            ) : null}
            <div className="ol-confirm-actions">
              <button className="ol-button-secondary" type="button" onClick={closeDialog}>
                {activeDialog.cancelLabel ?? 'Cancel'}
              </button>
              <button
                className={activeDialog.tone === 'danger' ? 'ol-button-danger' : 'ol-button'}
                type="button"
                onClick={submitDialog}
              >
                {activeDialog.confirmLabel ?? 'Continue'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used inside ConfirmDialogProvider.');
  }
  return context;
}
