import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import styles from './AmbientGradient.module.css'

function AmbientGradient() {
    const vantaRef = useRef(null)

    useEffect(() => {
        let effect = null

        import('vanta/dist/vanta.fog.min').then((FOG) => {
            if (vantaRef.current && !effect) {
                effect = FOG.default({
                    el: vantaRef.current,
                    THREE,
                    highlightColor: 0x134a6a,   // приглушённый синий вместо бирюзового
                    midtoneColor: 0x0e2a45,      // глубокий тёмный синий
                    lowlightColor: 0x080e1a,     // почти чёрный
                    baseColor: 0x01050f,         // фон
                    blurFactor: 0.8,             // ещё мягче
                    speed: 0.4,
                    zoom: 0.5,
                    mouseControls: false,
                    touchControls: false,
                    gyroControls: false,
                    minHeight: 200,
                    minWidth: 200,
                })
            }
        })

        return () => {
            if (effect) effect.destroy()
        }
    }, [])

    return (
        <div className={styles.wrapper}>
            <div ref={vantaRef} className={styles.vanta} />
            <div className={styles.lavenderMist} />
        </div>
    )
}

export default AmbientGradient