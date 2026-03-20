const loadedFonts = new Set();

export async function loadFont(fontFamily) {
  // Уже загружали — пропускаем
  if (loadedFonts.has(fontFamily)) return;

  // Формируем URL для Google Fonts
  const formattedName = fontFamily.replace(/ /g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@400;600;700&display=swap`;

  // Проверяем, не добавлен ли уже этот линк
  const existing = document.querySelector(`link[href="${url}"]`);
  if (existing) {
    loadedFonts.add(fontFamily);
    return;
  }

  // Создаём <link> и добавляем в <head>
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);

  // Ждём загрузки через промис
  await new Promise((resolve) => {
    link.onload = resolve;
    link.onerror = resolve; // не блокируем при ошибке
  });

  // Дополнительно ждём пока браузер реально загрузит шрифт
  try {
    await document.fonts.load(`16px "${fontFamily}"`);
    await document.fonts.ready;
  } catch {
    console.warn(`Не удалось загрузить шрифт: ${fontFamily}`);
  }

  loadedFonts.add(fontFamily);
  console.log(`✅ Шрифт загружен: ${fontFamily}`);
}

export function isFontLoaded(fontFamily) {
  return loadedFonts.has(fontFamily);
}