import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppThemeProvider } from './context/ThemeContext';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </React.StrictMode>
);
