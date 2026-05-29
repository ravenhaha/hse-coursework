// Базовая regex-валидация email.
// Простая, но отсекает 99% мусора: "test", "a@b", "a@b.c" и т.п.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isEmailValid = (email) =>
  EMAIL_REGEX.test(email.trim().toLowerCase());

// Популярные домены и их типичные опечатки → правильный вариант.
const COMMON_TYPOS = {
  // gmail
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.ru': 'gmail.com',
  // yandex
  'yandex.r': 'yandex.ru',
  'yandex.com': 'yandex.ru',
  'yandx.ru': 'yandex.ru',
  'yandex.u': 'yandex.ru',
  // mail.ru
  'mail.r': 'mail.ru',
  'mail.u': 'mail.ru',
  'maill.ru': 'mail.ru',
  'mial.ru': 'mail.ru',
  // yahoo
  'yahoo.co': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  // outlook
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  // icloud
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
};

export const suggestEmailFix = (email) => {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at === -1) return null;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!local || !domain) return null;

  const fixed = COMMON_TYPOS[domain];
  if (!fixed || fixed === domain) return null;

  return `${local}@${fixed}`;
};