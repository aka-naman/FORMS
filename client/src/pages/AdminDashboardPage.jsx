import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/client';
import '../styles/admin-dashboard.css';

export default function AdminDashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userForms, setUserForms] = useState([]);
    const [userFormsLoading, setUserFormsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [passwordModal, setPasswordModal] = useState({ open: false, userId: null, username: '', newPassword: '' });
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await api.get('/forms/admin/stats');
            setStats(res.data.stats);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
            setError(err.response?.data?.error || 'Failed to load statistics');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!confirm(`Are you sure you want to delete user "${username}"? This will delete ALL their forms and submissions. This action CANNOT be undone.`)) return;
        
        try {
            setActionLoading(true);
            await api.delete(`/admin/users/${userId}`);
            fetchStats();
            alert(`User ${username} deleted successfully.`);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete user');
        } finally {
            setActionLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!passwordModal.newPassword || passwordModal.newPassword.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }

        try {
            setActionLoading(true);
            await api.put(`/admin/users/${passwordModal.userId}/password`, { newPassword: passwordModal.newPassword });
            setPasswordModal({ open: false, userId: null, username: '', newPassword: '' });
            alert(`Password for ${passwordModal.username} updated successfully.`);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update password');
        } finally {
            setActionLoading(false);
        }
    };

    const handleChangeRole = async (userId, currentRole, username) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        if (!confirm(`Change role of "${username}" to ${newRole.toUpperCase()}?`)) return;

        try {
            setActionLoading(true);
            await api.put(`/admin/users/${userId}/role`, { role: newRole });
            fetchStats();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update role');
        } finally {
            setActionLoading(false);
        }
    };

    const viewUserForms = async (userId) => {
        try {
            setUserFormsLoading(true);
            setError('');
            const res = await api.get(`/forms/admin/user/${userId}`);
            setUserForms(res.data.forms);
            setSelectedUserId(userId);
        } catch (err) {
            console.error('Failed to fetch user forms:', err);
            setError(err.response?.data?.error || 'Failed to load user forms');
            setSelectedUserId(null);
        } finally {
            setUserFormsLoading(false);
        }
    };

    const closeUserFormsModal = () => {
        setSelectedUserId(null);
        setUserForms([]);
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading admin dashboard...</p>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="page-container">
                <div className="glass-card error-card">
                    <h2>⚠️ Error</h2>
                    <p>{error || 'Failed to load admin dashboard'}</p>
                    <button className="btn btn-primary" onClick={fetchStats}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const selectedUser = stats.users?.find(u => u.id === selectedUserId);

    return (
        <div className="admin-dashboard-page">
            <header className="dashboard-header">
                <div className="header-left">
                    <h1>👑 Admin Dashboard</h1>
                    <span className="user-badge">Admin: {user?.username}</span>
                </div>
                <div className="header-right">
                    <button className="btn btn-secondary" onClick={() => navigate('/')} title="Back to Dashboard">
                        ← Dashboard
                    </button>
                    <button
                        className="theme-toggle-btn"
                        onClick={toggleTheme}
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <button className="btn btn-ghost" onClick={logout}>
                        Logout
                    </button>
                </div>
            </header>

            {error && (
                <div className="alert alert-error">
                    <span>{error}</span>
                    <button className="alert-close" onClick={() => setError('')}>✕</button>
                </div>
            )}

            <section className="stats-section">
                <h2>Global Statistics</h2>
                <div className="stats-grid">
                    <div className="stat-card glass-card">
                        <div className="stat-icon">👥</div>
                        <div className="stat-content">
                            <div className="stat-number">{stats.total_users}</div>
                            <div className="stat-label">Total Users</div>
                        </div>
                    </div>
                    <div className="stat-card glass-card">
                        <div className="stat-icon">📋</div>
                        <div className="stat-content">
                            <div className="stat-number">{stats.total_forms}</div>
                            <div className="stat-label">Total Forms</div>
                        </div>
                    </div>
                    <div className="stat-card glass-card">
                        <div className="stat-icon">📝</div>
                        <div className="stat-content">
                            <div className="stat-number">{stats.total_submissions}</div>
                            <div className="stat-label">Total Submissions</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="users-section">
                <h2>User Activity</h2>
                <div className="table-container glass-card">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Joined</th>
                                <th>Forms</th>
                                <th>Submissions</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.users.map(userItem => (
                                <tr key={userItem.id} className={userItem.role === 'admin' ? 'admin-row' : ''}>
                                    <td className="user-name">
                                        {userItem.role === 'admin' ? '👑 ' : '👤 '}
                                        {userItem.username}
                                    </td>
                                    <td>
                                        <span className={`badge badge-${userItem.role}`}>
                                            {userItem.role}
                                        </span>
                                    </td>
                                    <td>{new Date(userItem.created_at).toLocaleDateString()}</td>
                                    <td className="text-center">{userItem.form_count}</td>
                                    <td className="text-center">{userItem.submission_count}</td>
                                    <td>
                                        <div className="admin-actions">
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => viewUserForms(userItem.id)}
                                                disabled={actionLoading}
                                                title="View Forms"
                                            >📂</button>
                                            <button
                                                className="btn btn-sm btn-accent"
                                                onClick={() => setPasswordModal({ open: true, userId: userItem.id, username: userItem.username, newPassword: '' })}
                                                disabled={actionLoading}
                                                title="Reset Password"
                                            >🔑</button>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleChangeRole(userItem.id, userItem.role, userItem.username)}
                                                disabled={actionLoading || userItem.id === user?.id}
                                                title="Toggle Role"
                                            >{userItem.role === 'admin' ? '👤' : '👑'}</button>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDeleteUser(userItem.id, userItem.username)}
                                                disabled={actionLoading || userItem.id === user?.id}
                                                title="Delete User"
                                            >🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {selectedUserId && (
                <div className="modal-overlay" onClick={closeUserFormsModal}>
                    <div className="modal glass-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Forms by {selectedUser?.username}</h2>
                            <button className="btn-close" onClick={closeUserFormsModal}>✕</button>
                        </div>
                        <div className="modal-content">
                            {userFormsLoading ? <div className="spinner"></div> : (
                                <div className="forms-list">
                                    {userForms.map(form => (
                                        <div key={form.id} className="form-item glass-card">
                                            <div className="form-item-header">
                                                <h4>{form.name}</h4>
                                                {form.is_locked && <span className="badge badge-locked">🔒</span>}
                                            </div>
                                            <div className="form-item-meta">
                                                <span>v{form.version_number}</span>
                                                <span>{form.submission_count} submissions</span>
                                            </div>
                                            <button className="btn btn-sm btn-secondary" onClick={() => { navigate(`/forms/${form.id}/submissions`); closeUserFormsModal(); }}>View</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {passwordModal.open && (
                <div className="modal-overlay" onClick={() => setPasswordModal({ ...passwordModal, open: false })}>
                    <div className="modal glass-card" onClick={e => e.stopPropagation()}>
                        <h2>Reset Password for {passwordModal.username}</h2>
                        <form onSubmit={handleChangePassword}>
                            <div className="form-group">
                                <label>New Password</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={passwordModal.newPassword}
                                    onChange={(e) => setPasswordModal({ ...passwordModal, newPassword: e.target.value })}
                                    placeholder="Min. 6 characters"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setPasswordModal({ ...passwordModal, open: false })}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={actionLoading}>Update</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
