import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const userRole = user.role?.toLowerCase() || '';
    
    // Map db roles to normalized roles for checking
    let normalizedRole = 'employee';
    if (userRole === 'master admin' || userRole === 'masteradmin' || userRole === 'superadmin') {
        normalizedRole = 'superadmin';
    } else if (userRole === 'admin' || userRole === 'hr' || userRole === 'hr admin') {
        normalizedRole = 'admin';
    }

    if (allowedRoles && !allowedRoles.includes(normalizedRole)) {
        // Redirect to their appropriate dashboard if they try to access an unauthorized route
        if (normalizedRole === 'superadmin') return <Navigate to="/superadmin" replace />;
        if (normalizedRole === 'admin') return <Navigate to="/admin" replace />;
        return <Navigate to="/employee" replace />;
    }

    return children;
};

export default ProtectedRoute;
