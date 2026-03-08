import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import {
    HiOutlineViewGrid,
    HiOutlineDeviceMobile,
    HiOutlinePhotograph,
    HiOutlineChatAlt2,
    HiOutlineLogout,
    HiOutlineStatusOnline
} from 'react-icons/hi';

export default function Sidebar() {
    const { admin, logout } = useAuth();
    const { connected } = useSocket();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">📱</div>
                    <div className="sidebar-logo-text">
                        <h1>Device Manager</h1>
                        <p>Control Panel</p>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section-title">Main</div>
                <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} end>
                    <span className="sidebar-link-icon"><HiOutlineViewGrid /></span>
                    Dashboard
                </NavLink>
                <NavLink to="/devices" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <span className="sidebar-link-icon"><HiOutlineDeviceMobile /></span>
                    Devices
                </NavLink>

                <div className="sidebar-section-title">Data</div>
                <NavLink to="/photos" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <span className="sidebar-link-icon"><HiOutlinePhotograph /></span>
                    Photos
                </NavLink>
                <NavLink to="/messages" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <span className="sidebar-link-icon"><HiOutlineChatAlt2 /></span>
                    Messages
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-footer-user">
                    <div className="sidebar-footer-avatar">
                        {admin?.email?.[0]?.toUpperCase() || 'A'}
                    </div>
                    <div className="sidebar-footer-info">
                        <p>{admin?.email || 'Admin'}</p>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <HiOutlineStatusOnline style={{ color: connected ? 'var(--accent-success)' : 'var(--text-muted)' }} />
                            {connected ? 'Connected' : 'Disconnected'}
                        </p>
                    </div>
                    <button className="logout-btn" onClick={handleLogout} title="Logout">
                        <HiOutlineLogout size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
