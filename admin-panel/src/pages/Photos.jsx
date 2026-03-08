import { useState, useEffect } from 'react';
import { getPhotos, getDevices, deletePhoto } from '../services/api';
import { HiOutlineSearch, HiOutlineTrash } from 'react-icons/hi';

export default function Photos() {
    const [photos, setPhotos] = useState([]);
    const [devices, setDevices] = useState([]);
    const [filter, setFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [lightbox, setLightbox] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchPhotos = async () => {
        try {
            const params = { page, limit: 24 };
            if (filter) params.deviceId = filter;
            const { data } = await getPhotos(params);
            setPhotos(data.photos);
            setTotalPages(data.pages);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDevices = async () => {
        try {
            const { data } = await getDevices();
            setDevices(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { fetchDevices(); }, []);
    useEffect(() => { fetchPhotos(); }, [filter, page]);

    const handleDelete = async (id) => {
        if (!confirm('Delete this photo?')) return;
        try {
            await deletePhoto(id);
            setPhotos(prev => prev.filter(p => p._id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1>Photos</h1>
                <p>All captured photos from your devices</p>
            </div>

            <div className="filters-bar">
                <select className="filter-select" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
                    <option value="">All Devices</option>
                    {devices.map(d => (
                        <option key={d._id} value={d.deviceId}>{d.name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="loading-spinner"><div className="spinner"></div></div>
            ) : photos.length > 0 ? (
                <>
                    <div className="photo-grid">
                        {photos.map((photo) => (
                            <div key={photo._id} className="photo-item">
                                <img
                                    src={`https://adminpanel-sharad.onrender.com${photo.path}`}
                                    alt={photo.originalName}
                                    loading="lazy"
                                    onClick={() => setLightbox(photo)}
                                />
                                <div className="photo-overlay">
                                    <p style={{ fontWeight: 600 }}>{photo.device?.name || 'Unknown'}</p>
                                    <p>{new Date(photo.createdAt).toLocaleDateString()}</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(photo._id); }}
                                        style={{
                                            position: 'absolute', top: '0.5rem', right: '0.5rem',
                                            background: 'rgba(239,68,68,0.8)', border: 'none',
                                            color: 'white', borderRadius: '50%', width: '28px', height: '28px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                        }}
                                    >
                                        <HiOutlineTrash size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="pagination">
                            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                            {Array.from({ length: totalPages }, (_, i) => (
                                <button
                                    key={i + 1}
                                    className={`pagination-btn ${page === i + 1 ? 'active' : ''}`}
                                    onClick={() => setPage(i + 1)}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                        </div>
                    )}
                </>
            ) : (
                <div className="card"><div className="card-body">
                    <div className="empty-state">
                        <div className="empty-state-icon">📸</div>
                        <h3>No photos yet</h3>
                        <p>Photos will appear here when devices upload them</p>
                    </div>
                </div></div>
            )}

            {lightbox && (
                <div className="lightbox" onClick={() => setLightbox(null)}>
                    <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
                    <img src={`https://adminpanel-sharad.onrender.com${lightbox.path}`} alt={lightbox.originalName} />
                    <div className="lightbox-info">
                        <p>{lightbox.device?.name} • {lightbox.originalName} • {new Date(lightbox.createdAt).toLocaleString()}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
