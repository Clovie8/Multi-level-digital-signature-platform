import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

export default function Select({ 
  value, 
  onChange, 
  options, 
  className = '',
  buttonClassName = 'bg-white border border-slate-200 shadow-sm hover:bg-slate-50',
  placeholder = 'Select an option',
  searchable = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0 });
  const [placement, setPlacement] = useState('bottom');
  const [searchTerm, setSearchTerm] = useState('');
  const buttonRef = useRef(null);
  const searchInputRef = useRef(null);

  const updateCoords = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      const newPlacement = (spaceBelow < 240 && spaceAbove > spaceBelow) ? 'top' : 'bottom';
      setPlacement(newPlacement);

      setCoords({
        top: rect.bottom,
        bottom: window.innerHeight - rect.top,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      updateCoords();
      setSearchTerm('');
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen) {
      const handleScroll = (e) => {
        if (e.target.dataset && e.target.dataset.dropdown) return;
        updateCoords();
      };
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [isOpen, updateCoords]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target) && !event.target.closest('[data-dropdown="true"]')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const selectedOption = options.find(opt => opt.value === value);
  const filteredOptions = searchable 
    ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const dropdownStyle = {
    position: 'fixed',
    left: coords.left,
    width: coords.width,
  };

  if (placement === 'bottom') {
    dropdownStyle.top = coords.top + 4;
  } else {
    dropdownStyle.bottom = coords.bottom + 4;
  }

  const originClass = placement === 'bottom' ? 'origin-top' : 'origin-bottom';

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`w-full flex items-center justify-between text-left text-sm font-medium text-slate-700 px-3 py-2 rounded-md transition-colors focus:outline-none cursor-pointer ${buttonClassName} ${isOpen ? 'ring-1 ring-slate-900 border-slate-900 bg-slate-50' : ''}`}
      >
        <span className="block truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180 text-slate-700' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div 
          data-dropdown="true"
          className={`z-[9999] bg-white rounded-md shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 flex flex-col max-h-72 animate-in fade-in zoom-in-95 ${originClass} duration-200 focus:outline-none`}
          style={dropdownStyle}
        >
          {searchable && (
            <div className="p-2 border-b border-slate-100 shrink-0 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          )}
          <ul className="py-1 text-sm text-slate-700 overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <li
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`relative cursor-pointer select-none py-2.5 pl-3 pr-9 hover:bg-slate-50 hover:text-slate-900 transition-colors ${
                    option.value === value ? 'bg-slate-50/80 font-semibold text-slate-900' : 'font-medium'
                  } ${option.className || ''}`}
                >
                  <span className="block truncate">{option.label}</span>
                  {option.value === value && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-900">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </li>
              ))
            ) : (
              <li className="py-3 px-3 text-center text-slate-500 italic text-xs">No options found.</li>
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
