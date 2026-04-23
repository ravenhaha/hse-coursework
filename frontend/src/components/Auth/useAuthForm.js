import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth'; // поправь путь под свою структуру

export default function useAuthForm() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);

  const hasEmail = email.trim().length > 0;
  const hasPassword = password.trim().length > 0;
  const isFormReady = mode === 'login'
    ? hasEmail && hasPassword
    : hasEmail && hasPassword
      && confirmPassword.trim().length > 0
      && password.length >= 8
      && password === confirmPassword;

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorText('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorText('');

    if (!email.trim() || !password.trim()) {
      setErrorText('Заполните email и пароль.');
      return;
    }
    if (mode === 'register' && password.length < 8) {
      setErrorText('Пароль должен содержать минимум 8 символов.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setErrorText('Пароли не совпадают.');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (mode === 'register') {
        await register(cleanEmail, password);
      } else {
        await login(cleanEmail, password);
      }
      navigate('/workspace'); // куда редиректить после входа — поменяй если надо
    } catch (err) {
      setErrorText(err.message || 'Ошибка авторизации.');
    } finally {
      setLoading(false);
    }
  };

  return {
    mode, email, password, confirmPassword, errorText, loading, isFormReady,
    setEmail, setPassword, setConfirmPassword,
    switchMode, handleSubmit,
  };
}