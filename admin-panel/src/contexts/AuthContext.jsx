import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem('dm_token'));
    const [admin, setAdmin] = useState(() => {
        const stored = localStorage.getItem('dm_admin');
        return stored ? JSON.parse(stored) : null;
    });

    const loginUser = (tokenVal, adminData) => {
        localStorage.setItem('dm_token', tokenVal);
        localStorage.setItem('dm_admin', JSON.stringify(adminData));
        setToken(tokenVal);
        setAdmin(adminData);
    };

    const logout = () => {
        localStorage.removeItem('dm_token');
        localStorage.removeItem('dm_admin');
        setToken(null);
        setAdmin(null);
    };

    const isAuthenticated = !!token;

    return (
        <AuthContext.Provider value={{ token, admin, isAuthenticated, loginUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
