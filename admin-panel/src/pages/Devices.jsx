import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDevices, deleteDevice, sendCommand } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import {
    HiOutlineDeviceMobile,
    HiOutlinePhotograph,
    HiOutlineChatAlt2,
    HiOutlineTrash,
    HiOutlineCamera,
    HiOutlineRefresh
} from 'react-icons/hi';

export default function Devices() {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const { events } = useSocket();
    const navigate = useNavigate();

    const fetchDevices = async () => {
        try {
            const { data } = await getDevices();
            setDevices(data);
        } catch (err) {
            console.error('Error fetching devices:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDevices(); }, []);
    useEffect(() => {
        if (events.length > 0) fetchDevices();
    }, [events.length]);

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete ${name} and all its data?`)) return;
        try {
            await deleteDevice(id);
            setDevices(prev => prev.filter(d => d._id !== id));
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleCommand = async (deviceId, command) => {
        try {
            await sendCommand(deviceId, command);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to send command');
        }
    };

    if (loading) {
        return <div className="loading-spinner"><div className="spinner"></div><p>Loading devices...</p></div>;
    }

    return (
        <div>
            <div className="page-header">
                <div className="page-header-actions">
                    <div>
                        <h1>Devices</h1>
                        <p>Manage all your registered devices</p>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={fetchDevices}>
                        <HiOutlineRefresh /> Refresh
                    </button>
                </div>
            </div>

            {devices.length > 0 ? (
                <div className="devices-grid">
                    {devices.map((device) => (
                        <div key={device._id} className="device-card">
                            <div className="device-card-header">
                                <div className="device-avatar">
                                    <HiOutlineDeviceMobile size={22} color="white" />
                                </div>
                                <div className="device-info">
                                    <h3>{device.name}</h3>
                                    <p>{device.model} • {device.platform}</p>
                                </div>
                                <div className={`device-status ${device.isOnline ? 'online' : 'offline'}`}>
                                    <span className="dot"></span>
                                    {device.isOnline ? 'Online' : 'Offline'}
                                </div>
                            </div>

                            <div className="device-stats">
                                <div className="device-stat">
                                    <div className="device-stat-value">{device.photoCount}</div>
                                    <div className="device-stat-label">Photos</div>
                                </div>
                                <div className="device-stat">
                                    <div className="device-stat-value">{device.messageCount}</div>
                                    <div className="device-stat-label">Messages</div>
                                </div>
                                <div className="device-stat">
                                    <div className="device-stat-value">
                                        {device.batteryLevel >= 0 ? `${device.batteryLevel}%` : '—'}
                                    </div>
                                    <div className="device-stat-label">Battery</div>
                                </div>
                            </div>

                            <div className="device-actions">
                                <button
                                    className="command-btn"
                                    onClick={() => handleCommand(device.deviceId, 'capture-photo')}
                                    disabled={!device.isOnline}
                                    title="Capture Photo"
                                >
                                    <HiOutlineCamera className="icon" /> Capture
                                </button>
                                <button
                                    className="command-btn"
                                    onClick={() => handleCommand(device.deviceId, 'sync-messages')}
                                    disabled={!device.isOnline}
                                    title="Sync Messages"
                                >
                                    <HiOutlineChatAlt2 className="icon" /> Sync
                                </button>
                                <button
                                    className="command-btn"
                                    onClick={() => navigate(`/devices/${device._id}`)}
                                    title="View Details"
                                >
                                    <HiOutlinePhotograph className="icon" /> View
                                </button>
                                <button
                                    className="command-btn"
                                    onClick={() => handleDelete(device._id, device.name)}
                                    title="Delete Device"
                                    style={{ marginLeft: 'auto' }}
                                >
                                    <HiOutlineTrash className="icon" style={{ color: 'var(--accent-danger)' }} />
                                </button>
                            </div>

                            <div style={{
                                marginTop: '0.75rem',
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                fontFamily: 'monospace'
                            }}>
                                ID: {device.deviceId} • Last seen: {new Date(device.lastSeen).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card">
                    <div className="card-body">
                        <div className="empty-state">
                            <div className="empty-state-icon">📱</div>
                            <h3>No devices registered</h3>
                            <p>Install the mobile app on your phones and register them to get started</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
