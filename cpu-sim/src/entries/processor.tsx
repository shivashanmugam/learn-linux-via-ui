import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { ProcessorPage } from '../pages/ProcessorPage.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProcessorPage />
  </StrictMode>,
);
