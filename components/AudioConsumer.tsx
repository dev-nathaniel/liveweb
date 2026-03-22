"use client";

import { useEffect, useRef } from 'react';

export default function AudioConsumer({ track }: { track: MediaStreamTrack }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current && track) {
            const stream = new MediaStream([track]);
            audioRef.current.srcObject = stream;

            // We rely on the global "Enable Audio" user gesture for iOS Safari
            audioRef.current.play().catch(e => {
                console.warn("Audio play blocked pending user gesture:", e);
            });
        }
    }, [track]);

    return <audio ref={audioRef} autoPlay playsInline controls={false} style={{ display: 'none' }} className="remote-audio-consumer" />;
}
