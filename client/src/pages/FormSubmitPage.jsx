import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import AutocompleteInput from '../components/AutocompleteInput';

export default function FormSubmitPage() {
    const { formId } = useParams();
    const navigate = useNavigate();
    const [fields, setFields] = useState([]);
    const [values, setValues] = useState({});
    const [checkboxValues, setCheckboxValues] = useState({}); // for checkboxes (array of selected)
    const [otherValues, setOtherValues] = useState({}); // for "Other" text inputs
    const [formName, setFormName] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [fieldError, setFieldError] = useState({ fieldId: null, message: '' });
    const [versionId, setVersionId] = useState(null);
    const fieldRefs = useRef({});

    useEffect(() => {
        const load = async () => {
            try {
                const formsRes = await api.get('/forms');
                const form = formsRes.data.forms.find(f => f.id === parseInt(formId));
                if (!form || !form.latest_version_id) {
                    setError('Form not found or has no fields.');
                    setLoading(false);
                    return;
                }
                setFormName(form.name);
                setVersionId(form.latest_version_id);

                const fieldsRes = await api.get(`/forms/${formId}/versions/${form.latest_version_id}/fields`);
                setFields(fieldsRes.data.fields);

                const initialValues = {};
                const initialCheckboxes = {};
                fieldsRes.data.fields.forEach(f => {
                    initialValues[f.id] = '';
                    if (f.type === 'checkboxes') initialCheckboxes[f.id] = [];
                });
                setValues(initialValues);
                setCheckboxValues(initialCheckboxes);
            } catch (err) {
                setError('Failed to load form');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [formId]);

    const handleChange = (fieldId, value) => {
        setValues(prev => ({ ...prev, [fieldId]: value }));
        if (fieldError.fieldId === fieldId) setFieldError({ fieldId: null, message: '' });
    };

    const handleOtherChange = (fieldId, value) => {
        setOtherValues(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleCheckboxChange = (fieldId, option, checked) => {
        setCheckboxValues(prev => {
            const prevArr = prev[fieldId] || [];
            const next = checked ? [...prevArr, option] : prevArr.filter(v => v !== option);
            return { ...prev, [fieldId]: next };
        });
        if (fieldError.fieldId === fieldId) setFieldError({ fieldId: null, message: '' });
    };

    const handleUniversitySelect = (item, currentFieldId) => {
        const newValues = { ...values, [currentFieldId]: item.name };
        for (const field of fields) {
            const label = field.label.toLowerCase();
            if (label.includes('state') && field.id !== currentFieldId) {
                newValues[field.id] = item.state;
            }
            if (label.includes('district') && field.id !== currentFieldId) {
                newValues[field.id] = item.district;
            }
        }
        setValues(newValues);
    };

    const scrollToField = (fieldId) => {
        const el = fieldRefs.current[fieldId];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('field-error-highlight');
            setTimeout(() => el.classList.remove('field-error-highlight'), 2000);
        }
    };

    const validateForm = () => {
        for (const field of fields) {
            let val = values[field.id];
            const rules = field.validation_rules || {};

            // For branch/duration with "Other" selected, use the other text value
            if (['branch', 'duration'].includes(field.type) && val === '__other__') {
                val = otherValues[field.id] || '';
            }

            // Checkboxes required check
            if (field.type === 'checkboxes') {
                if (rules.required && (checkboxValues[field.id] || []).length === 0) {
                    return { error: `"${field.label}" requires at least one selection`, fieldId: field.id };
                }
                continue;
            }

            // Required check
            if (rules.required && (!val || (typeof val === 'string' && !val.trim()))) {
                return { error: `"${field.label}" is required`, fieldId: field.id };
            }

            if (field.type === 'integer' && val !== '' && val !== undefined) {
                const num = Number(val);
                if (!Number.isInteger(num)) {
                    return { error: `"${field.label}" must be a valid integer`, fieldId: field.id };
                }
                if (rules.min !== undefined && num < rules.min) {
                    return { error: `"${field.label}" must be at least ${rules.min}`, fieldId: field.id };
                }
                if (rules.max !== undefined && num > rules.max) {
                    return { error: `"${field.label}" must be at most ${rules.max}`, fieldId: field.id };
                }
            }

            if (field.type === 'email' && val && val.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(val.trim())) {
                    return { error: `"${field.label}" must be a valid email address`, fieldId: field.id };
                }
            }

            if (field.type === 'phone' && val && val.trim()) {
                const digits = val.replace(/\D/g, '');
                if (digits.length !== 10) {
                    return { error: `"${field.label}" must be exactly 10 digits`, fieldId: field.id };
                }
            }
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const validation = validateForm();
        if (validation) {
            setFieldError({ fieldId: validation.fieldId, message: validation.error });
            scrollToField(validation.fieldId);
            return;
        }
        setFieldError({ fieldId: null, message: '' });

        // Build final values — replace __other__ with actual text; flatten checkboxes to comma string
        const finalValues = { ...values };
        for (const field of fields) {
            if (['branch', 'duration'].includes(field.type) && finalValues[field.id] === '__other__') {
                finalValues[field.id] = otherValues[field.id] || '';
            }
            if (field.type === 'checkboxes') {
                finalValues[field.id] = (checkboxValues[field.id] || []).join(', ');
            }
        }

        setSubmitting(true);
        try {
            await api.post(`/forms/${formId}/submit`, { values: finalValues });
            setSubmitted(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading form...</p>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="submit-page">
                <div className="success-container glass-card">
                    <div className="success-icon">✅</div>
                    <h2>Response Submitted!</h2>
                    <p>Your response has been recorded successfully.</p>
                    <div className="success-actions">
                        <button className="btn btn-primary" onClick={() => {
                            setSubmitted(false);
                            const iv = {};
                            const ic = {};
                            fields.forEach(f => {
                                iv[f.id] = '';
                                if (f.type === 'checkboxes') ic[f.id] = [];
                            });
                            setValues(iv);
                            setCheckboxValues(ic);
                            setOtherValues({});
                        }}>
                            Submit Another
                        </button>
                        <button className="btn btn-ghost" onClick={() => navigate('/')}>
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const renderField = (field) => {
        const val = values[field.id] || '';

        switch (field.type) {
            case 'text':
                return <input type="text" className="form-input" value={val} onChange={(e) => handleChange(field.id, e.target.value)} placeholder={`Enter ${field.label}`} />;

            case 'textarea':
                return <textarea className="form-input" value={val} onChange={(e) => handleChange(field.id, e.target.value)} placeholder={`Enter ${field.label}`} rows={4} />;

            case 'email':
                return <input type="email" className="form-input" value={val} onChange={(e) => handleChange(field.id, e.target.value)} placeholder="example@email.com" />;

            case 'phone':
                return (
                    <input type="tel" className="form-input" value={val}
                        onChange={(e) => { if (/^\d{0,10}$/.test(e.target.value)) handleChange(field.id, e.target.value); }}
                        placeholder="10-digit phone number" maxLength={10} />
                );

            case 'multiple_choice':
                return (
                    <div className="choice-list">
                        {(field.options_json || []).map((opt, i) => (
                            <label key={i} className="choice-option">
                                <input
                                    type="radio"
                                    name={`field_${field.id}`}
                                    value={opt}
                                    checked={val === opt}
                                    onChange={() => handleChange(field.id, opt)}
                                    className="choice-input"
                                />
                                <span className="choice-custom-indicator"></span>
                                <span>{opt}</span>
                            </label>
                        ))}
                    </div>
                );

            case 'checkboxes': {
                const selected = checkboxValues[field.id] || [];
                return (
                    <div className="choice-list">
                        {(field.options_json || []).map((opt, i) => (
                            <label key={i} className="choice-option">
                                <input
                                    type="checkbox"
                                    value={opt}
                                    checked={selected.includes(opt)}
                                    onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)}
                                    className="choice-input"
                                />
                                <span className="choice-custom-indicator choice-check-indicator"></span>
                                <span>{opt}</span>
                            </label>
                        ))}
                    </div>
                );
            }

            case 'dropdown':
                return (
                    <select className="form-input" value={val} onChange={(e) => handleChange(field.id, e.target.value)}>
                        <option value="">Select an option</option>
                        {(field.options_json || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                    </select>
                );

            case 'linear_scale': {
                const min = field.validation_rules?.scale_min ?? 1;
                const max = field.validation_rules?.scale_max ?? 5;
                const minLabel = field.validation_rules?.scale_min_label || '';
                const maxLabel = field.validation_rules?.scale_max_label || '';
                const points = [];
                for (let n = min; n <= max; n++) points.push(n);
                return (
                    <div className="linear-scale-wrapper">
                        {(minLabel || maxLabel) && (
                            <div className="linear-scale-labels">
                                <span>{minLabel}</span>
                                <span>{maxLabel}</span>
                            </div>
                        )}
                        <div className="linear-scale-points">
                            {points.map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    className={`scale-point${val === String(n) ? ' scale-point-selected' : ''}`}
                                    onClick={() => handleChange(field.id, String(n))}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            }

            case 'rating': {
                const maxStars = field.validation_rules?.max_stars ?? 5;
                const ratingVal = Number(val) || 0;
                return (
                    <div className="rating-wrapper">
                        {Array.from({ length: maxStars }, (_, i) => i + 1).map(star => (
                            <button
                                key={star}
                                type="button"
                                className={`star-btn${star <= ratingVal ? ' star-filled' : ''}`}
                                onClick={() => handleChange(field.id, star === ratingVal ? '' : String(star))}
                                title={`${star} star${star !== 1 ? 's' : ''}`}
                            >
                                ★
                            </button>
                        ))}
                        {ratingVal > 0 && <span className="rating-value">{ratingVal} / {maxStars}</span>}
                    </div>
                );
            }

            case 'date':
                return <input type="date" className="form-input" value={val} onChange={(e) => handleChange(field.id, e.target.value)} />;

            case 'time':
                return <input type="time" className="form-input" value={val} onChange={(e) => handleChange(field.id, e.target.value)} />;

            case 'branch':
            case 'duration':
                return (
                    <div className="select-with-other">
                        <select className="form-input" value={val} onChange={(e) => handleChange(field.id, e.target.value)}>
                            <option value="">Select an option</option>
                            {(field.options_json || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                            <option value="__other__">Other</option>
                        </select>
                        {val === '__other__' && (
                            <input
                                type="text"
                                className="form-input other-input"
                                value={otherValues[field.id] || ''}
                                onChange={(e) => handleOtherChange(field.id, e.target.value)}
                                placeholder="Please specify..."
                                autoFocus
                            />
                        )}
                    </div>
                );

            case 'university_autocomplete':
                return (
                    <AutocompleteInput
                        value={val}
                        onChange={(v) => handleChange(field.id, v)}
                        onSelect={(item) => handleUniversitySelect(item, field.id)}
                        placeholder="Start typing university name..."
                    />
                );

            case 'integer':
                return (
                    <input type="number" className="form-input" value={val}
                        onChange={(e) => { if (e.target.value === '' || /^-?\d*$/.test(e.target.value)) handleChange(field.id, e.target.value); }}
                        placeholder={`Enter ${field.label}`} step="1" />
                );

            default:
                return <input type="text" className="form-input" value={val} onChange={(e) => handleChange(field.id, e.target.value)} />;
        }
    };

    return (
        <div className="submit-page">
            <div className="submit-container">
                <header className="submit-header glass-card">
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
                        ← Back
                    </button>
                    <h1>{formName}</h1>
                    <p className="submit-subtitle">Fill out the form below</p>
                </header>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    {fields.map((field) => (
                        <div key={field.id} className={`submit-field glass-card ${fieldError.fieldId === field.id ? 'field-error-highlight' : ''}`} ref={el => fieldRefs.current[field.id] = el}>
                            {fieldError.fieldId === field.id && (
                                <div className="field-inline-error">{fieldError.message}</div>
                            )}
                            <label className="submit-field-label">
                                {field.label}
                                {field.validation_rules?.required && <span className="required-star"> *</span>}
                            </label>
                            {renderField(field)}
                        </div>
                    ))}

                    {fields.length > 0 && (
                        <button type="submit" className="btn btn-primary btn-full btn-submit" disabled={submitting}>
                            {submitting ? <span className="spinner-sm"></span> : 'Submit Response'}
                        </button>
                    )}

                    {fields.length === 0 && (
                        <div className="empty-state glass-card">
                            <div className="empty-icon">📝</div>
                            <h2>No Fields</h2>
                            <p>This form has no fields yet. Ask an admin to build the form first.</p>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
