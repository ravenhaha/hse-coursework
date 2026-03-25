import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const start = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(t => t.stop());
                clearInterval(timerRef.current);
                timerRef.current = null;
                setRecordingTime(0);
            };

            recorder.start();
            setIsRecording(true);
            setAudioUrl(null);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch {
            // Микрофон недоступен — молча игнорируем
        }
    }, []);

    const stop = useCallback(() => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    }, []);

    const remove = useCallback(() => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
    }, [audioUrl]);

    // Cleanup таймера при unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return {
        isRecording,
        audioUrl,
        recordingTime,
        start,
        stop,
        remove,
    };
}