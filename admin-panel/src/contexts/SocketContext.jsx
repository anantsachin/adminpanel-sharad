import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
    const { token, isAuthenticated } = useAuth();
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [events, setEvents] = useState([]);

    useEffect(() => {
        if (!isAuthenticated || !token) return;

        const newSocket = io('http://localhost:5001', {
            auth: { token, role: 'admin' }
        });

        newSocket.on('connect', () => {
            console.log('🔵 Admin connected to server');
            setConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('🔴 Admin disconnected');
            setConnected(false);
        });

        // Listen for device events
        newSocket.on('device:online', (data) => {
            addEvent({ type: 'device:online', ...data, timestamp: Date.now() });
        });

        newSocket.on('device:offline', (data) => {
            addEvent({ type: 'device:offline', ...data, timestamp: Date.now() });
        });

        newSocket.on('data:photo-uploaded', (data) => {
            addEvent({ type: 'photo-uploaded', ...data, timestamp: Date.now() });
        });

        newSocket.on('data:messages-synced', (data) => {
            addEvent({ type: 'messages-synced', ...data, timestamp: Date.now() });
        });

        newSocket.on('device:info-updated', (data) => {
            addEvent({ type: 'device:info', ...data, timestamp: Date.now() });
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthenticated, token]);

    const addEvent = (event) => {
        setEvents(prev => [event, ...prev].slice(0, 50));
    };

    return (
        <SocketContext.Provider value={{ socket, connected, events }}>
            {children}
        </SocketContext.Provider>
    );
}
