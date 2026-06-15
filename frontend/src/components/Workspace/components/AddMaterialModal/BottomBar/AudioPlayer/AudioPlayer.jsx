import { useRef, useEffect, useState, useCallback } from 'react';
import styles from './AudioPlayer.module.css';

function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ src, onRemove }) {
    const audioRef = useRef(null);
    const progressRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onLoaded = () => {
            setDuration(audio.duration);
            setCurrentTime(0);
            setIsPlaying(false);
        };
        const onTime = () => setCurrentTime(audio.currentTime);
        const onEnded = () => setIsPlaying(false);

        audio.addEventListener('loadedmetadata', onLoaded);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.pause();
            audio.removeEventListener('loadedmetadata', onLoaded);
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('ended', onEnded);
        };
    }, [src]);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play()
                .then(() => setIsPlaying(true))
                .catch(() => setIsPlaying(false));
        }
    }, [isPlaying]);

    const handleProgressClick = useCallback((e) => {
        const audio = audioRef.current;
        const bar = progressRef.current;
        if (!audio || !bar || !duration) return;

        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = ratio * duration;
    }, [duration]);

    const progress = duration ? (currentTime / duration) * 100 : 0;

    return (
        <div className={styles.player}>
            <audio ref={audioRef} src={src} preload="metadata" />

            <button className={styles.playBtn} onClick={togglePlay} type="button">
                {isPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6,4 20,12 6,20" />
                    </svg>
                )}
            </button>

            <span className={styles.time}>{formatTime(currentTime)}</span>

            <div
                className={styles.progressBar}
                ref={progressRef}
                onClick={handleProgressClick}
            >
                <div className={styles.progressTrack}>
                    <div
                        className={styles.progressFill}
                        style={{ width: `${progress}%` }}
                    />
                    <div
                        className={styles.progressThumb}
                        style={{ left: `${progress}%` }}
                    />
                </div>
            </div>

            <span className={styles.time}>{formatTime(duration)}</span>

            {onRemove && (
                <button className={styles.removeBtn} onClick={onRemove} type="button" title="Удалить">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            )}
        </div>
    );
}