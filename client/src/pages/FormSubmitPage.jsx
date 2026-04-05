import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import AutocompleteInput from '../components/AutocompleteInput';

const CGPA_PRESETS = [
    { id: '10_scale', label: '10 Scale (9.5)', scale: 10, factor: 9.5 },
    { id: '4_scale', label: '4 Scale (3.8)', scale: 4, factor: 3.8 },
    { id: 'custom', label: 'Custom Rule', scale: 10, factor: 9.5 }
];

export default function FormSubmitPage() {
    const { formId } = useParams();
    const [fields, setFields] = useState([]);
    const [values, setValues] = useState({});
    const [checkboxValues, setCheckboxValues] = useState({});
    const [otherValues, setOtherValues] = useState({}); // Stores complex field states like CGPA/Address
    const [formName, setFormName] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [_error, setError] = useState('');
    const [fieldError, setFieldError] = useState({ fieldId: null, message: '' });
    const [locations, setLocations] = useState({});
    const [organizationalGroups, setOrganizationalGroups] = useState({});
    const [dynamicBranches, setDynamicBranches] = useState([]);
    
    const [newUniModal, setNewUniModal] = useState({ show: false, name: '', state: '', district: '', fieldId: null });
    const fieldRefs = useRef({});

    useEffect(() => {
        const load = async () => {
            try {
                const [locsRes, branchesRes, formsRes, groupsRes] = await Promise.all([
                    api.get('/autocomplete/locations'),
                    api.get('/autocomplete/branches'),
                    api.get('/forms'),
                    api.get('/autocomplete/groups')
                ]);
                
                setLocations(locsRes.data);
                setOrganizationalGroups(groupsRes.data);
                setDynamicBranches(branchesRes.data.results || []);

                const form = formsRes.data.forms.find(f => f.id === parseInt(formId));
                if (!form || !form.latest_version_id) {
                    setError('Form not found.');
                    setLoading(false);
                    return;
                }
                setFormName(form.name);

                const fieldsRes = await api.get(`/forms/${formId}/versions/${form.latest_version_id}/fields`);
                const loadedFields = fieldsRes.data.fields;
                setFields(loadedFields);

                const initialValues = {};
                const initialCheckboxes = {};
                const initialOthers = {};

                loadedFields.forEach(f => {
                    initialValues[f.id] = '';
                    if (f.type === 'checkboxes' || f.type === 'multiple_choice') initialCheckboxes[f.id] = [];
                    if (f.type === 'cgpa_converter') {
                        initialOthers[f.id] = { cgpa: '', presetId: '10_scale', scale: 10, factor: 9.5 };
                    }
                });
                setValues(initialValues);
                setCheckboxValues(initialCheckboxes);
                setOtherValues(initialOthers);
            } catch {
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

    const handleCheckboxChange = (fieldId, option, checked) => {
        setCheckboxValues(prev => {
            const prevArr = prev[fieldId] || [];
            const next = checked ? [...prevArr, option] : prevArr.filter(v => v !== option);
            return { ...prev, [fieldId]: next };
        });
    };

    const handleUniversitySelect = (item, fieldId) => {
        if (item.isNew) {
            setNewUniModal({ show: true, name: item.name, state: '', district: '', fieldId });
        } else {
            handleChange(fieldId, `${item.name} (${item.district}, ${item.state})`);
        }
    };

    const submitNewUniversity = async () => {
        if (!newUniModal.name || !newUniModal.state || !newUniModal.district) return alert('Fill all details');
        try {
            const res = await api.post('/autocomplete/university/add', newUniModal);
            const uni = res.data.university;
            handleChange(newUniModal.fieldId, `${uni.name} (${uni.district}, ${uni.state})`);
            setNewUniModal({ show: false, name: '', state: '', district: '', fieldId: null });
        } catch {
            alert('Failed to add');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Basic required validation
        for (const field of fields) {
            let isFilled = false;
            if (field.type === 'checkboxes' || field.type === 'multiple_choice') {
                isFilled = (checkboxValues[field.id] || []).length > 0;
            } else {
                isFilled = !!values[field.id];
            }

            if (field.validation_rules?.required && !isFilled) {
                setFieldError({ fieldId: field.id, message: `${field.label} is required` });
                fieldRefs.current[field.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            
            // Strict Pincode validation for residential_address
            if (field.type === 'residential_address') {
                const parts = (values[field.id] || '').split(' ||| ');
                const pin = parts[3] || '';
                if (pin && pin.length !== 6) {
                    setFieldError({ fieldId: field.id, message: 'Pincode must be exactly 6 digits' });
                    fieldRefs.current[field.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
            }
        }

        const finalValues = { ...values };
        fields.forEach(f => {
            if (f.type === 'checkboxes' || f.type === 'multiple_choice') {
                finalValues[f.id] = (checkboxValues[f.id] || []).join(', ');
            }
        });

        setSubmitting(true);
        try {
            await api.post(`/forms/${formId}/submit`, { values: finalValues });
            setSubmitted(true);
        } catch {
            setError('Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    const renderField = (field) => {
        const val = values[field.id] || '';

        switch (field.type) {
            case 'cgpa_converter': {
                const data = otherValues[field.id] || { cgpa: '', presetId: '10_scale', scale: 10, factor: 9.5 };
                
                const updateCgpa = (updates) => {
                    const next = { ...data, ...updates };
                    
                    // Handle preset changes
                    if (updates.presetId && updates.presetId !== 'custom') {
                        const preset = CGPA_PRESETS.find(p => p.id === updates.presetId);
                        next.scale = preset.scale;
                        next.factor = preset.factor;
                    }

                    setOtherValues(p => ({ ...p, [field.id]: next }));
                    
                    const obtained = parseFloat(next.cgpa);
                    const scale = parseFloat(next.scale);
                    const factor = parseFloat(next.factor);

                    if (!isNaN(obtained) && !isNaN(scale) && scale !== 0 && !isNaN(factor)) {
                        // Formula: (Obtained / Scale) * (Factor * Scale)
                        const result = (obtained / scale) * (factor * scale);
                        // const result = (obtained * factor);
                        handleChange(field.id, `${result.toFixed(2)}% (CGPA: ${obtained}, Scale: ${scale}, Factor: ${factor})`);
                    } else {
                        handleChange(field.id, '');
                    }
                };

                return (
                    <div className="cgpa-composite">
                        <div className="field-row">
                            <div className="flex-1">
                                <label className="sub-label">Obtained CGPA</label>
                                <input type="number" className="form-input" placeholder="e.g. 8.5" value={data.cgpa} onChange={(e) => updateCgpa({ cgpa: e.target.value })} step="0.01" />
                            </div>
                            <div className="flex-1">
                                <label className="sub-label">Standard Rule</label>
                                <select className="form-input" value={data.presetId} onChange={(e) => updateCgpa({ presetId: e.target.value })}>
                                    {CGPA_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="field-row">
                            <div className="flex-1">
                                <label className="sub-label">CGPA Grading Scale</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    value={data.scale} 
                                    onChange={(e) => updateCgpa({ scale: e.target.value, presetId: 'custom' })} 
                                />
                            </div>
                            <div className="flex-1">
                                <label className="sub-label">Conversion Factor</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    value={data.factor} 
                                    onChange={(e) => updateCgpa({ factor: e.target.value, presetId: 'custom' })} 
                                />
                            </div>
                        </div>
                        {val && (
                            <div className="cgpa-result">
                                Calculated Percentage: <strong>{val.split('%')[0]}%</strong>
                            </div>
                        )}
                    </div>
                );
            }

            case 'residential_address': {
                const parts = val.split(' ||| ');
                const house = parts[0] || '', dist = parts[1] || '', state = parts[2] || '', pin = parts[3] || '';
                
                // Determine if current state/dist are manual inputs (not in known list)
                const isStateManual = state && state !== '__other__' && !Object.keys(locations).includes(state);
                const isDistManual = dist && dist !== '__other__' && state && !(locations[state] || []).includes(dist);

                const upd = (h, d, s, p) => handleChange(field.id, `${h} ||| ${d} ||| ${s} ||| ${p}`);

                return (
                    <div className="address-composite">
                        <textarea className="form-input" placeholder="House/Street" value={house} onChange={(e) => upd(e.target.value, dist, state, pin)} />
                        <div className="field-row">
                            <input type="text" className="form-input flex-1" placeholder="Pincode (6 digits)" value={pin} maxLength={6} onChange={(e) => upd(house, dist, state, e.target.value.replace(/\D/g, ''))} />
                            
                            <div className="flex-1 flex-column gap-sm">
                                <select 
                                    className="form-input" 
                                    value={isStateManual ? '__other__' : state} 
                                    onChange={(e) => upd(house, (e.target.value === '__other__' ? '' : dist), e.target.value, pin)}
                                >
                                    <option value="">State</option>
                                    {Object.keys(locations).map(s => <option key={s} value={s}>{s}</option>)}
                                    <option value="__other__">Other</option>
                                </select>
                                {(state === '__other__' || isStateManual) && (
                                    <input 
                                        type="text" 
                                        className="form-input other-input" 
                                        placeholder="Type State" 
                                        value={isStateManual ? state : ''}
                                        onChange={(e) => upd(house, dist, e.target.value, pin)}
                                        autoFocus={state === '__other__'}
                                    />
                                )}
                            </div>

                            <div className="flex-1 flex-column gap-sm">
                                <select 
                                    className="form-input" 
                                    value={isDistManual ? '__other__' : dist} 
                                    disabled={!state || state === '__other__'}
                                    onChange={(e) => upd(house, e.target.value, state, pin)}
                                >
                                    <option value="">District</option>
                                    {(locations[state] || []).map(d => <option key={d} value={d}>{d}</option>)}
                                    <option value="__other__">Other</option>
                                </select>
                                {(dist === '__other__' || isDistManual) && (
                                    <input 
                                        type="text" 
                                        className="form-input other-input" 
                                        placeholder="Type District" 
                                        value={isDistManual ? dist : ''}
                                        onChange={(e) => upd(house, e.target.value, state, pin)}
                                        autoFocus={dist === '__other__'}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                );
            }

            case 'zone_group': {
                const parts = val.split(' ||| ');
                const zone = parts[0] || '', group = parts[1] || '';
                
                const isZoneManual = zone && zone !== '__other__' && !Object.keys(organizationalGroups).includes(zone);
                const isGroupManual = group && group !== '__other__' && zone && !(organizationalGroups[zone] || []).includes(group);

                const upd = (z, g) => handleChange(field.id, `${z} ||| ${g}`);

                const zoneList = ['Zone I', 'Zone II', 'Zone III', 'Zone IV', 'Zone V', 'Zone VI', 'Zone VII', 'Zone VIII'];
                const allZones = Array.from(new Set([...zoneList, ...Object.keys(organizationalGroups)]));

                return (
                    <div className="address-composite">
                        <div className="field-row">
                            <div className="flex-1 flex-column gap-sm">
                                <select 
                                    className="form-input" 
                                    value={isZoneManual ? '__other__' : zone}
                                    onChange={(e) => upd(e.target.value, (e.target.value === '__other__' ? '' : group))}
                                >
                                    <option value="">Select Zone</option>
                                    {allZones.sort().map(z => <option key={z} value={z}>{z}</option>)}
                                    <option value="__other__">Other Zone</option>
                                </select>
                                {(zone === '__other__' || isZoneManual) && (
                                    <input 
                                        type="text" 
                                        className="form-input other-input" 
                                        placeholder="Type Zone Name" 
                                        value={isZoneManual ? zone : ''}
                                        onChange={(e) => upd(e.target.value, group)}
                                        autoFocus={zone === '__other__'}
                                    />
                                )}
                            </div>

                            <div className="flex-1 flex-column gap-sm">
                                <select 
                                    className="form-input" 
                                    value={isGroupManual ? '__other__' : group} 
                                    disabled={!zone || zone === '__other__'}
                                    onChange={(e) => upd(zone, e.target.value)}
                                >
                                    <option value="">Select Group</option>
                                    {(organizationalGroups[zone] || []).map(g => <option key={g} value={g}>{g}</option>)}
                                    <option value="__other__">Other Group</option>
                                </select>
                                {(group === '__other__' || isGroupManual) && (
                                    <input 
                                        type="text" 
                                        className="form-input other-input" 
                                        placeholder="Type Group Name" 
                                        value={isGroupManual ? group : ''}
                                        onChange={(e) => upd(zone, e.target.value)}
                                        autoFocus={group === '__other__'}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                );
            }

            case 'university_autocomplete':
                return <AutocompleteInput value={val.split(' (')[0]} onSelect={(item) => handleUniversitySelect(item, field.id)} onChange={() => {}} placeholder="University Name..." />;

            case 'phone':
                return <input type="tel" className="form-input" value={val} onChange={(e) => { if (/^\d{0,10}$/.test(e.target.value)) handleChange(field.id, e.target.value); }} placeholder="10-digit number" />;

            case 'dropdown':
            case 'branch':
            case 'duration': {
                const options = Array.from(new Set([...(field.options_json || []), ...(field.type === 'branch' ? dynamicBranches : [])]));
                const isManual = val && !options.includes(val) && val !== '__other__';
                
                return (
                    <div className="select-with-other">
                        <select 
                            className="form-input" 
                            value={isManual ? '__other__' : val} 
                            onChange={(e) => handleChange(field.id, e.target.value)}
                        >
                            <option value="">Select Option</option>
                            {options.map(o => <option key={o} value={o}>{o}</option>)}
                            <option value="__other__">Other (Manual Entry)</option>
                        </select>
                        {(val === '__other__' || isManual) && (
                            <input 
                                type="text" 
                                className="form-input other-input" 
                                placeholder="Type custom value..." 
                                value={isManual ? val : ''}
                                onChange={(e) => handleChange(field.id, e.target.value)}
                                autoFocus={val === '__other__'}
                            />
                        )}
                    </div>
                );
            }

            case 'checkboxes':
            case 'multiple_choice':
                return (
                    <div className="choice-list">
                        {(field.options_json || []).map((opt, i) => (
                            <label key={i} className="choice-option">
                                <input type="checkbox" checked={(checkboxValues[field.id] || []).includes(opt)} onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)} />
                                <span className="choice-custom-indicator"></span>
                                <span>{opt}</span>
                            </label>
                        ))}
                    </div>
                );

            default:
                return <input type={field.type === 'email' ? 'email' : (field.type === 'integer' ? 'number' : 'text')} className="form-input" value={val} onChange={(e) => handleChange(field.id, e.target.value)} />;
        }
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    if (submitted) return (
        <div className="submit-page">
            <div className="success-container glass-card">
                <h2>Response Submitted!</h2>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>Submit Another</button>
            </div>
        </div>
    );

    return (
        <div className="submit-page">
            <div className="submit-container">
                <header className="submit-header glass-card">
                    <h1>{formName}</h1>
                </header>
                <form onSubmit={handleSubmit}>
                    {fields.map(field => (
                        <div key={field.id} className="submit-field glass-card" ref={el => fieldRefs.current[field.id] = el}>
                            <label className="submit-field-label">
                                {field.label} {field.validation_rules?.required && <span className="required-star">*</span>}
                            </label>
                            {fieldError.fieldId === field.id && <div className="field-inline-error">{fieldError.message}</div>}
                            {renderField(field)}
                        </div>
                    ))}
                    <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>Submit Response</button>
                </form>
            </div>

            {newUniModal.show && (
                <div className="modal-overlay">
                    <div className="modal glass-card">
                        <h2>Add University</h2>
                        <div className="form-group">
                            <label>State</label>
                            <select className="form-input" onChange={e => setNewUniModal({...newUniModal, state: e.target.value})}>
                                <option value="">Select State</option>
                                {Object.keys(locations).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>District</label>
                            <select className="form-input" onChange={e => setNewUniModal({...newUniModal, district: e.target.value})}>
                                <option value="">Select District</option>
                                {(locations[newUniModal.state] || []).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setNewUniModal({show:false})}>Cancel</button>
                            <button className="btn btn-accent" onClick={submitNewUniversity}>Add</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
