import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { offlineDB } from '../services/offlineDB';
import axios from 'axios';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    const checkPendingCount = useCallback(async () => {
        try {
            const queue = await offlineDB.getMutationQueue();
            setPendingCount(queue.length);
        } catch (error) {
            console.error('Error checking pending count', error);
        }
    }, []);

    const flushQueue = useCallback(async () => {
        if (isSyncing || !navigator.onLine) return;
        
        setIsSyncing(true);
        try {
            const queue = await offlineDB.getMutationQueue();
            if (queue.length === 0) {
                setIsSyncing(false);
                return;
            }

            for (const item of queue) {
                try {
                    await axios({
                        method: item.method,
                        url: item.url,
                        data: item.data,
                        headers: item.headers
                    });
                    // On success, remove from queue
                    await offlineDB.removeMutationFromQueue(item.id);
                } catch (error) {
                    console.error('Failed to sync item:', item, error);
                    // If network error, we break and stop syncing until next online event
                    if (!error.response) {
                        break; 
                    }
                    // If it's a 4xx error (bad request, etc), we might want to drop it, but we'll leave it for now or delete it
                    if (error.response && error.response.status >= 400 && error.response.status < 500) {
                        await offlineDB.removeMutationFromQueue(item.id);
                    }
                }
            }
        } catch (error) {
            console.error('Error flushing queue:', error);
        } finally {
            await checkPendingCount();
            setIsSyncing(false);
        }
    }, [isSyncing, checkPendingCount]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check initially
        checkPendingCount();

        // Polling queue check every 10 seconds to catch any new items
        const interval = setInterval(checkPendingCount, 10000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, [checkPendingCount]);

    useEffect(() => {
        if (isOnline) {
            flushQueue();
        }
    }, [isOnline, flushQueue]);

    const triggerSync = useCallback(async () => {
        await checkPendingCount();
        if (isOnline) {
            await flushQueue();
        }
    }, [isOnline, checkPendingCount, flushQueue]);

    return (
        <SyncContext.Provider value={{ isOnline, pendingCount, isSyncing, triggerSync }}>
            {children}
        </SyncContext.Provider>
    );
};
