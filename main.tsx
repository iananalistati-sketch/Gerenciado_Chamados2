import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from "./contexts/AuthContext";
import './index.css';
import { ThemeProvider } from "./contexts/ThemeContext";
import MobileTargetVersionsManager from "./components/MobileTargetVersionsManager";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
        <MobileTargetVersionsManager />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);