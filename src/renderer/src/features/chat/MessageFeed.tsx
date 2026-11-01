import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import type { ChatMessage } from '../../../../shared/contracts/task';

export function MessageFeed({ messages }: { messages: ChatMessage[] }) {
  const end = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  if (!messages.length) return null;

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
      setCopyError(false);
    } catch { setCopyError(true); }
  }

  return (
    <div className="message-feed">
      {messages.map(message => {
        const isUser = message.sender === 'user';
        return (
          <article key={message.id} className={`chat-message ${isUser ? 'user-message' : 'agent-message'}`}>
            {!isUser && <div className="message-author"><span className="brand-spark" aria-hidden="true">✦</span><span>Ghost</span></div>}
            <div className="message-body"><p>{message.content}</p></div>
            {message.verificationImage && <figure className="message-image"><img src={message.verificationImage} alt="Desktop evidence captured for this task" /><a className="image-download" href={message.verificationImage} download={`ghost-${message.id}.png`} aria-label="Download desktop evidence"><Download size={19} /></a></figure>}
            {!isUser && <div className="message-actions"><button type="button" className="chat-icon-button" aria-label={copied === message.id ? 'Message copied' : 'Copy response'} title="Copy response" onClick={() => void copyMessage(message)}>{copied === message.id ? <Check /> : <Copy />}</button><time>{message.timestamp}</time></div>}
          </article>
        );
      })}
      {copyError && <p role="status" className="composer-feedback">Could not copy. You can select and copy the message text.</p>}
      <div ref={end} />
    </div>
  );
}
