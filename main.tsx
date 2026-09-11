import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from "./contexts/AuthContext";
import './index.css';
import { ThemeProvider } from "./contexts/ThemeContext";
import MobileTargetVersionsManager from "./components/MobileTargetVersionsManager";
import { AppDialogProvider } from "./contexts/AppDialogContext";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AppDialogProvider>
          <App />
          <MobileTargetVersionsManager />
        </AppDialogProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
