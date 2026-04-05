import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

export default function NotificationCenter() {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications');
            setNotifications(res.data.notifications);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAction = async (action, notification) => {
        setLoading(true);
        try {
            // Action on the permission itself
            await api.post(`/permissions/${action}/${notification.permission_id}`);
            // The backend already marks the 'access_request' notification as read, 
            // but we should refresh to see new status notifications if any
            await fetchNotifications();
        } catch {
            alert(`${action} failed`);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
        } catch (e) { console.error(e); }
    };

    const clearNotification = async (id, e) => {
        e.stopPropagation();
        try {
            await api.patch(`/notifications/${id}/clear`);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch { alert('Clear failed'); }
    };

    const clearAll = async () => {
        if (!window.confirm('Clear all notifications?')) return;
        try {
            await api.patch('/notifications/clear-all');
            setNotifications([]);
        } catch { alert('Clear all failed'); }
    };

    const unreadCount = notifications.filter(n => n.status === 'unread').length;

    return (
        <div className="notification-center" ref={dropdownRef}>
            <button 
                className={`btn btn-icon notification-trigger ${unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title="Notifications"
            >
                🔔
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>

            {isOpen && (
                <div className="notification-dropdown glass-card">
                    <div className="notification-header">
                        <h3>Notifications</h3>
                        {notifications.length > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={clearAll}>Clear All</button>
                        )}
                    </div>

                    <div className="notification-list">
                        {notifications.length === 0 ? (
                            <div className="notification-empty">No new notifications</div>
                        ) : (
                            notifications.map(n => (
                                <div 
                                    key={n.id} 
                                    className={`notification-item ${n.status === 'unread' ? 'unread' : ''}`}
                                    onClick={() => n.status === 'unread' && markAsRead(n.id)}
                                >
                                    <div className="notification-content">
                                        <p className="notification-message">{n.message}</p>
                                        <span className="notification-time">{new Date(n.created_at).toLocaleString()}</span>
                                        
                                        {n.type === 'access_request' && n.status !== 'read' && (
                                            <div className="notification-actions">
                                                <button 
                                                    className="btn btn-sm btn-primary" 
                                                    onClick={(e) => { e.stopPropagation(); handleAction('approve', n); }}
                                                    disabled={loading}
                                                >
                                                    Approve
                                                </button>
                                                <button 
                                                    className="btn btn-sm btn-secondary" 
                                                    onClick={(e) => { e.stopPropagation(); handleAction('reject', n); }}
                                                    disabled={loading}
                                                >
                                                    Reject
                                                </button>
                                                <button 
                                                    className="btn btn-sm btn-ghost" 
                                                    onClick={(e) => { e.stopPropagation(); handleAction('ignore', n); }}
                                                    disabled={loading}
                                                >
                                                    Ignore
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button className="notification-clear-btn" onClick={(e) => clearNotification(n.id, e)} title="Clear">✕</button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
