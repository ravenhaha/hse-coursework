const SIN_SIZE = 1024;
const SIN_TABLE = new Float32Array(SIN_SIZE);
for (let i = 0; i < SIN_SIZE; i++) {
    SIN_TABLE[i] = Math.sin((i / SIN_SIZE) * Math.PI * 2);
}

export function fastSin(x) {
    const idx = ((x % 6.283) / 6.283 * SIN_SIZE + SIN_SIZE) % SIN_SIZE;
    return SIN_TABLE[idx | 0];
}

const rand = (min, max) => Math.random() * (max - min) + min;

export function fillParticle(arrays, i, w, h, randomY) {
    const { px, py, pr, pSpeedY, pOpacity, pPhase, pFlickerSpeed, pDriftPhaseX, pDriftSpeed, pDriftAmp } = arrays;
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
}

export function createParticleArrays(count) {
    return {
        px: new Float32Array(count),
        py: new Float32Array(count),
        pr: new Float32Array(count),
        pSpeedY: new Float32Array(count),
        pOpacity: new Float32Array(count),
        pPhase: new Float32Array(count),
        pFlickerSpeed: new Float32Array(count),
        pDriftPhaseX: new Float32Array(count),
        pDriftSpeed: new Float32Array(count),
        pDriftAmp: new Float32Array(count),
    };
}

export function createGlowSprite() {
    const SIZE = 32;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE * 2;
    canvas.height = SIZE * 2;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(SIZE, SIZE, 0, SIZE, SIZE, SIZE);
    grad.addColorStop(0, 'rgba(130,220,215,0.2)');
    grad.addColorStop(0.4, 'rgba(130,220,215,0.06)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE * 2, SIZE * 2);
    return canvas;
}

export function createDotSprite() {
    const SIZE = 4;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE * 2;
    canvas.height = SIZE * 2;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(SIZE, SIZE, SIZE, 0, 6.283);
    ctx.fillStyle = 'hsl(180,85%,65%)';
    ctx.fill();
    return canvas;
}
