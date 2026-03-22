"use client";

import { useEffect, useRef } from 'react';

export default function AudioConsumer({ track }: { track: MediaStreamTrack }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current && track) {
            const stream = new MediaStream([track]);
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(e => console.warn("Audio play error:", e));
        }
    }, [track]);

    return <audio ref={audioRef} autoPlay controls={false} style={{ display: 'none' }} />;
}
