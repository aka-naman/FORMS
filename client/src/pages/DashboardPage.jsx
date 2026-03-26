import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/client';

export default function DashboardPage() {
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newFormName, setNewFormName] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [renameId, setRenameId] = useState(null);
    const [renameName, setRenameName] = useState('');
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const fetchForms = async () => {
        try {
            const res = await api.get('/forms');
            setForms(res.data.forms);
        } catch (err) {
            console.error('Failed to fetch forms:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchForms(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newFormName.trim()) return;
        try {
            await api.post('/forms', { name: newFormName.trim() });
            setNewFormName('');
            setShowCreateModal(false);
            fetchForms();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create form');
        }
    };

    const handleRename = async (id) => {
        if (!renameName.trim()) return;
        try {
            await api.put(`/forms/${id}`, { name: renameName.trim() });
            setRenameId(null);
            setRenameName('');
            fetchForms();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to rename');
        }
    };

    const handleDuplicate = async (id) => {
        try {
            await api.post(`/forms/${id}/duplicate`);
            fetchForms();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to duplicate');
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete "${name}"? This will remove all submissions.`)) return;
        try {
            await api.delete(`/forms/${id}`);
            fetchForms();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete');
        }
    };

    const handleExport = async (id, name) => {
        try {
            const res = await api.get(`/forms/${id}/export`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_submissions.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert(err.response?.data?.error || 'Export failed');
        }
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <div className="header-left">
                    <h1>📋 Form Dashboard</h1>
                    <span className="user-badge">{user?.role === 'admin' ? '👑 Admin' : '👤 User'}: {user?.username}</span>
                </div>
                <div className="header-right">
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        + New Form
                    </button>
                    {user?.role === 'admin' && (
                        <button className="btn btn-secondary" onClick={() => navigate('/admin/dashboard')}>
                            📊 Admin Dashboard
                        </button>
                    )}
                    <button
                        className="theme-toggle-btn"
                        onClick={toggleTheme}
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <button className="btn btn-ghost" onClick={logout}>
                        Logout
                    </button>
                </div>
            </header>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal glass-card" onClick={e => e.stopPropagation()}>
                        <h2>Create New Form</h2>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label>Form Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newFormName}
                                    onChange={(e) => setNewFormName(e.target.value)}
                                    placeholder="Enter form name"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Forms Grid */}
            <div className="forms-grid">
                {forms.length === 0 ? (
                    <div className="empty-state glass-card">
                        <div className="empty-icon">📝</div>
                        <h2>No Forms Yet</h2>
                        <p>Create your first form to get started.</p>
                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                            Create First Form
                        </button>
                    </div>
                ) : (
                    forms.map((form) => {
                        const isOwner = user?.id === form.user_id || user?.role === 'admin';
                        return (
                        <div key={form.id} className="form-card glass-card">
                            <div className="form-card-header">
                                {renameId === form.id ? (
                                    <div className="rename-inline">
                                        <input
                                            type="text"
                                            className="form-input form-input-sm"
                                            value={renameName}
                                            onChange={(e) => setRenameName(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(form.id); if (e.key === 'Escape') setRenameId(null); }}
                                            autoFocus
                                        />
                                        <button className="btn btn-sm btn-primary" onClick={() => handleRename(form.id)}>Save</button>
                                        <button className="btn btn-sm btn-ghost" onClick={() => setRenameId(null)}>✕</button>
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="form-card-title">{form.name}</h3>
                                        {user?.role === 'admin' && form.owner_username && !isOwner && (
                                            <span className="form-owner-badge">by {form.owner_username}</span>
                                        )}
                                    </>
                                )}
                                <div className="form-card-badges">
                                    {form.is_locked && <span className="badge badge-locked">🔒 Locked</span>}
                                    <span className="badge badge-count">{form.submission_count} submissions</span>
                                </div>
                            </div>

                            <div className="form-card-meta">
                                <span>Created: {new Date(form.created_at).toLocaleDateString()}</span>
                                {form.latest_version_id && <span>Version {form.version_number}</span>}
                            </div>

                            <div className="form-card-actions">
                                {isOwner && !form.is_locked && (
                                    <button className="btn btn-sm btn-accent" onClick={() => navigate(`/forms/${form.id}/builder/${form.latest_version_id}`)}>
                                        ✏️ Build
                                    </button>
                                )}
                                <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/forms/${form.id}/submit`)}>
                                    📝 Fill
                                </button>
                                {isOwner && (
                                    <>
                                        <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/forms/${form.id}/submissions`)}>
                                            📊 View
                                        </button>
                                        <button className="btn btn-sm btn-secondary" onClick={() => handleExport(form.id, form.name)}>
                                            📥 Export
                                        </button>
                                        {!form.is_locked && (
                                            <button className="btn btn-sm btn-ghost" onClick={() => { setRenameId(form.id); setRenameName(form.name); }}>
                                                ✏️ Rename
                                            </button>
                                        )}
                                        <button className="btn btn-sm btn-ghost" onClick={() => handleDuplicate(form.id)}>
                                            📋 Duplicate
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(form.id, form.name)}>
                                            🗑️ Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
