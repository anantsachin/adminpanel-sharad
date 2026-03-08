import { useState, useEffect } from 'react';
import { getMessages, getDevices, deleteMessage } from '../services/api';
import { HiOutlineSearch, HiOutlineTrash } from 'react-icons/hi';

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

    const formatDate = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString();
    };

    return (
        <div>
            <div className="page-header">
                <h1>Messages</h1>
                <p>{total.toLocaleString()} messages from {devices.length} devices</p>
            </div>

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
