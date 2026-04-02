import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function SubmissionsPage() {
    const { formId } = useParams();
    const navigate = useNavigate();
    const [fields, setFields] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [formName, setFormName] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingSubmission, setEditingSubmission] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [savingEdit, setSavingEdit] = useState(false);

    const load = async () => {
        try {
            const [formsRes, subsRes] = await Promise.all([
                api.get('/forms'),
                api.get(`/forms/${formId}/submissions`),
            ]);
            const form = formsRes.data.forms.find(f => f.id === parseInt(formId));
            if (form) setFormName(form.name);
            setFields(subsRes.data.fields);
            setSubmissions(subsRes.data.submissions);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [formId]);

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
            await load();
        } catch (err) {
            alert('Failed to update submission');
        } finally {
            setSavingEdit(false);
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
            link.download = `${formName.replace(/[^a-zA-Z0-9]/g, '_')}_submissions.xlsx`;
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

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading submissions...</p>
            </div>
        );
    }

    return (
        <div className="submissions-page">
            <header className="submissions-header">
                <div className="header-left">
                    <button className="btn btn-ghost" onClick={() => navigate('/')}>
                        ← Back
                    </button>
                    <h1>📊 {formName} — Submissions</h1>
                </div>
                <div className="header-right">
                    <span className="badge badge-count">{submissions.length} total</span>
                    <button className="btn btn-primary" onClick={handleExport}>
                        📥 Export Excel
                    </button>
                </div>
            </header>

            {submissions.length === 0 ? (
                <div className="empty-state glass-card">
                    <div className="empty-icon">📭</div>
                    <h2>No Submissions Yet</h2>
                    <p>Share the form link to start collecting responses.</p>
                </div>
            ) : (
                <div className="table-container glass-card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Submitted At</th>
                                {fields.map(f => (
                                    <th key={f.id}>{f.label}</th>
                                ))}
                                <th>Last Edited</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.map((sub, index) => (
                                <tr key={sub.id}>
                                    <td>{index + 1}</td>
                                    <td>{new Date(sub.submitted_at).toLocaleString()}</td>
                                    {fields.map(f => (
                                        <td key={f.id}>{getFieldValue(sub, f.id)}</td>
                                    ))}
                                    <td>
                                        {sub.updated_at ? (
                                            <div className="edit-tracking">
                                                <span className="edit-time">{new Date(sub.updated_at).toLocaleString()}</span>
                                                <span className="edit-user">by {sub.updated_by_username}</span>
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td>
                                        <button className="btn btn-sm btn-ghost" onClick={() => handleEditClick(sub)}>✏️ Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {editingSubmission && (
                <div className="modal-overlay" onClick={() => setEditingSubmission(null)}>
                    <div className="modal glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                        <h2>Edit Submission</h2>
                        <div className="edit-fields-list" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1rem' }}>
                            {fields.map(f => (
                                <div key={f.id} className="form-group">
                                    <label>{f.label}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={editValues[f.id] || ''}
                                        onChange={(e) => setEditValues({ ...editValues, [f.id]: e.target.value })}
                                        placeholder={`Value for ${f.label}`}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setEditingSubmission(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleEditSave} disabled={savingEdit}>
                                {savingEdit ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
