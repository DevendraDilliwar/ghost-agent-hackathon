import { useState, useEffect, useRef } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { ArrowUp, ChevronDown, Mic, MicOff, Plus, Sparkles, X } from 'lucide-react';
import type { ApprovalMode, RunConfiguration } from '../../../../shared/contracts/task';
import { BUDGET_PRESETS, matchBudgetPreset } from './task-presentation';

interface TaskComposerProps {
  displayName?: string;
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
  onBudgetChange: (maxSteps: number, maxMinutes: number) => void;
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
  displayName = 'Ghost Agent',
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
  onBudgetChange,
}: TaskComposerProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'hi-IN' | 'en-US'>('hi-IN');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const voicePrefix = useRef('');

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
            setGoal(`${voicePrefix.current}${voicePrefix.current ? ' ' : ''}${transcript}`);
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
      setVoiceError('Voice input is unavailable in this environment. Please type your task.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setVoiceError(null);
      try {
        voicePrefix.current = goal;
        recognitionRef.current.lang = voiceLang;
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  }

  const canSubmit = connected && !busy && Boolean(goal.trim()) && (!modelReady || (ready && screenConsent && isolatedEnvironment));
  const submitLabel = busy ? 'Running Task...' : !connected ? 'Desktop app required' : !modelReady ? 'Set up & continue' : !ready ? 'Desktop not ready' : !screenConsent || !isolatedEnvironment ? 'Enable desktop permissions in settings' : approvalMode === 'full_access' ? 'Execute Autonomously' : 'Execute Step-by-Step';

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

  const [showPrompts, setShowPrompts] = useState(false);

  const quickTemplates = [
    { label: '🇮🇳 Tally Invoice', text: 'Tally me 50,000 ka GST invoice create karo' },
    { label: '📊 Table to Excel', text: 'Extract active table on screen to an Excel spreadsheet' },
    { label: '🧹 Downloads Cleanup', text: 'Organize files in Downloads folder and generate summary report' }
  ];

  return (
    <form onSubmit={submit} aria-label="Send a desktop task" className="task-composer">
      {showPrompts && (
        <div className="composer-menu" aria-label="Task suggestions">
          <div className="composer-menu-heading"><span><Sparkles size={15} />Try a task</span><button type="button" className="chat-icon-button" aria-label="Close task suggestions" onClick={() => setShowPrompts(false)}><X size={16} /></button></div>
          {quickTemplates.map(item => <button key={item.label} type="button" onClick={() => { setGoal(item.text); setShowPrompts(false); textareaRef.current?.focus(); }}>{item.label}</button>)}
          <button type="button" onClick={() => setVoiceLang(voiceLang === 'hi-IN' ? 'en-US' : 'hi-IN')}>Voice language: {voiceLang === 'hi-IN' ? 'Hindi' : 'English'}<ChevronDown size={14} /></button>
        </div>
      )}
      <div className="composer-budget" role="group" aria-label="Task budget">
        <span className="composer-budget-label">Budget</span>
        {BUDGET_PRESETS.map(preset => {
          const active = matchBudgetPreset(maxSteps, maxMinutes) === preset.id;
          return (
            <button key={preset.id} type="button" title={preset.hint}
              aria-pressed={active} aria-label={preset.label + ' budget: ' + preset.hint}
              className={`composer-budget-option${active ? ' is-active' : ''}`}
              disabled={busy} onClick={() => onBudgetChange(preset.maxSteps, preset.maxMinutes)}>
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className={`composer-capsule ${isListening ? 'is-listening' : ''}`}>
        <button type="button" className="chat-icon-button composer-plus" disabled={busy} aria-label="Open task suggestions" aria-expanded={showPrompts} onClick={() => setShowPrompts(value => !value)}><Plus /></button>
        <textarea
          ref={textareaRef}
          id="task-goal"
          aria-label={`Message ${displayName}`}
          aria-describedby="task-entry-help"
          value={goal}
          onChange={event => {
            setGoal(event.target.value);
            event.target.style.height = 'auto';
            event.target.style.height = `${Math.min(event.target.scrollHeight, 144)}px`;
          }}
          onKeyDown={keyDown}
          maxLength={2000}
          rows={1}
          disabled={busy}
          placeholder={isListening ? 'Listening…' : `Ask ${displayName}`}
        />
        <button type="button" className={`chat-icon-button ${isListening ? 'voice-active' : ''}`} onClick={toggleVoice} disabled={busy} aria-label={isListening ? 'Stop listening' : 'Speak task using microphone'} aria-pressed={isListening}>{isListening ? <MicOff /> : <Mic />}</button>
        {goal.trim() && <button type="submit" disabled={!canSubmit} title={submitLabel} aria-label={submitLabel} className="composer-send"><ArrowUp size={19} /></button>}
      </div>
      <span id="task-entry-help" className="sr-only">Enter to send. Shift and Enter for a new line. Desktop app and permissions required to run tasks.</span>
      {voiceError && <p role="status" className="composer-feedback">{voiceError}</p>}
    </form>
  );
}
