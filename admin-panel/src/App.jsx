import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import DeviceDetail from './pages/DeviceDetail';
import Photos from './pages/Photos';
import Messages from './pages/Messages';
import './index.css';

function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children }) {
    return (
        <SocketProvider>
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </SocketProvider>
    );
}

function AppRoutes() {
    const { isAuthenticated } = useAuth();

    return (
        <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/" element={
                <ProtectedRoute>
                    <AppLayout><Dashboard /></AppLayout>
                </ProtectedRoute>
            } />
            <Route path="/devices" element={
                <ProtectedRoute>
                    <AppLayout><Devices /></AppLayout>
                </ProtectedRoute>
            } />
            <Route path="/devices/:id" element={
                <ProtectedRoute>
                    <AppLayout><DeviceDetail /></AppLayout>
                </ProtectedRoute>
            } />
            <Route path="/photos" element={
                <ProtectedRoute>
                    <AppLayout><Photos /></AppLayout>
                </ProtectedRoute>
            } />
            <Route path="/messages" element={
                <ProtectedRoute>
                    <AppLayout><Messages /></AppLayout>
                </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}
