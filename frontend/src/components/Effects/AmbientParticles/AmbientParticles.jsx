import { useEffect, useRef, useState } from 'react';
import { fastSin, fillParticle, createParticleArrays, createGlowSprite, createDotSprite } from './particleEngine';
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

        const isMobile = window.innerWidth < 768;
        const COUNT = isMobile ? 50 : 80;
        const LINK_DIST = isMobile ? 80 : 100;
        const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
        const FPS = isMobile ? 24 : 30;
        const FRAME_TIME = 1000 / FPS;

        const arrays = createParticleArrays(COUNT);
        const glowCanvas = createGlowSprite();
        const dotCanvas = createDotSprite();

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
            for (let i = 0; i < COUNT; i++) fillParticle(arrays, i, w, h, true);
        };

        let lastTime = 0;
        const { px, py, pr, pSpeedY, pOpacity, pPhase, pFlickerSpeed, pDriftPhaseX, pDriftSpeed, pDriftAmp } = arrays;

        const render = (now) => {
            animId = requestAnimationFrame(render);

            const delta = now - lastTime;
            if (delta < FRAME_TIME) return;
            lastTime = now - (delta % FRAME_TIME);

            ctx.clearRect(0, 0, w, h);
            const t = now * 0.001;

            for (let i = 0; i < COUNT; i++) {
                py[i] -= pSpeedY[i];
                px[i] += fastSin(t * pDriftSpeed[i] + pDriftPhaseX[i]) * pDriftAmp[i];

                if (py[i] < -30) {
                    fillParticle(arrays, i, w, h, false);
                    continue;
                }

                const x = px[i];
                const y = py[i];
                const r = pr[i];
                const flicker = 0.35 + 0.65 * fastSin(t * pFlickerSpeed[i] + pPhase[i]);
                const alpha = pOpacity[i] * flicker;

                const glowR = r * 8;
                ctx.globalAlpha = alpha;
                ctx.drawImage(glowCanvas, x - glowR, y - glowR, glowR * 2, glowR * 2);
                ctx.drawImage(dotCanvas, x - r, y - r, r * 2, r * 2);
            }

            ctx.globalAlpha = 1;

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
                for (let i = 0; i < COUNT; i++) fillParticle(arrays, i, w, h, true);
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