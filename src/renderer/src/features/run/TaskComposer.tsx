import { useState, useEffect, useRef } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Send, Mic, MicOff, Sparkles, Globe } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { ApprovalMode, RunConfiguration } from '../../../../shared/contracts/task';

interface TaskComposerProps {
  connected: boolean;
  modelReady: boolean;
  ready: boolean;
  busy: boolean;
  initialGoal: string;
  approvalMode: ApprovalMode;
  screenConsent: boolean;
  isolatedEnvironment: boolean;
  maxSteps: number;
  maxMinutes: number;
  onOpenSetup: () => void;
  onLaunch: (configuration: RunConfiguration) => void;
}

// Web Speech API Types
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function TaskComposer({
  connected,
  modelReady,
  ready,
  busy,
  initialGoal,
  approvalMode,
  screenConsent,
  isolatedEnvironment,
  maxSteps,
  maxMinutes,
  onOpenSetup,
  onLaunch,
}: TaskComposerProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'hi-IN' | 'en-US'>('hi-IN');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      try {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = voiceLang;

        recognition.onstart = () => {
          setIsListening(true);
          setVoiceError(null);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0]?.[0]?.transcript;
          if (transcript) {
            setGoal(prev => (prev ? `${prev} ${transcript}` : transcript));
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          setIsListening(false);
          if (event.error !== 'no-speech') {
            setVoiceError(`Voice error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Speech recognition setup failed:', e);
      }
    }
    return () => {
      recognitionRef.current?.abort();
    };
  }, [voiceLang]);

  function toggleVoice() {
    if (!recognitionRef.current) {
      // Fallback demo speech fill
      const demoText = voiceLang === 'hi-IN' 
        ? 'Tally me 50,000 ka invoice generate karo aur Excel sheet banao'
        : 'Open the accounting software, enter the pending invoice and export report';
      setGoal(demoText);
      setVoiceError('Microphone simulated with demo voice command.');
      setTimeout(() => setVoiceError(null), 3000);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setVoiceError(null);
      try {
        recognitionRef.current.lang = voiceLang;
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  }

  const canSubmit = connected && !busy && Boolean(goal.trim()) && (!modelReady || (ready && screenConsent && isolatedEnvironment));
  const submitLabel = busy ? 'Running Task...' : !connected ? 'Desktop app required' : !modelReady ? 'Set up & continue' : !ready ? 'Desktop not ready' : !screenConsent || !isolatedEnvironment ? 'Enable switches below' : approvalMode === 'full_access' ? 'Execute Autonomously' : 'Execute Step-by-Step';

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSubmit) return;
    if (!modelReady) { onOpenSetup(); return; }
    onLaunch({ goal: goal.trim(), maxSteps, maxMinutes, approvalMode, screenConsent, isolatedEnvironment });
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const quickTemplates = [
    { label: '🇮🇳 Tally Invoice', text: 'Tally me 50,000 ka GST invoice create karo' },
    { label: '📊 Table to Excel', text: 'Extract active table on screen to an Excel spreadsheet' },
    { label: '🧹 Downloads Cleanup', text: 'Organize files in Downloads folder and generate summary report' }
  ];

  return (
    <form onSubmit={submit} aria-label="Send a desktop task" className="space-y-4">
      {/* Quick Template Prompt Chips */}
      {!busy && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-slate-400" />
            Quick Prompts:
          </span>
          {quickTemplates.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setGoal(item.text);
                textareaRef.current?.focus();
              }}
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Console Container */}
      <div 
        onClick={() => textareaRef.current?.focus()}
        className={`relative rounded-3xl border p-4 cursor-text transition-colors duration-150 ${
        isListening
          ? 'border-emerald-500 bg-white shadow-md shadow-emerald-500/10'
          : 'border-slate-200 bg-white focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200'
      }`}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <label htmlFor="task-goal" className="text-xs font-bold tracking-wide text-slate-700 cursor-text">
            Task Instruction
          </label>

          {/* Voice Language Toggle */}
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <Button
              type="button"
              onClick={() => setVoiceLang(voiceLang === 'hi-IN' ? 'en-US' : 'hi-IN')}
              variant="ghost"
              size="sm"
              title="Click to toggle voice language"
            >
              <Globe className="h-2.5 w-2.5 text-slate-400" />
              <span>{voiceLang === 'hi-IN' ? '🇮🇳 Hindi' : '🌐 English'}</span>
            </Button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          id="task-goal"
          value={goal}
          onChange={event => setGoal(event.target.value)}
          onKeyDown={keyDown}
          maxLength={2000}
          rows={3}
          disabled={busy}
          aria-describedby="task-entry-help"
          placeholder={isListening ? 'Listening to your voice... Speak now.' : 'Tell NoMCP what to do on your desktop... (e.g. "Tally me entry karo" or "Export report to Excel")'}
          className="mt-2 w-full resize-none bg-transparent text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 cursor-text caret-emerald-600"
        />

        {voiceError && (
          <p className="text-[10px] text-amber-600 mt-1">{voiceError}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3" onClick={e => e.stopPropagation()}>
          {/* Right: Voice Mic + Submit */}
          <button
            type="button"
            onClick={toggleVoice}
            disabled={busy}
            className={`flex h-10 w-10 items-center justify-center rounded-xl cursor-pointer transition-all ${
              isListening
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse'
                : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title={isListening ? 'Click to stop listening' : 'Speak task in Hindi or English'}
            aria-label={isListening ? 'Stop listening' : 'Speak task using microphone'}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <Button
            type="submit"
            disabled={!canSubmit}
            variant="default"
            size="icon"
            className="h-10 w-10"
            title={submitLabel}
            aria-label={submitLabel}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

    </form>
  );
}
