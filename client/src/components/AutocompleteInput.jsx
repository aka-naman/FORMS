import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

export default function AutocompleteInput({ value, onChange, onSelect, placeholder }) {
    const [query, setQuery] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Sync external value changes
    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    const searchUniversities = (q) => {
        if (q.length < 2) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        setLoading(true);
        api.get(`/autocomplete/university?q=${encodeURIComponent(q)}`)
            .then(res => {
                setSuggestions(res.data.results || []);
                setShowDropdown(true);
                setHighlightedIndex(-1);
            })
            .catch(() => setSuggestions([]))
            .finally(() => setLoading(false));
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        onChange(val);

        // Debounce 300ms
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchUniversities(val), 300);
    };

    const handleSelect = (item) => {
        setQuery(item.name);
        setSuggestions([]);
        setShowDropdown(false);
        onChange(item.name);
        if (onSelect) onSelect(item);
    };

    const handleKeyDown = (e) => {
        if (!showDropdown || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            handleSelect(suggestions[highlightedIndex]);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    return (
        <div className="autocomplete-wrapper" ref={wrapperRef}>
            <div className="autocomplete-input-container">
                <input
                    type="text"
                    className="form-input"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                    placeholder={placeholder || 'Start typing university name...'}
                    autoComplete="off"
                />
                {loading && <span className="autocomplete-spinner"></span>}
            </div>
            {showDropdown && suggestions.length > 0 && (
                <ul className="autocomplete-dropdown">
                    {suggestions.map((item, idx) => (
                        <li
                            key={idx}
                            className={`autocomplete-item ${idx === highlightedIndex ? 'highlighted' : ''}`}
                            onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                        >
                            <span className="autocomplete-name">{item.name}</span>
                            <span className="autocomplete-meta">{item.district}, {item.state}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
