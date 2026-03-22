"use client";

import { useEffect, useRef, useState } from 'react';

export default function AudioConsumer({ track }: { track: MediaStreamTrack }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        if (audioRef.current && track) {
            const stream = new MediaStream([track]);
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(e => {
                console.warn("Audio play blocked by browser autoplay policy:", e);
                setBlocked(true);
            });
        }
    }, [track]);

    return (
        <>
            <audio ref={audioRef} autoPlay controls={false} style={{ display: 'none' }} />
            {blocked && (
                <button
                    onClick={() => { audioRef.current?.play(); setBlocked(false); }}
                    className="absolute z-20 top-2 bg-pink-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-bounce shadow-lg cursor-pointer hover:bg-pink-500"
                >
                    Click to Play Audio
                </button>
            )}
        </>
    );
}
