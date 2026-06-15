export function checkPasswordRules(password) {
  return {
    length: password.length >= 8,
    letter: /[A-Za-zА-Яа-яЁё]/.test(password),
    digit: /\d/.test(password),
  };
}

export function isPasswordValid(password) {
  const r = checkPasswordRules(password);
  return r.length && r.letter && r.digit;
}

export const PASSWORD_RULES = [
  { key: 'length', text: 'Минимум 8 символов' },
  { key: 'letter', text: 'Хотя бы одна буква' },
  { key: 'digit', text: 'Хотя бы одна цифра' },
];