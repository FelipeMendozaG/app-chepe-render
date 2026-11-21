import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles/tokens.css';
import './ui/styles/global.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
