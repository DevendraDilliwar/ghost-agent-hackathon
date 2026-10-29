import { AgentChatView } from '../features/chat/AgentChatView';
import { useTaskRuntime } from '../features/tasks/useTaskRuntime';

export function App() {
  const runtime = useTaskRuntime();
  return (
    <main className="relative min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-indigo-950/30 to-transparent" />
      <div className="relative mx-auto w-full max-w-3xl">
        <p className="mb-5 text-center text-xs tracking-wide text-slate-400">Give your desktop a task. Stay in control.</p>
        <AgentChatView runtime={runtime} />
      </div>
    </main>
  );
}
