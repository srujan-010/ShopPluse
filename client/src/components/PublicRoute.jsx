import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PublicRoute = () => {
    const { user, loading } = useAuth();

    if (loading) return null;

    if (user) {
        return <Navigate to="/shops" replace />;
    }

    return <Outlet />;
};

export default PublicRoute;
