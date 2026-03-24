import { memo, useEffect, useRef } from 'react';
import { vertexShader, fragmentShader } from './shaders';
import { createShader, createProgram } from './glUtils';
import styles from './VortexBackground.module.css';

const VortexBackground = memo(function VortexBackground({ fast = false }) {
    const canvasRef = useRef(null);
    const speedRef = useRef(1.0);
    const targetSpeedRef = useRef(1.0);

    useEffect(() => {
        targetSpeedRef.current = fast ? 3.0 : 1.0;
    }, [fast]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl', {
            antialias: false,
            alpha: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'low-power',
        });

        if (!gl) {
            console.warn('[Vortex] WebGL not available');
            return;
        }

        const vs = createShader(gl, gl.VERTEX_SHADER, vertexShader);
        const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
        if (!vs || !fs) return;

        const program = createProgram(gl, vs, fs);
        if (!program) return;

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
        ]), gl.STATIC_DRAW);

        const aPos = gl.getAttribLocation(program, 'a_position');
        const uTime = gl.getUniformLocation(program, 'u_time');
        const uRes = gl.getUniformLocation(program, 'u_resolution');

        gl.useProgram(program);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio, 2.0);
            const w = canvas.clientWidth * dpr;
            const h = canvas.clientHeight * dpr;
            if (w === 0 || h === 0) return;
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
            gl.uniform2f(uRes, w, h);
        };

        window.addEventListener('resize', resize);
        resize();

        let animId;
        let prevTime = 0;
        let accumTime = 0;
        const MAX_DELTA = 0.1;

        const render = (now) => {
            animId = requestAnimationFrame(render);

            const nowSec = now / 1000;

            if (prevTime === 0) {
                prevTime = nowSec;
                return;
            }

            const rawDelta = nowSec - prevTime;
            prevTime = nowSec;

            const delta = Math.min(rawDelta, MAX_DELTA);
            speedRef.current += (targetSpeedRef.current - speedRef.current) * 0.05;
            accumTime += delta * speedRef.current;

            if (gl.isContextLost()) return;

            gl.uniform1f(uTime, accumTime);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        };

        animId = requestAnimationFrame(render);

        const handleContextLost = (e) => {
            e.preventDefault();
            cancelAnimationFrame(animId);
        };

        const handleContextRestored = () => {
            prevTime = 0;
            resize();
            animId = requestAnimationFrame(render);
        };

        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
            gl.deleteProgram(program);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            gl.deleteBuffer(buffer);
        };
    }, []);

    return <canvas ref={canvasRef} className={styles.canvas} />;
});

export default VortexBackground;