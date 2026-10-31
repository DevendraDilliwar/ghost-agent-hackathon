import { AgentChatView } from '../features/chat/AgentChatView';
import { useTaskRuntime } from '../features/tasks/useTaskRuntime';

export function App() {
  const runtime = useTaskRuntime();
  return (
    <main className="relative flex h-dvh min-h-[500px] bg-slate-100 p-2 sm:p-4 md:p-5 overflow-hidden">
      <div className="relative flex min-h-0 w-full flex-col">
        <AgentChatView runtime={runtime} />
      </div>
    </main>
  );
}
