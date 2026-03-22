"use client";

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Device, types } from 'mediasoup-client';

const SERVER_URL = 'https://liveserver.usedistress.com';

export interface PeerInfo {
  peerId: string;
  userId: string;
  role: string;
  isMuted: boolean;
  isRecording?: boolean;
}

export function useAudioRoom(roomId: string, userId: string, role: 'speaker' | 'listener') {
  const [isConnected, setIsConnected] = useState(false);
  const [consumers, setConsumers] = useState<{ id: string; track: MediaStreamTrack; userId?: string }[]>([]);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [isMicOn, setIsMicOn] = useState(false);
  const [isLocalMuted, setIsLocalMuted] = useState(false);
  const [isLocalRecording, setIsLocalRecording] = useState(false);
  const [producerId, setProducerId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const producerTransportRef = useRef<types.Transport | null>(null);
  const consumerTransportRef = useRef<types.Transport | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // 1. Get Token
        const res = await fetch(`${SERVER_URL}/api/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, role, roomId }),
        });
        const { token } = await res.json();

        // 2. Connect Socket
        const socket = io(SERVER_URL, { auth: { token } });
        socketRef.current = socket;

        socket.on('connect', () => {
          if (!mounted) return;
          setIsConnected(true);
          
          socket.emit('joinRoom', roomId, async (res: any) => {
            if (res.error) {
              setError(res.error);
              return;
            }
            
            // 3. Init Mediasoup Device
            setPeers(res.peers || []);

            const device = new Device();
            deviceRef.current = device;
            await device.load({ routerRtpCapabilities: res.routerRtpCapabilities });

            // 4. Create Transports
            if (role === 'speaker') {
              await createSendTransport();
            }
            await createRecvTransport();

            // 4.5 Get existing producers in the room to sync state
            socket.emit('getProducers', { roomId }, (producers: { id: string, userId: string }[]) => {
              producers.forEach(p => consumeProducer(p.id, p.userId));
            });

            // 5. If Speaker, produce audio
            if (role === 'speaker') {
              produceAudio();
            }
          });
        });

        socket.on('peerJoined', (peerInfo: PeerInfo) => {
          setPeers(prev => [...prev, peerInfo]);
        });

        socket.on('peerClosed', ({ peerId }) => {
          setPeers(prev => prev.filter(p => p.peerId !== peerId));
        });

        socket.on('peerMicToggled', ({ peerId, isMuted }) => {
          setPeers(prev => prev.map(p => p.peerId === peerId ? { ...p, isMuted } : p));
        });

        socket.on('peerRecordingStarted', ({ peerId }) => {
          setPeers(prev => prev.map(p => p.peerId === peerId ? { ...p, isRecording: true } : p));
        });

        socket.on('peerRecordingStopped', ({ peerId }) => {
          setPeers(prev => prev.map(p => p.peerId === peerId ? { ...p, isRecording: false } : p));
        });

        socket.on('newProducer', async ({ producerId, userId: remoteUserId }) => {
          consumeProducer(producerId, remoteUserId);
        });

        socket.on('consumerClosed', ({ consumerId }) => {
          setConsumers(prev => prev.filter(c => c.id !== consumerId));
        });

        socket.on('disconnect', () => setIsConnected(false));
      } catch (err: any) {
        setError(err.message);
      }
    }

    async function consumeProducer(producerId: string, remoteUserId?: string) {
      if (!socketRef.current || !consumerTransportRef.current || !deviceRef.current) return;
      socketRef.current.emit('consume', {
        roomId,
        producerId,
        transportId: consumerTransportRef.current.id,
        rtpCapabilities: deviceRef.current.rtpCapabilities
      }, async (res: any) => {
        if (res.error) return console.error(res.error);
        const { id, kind, rtpParameters } = res.params;
        const consumer = await consumerTransportRef.current!.consume({
          id, producerId, kind, rtpParameters
        });
        
        setConsumers(prev => [...prev, { id: consumer.id, track: consumer.track, userId: remoteUserId }]);
        
        // Resume on server
        socketRef.current?.emit('resumeConsumer', { roomId, consumerId: consumer.id }, () => {});
      });
    }

    async function createSendTransport() {
      return new Promise<void>((resolve, reject) => {
        socketRef.current?.emit('createWebRtcTransport', { roomId }, async (res: any) => {
          if (res.error) return reject(res.error);
          
          const transport = deviceRef.current!.createSendTransport(res.params);
          producerTransportRef.current = transport;

          transport.on('connect', ({ dtlsParameters }, callback, errback) => {
            socketRef.current?.emit('connectTransport', { roomId, transportId: transport.id, dtlsParameters }, (res: any) => res.error ? errback(new Error(res.error)) : callback());
          });

          transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
            socketRef.current?.emit('produce', { roomId, transportId: transport.id, kind, rtpParameters }, (res: any) => {
              if (res.error) errback(new Error(res.error));
              else {
                setProducerId(res.id);
                callback({ id: res.id });
              }
            });
          });

          resolve();
        });
      });
    }

    async function createRecvTransport() {
      return new Promise<void>((resolve, reject) => {
        socketRef.current?.emit('createWebRtcTransport', { roomId }, async (res: any) => {
          if (res.error) return reject(res.error);

          const transport = deviceRef.current!.createRecvTransport(res.params);
          consumerTransportRef.current = transport;

          transport.on('connect', ({ dtlsParameters }, callback, errback) => {
            socketRef.current?.emit('connectTransport', { roomId, transportId: transport.id, dtlsParameters }, (res: any) => res.error ? errback(new Error(res.error)) : callback());
          });

          resolve();
        });
      });
    }

    async function produceAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        const track = stream.getAudioTracks()[0];
        
        await producerTransportRef.current!.produce({ track });
        setIsMicOn(true);
      } catch (err) {
        console.error("Failed to get user media", err);
      }
    }

    init();

    return () => {
      mounted = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      socketRef.current?.disconnect();
    };
  }, [roomId, userId, role]);

  function toggleMute() {
    if (!producerId || !socketRef.current) return;
    const newState = !isLocalMuted;
    socketRef.current.emit('toggleMic', { roomId, producerId, isMuted: newState }, (res: any) => {
      if (!res.error) {
         setIsLocalMuted(newState);
      }
    });
  }

  function toggleRecording() {
    if (!producerId || !socketRef.current) return;
    if (isLocalRecording) {
      socketRef.current.emit('stopRecording', (res: any) => {
        if (!res.error) setIsLocalRecording(false);
      });
    } else {
      socketRef.current.emit('startRecording', { roomId, producerId }, (res: any) => {
        if (!res.error) setIsLocalRecording(true);
        else console.error("Start recording error:", res.error);
      });
    }
  }

  function leaveRoom() {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    socketRef.current?.disconnect();
    setIsConnected(false);
  }

  return { isConnected, error, peers, consumers, isMicOn, localStream, isLocalMuted, toggleMute, isLocalRecording, toggleRecording, leaveRoom };
}
