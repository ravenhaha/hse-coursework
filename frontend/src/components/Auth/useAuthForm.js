import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { isPasswordValid } from './components/passwordRules';

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
  const hasPassword = password.length > 0;

  const isFormReady =
    mode === 'login'
      ? hasEmail && hasPassword
      : hasEmail
        && isPasswordValid(password)
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

    if (!email.trim() || !password) {
      setErrorText('Заполните email и пароль.');
      return;
    }
    if (mode === 'register' && !isPasswordValid(password)) {
      setErrorText('Пароль не соответствует требованиям.');
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
      navigate('/workspace');
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