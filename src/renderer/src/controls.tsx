import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FloatingControlsView } from './features/overlay/FloatingControlsView';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Controls root is missing.');
createRoot(root).render(<StrictMode><FloatingControlsView /></StrictMode>);
