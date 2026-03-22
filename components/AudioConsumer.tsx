"use client";

import { useEffect, useRef, useState } from 'react';

export default function AudioConsumer({ track }: { track: MediaStreamTrack }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        if (audioRef.current && track) {
            const stream = new MediaStream([track]);
            audioRef.current.srcObject = stream;

            // On iOS Safari, autoplaying dynamically attached WebRTC streams often throws NotAllowedError
            // even if the global Audio element was unlocked.
            audioRef.current.play().catch(e => {
                console.warn("Audio play blocked by strict mobile browser policy:", e);
                setBlocked(true);
            });
        }
    }, [track]);

    return (
        <>
            <audio ref={audioRef} autoPlay playsInline controls={false} style={{ display: 'none' }} />
            {blocked && (
                <button
                    onClick={() => { audioRef.current?.play(); setBlocked(false); }}
                    className="absolute z-20 top-2 bg-pink-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-bounce shadow-[0_0_10px_rgba(219,39,119,0.8)] cursor-pointer hover:bg-pink-500 border border-pink-400"
                >
                    Tap to Listen
                </button>
            )}
        </>
    );
}
