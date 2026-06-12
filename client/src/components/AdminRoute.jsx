import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#F6F8FC' }}>
                <div className="spinner"></div>
                <style jsx="true">{`
                    .spinner {
                        width: 40px;
                        height: 40px;
                        border: 3px solid rgba(30, 107, 255, 0.1);
                        border-radius: 50%;
                        border-top-color: #1E6BFF;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return <Navigate to="/admin/login" replace />;
    }

    return <Outlet />;
};

export default AdminRoute;
