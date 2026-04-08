import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import api from '../api/client';

export default function SubmissionsPage() {
    const { formId } = useParams();
    const navigate = useNavigate();
    const [fields, setFields] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [formName, setFormName] = useState('');
    const [loading, setLoading] = useState(true);
    
    // Pagination & Search State
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });
    
    // Edit Modal State
    const [editingSubmission, setEditingSubmission] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [savingEdit, setSavingEdit] = useState(false);

    // Audit State
    const [auditLog, setAuditLog] = useState(null);

    const load = useCallback(async (pageNum = 1, search = '') => {
        setLoading(true);
        try {
            const res = await api.get(`/forms/${formId}/submissions?page=${pageNum}&search=${search}&limit=50`);
            setFields(res.data.fields);
            setSubmissions(res.data.submissions);
            setPagination(res.data.pagination);
            
            if (!formName) {
                const formsRes = await api.get('/forms');
                const form = formsRes.data.forms.find(f => f.id === parseInt(formId));
                if (form) setFormName(form.name);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [formId, formName]);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            load(1, searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(delayDebounce);
    }, [searchTerm, load]);

    useEffect(() => {
        load(page, searchTerm);
    }, [page, searchTerm, load]);

    const handleEditClick = (sub) => {
        const initial = {};
        fields.forEach(f => {
            const found = sub.values.find(v => v.field_id === f.id);
            initial[f.id] = found ? found.value : '';
        });
        setEditValues(initial);
        setEditingSubmission(sub);
    };

    const handleEditSave = async () => {
        setSavingEdit(true);
        try {
            await api.put(`/forms/${formId}/submissions/${editingSubmission.id}`, { values: editValues });
            setEditingSubmission(null);
            load(page, searchTerm);
        } catch {
            alert('Failed to update submission');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDelete = async (subId) => {
        if (!window.confirm('Delete this entry? It will be removed from this view but kept in the audit trail.')) return;
        try {
            await api.delete(`/forms/${formId}/submissions/${subId}`);
            load(page, searchTerm);
        } catch {
            alert('Delete failed');
        }
    };

    const fetchAudit = async (subId) => {
        try {
            const res = await api.get(`/forms/${formId}/submissions/${subId}/audit`);
            setAuditLog({ submissionId: subId, entries: res.data.audit });
        } catch {
            alert('Failed to fetch audit history');
        }
    };

    const getFieldValue = (submission, fieldId) => {
        if (!submission.values) return '';
        const val = submission.values.find(v => v.field_id === fieldId);
        return val ? val.value : '';
    };

    const handleExport = async () => {
        try {
            const res = await api.get(`/export/${formId}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `export_${formId}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            alert('Export failed');
        }
    };

    // Horizontal Scroll Sync
    const headerRef = useMemo(() => ({ current: null }), []);
    const onScroll = ({ scrollLeft }) => {
        if (headerRef.current) {
            headerRef.current.scrollLeft = scrollLeft;
        }
    };

    // Virtualized Row Component
    const Row = ({ index, style }) => {
        const sub = submissions[index];
        return (
            <div style={style} className="table-row">
                <div className="table-cell sticky-col first-col">
                    <div className="action-group">
                        <button className="btn btn-icon btn-sm" onClick={() => handleEditClick(sub)} title="Edit">✏️</button>
                        <button className="btn btn-icon btn-sm btn-danger-icon" onClick={() => handleDelete(sub.id)} title="Delete">🗑️</button>
                    </div>
                </div>
                <div className="table-cell">{sub.id}</div>
                <div className="table-cell">{new Date(sub.submitted_at).toLocaleString()}</div>
                {fields.map(f => (
                    <div key={f.id} className="table-cell">{getFieldValue(sub, f.id)}</div>
                ))}
                <div className="table-cell">
                    {sub.updated_at ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => fetchAudit(sub.id)}>
                            🕒 History ({sub.updated_by_username})
                        </button>
                    ) : '-'}
                </div>
            </div>
        );
    };

    return (
        <div className="submissions-page">
            <header className="submissions-header">
                <div className="header-left">
                    <button className="btn btn-ghost" onClick={() => navigate('/')}>← Back</button>
                    <h1>📊 {formName}</h1>
                </div>
                
                <div className="header-center flex-1">
                    <div className="search-container">
                        <input 
                            type="text" 
                            className="search-input" 
                            placeholder="🔍 Server-side search..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="header-right">
                    <span className="badge badge-count">{pagination.total} entries</span>
                    <button className="btn btn-primary" onClick={handleExport}>📥 Export All</button>
                </div>
            </header>

            {loading && submissions.length === 0 ? (
                <div className="loading-screen"><div className="spinner"></div></div>
            ) : submissions.length === 0 ? (
                <div className="empty-state glass-card"><h2>No entries found</h2></div>
            ) : (
                <>
                    <div className="table-container virtualized-table-container glass-card">
                        <div className="virtualized-table">
                            <div className="table-header" ref={headerRef}>
                                <div className="table-cell sticky-col first-col">Actions</div>
                                <div className="table-cell">ID</div>
                                <div className="table-cell">Submitted At</div>
                                {fields.map(f => <div key={f.id} className="table-cell">{f.label}</div>)}
                                <div className="table-cell">Edit Logs</div>
                            </div>
                            <div className="table-body">
                                <AutoSizer>
                                    {({ height, width }) => (
                                        <List
                                            height={height}
                                            itemCount={submissions.length}
                                            itemSize={60}
                                            width={width}
                                            onScroll={onScroll}
                                        >
                                            {Row}
                                        </List>
                                    )}
                                </AutoSizer>
                            </div>
                        </div>
                    </div>

                    <div className="pagination-controls">
                        <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                        <span className="page-info">Page <strong>{page}</strong> of {pagination.pages}</span>
                        <button className="btn btn-secondary" disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
                    </div>
                </>
            )}

            {/* Modals remain same */}
            {editingSubmission && (
                <div className="modal-overlay" onClick={() => setEditingSubmission(null)}>
                    <div className="modal glass-card modal-fixed-height" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>✏️ Edit Response #{editingSubmission.id}</h2>
                        </div>
                        <div className="modal-body scrollable-content">
                            {fields.map(f => (
                                <div key={f.id} className="form-group">
                                    <label>{f.label}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={editValues[f.id] || ''}
                                        onChange={(e) => setEditValues({ ...editValues, [f.id]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="modal-actions-sticky">
                            <button className="btn btn-ghost" onClick={() => setEditingSubmission(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleEditSave} disabled={savingEdit}>
                                {savingEdit ? <span className="spinner-sm"></span> : '💾 Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {auditLog && (
                <div className="modal-overlay" onClick={() => setAuditLog(null)}>
                    <div className="modal glass-card modal-fixed-height audit-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🕒 History for Response #{auditLog.submissionId}</h2>
                        </div>
                        <div className="modal-body scrollable-content">
                            <div className="audit-timeline">
                                {auditLog.entries.map((entry, idx) => (
                                    <div key={entry.id} className="audit-entry glass-card">
                                        <div className="audit-entry-header">
                                            <span className="audit-badge">Snapshot #{auditLog.entries.length - idx}</span>
                                            <span className="audit-meta">
                                                Changed by <strong>{entry.changed_by_username}</strong> on {new Date(entry.changed_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="audit-values">
                                            {fields.map(f => (
                                                <div key={f.id} className="audit-value-item">
                                                    <span className="audit-label">{f.label}:</span>
                                                    <span className="audit-value">{entry.old_values_json[f.id] || '(empty)'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-actions-sticky">
                            <button className="btn btn-primary" onClick={() => setAuditLog(null)}>Close History</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
