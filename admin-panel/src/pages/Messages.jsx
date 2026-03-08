import { useState, useEffect, useContext } from 'react';
import { getMessages, getDevices, deleteMessage, sendSMS } from '../services/api';
import { HiOutlineSearch, HiOutlineTrash, HiOutlinePaperAirplane } from 'react-icons/hi';
import { SocketContext } from '../contexts/SocketContext';

export default function Messages() {
    const [messages, setMessages] = useState([]);
    const [devices, setDevices] = useState([]);
    const [deviceFilter, setDeviceFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    // Send SMS modal state
    const [showSendModal, setShowSendModal] = useState(false);
    const [smsDevice, setSmsDevice] = useState('');
    const [smsTo, setSmsTo] = useState('');
    const [smsMessage, setSmsMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sendStatus, setSendStatus] = useState(null);

    const socket = useContext(SocketContext);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const params = { page, limit: 30 };
            if (deviceFilter) params.deviceId = deviceFilter;
            if (typeFilter) params.type = typeFilter;
            if (search) params.search = search;
            const { data } = await getMessages(params);
            setMessages(data.messages);
            setTotalPages(data.pages);
            setTotal(data.total);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getDevices().then(({ data }) => setDevices(data)).catch(console.error);
    }, []);

    useEffect(() => { fetchMessages(); }, [deviceFilter, typeFilter, search, page]);

    // Real-time SMS events
    useEffect(() => {
        if (!socket) return;

        const handleSmsReceived = (data) => {
            fetchMessages(); // Refresh to show new message
            setSendStatus({ type: 'info', text: `📥 New SMS received on device from ${data.from}` });
            setTimeout(() => setSendStatus(null), 5000);
        };

        const handleSmsSent = (data) => {
            setSendStatus({ type: 'success', text: `✅ SMS sent to ${data.to}` });
            setTimeout(() => setSendStatus(null), 5000);
            fetchMessages();
        };

        const handleSmsFailed = (data) => {
            setSendStatus({ type: 'error', text: `❌ SMS failed: ${data.error}` });
            setTimeout(() => setSendStatus(null), 5000);
        };

        socket.on('data:sms-received', handleSmsReceived);
        socket.on('data:sms-sent', handleSmsSent);
        socket.on('data:sms-failed', handleSmsFailed);

        return () => {
            socket.off('data:sms-received', handleSmsReceived);
            socket.off('data:sms-sent', handleSmsSent);
            socket.off('data:sms-failed', handleSmsFailed);
        };
    }, [socket]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
    };

    const handleDelete = async (id) => {
        try {
            await deleteMessage(id);
            setMessages(prev => prev.filter(m => m._id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    const handleSendSMS = async (e) => {
        e.preventDefault();
        if (!smsDevice || !smsTo || !smsMessage) return;

        setSending(true);
        try {
            await sendSMS(smsDevice, smsTo, smsMessage);
            setSendStatus({ type: 'success', text: `📤 SMS command sent! Waiting for device to send...` });
            setSmsTo('');
            setSmsMessage('');
            setShowSendModal(false);
        } catch (err) {
            setSendStatus({ type: 'error', text: `❌ ${err.response?.data?.message || err.message}` });
        } finally {
            setSending(false);
            setTimeout(() => setSendStatus(null), 5000);
        }
    };

    const formatDate = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString();
    };

    const onlineDevices = devices.filter(d => d.isOnline);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Messages</h1>
                    <p>{total.toLocaleString()} messages from {devices.length} devices</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => setShowSendModal(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.6rem 1.2rem', borderRadius: '0.5rem',
                        background: 'var(--gradient-primary)', color: '#fff',
                        border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
                    }}
                >
                    <HiOutlinePaperAirplane size={16} /> Send SMS
                </button>
            </div>

            {/* Send Status Toast */}
            {sendStatus && (
                <div style={{
                    padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem',
                    background: sendStatus.type === 'success' ? 'rgba(16,185,129,0.15)' :
                        sendStatus.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                    color: sendStatus.type === 'success' ? '#10b981' :
                        sendStatus.type === 'error' ? '#ef4444' : '#3b82f6',
                    fontSize: '0.85rem', fontWeight: 500
                }}>
                    {sendStatus.text}
                </div>
            )}

            {/* Send SMS Modal */}
            {showSendModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }} onClick={() => setShowSendModal(false)}>
                    <div className="card" style={{ width: '100%', maxWidth: '420px', margin: '1rem' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="card-body">
                            <h3 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>📤 Send SMS via Device</h3>
                            <form onSubmit={handleSendSMS}>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                                        Device *
                                    </label>
                                    <select
                                        className="filter-select"
                                        value={smsDevice}
                                        onChange={e => setSmsDevice(e.target.value)}
                                        required
                                        style={{ width: '100%' }}
                                    >
                                        <option value="">Select online device...</option>
                                        {onlineDevices.map(d => (
                                            <option key={d._id} value={d.deviceId}>
                                                🟢 {d.name} ({d.model})
                                            </option>
                                        ))}
                                        {onlineDevices.length === 0 && (
                                            <option disabled>No devices online</option>
                                        )}
                                    </select>
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                                        Recipient Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        className="search-input"
                                        placeholder="+1234567890"
                                        value={smsTo}
                                        onChange={e => setSmsTo(e.target.value)}
                                        required
                                        style={{ width: '100%', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                                        Message *
                                    </label>
                                    <textarea
                                        className="search-input"
                                        placeholder="Type your message..."
                                        value={smsMessage}
                                        onChange={e => setSmsMessage(e.target.value)}
                                        required
                                        rows={3}
                                        style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowSendModal(false)}
                                        style={{
                                            padding: '0.5rem 1rem', borderRadius: '0.4rem',
                                            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                                            border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.85rem'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={sending || !smsDevice || !smsTo || !smsMessage}
                                        style={{
                                            padding: '0.5rem 1rem', borderRadius: '0.4rem',
                                            background: sending ? 'var(--bg-tertiary)' : 'var(--gradient-primary)',
                                            color: '#fff', border: 'none', cursor: sending ? 'not-allowed' : 'pointer',
                                            fontSize: '0.85rem', fontWeight: 600
                                        }}
                                    >
                                        {sending ? 'Sending...' : 'Send SMS'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <div className="filters-bar">
                <form onSubmit={handleSearch} className="search-wrapper">
                    <HiOutlineSearch className="search-icon" />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search messages, contacts..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </form>
                <select className="filter-select" value={deviceFilter} onChange={(e) => { setDeviceFilter(e.target.value); setPage(1); }}>
                    <option value="">All Devices</option>
                    {devices.map(d => (
                        <option key={d._id} value={d.deviceId}>{d.name}</option>
                    ))}
                </select>
                <select className="filter-select" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                    <option value="">All Types</option>
                    <option value="inbox">Inbox</option>
                    <option value="sent">Sent</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-spinner"><div className="spinner"></div></div>
            ) : messages.length > 0 ? (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        <div className="message-list">
                            {messages.map((msg) => (
                                <div key={msg._id} className="message-item">
                                    <div className="message-avatar">
                                        {(msg.contactName || msg.address)?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div className="message-content">
                                        <div className="message-content-header">
                                            <span className="message-sender">
                                                {msg.contactName || msg.address}
                                                <span className={`message-badge ${msg.type}`}>{msg.type}</span>
                                            </span>
                                            <span className="message-time">{formatDate(msg.messageDate)}</span>
                                        </div>
                                        <div className="message-body">{msg.body}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            {msg.device?.name || 'Unknown device'} • {msg.address}
                                        </div>
                                    </div>
                                    <button
                                        className="logout-btn"
                                        onClick={() => handleDelete(msg._id)}
                                        title="Delete"
                                        style={{ flexShrink: 0 }}
                                    >
                                        <HiOutlineTrash size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {totalPages > 1 && (
                        <div style={{ padding: '1rem' }}>
                            <div className="pagination">
                                <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 0.5rem' }}>
                                    Page {page} of {totalPages}
                                </span>
                                <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card"><div className="card-body">
                    <div className="empty-state">
                        <div className="empty-state-icon">💬</div>
                        <h3>No messages found</h3>
                        <p>{search ? 'Try a different search term' : 'Messages will appear here when devices sync them'}</p>
                    </div>
                </div></div>
            )}
        </div>
    );
}
