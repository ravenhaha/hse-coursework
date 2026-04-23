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
    const mountedRef = useRef(true);

    // Отслеживаем mounted
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

    const stopTracks = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
    }, []);

    const start = useCallback(async () => {
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            // Если компонент уже unmounted пока ждали разрешение
            if (!mountedRef.current) {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }

            streamRef.current = stream;
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, {
                    type: 'audio/webm',
                });
                stopTracks();
                clearTimer();

                if (mountedRef.current) {
                    setAudioUrl(URL.createObjectURL(blob));
                    setRecordingTime(0);
                }
            };

            recorder.start();
            setIsRecording(true);
            setAudioUrl(null);

            timerRef.current = setInterval(() => {
                if (mountedRef.current) {
                    setRecordingTime((prev) => prev + 1);
                }
            }, 1000);
        } catch (err) {
            if (mountedRef.current) {
                setError(
                    err.name === 'NotAllowedError'
                        ? 'Доступ к микрофону запрещён'
                        : 'Не удалось начать запись',
                );
            }
        }
    }, [clearTimer, stopTracks]);

    const stop = useCallback(() => {
        if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state !== 'inactive'
        ) {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    }, []);

    const remove = useCallback(() => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
    }, [audioUrl]);

    // Полный cleanup при unmount
    useEffect(() => {
        return () => {
            clearTimer();
            stopTracks();

            if (
                mediaRecorderRef.current &&
                mediaRecorderRef.current.state !== 'inactive'
            ) {
                mediaRecorderRef.current.stop();
            }
        };
    }, [clearTimer, stopTracks]);

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