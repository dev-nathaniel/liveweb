"use client";

import { use, useState } from 'react';
import { useAudioRoom } from '../../../hooks/useAudioRoom';
import { useAudioIndicator } from '../../../hooks/useAudioIndicator';
import AudioConsumer from '../../../components/AudioConsumer';

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [joined, setJoined] = useState(false);
    const [userName, setUserName] = useState('');
    const [role, setRole] = useState<'speaker' | 'listener'>('speaker');

    if (!joined) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4 font-sans">
                <h1 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Join Room: {id}</h1>
                <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Display Name</label>
                        <input
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            placeholder="Enter your name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Role</label>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => setRole('speaker')}
                                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${role === 'speaker' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                            >Speaker</button>
                            <button
                                onClick={() => setRole('listener')}
                                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${role === 'listener' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                            >Listener</button>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            if (userName.trim()) {
                                // PLATFORM AUDIO UNLOCK TRICK:
                                // Play a totally silent audio string. Because this happens exactly exactly
                                // when the user physically clicks their mouse, the browser permanently
                                // grants this page permission to autoplay audio later.
                                const unlocker = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
                                unlocker.play().catch(() => { });
                                setJoined(true);
                            }
                        }}
                        disabled={!userName.trim()}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >Join Call</button>
                </div>
            </div>
        );
    }

    return <ActiveRoom roomId={id} userId={userName} role={role} onLeave={() => setJoined(false)} />;
}

function ActiveRoom({ roomId, userId, role, onLeave }: { roomId: string, userId: string, role: 'speaker' | 'listener', onLeave: () => void }) {
    const { isConnected, error, peers, consumers, isMicOn, localStream, isLocalMuted, toggleMute, isLocalRecording, toggleRecording, leaveRoom } = useAudioRoom(roomId, userId, role);

    const handleLeave = () => {
        leaveRoom();
        onLeave();
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center p-8 font-sans">
            <div className="w-full max-w-4xl flex justify-between items-center mb-12">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                    Room // {roomId}
                </h1>
                <div className="flex items-center space-x-4">
                    <span className="text-gray-400 text-sm">{userId} ({role})</span>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium border ${isConnected ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>

                    {role === 'speaker' && isMicOn && (
                        <div className="flex space-x-2">
                            <button
                                onClick={toggleRecording}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isLocalRecording ? 'bg-pink-600 animate-pulse text-white shadow-[0_0_10px_rgba(219,39,119,0.8)]' : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'}`}
                            >
                                {isLocalRecording ? 'Recording...' : 'Record Audio'}
                            </button>
                            <button
                                onClick={toggleMute}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isLocalMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'}`}
                            >
                                {isLocalMuted ? 'Unmute' : 'Mute'}
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handleLeave}
                        className="bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/50 px-4 py-2 rounded-lg text-sm font-bold transition-all"
                    >
                        Leave Call
                    </button>
                </div>
            </div>

            {error && (
                <div className="w-full max-w-4xl bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg mb-8">
                    Error: {error}
                </div>
            )}

            {/* Grid of Users */}
            <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">

                {/* Local User */}
                <UserBox
                    name={`${userId} (You)`}
                    role={role}
                    isMuted={role === 'listener' || isLocalMuted || !isMicOn}
                    isRecording={isLocalRecording}
                    stream={localStream}
                />

                {/* Remote Users */}
                {peers.map(p => {
                    const consumer = consumers.find(c => c.userId === p.userId);
                    const stream = consumer ? new MediaStream([consumer.track]) : null;

                    return (
                        <div key={p.peerId} className="contents">
                            <UserBox
                                name={p.userId}
                                role={p.role as 'speaker' | 'listener'}
                                isMuted={p.isMuted || p.role === 'listener'}
                                isRecording={p.isRecording || false}
                                stream={stream}
                            />
                            {consumer && <AudioConsumer track={consumer.track} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function UserBox({ name, role, isMuted, isRecording, stream }: { name: string, role: 'speaker' | 'listener', isMuted: boolean, isRecording: boolean, stream: MediaStream | null }) {
    const isSpeaking = useAudioIndicator(stream);

    return (
        <div className={`relative group rounded-2xl bg-gray-900 border ${isSpeaking && !isMuted ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'border-gray-800'} aspect-square flex flex-col items-center justify-center overflow-hidden transition-all duration-300`}>
            {isRecording && (
                <div className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" title="Recording Audio" />
            )}
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold shadow-2xl transition-all ${isSpeaking && !isMuted ? 'bg-green-600 scale-110' : 'bg-gray-800'}`}>
                {name.charAt(0).toUpperCase()}
            </div>
            <p className="mt-4 font-medium z-10">{name}</p>
            <div className="flex items-center space-x-2 mt-1 z-10">
                <span className="text-xs text-gray-400 capitalize">{role}</span>
                {role === 'speaker' && (
                    <span className={`text-xs ${isMuted ? 'text-red-400' : 'text-gray-400'}`}>
                        {isMuted ? 'Muted 👋' : 'Mic On'}
                    </span>
                )}
            </div>
        </div>
    );
}
