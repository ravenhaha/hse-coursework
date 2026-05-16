// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './context/ToastContext';   // 🆕 добавить
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>                {/* 🆕 обернуть */}
      <App />
    </ToastProvider>               {/* 🆕 закрыть */}
  </React.StrictMode>,
);