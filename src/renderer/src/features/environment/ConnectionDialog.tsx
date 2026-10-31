import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { TaskRuntimeView } from '../tasks/useTaskRuntime';
import { ConnectionSetup } from './ConnectionSetup';

interface ConnectionDialogProps {
  open: boolean;
  runtime: TaskRuntimeView;
  onClose: () => void;
}

export function ConnectionDialog({ open, runtime, onClose }: ConnectionDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog ref={dialog} aria-labelledby="connection-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl backdrop:bg-slate-900/50 sm:p-6">
      {open && <>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="connection-dialog-title" className="text-sm font-semibold">Connection settings</h2>
          <button type="button" onClick={onClose} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />Back to chat
          </button>
        </div>
        <ConnectionSetup runtime={runtime} />
        <p className="mt-4 text-xs leading-relaxed text-slate-500">Your task draft stays in the chat. Return there when setup is complete; connecting will not start a task.</p>
      </>}
    </dialog>
  );
}
