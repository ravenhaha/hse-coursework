import { useEffect, useRef, useState } from 'react';
import styles from './AmbientParticles.module.css';

function AmbientParticles() {
    const canvasRef = useRef(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        let animId;
        let w = 0;
        let h = 0;
        let firstFrame = true;

        // ── Адаптивно ──
        const isMobile = window.innerWidth < 768;
        const COUNT = isMobile ? 50 : 80;
        const LINK_DIST = isMobile ? 80 : 100;
        const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
        const FPS = isMobile ? 24 : 30;
        const FRAME_TIME = 1000 / FPS;

        const px = new Float32Array(COUNT);
        const py = new Float32Array(COUNT);
        const pr = new Float32Array(COUNT);
        const pSpeedY = new Float32Array(COUNT);
        const pOpacity = new Float32Array(COUNT);
        const pPhase = new Float32Array(COUNT);
        const pFlickerSpeed = new Float32Array(COUNT);
        const pDriftPhaseX = new Float32Array(COUNT);
        const pDriftSpeed = new Float32Array(COUNT);
        const pDriftAmp = new Float32Array(COUNT);

        const rand = (min, max) => Math.random() * (max - min) + min;

        const fillParticle = (i, randomY) => {
            px[i] = rand(0, w || 1);
            py[i] = randomY ? rand(0, h || 1) : (h || 1) + rand(10, 60);
            pr[i] = rand(0.5, 1.8);
            pSpeedY[i] = rand(0.15, 0.4);
            pOpacity[i] = rand(0.1, 0.45);
            pPhase[i] = rand(0, 6.283);
            pFlickerSpeed[i] = rand(0.2, 0.8);
            pDriftPhaseX[i] = rand(0, 6.283);
            pDriftSpeed[i] = rand(0.1, 0.4);
            pDriftAmp[i] = rand(0.1, 0.2);
        };

        // ── Таблица синусов ──
        const SIN_SIZE = 1024;
        const SIN_TABLE = new Float32Array(SIN_SIZE);
        for (let i = 0; i < SIN_SIZE; i++) {
            SIN_TABLE[i] = Math.sin((i / SIN_SIZE) * Math.PI * 2);
        }
        const fastSin = (x) => {
            const idx = ((x % 6.283) / 6.283 * SIN_SIZE + SIN_SIZE) % SIN_SIZE;
            return SIN_TABLE[idx | 0];
        };

        // ── Кэш glow-спрайта (вместо createRadialGradient каждый кадр) ──
        const GLOW_SIZE = 32;
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = GLOW_SIZE * 2;
        glowCanvas.height = GLOW_SIZE * 2;
        const glowCtx = glowCanvas.getContext('2d');
        const glowGrad = glowCtx.createRadialGradient(
            GLOW_SIZE, GLOW_SIZE, 0,
            GLOW_SIZE, GLOW_SIZE, GLOW_SIZE
        );
        glowGrad.addColorStop(0, 'rgba(130,220,215,0.2)');
        glowGrad.addColorStop(0.4, 'rgba(130,220,215,0.06)');
        glowGrad.addColorStop(1, 'transparent');
        glowCtx.fillStyle = glowGrad;
        glowCtx.fillRect(0, 0, GLOW_SIZE * 2, GLOW_SIZE * 2);

        // ── Кэш точки ──
        const DOT_SIZE = 4;
        const dotCanvas = document.createElement('canvas');
        dotCanvas.width = DOT_SIZE * 2;
        dotCanvas.height = DOT_SIZE * 2;
        const dotCtx = dotCanvas.getContext('2d');
        dotCtx.beginPath();
        dotCtx.arc(DOT_SIZE, DOT_SIZE, DOT_SIZE, 0, 6.283);
        dotCtx.fillStyle = 'hsl(180,85%,65%)';
        dotCtx.fill();

        const resize = () => {
            const parent = canvas.parentElement;
            if (!parent) return;
            w = parent.clientWidth;
            h = parent.clientHeight;
            if (h < window.innerHeight) h = window.innerHeight;
            if (w < window.innerWidth) w = window.innerWidth;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const init = () => {
            resize();
            for (let i = 0; i < COUNT; i++) fillParticle(i, true);
        };

        let lastTime = 0;

        const render = (now) => {
            animId = requestAnimationFrame(render);

            const delta = now - lastTime;
            if (delta < FRAME_TIME) return;
            lastTime = now - (delta % FRAME_TIME);

            ctx.clearRect(0, 0, w, h);
            const t = now * 0.001;

            // ── Частицы ──
            for (let i = 0; i < COUNT; i++) {
                py[i] -= pSpeedY[i];
                px[i] += fastSin(t * pDriftSpeed[i] + pDriftPhaseX[i]) * pDriftAmp[i];

                if (py[i] < -30) {
                    fillParticle(i, false);
                    continue;
                }

                const x = px[i];
                const y = py[i];
                const r = pr[i];
                const flicker = 0.35 + 0.65 * fastSin(t * pFlickerSpeed[i] + pPhase[i]);
                const alpha = pOpacity[i] * flicker;

                // Glow
                const glowR = r * 8;
                ctx.globalAlpha = alpha;
                ctx.drawImage(glowCanvas, x - glowR, y - glowR, glowR * 2, glowR * 2);

                // Точка
                ctx.drawImage(dotCanvas, x - r, y - r, r * 2, r * 2);
            }

            ctx.globalAlpha = 1;

            // ── Линии (один batch stroke) ──
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = 'rgba(58,215,211,0.03)';
            ctx.beginPath();

            for (let i = 0; i < COUNT; i++) {
                for (let j = i + 1; j < COUNT; j++) {
                    const dx = px[i] - px[j];
                    if (dx > LINK_DIST || dx < -LINK_DIST) continue;
                    const dy = py[i] - py[j];
                    if (dy > LINK_DIST || dy < -LINK_DIST) continue;

                    if (dx * dx + dy * dy < LINK_DIST_SQ) {
                        ctx.moveTo(px[i], py[i]);
                        ctx.lineTo(px[j], py[j]);
                    }
                }
            }

            ctx.stroke();

            if (firstFrame) {
                firstFrame = false;
                setReady(true);
            }
        };

        init();

        let resizeTimer;
        const onResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                resize();
                for (let i = 0; i < COUNT; i++) fillParticle(i, true);
            }, 200);
        };

        const ro = new ResizeObserver(onResize);
        ro.observe(canvas.parentElement);
        animId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animId);
            clearTimeout(resizeTimer);
            ro.disconnect();
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={`${styles.canvas} ${ready ? styles.canvasReady : ''}`}
            style={ready ? undefined : { opacity: 0, visibility: 'hidden' }}
        />
    );
}

export default AmbientParticles;