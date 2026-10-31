import { AgentChatView } from '../features/chat/AgentChatView';
import { useTaskRuntime } from '../features/tasks/useTaskRuntime';

export function App() {
  const runtime = useTaskRuntime();
  return (
    <main className="relative flex h-dvh min-h-[500px] bg-[#06080f] p-2.5 text-slate-100 sm:p-4 md:p-6 overflow-hidden">
      {/* Ambient background light spheres */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-indigo-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-sky-500/12 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[150px]" />

      <div className="relative mx-auto flex min-h-0 w-full max-w-4xl flex-col">
        <AgentChatView runtime={runtime} />
      </div>
    </main>
  );
}
