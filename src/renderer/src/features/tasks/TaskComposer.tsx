import { useState, useEffect, useRef } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Send, Mic, MicOff, Sparkles, Check, Globe, Zap, Shield } from 'lucide-react';
import type { ApprovalMode, RunConfiguration } from '../../../../shared/contracts/task';

interface TaskComposerProps {
  connected: boolean;
  modelReady: boolean;
  ready: boolean;
  busy: boolean;
  initialGoal: string;
  initialLimit: number;
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
  initialLimit,
  onOpenSetup,
  onLaunch,
}: TaskComposerProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [maxSteps, setMaxSteps] = useState(initialLimit);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('full_access');
  const [screenConsent, setScreenConsent] = useState(true);
  const [isolatedEnvironment, setIsolatedEnvironment] = useState(true);
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

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSubmit) return;
    if (!modelReady) { onOpenSetup(); return; }
    onLaunch({ goal: goal.trim(), maxSteps, approvalMode, screenConsent, isolatedEnvironment });
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
            <button
              type="button"
              onClick={() => setVoiceLang(voiceLang === 'hi-IN' ? 'en-US' : 'hi-IN')}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
              title="Click to toggle voice language"
            >
              <Globe className="h-2.5 w-2.5 text-slate-400" />
              <span>{voiceLang === 'hi-IN' ? '🇮🇳 Hindi' : '🌐 English'}</span>
            </button>
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3" onClick={e => e.stopPropagation()}>
          {/* Left: Voice Mic + Voice Wave + Shortcut hint */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleVoice}
              disabled={busy}
              className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer transition-all ${
                isListening
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title={isListening ? 'Click to stop listening' : 'Speak task in Hindi or English'}
            >
              {isListening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  <span>Listening...</span>
                  <div className="flex items-center gap-0.5 ml-1">
                    <span className="voice-bar" />
                    <span className="voice-bar" />
                    <span className="voice-bar" />
                    <span className="voice-bar" />
                  </div>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  <span>Voice Prompt</span>
                </>
              )}
            </button>

            <span className="hidden sm:inline-block text-[11px] text-slate-500">
              Enter to send · Shift + Enter for new line
            </span>
          </div>

          {/* Right: Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Running Task...' : !connected ? 'Desktop app required' : !modelReady ? 'Set up & continue' : !ready ? 'Desktop not ready' : !screenConsent || !isolatedEnvironment ? 'Enable switches below' : approvalMode === 'full_access' ? 'Execute Autonomously' : 'Execute Step-by-Step'}
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Autonomous Full Control vs Supervised Approval Selector */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 border border-slate-200 rounded-2xl text-xs">
        <button
          type="button"
          onClick={() => setApprovalMode('full_access')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold transition-all cursor-pointer ${
            approvalMode === 'full_access'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
          <span>Full Autonomous Mode</span>
        </button>
        <button
          type="button"
          onClick={() => setApprovalMode('ask_approval')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-semibold transition-all cursor-pointer ${
            approvalMode === 'ask_approval'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Shield className="h-3.5 w-3.5 text-emerald-600" />
          <span>Step-by-Step Approval</span>
        </button>
      </div>

      {/* Permissions Switches as Modern Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
        <label className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer ${
          screenConsent ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            screenConsent ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
          }`}>
            {screenConsent && <Check className="h-3 w-3 stroke-[3]" />}
          </div>
          <input
            type="checkbox"
            checked={screenConsent}
            onChange={e => setScreenConsent(e.target.checked)}
            disabled={busy}
            className="sr-only"
          />
          <span className="text-[11px] leading-tight text-slate-600">
            Allow AI vision processing of desktop screenshots
          </span>
        </label>

        <label className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer ${
          isolatedEnvironment ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            isolatedEnvironment ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
          }`}>
            {isolatedEnvironment && <Check className="h-3 w-3 stroke-[3]" />}
          </div>
          <input
            type="checkbox"
            checked={isolatedEnvironment}
            onChange={e => setIsolatedEnvironment(e.target.checked)}
            disabled={busy}
            className="sr-only"
          />
          <span className="text-[11px] leading-tight text-slate-600">
            Running on verified test desktop environment
          </span>
        </label>
      </div>

      {/* Task Limits Drawer */}
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer hover:text-slate-700 text-[11px] font-medium">
          Advanced Limits & Execution Safety
        </summary>
        <div className="mt-2.5 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <span className="text-[11px] text-slate-600">Maximum autonomous actions:</span>
          <select
            id="action-limit"
            value={maxSteps}
            onChange={event => setMaxSteps(Number(event.target.value))}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 outline-none"
          >
            {[5, 10, 15, 20, 30].map(value => (
              <option key={value} value={value}>{value} actions</option>
            ))}
          </select>
        </div>
      </details>
    </form>
  );
}
