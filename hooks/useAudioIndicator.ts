"use client";
import { useEffect, useState } from 'react';

export function useAudioIndicator(stream: MediaStream | null | undefined) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;

    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationId: number;

    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.minDecibels = -70; // more sensitive
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = 0.4;
      
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let speakingFrames = 0;

      function checkVolume() {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        if (average > 15) {
          speakingFrames++;
          if (speakingFrames > 3) setIsSpeaking(true);
        } else {
          speakingFrames = 0;
          setIsSpeaking(false);
        }
        animationId = requestAnimationFrame(checkVolume);
      }
      checkVolume();
    } catch (e) {
      console.warn("Could not create audio context for indicator", e);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (source) source.disconnect();
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
    };
  }, [stream]);

  return isSpeaking;
}
