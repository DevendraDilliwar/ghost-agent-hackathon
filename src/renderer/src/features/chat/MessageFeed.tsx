import { useEffect, useRef } from 'react';
import { Eye, ShieldCheck, Sparkles, Mic, Bot, User } from 'lucide-react';
import type { ChatMessage } from '../../../../shared/contracts/task';

export function MessageFeed({ messages }: { messages: ChatMessage[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (!messages.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center sm:py-12">
        {/* Glow Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1 text-xs font-semibold text-slate-600">
          <Sparkles className="h-3.5 w-3.5 text-slate-500 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Universal Software Operator · Zero MCP</span>
        </div>

        <h2 className="max-w-lg text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          Operate Any Software. <span className="text-emerald-600">Just by Seeing It.</span>
        </h2>
        
        <p className="mt-2.5 max-w-md text-xs leading-relaxed text-slate-500">
          No per-app API integrations. From legacy ERPs & Tally to desktop browsers, NoMCP sees your screen, plans actions, and operates your PC with visual verification.
        </p>

        {/* 3 Pillar Cards */}
        <div className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="glow-card rounded-2xl border border-slate-200 bg-white p-4 text-left">
            <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Eye className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">Vision Observe</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Reads the selected desktop through a fresh screenshot before every step.
            </p>
          </div>

          <div className="glow-card rounded-2xl border border-slate-200 bg-white p-4 text-left">
            <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">PRISM Verify</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Compares before & after screenshots to verify if action succeeded or error appeared.
            </p>
          </div>

          <div className="glow-card rounded-2xl border border-slate-200 bg-white p-4 text-left">
            <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Mic className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">Hindi & English</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Speak tasks naturally in Hindi or English using the microphone button below.
            </p>
          </div>
        </div>
      </div>
    );
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
              className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                isUser
                  ? 'bg-slate-900 text-white font-medium'
                  : 'border border-slate-200 bg-white text-slate-700'
              }`}
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
