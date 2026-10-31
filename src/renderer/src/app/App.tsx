import { AgentChatView } from '../features/chat/AgentChatView';
import { useTaskRuntime } from '../features/tasks/useTaskRuntime';

export function App() {
  const runtime = useTaskRuntime();
  return (
    <main className="relative flex h-dvh min-h-[500px] bg-[#06080f] p-2 sm:p-4 md:p-5 overflow-hidden">
      <div className="relative mx-auto flex min-h-0 w-full max-w-4xl flex-col">
        <AgentChatView runtime={runtime} />
      </div>
    </main>
  );
}
