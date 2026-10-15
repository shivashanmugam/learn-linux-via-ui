import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { BigPicturePage } from '../pages/BigPicturePage.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BigPicturePage />
  </StrictMode>,
);
