import { useState, useRef, useCallback } from 'react';
import styles from './AudioRecorder.module.css';

export function AudioRecorder({ audioUrl, setAudioUrl }) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorder = useRef(null);
    const chunks = useRef([]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            chunks.current = [];

            mediaRecorder.current.ondataavailable = (e) => {
                chunks.current.push(e.data);
            };

            mediaRecorder.current.onstop = () => {
                const blob = new Blob(chunks.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.current.start();
            setIsRecording(true);
        } catch {
            alert('Не удалось получить доступ к микрофону');
        }
    }, [setAudioUrl]);

    const stopRecording = useCallback(() => {
        if (mediaRecorder.current && isRecording) {
            mediaRecorder.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    const deleteRecording = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
    };

    return (
        <div className={styles.section}>
            <label className={styles.label}>Аудио заметка</label>

            {!audioUrl ? (
                <button
                    type="button"
                    className={`${styles.btn} ${isRecording ? styles.btnRecording : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                >
                    <span className={styles.icon}>
                        {isRecording ? '⏹' : '🎙'}
                    </span>
                    {isRecording ? 'Остановить запись...' : 'Начать запись'}
                    {isRecording && <span className={styles.dot} />}
                </button>
            ) : (
                <div className={styles.preview}>
                    <audio controls src={audioUrl} className={styles.player} />
                    <button
                        type="button"
                        className={styles.delete}
                        onClick={deleteRecording}
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
}