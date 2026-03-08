import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import {
    HiOutlineDeviceMobile,
    HiOutlineStatusOnline,
    HiOutlinePhotograph,
    HiOutlineChatAlt2,
    HiOutlineArrowRight
} from 'react-icons/hi';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { events, connected } = useSocket();

    const fetchData = async () => {
        try {
            const res = await getDashboard();
            setData(res.data);
        } catch (err) {
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Auto-refresh on socket events
    useEffect(() => {
        if (events.length > 0) {
            fetchData();
        }
    }, [events.length]);

    if (loading) {
        return (
            <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1>Dashboard</h1>
                <p>Overview of all your managed devices</p>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card primary">
                    <div className="stat-card-header">
                        <div className="stat-card-icon"><HiOutlineDeviceMobile size={20} /></div>
                    </div>
                    <div className="stat-card-value">{data?.totalDevices || 0}</div>
                    <div className="stat-card-label">Total Devices</div>
                </div>

                <div className="stat-card success">
                    <div className="stat-card-header">
                        <div className="stat-card-icon"><HiOutlineStatusOnline size={20} /></div>
                    </div>
                    <div className="stat-card-value">{data?.onlineDevices || 0}</div>
                    <div className="stat-card-label">Online Now</div>
                </div>

                <div className="stat-card info">
                    <div className="stat-card-header">
                        <div className="stat-card-icon"><HiOutlinePhotograph size={20} /></div>
                    </div>
                    <div className="stat-card-value">{data?.totalPhotos || 0}</div>
                    <div className="stat-card-label">Total Photos</div>
                </div>

                <div className="stat-card warning">
                    <div className="stat-card-header">
                        <div className="stat-card-icon"><HiOutlineChatAlt2 size={20} /></div>
                    </div>
                    <div className="stat-card-value">{data?.totalMessages || 0}</div>
                    <div className="stat-card-label">Total Messages</div>
                </div>
            </div>

            {/* Recent Devices */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <h3>Devices</h3>
                    <Link to="/devices" className="btn btn-ghost btn-sm">
                        View All <HiOutlineArrowRight />
                    </Link>
                </div>
                <div className="card-body">
                    {data?.recentDevices?.length > 0 ? (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Device ID</th>
                                    <th>Model</th>
                                    <th>Status</th>
                                    <th>Last Seen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.recentDevices.map((device) => (
                                    <tr key={device._id}>
                                        <td style={{ fontWeight: 600 }}>{device.name}</td>
                                        <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{device.deviceId}</td>
                                        <td>{device.model}</td>
                                        <td>
                                            <span className={`device-status ${device.isOnline ? 'online' : 'offline'}`}>
                                                <span className="dot"></span>
                                                {device.isOnline ? 'Online' : 'Offline'}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {new Date(device.lastSeen).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">📱</div>
                            <h3>No devices yet</h3>
                            <p>Register devices using the mobile app to get started</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Live Activity Feed */}
            <div className="card">
                <div className="card-header">
                    <h3>Live Activity</h3>
                    <span style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontSize: '0.8rem', color: connected ? 'var(--accent-success)' : 'var(--text-muted)'
                    }}>
                        <span className={`dot`} style={{
                            width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                            background: connected ? 'var(--accent-success)' : 'var(--text-muted)'
                        }}></span>
                        {connected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                <div className="card-body">
                    {events.length > 0 ? (
                        <div className="message-list">
                            {events.slice(0, 10).map((event, i) => (
                                <div key={i} className="message-item" style={{ cursor: 'default' }}>
                                    <div className="message-avatar" style={{
                                        background: event.type === 'device:online' ? 'var(--gradient-success)' :
                                            event.type === 'device:offline' ? 'var(--gradient-danger)' :
                                                event.type === 'photo-uploaded' ? 'var(--gradient-info)' :
                                                    'var(--gradient-primary)'
                                    }}>
                                        {event.type === 'device:online' ? '🟢' :
                                            event.type === 'device:offline' ? '🔴' :
                                                event.type === 'photo-uploaded' ? '📸' : '💬'}
                                    </div>
                                    <div className="message-content">
                                        <div className="message-content-header">
                                            <span className="message-sender">{event.deviceName || event.deviceId}</span>
                                            <span className="message-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="message-body">
                                            {event.type === 'device:online' ? 'Device came online' :
                                                event.type === 'device:offline' ? 'Device went offline' :
                                                    event.type === 'photo-uploaded' ? 'New photo uploaded' :
                                                        event.type === 'messages-synced' ? `${event.synced} messages synced` :
                                                            event.type}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">📡</div>
                            <h3>No activity yet</h3>
                            <p>Events will appear here in real-time when devices connect</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
