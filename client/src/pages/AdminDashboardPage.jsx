import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/client';
import '../styles/admin-dashboard.css';

export default function AdminDashboardPage() {
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('users'); // 'users' or 'approvals'
    const [error, setError] = useState('');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userForms, setUserForms] = useState([]);
    const [userFormsLoading, setUserFormsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [profileModal, setProfileModal] = useState({ open: false, userId: null, username: '', originalUsername: '', newPassword: '' });
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '' });
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    useEffect(() => {
        fetchStats();
        fetchLogs();
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

    const fetchLogs = async () => {
        try {
            setLogsLoading(true);
            const res = await api.get('/permissions/logs');
            setLogs(res.data.logs);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLogsLoading(false);
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

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        
        const updates = {};
        if (profileModal.username !== profileModal.originalUsername) {
            if (!profileModal.username.trim() || profileModal.username.length < 3) {
                alert('Username must be at least 3 characters');
                return;
            }
            updates.username = profileModal.username.trim();
        }
        
        if (profileModal.newPassword) {
            if (profileModal.newPassword.length < 6) {
                alert('Password must be at least 6 characters');
                return;
            }
            updates.password = profileModal.newPassword;
        }

        if (Object.keys(updates).length === 0) {
            setProfileModal({ open: false, userId: null, username: '', originalUsername: '', newPassword: '' });
            return;
        }

        try {
            setActionLoading(true);
            const res = await api.put(`/admin/users/${profileModal.userId}/profile`, updates);
            setProfileModal({ open: false, userId: null, username: '', originalUsername: '', newPassword: '' });
            alert(res.data.message);
            fetchStats();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update profile');
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

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newUser.username || newUser.password.length < 6) {
            alert('Username and password (min. 6 chars) are required');
            return;
        }

        try {
            setActionLoading(true);
            await api.post('/auth/register', newUser);
            setShowCreateUserModal(false);
            setNewUser({ username: '', password: '' });
            fetchStats();
            alert(`User ${newUser.username} created successfully.`);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create user');
        } finally {
            setActionLoading(false);
        }
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
                    <button className="btn btn-primary" onClick={() => setShowCreateUserModal(true)}>
                        + Create User
                    </button>
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

            <nav className="dashboard-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 User Activity
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
                    onClick={() => setActiveTab('approvals')}
                >
                    ⚖️ Approval History
                </button>
            </nav>

            {activeTab === 'users' && (
                <div className="tab-content animate-fade-in">
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
                        <h2>User Activity Details</h2>
                        <div className="table-container glass-card scrollable-table-wrapper">
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
                                                        onClick={() => setProfileModal({ 
                                                            open: true, 
                                                            userId: userItem.id, 
                                                            username: userItem.username, 
                                                            originalUsername: userItem.username,
                                                            newPassword: '' 
                                                        })}
                                                        disabled={actionLoading}
                                                        title="Edit Profile"
                                                    >👤</button>
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
                </div>
            )}

            {activeTab === 'approvals' && (
                <div className="tab-content animate-fade-in">
                    <section className="logs-section">
                        <h2>Approval & Activity Tracking</h2>
                        <div className="table-container glass-card scrollable-table-wrapper">
                            {logsLoading ? (
                                <div className="spinner-container"><div className="spinner"></div></div>
                            ) : logs.length === 0 ? (
                                <div className="empty-logs">No activity recorded yet.</div>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Form Name</th>
                                            <th>Requester</th>
                                            <th>Action</th>
                                            <th>Performed By</th>
                                            <th>Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map(log => (
                                            <tr key={log.id}>
                                                <td>{log.form_name}</td>
                                                <td>{log.requester}</td>
                                                <td>
                                                    <span className={`badge badge-action-${log.action}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td>{log.performer || 'System'}</td>
                                                <td>{new Date(log.timestamp).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </section>
                </div>
            )}

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

            {profileModal.open && (
                <div className="modal-overlay" onClick={() => setProfileModal({ ...profileModal, open: false })}>
                    <div className="modal glass-card" onClick={e => e.stopPropagation()}>
                        <h2>Edit Profile: {profileModal.originalUsername}</h2>
                        <form onSubmit={handleProfileUpdate}>
                            <div className="form-group">
                                <label>Username</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={profileModal.username}
                                    onChange={(e) => setProfileModal({ ...profileModal, username: e.target.value })}
                                    placeholder="Enter username"
                                    required
                                    minLength={3}
                                />
                            </div>
                            <div className="form-group">
                                <label>New Password (Optional)</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={profileModal.newPassword}
                                    onChange={(e) => setProfileModal({ ...profileModal, newPassword: e.target.value })}
                                    placeholder="Leave blank to keep current"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setProfileModal({ ...profileModal, open: false })}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={actionLoading}>Update Profile</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showCreateUserModal && (
                <div className="modal-overlay" onClick={() => setShowCreateUserModal(false)}>
                    <div className="modal glass-card" onClick={e => e.stopPropagation()}>
                        <h2>Create New User</h2>
                        <form onSubmit={handleCreateUser}>
                            <div className="form-group">
                                <label>Username</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                    placeholder="Enter username"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder="Min. 6 characters"
                                    required
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateUserModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={actionLoading}>Create User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
