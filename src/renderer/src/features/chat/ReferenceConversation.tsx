import { useState } from 'react';
import { Check, Copy, Download, MoreHorizontal, RotateCw, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import referenceEye from '../../assets/reference-eye.png';

export function ReferenceActions({ image = false }: { image?: boolean }) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  async function copyPrompt() {
    try { await navigator.clipboard.writeText('ok genrate'); setCopied(true); }
    catch { setNotice('Copy is unavailable. The reference prompt is: ok genrate'); }
  }
  return (
    <div className="reference-actions">
      <button type="button" aria-label="Good response" aria-pressed={rating === 'up'} title="Good response" onClick={() => setRating(rating === 'up' ? null : 'up')}><ThumbsUp /></button>
      <button type="button" aria-label="Bad response" aria-pressed={rating === 'down'} title="Bad response" onClick={() => setRating(rating === 'down' ? null : 'down')}><ThumbsDown /></button>
      {image ? <>
        <button type="button" aria-label="Regenerate image" title="Image generation is not connected in this reproduction" onClick={() => setNotice('This is the reference artwork. Image generation is not connected.')}><RotateCw /></button>
        <a href={referenceEye} download="blue-eye.png" aria-label="Save image" title="Save image"><Share2 /></a>
      </> : <button type="button" aria-label={copied ? 'Prompt copied' : 'Copy prompt'} title="Copy prompt" onClick={() => void copyPrompt()}>{copied ? <Check /> : <Copy />}</button>}
      <button type="button" aria-label="More response options" title="More" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><MoreHorizontal /></button>
      {menuOpen && <div className="reference-action-menu"><a href={referenceEye} download="blue-eye.png"><Download size={16} />Download image</a><button type="button" onClick={() => void copyPrompt()}><Copy size={16} />Copy prompt</button></div>}
      {notice && <button type="button" className="reference-action-notice" onClick={() => setNotice('')} role="status">{notice}</button>}
    </div>
  );
}

export function ReferenceConversation() {
  return (
    <div className="chat-thread reference-thread" aria-label="Reference conversation">
      <div className="chat-thread-content reference-content">
        <div className="reference-previous-actions"><ReferenceActions /></div>
        <div className="reference-user-row"><p>ok genrate</p></div>
        <figure className="reference-artwork"><img src={referenceEye} alt="Blue geometric eye with a luminous iris, circular orbital details and crosshairs on a pale background" /></figure>
        <ReferenceActions image />
      </div>
    </div>
  );
}
