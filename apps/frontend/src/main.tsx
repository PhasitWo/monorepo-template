import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ThemeProvider } from '@/contexts/theme-provider.tsx';
import { TooltipProvider } from './components/ui/tooltip.tsx';
import { Toaster } from '@/components/ui/sonner';
import { AppStateProvider } from './contexts/app-state-provider.tsx';
import { DialogAlertProvider } from './contexts/dialog-alert-provider.tsx';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <AppStateProvider>
      <DialogAlertProvider>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </DialogAlertProvider>
    </AppStateProvider>
    <Toaster />
  </ThemeProvider>,
);
