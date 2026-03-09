import { createContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DiveContext = createContext();

export default function DiveProvider({ children }) {
    const [blurActive, setBlurActive] = useState(false);
    const [vortexFast, setVortexFast] = useState(false);
    const navigate = useNavigate();
    const timersRef = useRef([]);

    useEffect(() => {
        const timers = timersRef.current;
        return () => {
            timers.forEach(clearTimeout);
        };
    }, []);

    const safeTimeout = useCallback((fn, delay) => {
        const id = setTimeout(fn, delay);
        timersRef.current.push(id);
        return id;
    }, []);

    const handleHeroDive = useCallback((path = '/auth') => {
        if (blurActive || vortexFast) return;
        document.body.classList.add('no-scroll');

        setVortexFast(true);

        safeTimeout(() => {
            setBlurActive(true);
        }, 1000);

        safeTimeout(() => {
            navigate(path);
            setVortexFast(false);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    document.body.classList.remove('no-scroll');
                    setBlurActive(false);
                });
            });
        }, 1600);
    }, [blurActive, vortexFast, navigate, safeTimeout]);

    const handleDive = useCallback((path = '/auth') => {
    if (blurActive) return;
    document.body.classList.add('no-scroll');
    setBlurActive(true);

    safeTimeout(() => {
        navigate(path);

        safeTimeout(() => {
            document.body.classList.remove('no-scroll');
            setBlurActive(false);
        }, 500);
    }, 700);
}, [blurActive, navigate, safeTimeout]);

    return (
        <DiveContext.Provider value={{
            blurActive,
            vortexFast,
            handleDive,
            handleHeroDive,
        }}>
            {children}
        </DiveContext.Provider>
    );
}

export { DiveContext };