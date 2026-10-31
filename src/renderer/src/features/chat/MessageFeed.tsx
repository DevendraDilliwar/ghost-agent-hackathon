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
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-sky-300 shadow-lg shadow-sky-500/10">
          <Sparkles className="h-3.5 w-3.5 text-sky-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Universal Software Operator · Zero MCP</span>
        </div>

        <h2 className="max-w-lg text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          Operate Any Software. <span className="gradient-text-cyber">Just by Seeing It.</span>
        </h2>
        
        <p className="mt-2.5 max-w-md text-xs leading-relaxed text-slate-400">
          No API required. From legacy ERPs & Tally to desktop browsers, NoMCP sees your screen, plans actions, and operates your PC with visual verification.
        </p>

        {/* 3 Pillar Cards */}
        <div className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="glow-card rounded-2xl border border-white/10 bg-[#0e1424] p-4 text-left">
            <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <Eye className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-200">SAM 3.1 Eyes</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Grounds UI buttons, fields & menus on any screen without coordinates guessing.
            </p>
          </div>

          <div className="glow-card rounded-2xl border border-white/10 bg-[#0e1424] p-4 text-left">
            <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-200">Wonder PRISM</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Compares before & after screenshots to verify if action succeeded or error appeared.
            </p>
          </div>

          <div className="glow-card rounded-2xl border border-white/10 bg-[#0e1424] p-4 text-left">
            <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
              <Mic className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-200">Hindi & English</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
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
                isUser ? 'bg-indigo-600 text-white' : 'bg-sky-600 text-white'
              }`}>
                {isUser ? <User className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
              </div>
              <span className="text-[10px] font-medium text-slate-400">
                {isUser ? 'You' : 'NoMCP Agent'} · {message.timestamp}
              </span>
            </div>

            <div
              className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-lg ${
                isUser
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium shadow-indigo-600/20'
                  : 'border border-white/10 bg-[#0e1424] text-slate-200 shadow-black/40'
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
