import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [error, setError] = useState(null);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const audioUrlRef = useRef(null);
    const mountedRef = useRef(true);

    // Track mounted state to avoid setState after unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }, []);

    const revokeAudioUrl = useCallback(() => {
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
        }
    }, []);

    const start = useCallback(async () => {
        if (mediaRecorderRef.current?.state === 'recording') return;

        try {
            clearTimer();
            stopStream();
            revokeAudioUrl();
            if (mountedRef.current) {
                setAudioUrl(null);
                setError(null);
                setRecordingTime(0);
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Если компонент уже unmounted пока ждали разрешение
            if (!mountedRef.current) {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }

            const recorder = new MediaRecorder(stream);

            streamRef.current = stream;
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunksRef.current.push(event.data);
            };

            recorder.onstop = () => {
                if (chunksRef.current.length > 0) {
                    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                    const nextAudioUrl = URL.createObjectURL(blob);
                    audioUrlRef.current = nextAudioUrl;
                    if (mountedRef.current) {
                        setAudioUrl(nextAudioUrl);
                    }
                }

                clearTimer();
                stopStream();
                if (mountedRef.current) {
                    setIsRecording(false);
                    setRecordingTime(0);
                }
            };

            recorder.start();
            setIsRecording(true);
            timerRef.current = setInterval(() => {
                if (mountedRef.current) {
                    setRecordingTime((prev) => prev + 1);
                }
            }, 1000);
        } catch (err) {
            clearTimer();
            stopStream();
            if (mountedRef.current) {
                setIsRecording(false);
                setError(
                    err.name === 'NotAllowedError'
                        ? 'Доступ к микрофону запрещён'
                        : 'Не удалось начать запись',
                );
            }
        }
    }, [clearTimer, revokeAudioUrl, stopStream]);

    const stop = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder?.state === 'recording') {
            recorder.stop();
        } else {
            clearTimer();
            stopStream();
            if (mountedRef.current) {
                setIsRecording(false);
            }
        }
    }, [clearTimer, stopStream]);

    const remove = useCallback(() => {
        revokeAudioUrl();
        if (mountedRef.current) {
            setAudioUrl(null);
        }
    }, [revokeAudioUrl]);

    // Полный cleanup при unmount
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
            clearTimer();
            stopStream();
            revokeAudioUrl();
        };
    }, [clearTimer, revokeAudioUrl, stopStream]);

    return {
        isRecording,
        audioUrl,
        recordingTime,
        error,
        start,
        stop,
        remove,
    };
}