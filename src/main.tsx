import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from '../tokens';
import App from './App.tsx';
import './index.css';

// Injecte les variables de thème Atlas (tokens.ts) avant le premier render.
applyTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
