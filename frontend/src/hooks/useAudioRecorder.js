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
            setAudioUrl(null);
            setError(null);
            setRecordingTime(0);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
                    setAudioUrl(nextAudioUrl);
                }

                clearTimer();
                stopStream();
                setIsRecording(false);
                setRecordingTime(0);
            };

            recorder.start();
            setIsRecording(true);
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            clearTimer();
            stopStream();
            setIsRecording(false);
            setError(err);
        }
    }, [clearTimer, revokeAudioUrl, stopStream]);

    const stop = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder?.state === 'recording') {
            recorder.stop();
        } else {
            clearTimer();
            stopStream();
            setIsRecording(false);
        }
    }, [clearTimer, stopStream]);

    const remove = useCallback(() => {
        revokeAudioUrl();
        setAudioUrl(null);
    }, [revokeAudioUrl]);

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
