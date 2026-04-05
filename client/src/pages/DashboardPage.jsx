import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/client';
import NotificationCenter from '../components/NotificationCenter';

export default function DashboardPage() {
    const [forms, setForms] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [newFormName, setNewFormName] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [renameId, setRenameId] = useState(null);
    const [renameName, setRenameName] = useState('');
    const [expandedUsers, setExpandedUsers] = useState({});
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

    useEffect(() => { 
        fetchForms(); 
    }, []);

    const handleRequestAccess = async (formId) => {
        try {
            await api.post(`/permissions/request/${formId}`);
            // Optimistically update status
            setForms(prevForms => prevForms.map(f => f.id === formId ? { ...f, access_status: 'pending' } : f));
        } catch { alert('Failed to request access'); }
    };

    const handleCreate = async (event) => {
        event.preventDefault();
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
            const res = await api.post(`/forms/${id}/duplicate`);
            const newForm = res.data.form;
            if (newForm && newForm.latest_version_id) {
                navigate(`/forms/${newForm.id}/builder/${newForm.latest_version_id}`);
            } else {
                fetchForms();
            }
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
            const res = await api.get(`/export/${id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_submissions.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed:', err);
            const errMsg = err.response?.data?.error || err.message || 'Unknown error';
            alert(`Export failed: ${errMsg}`);
        }
    };

    const toggleUserExpand = (owner) => {
        setExpandedUsers(prev => ({ ...prev, [owner]: !prev[owner] }));
    };

    // Group forms by owner
    const filteredForms = forms.filter(form => {
        const search = searchTerm.toLowerCase();
        return (
            form.name?.toLowerCase().includes(search) || 
            form.owner_username?.toLowerCase().includes(search)
        );
    });

    const groupedForms = filteredForms.reduce((acc, form) => {
        const owner = form.owner_username || 'Unknown';
        if (!acc[owner]) acc[owner] = [];
        acc[owner].push(form);
        return acc;
    }, {});

    // Sort owners so current user is always first
    const sortedOwners = Object.keys(groupedForms).sort((a, b) => {
        if (a === user?.username) return -1;
        if (b === user?.username) return 1;
        return a.localeCompare(b);
    });

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
                    <div className="search-container">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search forms or users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="search-clear" onClick={() => setSearchTerm('')}>✕</button>
                        )}
                    </div>
                </div>
                <div className="header-right">
                    <NotificationCenter />
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

            {/* Forms Grouped by User */}
            <div className="forms-grouped" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem' }}>
                {forms.length === 0 ? (
                    <div className="empty-state glass-card">
                        <div className="empty-icon">📝</div>
                        <h2>No Forms Found</h2>
                        <p>Create a form or wait for shared forms to appear.</p>
                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                            Create First Form
                        </button>
                    </div>
                ) : filteredForms.length === 0 ? (
                    <div className="empty-state glass-card">
                        <div className="empty-icon">🔍</div>
                        <h2>No Matches Found</h2>
                        <p>We couldn't find any forms matching "{searchTerm}".</p>
                        <button className="btn btn-ghost" onClick={() => setSearchTerm('')}>
                            Clear Search
                        </button>
                    </div>
                ) : (
                    sortedOwners.map((owner) => {
                        const ownerForms = groupedForms[owner];
                        const isExpanded = expandedUsers[owner] !== false; // Default to expanded
                        const isMe = owner === user?.username;

                        return (
                            <div key={owner} className="user-form-group">
                                <h2 className="user-group-title" onClick={() => toggleUserExpand(owner)} style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-color)' }}>
                                    <span style={{ fontSize: '0.8em', opacity: 0.7 }}>{isExpanded ? '▼' : '▶'}</span>
                                    {isMe ? '⭐ My Forms' : `👤 ${owner}'s Forms`} 
                                    <span className="badge badge-count" style={{ marginLeft: '0.5rem' }}>{ownerForms.length}</span>
                                </h2>
                                
                                {isExpanded && (
                                    <div className="forms-grid">
                                        {ownerForms.map((form) => {
                                            const status = form.access_status;
                                            const isOwner = status === 'owner';
                                            const isAdmin = status === 'admin';
                                            const hasAccess = isOwner || isAdmin || status === 'approved';

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
                                                            </>
                                                        )}
                                                        <div className="form-card-badges">
                                                            {form.is_locked && <span className="badge badge-locked">🔒 Locked</span>}
                                                            <span className="badge badge-count">{form.submission_count} submissions</span>
                                                            {isAdmin && <span className="badge badge-admin">Global Access</span>}
                                                        </div>
                                                    </div>

                                                    <div className="form-card-meta">
                                                        <span>Created: {new Date(form.created_at).toLocaleDateString()}</span>
                                                        {form.latest_version_id && <span>Version {form.version_number}</span>}
                                                    </div>

                                                    <div className="form-card-actions">
                                                        {(isOwner || isAdmin) && !form.is_locked && (
                                                            <button className="btn btn-sm btn-accent" onClick={() => navigate(`/forms/${form.id}/builder/${form.latest_version_id}`)}>
                                                                ✏️ Build
                                                            </button>
                                                        )}
                                                        
                                                        {hasAccess ? (
                                                            <>
                                                                <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/forms/${form.id}/submit`)}>
                                                                    📝 Fill
                                                                </button>
                                                                <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/forms/${form.id}/submissions`)}>
                                                                    📊 View
                                                                </button>
                                                                <button className="btn btn-sm btn-secondary" onClick={() => handleExport(form.id, form.name)}>
                                                                    📥 Export
                                                                </button>
                                                                {(isOwner || isAdmin) && (
                                                                    <>
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
                                                            </>
                                                        ) : (
                                                            status === 'pending' ? (
                                                                <button className="btn btn-sm btn-ghost" disabled>⏳ Request Sent</button>
                                                            ) : status === 'rejected' ? (
                                                                <button className="btn btn-sm btn-danger" disabled>🚫 Rejected</button>
                                                            ) : (
                                                                <button className="btn btn-sm btn-primary" onClick={() => handleRequestAccess(form.id)}>🔓 Request Access</button>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
