import { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import type { ChatMessage } from '../../../../shared/contracts/task';

export function MessageFeed({ messages }: { messages: ChatMessage[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (!messages.length) {
    return null;
  }

  return (
    <div className="space-y-4 py-2">
      {messages.map(message => {
        const isUser = message.sender === 'user';
        return (
          <article
            key={message.id}
            className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 px-1">
              <div className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                isUser ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white'
              }`}>
                {isUser ? <User className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
              </div>
              <span className="text-[10px] font-medium text-slate-500">
                {isUser ? 'You' : 'NoMCP Agent'} · {message.timestamp}
              </span>
            </div>

            <div
              className={isUser
                ? 'max-w-[85%] rounded-2xl bg-slate-900 p-4 text-sm font-medium leading-relaxed text-white shadow-sm'
                : 'max-w-[95%] py-1 text-sm leading-relaxed text-slate-800'}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </article>
        );
      })}
      <div ref={end} />
    </div>
  );
}
