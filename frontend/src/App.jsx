import { useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage/AuthPage.jsx';
import WorkspacePage from './pages/WorkspacePage/WorkspacePage.jsx';

const STORAGE_KEY_TOKEN = 'auth_token';
const STORAGE_KEY_USER = 'auth_user';
const STORAGE_KEY_SETTINGS = 'app_settings';

const defaultSettings = {
  theme: 'dark',
  language: 'ru',
  notifications: false,
};

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem(STORAGE_KEY_TOKEN)
  );
  const [user, setUser] = useState(
    () => loadFromStorage(STORAGE_KEY_USER, null)
  );
  const [settings, setSettings] = useState(
    () => loadFromStorage(STORAGE_KEY_SETTINGS, defaultSettings)
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  const handleLogin = (userData) => {
    // TODO: заменить на реальный API-вызов
    const mockToken = 'mock_jwt_token_' + Date.now();
    const mockUser = userData || { name: 'Анна Иванова', email: 'anna@example.com' };

    localStorage.setItem(STORAGE_KEY_TOKEN, mockToken);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(mockUser));
    setUser(mockUser);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    setUser(null);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={handleLogin} />;
  }

  return (
    <WorkspacePage
      user={user}
      settings={settings}
      onUpdateSettings={setSettings}
      onLogout={handleLogout}
    />
  );
}

export default App;
