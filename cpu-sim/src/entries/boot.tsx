import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { BootPage } from '../pages/BootPage.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootPage />
  </StrictMode>,
);
