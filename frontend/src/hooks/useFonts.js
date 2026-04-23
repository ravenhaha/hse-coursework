import { useState, useCallback } from 'react';

const FONT_CONFIGS = [
    { name: 'По умолчанию', value: '',                             url: null },
    { name: 'Inter',         value: 'Inter, sans-serif',            url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
    { name: 'Georgia',       value: 'Georgia, serif',               url: null },
    { name: 'Merriweather',  value: 'Merriweather, serif',          url: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap' },
    { name: 'Fira Code',     value: '"Fira Code", monospace',       url: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap' },
    { name: 'PT Serif',      value: '"PT Serif", serif',            url: 'https://fonts.googleapis.com/css2?family=PT+Serif:wght@400;700&display=swap' },
    { name: 'Roboto Mono',   value: '"Roboto Mono", monospace',     url: 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600&display=swap' },
    { name: 'Nunito',        value: 'Nunito, sans-serif',           url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap' },
    { name: 'Playfair Display', value: '"Playfair Display", serif', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap' },
    { name: 'JetBrains Mono',  value: '"JetBrains Mono", monospace', url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap' },
    { name: 'Lora',          value: 'Lora, serif',                  url: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap' },
    { name: 'Source Sans 3', value: '"Source Sans 3", sans-serif',  url: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap' },
];

/**
 * Глобальный Set — переживает HMR и ре-маунты.
 * Шрифты загружаются один раз на всё приложение.
 */
const globalLoaded = new Set();

export function useFonts() {
    const [loadingFont, setLoadingFont] = useState(null);

    const loadFont = useCallback(async (fontConfig) => {
        if (!fontConfig.url || globalLoaded.has(fontConfig.name)) {
            return true;
        }

        setLoadingFont(fontConfig.name);

        try {
            // Ищем существующий link безопасно — через data-атрибут
            const existing = document.querySelector(
                `link[data-font="${CSS.escape(fontConfig.name)}"]`,
            );

            if (!existing) {
                await new Promise((resolve, reject) => {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = fontConfig.url;
                    link.dataset.font = fontConfig.name;
                    link.onload = resolve;
                    link.onerror = reject;
                    document.head.appendChild(link);
                });
            }

            // Ждём отрисовку шрифта
            const fontFamily = fontConfig.value
                .replace(/["']/g, '')
                .split(',')[0]
                .trim();
            await document.fonts.load(`16px "${fontFamily}"`);

            globalLoaded.add(fontConfig.name);
            setLoadingFont(null);
            return true;
        } catch {
            setLoadingFont(null);
            return false;
        }
    }, []);

    const isLoaded = useCallback((fontName) => {
        const config = FONT_CONFIGS.find((f) => f.name === fontName);
        if (!config?.url) return true;
        return globalLoaded.has(fontName);
    }, []);

    return {
        fonts: FONT_CONFIGS,
        loadFont,
        loadingFont,
        isLoaded,
    };
}