import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import type { ChatMessage } from '../../../../shared/contracts/task';

export function MessageFeed({ messages }: { messages: ChatMessage[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  if (!messages.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-indigo-400"><Sparkles className="h-6 w-6" /></div>
        <h3 className="text-base font-semibold">What would you like to do?</h3>
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-400">Start with a simple task in an isolated Ubuntu desktop. Review each proposed action and check the final result.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {messages.map(message => (
        <article key={message.id} className={'flex flex-col gap-1 ' + (message.sender === 'user' ? 'items-end' : 'items-start')}>
          <p className="text-[10px] text-slate-500">{message.sender === 'user' ? 'You' : 'Ghost Agent'} · {message.timestamp}</p>
          <p className={'max-w-[90%] whitespace-pre-wrap rounded-2xl p-3 text-xs leading-relaxed ' + (message.sender === 'user' ? 'bg-indigo-600 text-white' : 'border border-slate-800 bg-slate-900 text-slate-200')}>{message.content}</p>
        </article>
      ))}
      <div ref={end} />
    </div>
  );
}
