import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { authService } from '../services/api';
import api from '../services/api';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));

    // Function to load current user
    const loadUser = useCallback(async (authToken) => {
        if (!authToken) {
            setLoading(false);
            return;
        }

        try {
            api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
            
            const res = await api.get('/api/auth/me');
            if (res.data && res.data.success) {
                setUser(res.data.data);
            } else {
                throw new Error('Failed to fetch user');
            }
        } catch (err) {
            console.error('Error loading user:', err);
            handleLogout();
        } finally {
            setLoading(false);
        }
    }, []);

    const handleLogout = useCallback(async () => {
        try {
            await signOut(auth);
        } catch (e) {
            console.error("Firebase logout error", e);
        }
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        delete api.defaults.headers.common['Authorization'];
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // If logged in via Firebase but no local token, sync with backend
                const currentToken = localStorage.getItem('token');
                if (!currentToken) {
                    try {
                        const res = await authService.googleLogin({
                            email: firebaseUser.email,
                            name: firebaseUser.displayName || 'User',
                            uid: firebaseUser.uid,
                            photoURL: firebaseUser.photoURL
                        });

                        const { token: newToken, data: newUser } = res.data;
                        
                        localStorage.setItem('token', newToken);
                        setToken(newToken);
                        setUser(newUser);
                        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                        setLoading(false);
                    } catch (error) {
                        console.error('Backend Google Auth Error:', error);
                        handleLogout();
                    }
                } else {
                    // Just load the user if we have a token
                    loadUser(currentToken);
                }
            } else {
                // Not logged into Firebase, check standard backend session
                const currentToken = localStorage.getItem('token');
                if (currentToken) {
                    loadUser(currentToken);
                } else {
                    setLoading(false);
                }
            }
        });

        return () => unsubscribe();
    }, [loadUser, handleLogout]);

    const register = async (userData) => {
        try {
            const res = await authService.register(userData);
            const { token: newToken, data: newUser } = res.data;
            
            localStorage.setItem('token', newToken);
            setToken(newToken);
            setUser(newUser);
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            
            return res.data;
        } catch (err) {
            throw err;
        }
    };

    const login = async (userData) => {
        try {
            const res = await authService.login(userData);
            const { token: newToken, data: newUser } = res.data;
            
            localStorage.setItem('token', newToken);
            setToken(newToken);
            setUser(newUser);
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            
            return res.data;
        } catch (err) {
            throw err;
        }
    };

    const logout = () => {
        handleLogout();
    };

    return (
        <AuthContext.Provider value={{ user, loading, register, login, logout, token, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
