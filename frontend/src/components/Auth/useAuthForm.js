import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { isPasswordValid } from './components/passwordRules';
import { isEmailValid, suggestEmailFix } from './components/emailRules';

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
  const emailOk = isEmailValid(email);

  // Подсказка по опечатке домена (gmail.co → gmail.com и т.п.)
  // Показываем, только если email уже похож на email (есть @ и точка).
  const emailSuggestion = hasEmail ? suggestEmailFix(email) : null;

  const isFormReady =
    mode === 'login'
      ? hasEmail && hasPassword && emailOk
      : hasEmail
        && emailOk
        && isPasswordValid(password)
        && password === confirmPassword;

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorText('');
    setPassword('');
    setConfirmPassword('');
  };

  // Обёртки: при правке полей гасим прошлую серверную ошибку.
  const handleEmailChange = (v) => {
    setEmail(v);
    if (errorText) setErrorText('');
  };
  const handlePasswordChange = (v) => {
    setPassword(v);
    if (errorText) setErrorText('');
  };
  const handleConfirmChange = (v) => {
    setConfirmPassword(v);
    if (errorText) setErrorText('');
  };

  // Применить подсказку (юзер кликнул "Возможно, вы имели в виду …")
  const applyEmailSuggestion = () => {
    if (emailSuggestion) {
      setEmail(emailSuggestion);
      if (errorText) setErrorText('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorText('');

    if (!email.trim() || !password) {
      setErrorText('Заполните email и пароль.');
      return;
    }
    if (!emailOk) {
      setErrorText('Введите корректный email (например, name@example.com).');
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
      const msg = err?.message || '';
      const status = err?.status;

      if (status === 0 || !status) {
        setErrorText('Нет связи с сервером. Проверьте интернет.');
      } else if (status === 401) {
        setErrorText('Неверный email или пароль');
      } else if (status === 409 || /уже|exists|taken|registered/i.test(msg)) {
        setErrorText('Пользователь с таким email уже зарегистрирован');
      } else if (status === 422) {
        setErrorText('Проверьте правильность email и пароля');
      } else if (status >= 500) {
        setErrorText('Сервер временно недоступен. Попробуйте через минуту.');
      } else {
        setErrorText(msg || 'Не удалось выполнить вход');
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    mode,
    email,
    password,
    confirmPassword,
    errorText,
    loading,
    isFormReady,
    emailSuggestion,
    setEmail: handleEmailChange,
    setPassword: handlePasswordChange,
    setConfirmPassword: handleConfirmChange,
    applyEmailSuggestion,
    switchMode,
    handleSubmit,
  };
}