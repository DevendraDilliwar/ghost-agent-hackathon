import { AgentChatView } from '../features/chat/AgentChatView';
import { useTaskRuntime } from '../features/tasks/useTaskRuntime';

export function App() {
  const runtime = useTaskRuntime();
  return (
    <main className="relative flex h-dvh min-h-[420px] bg-slate-950 p-3 text-slate-100 sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-indigo-950/30 to-transparent" />
      <div className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-col">
        <p className="mb-3 shrink-0 text-center text-xs tracking-wide text-slate-400">Give your desktop a task. Stay in control.</p>
        <AgentChatView runtime={runtime} />
      </div>
    </main>
  );
}
