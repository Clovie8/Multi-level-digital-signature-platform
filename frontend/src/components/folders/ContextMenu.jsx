import React, { useEffect, useRef } from 'react';
import { FolderInput, Edit2, Share2, Trash2, Eye, ArrowRight } from 'lucide-react';

export default function ContextMenu({ x, y, item, onClose, onAction }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    
    // Slight delay to prevent the initial click from closing it
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }, 10);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [onClose]);

  if (!item) return null;

  // Adjust position if it goes off screen
  const style = {
    top: y,
    left: x,
  };

  // Determine user role for this item (default to manager if not provided, e.g., for owned documents or root items)
  const role = item.access_role || 'manager';

  return (
    <div 
      ref={menuRef}
      className="fixed z-[200] w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1"
      style={style}
    >
      <div className="px-3 py-2 border-b border-slate-100 mb-1">
        <p className="text-xs font-medium text-slate-500 truncate">{item.name || item.title || item.fileName || 'Item'}</p>
      </div>

      {item.type === 'template' && (
        <>
          <button 
            onClick={() => { onAction('review', item); onClose(); }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          >
            <Eye className="h-4 w-4 text-slate-400" /> Review
          </button>
          <button 
            onClick={() => { onAction('use', item); onClose(); }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          >
            <ArrowRight className="h-4 w-4 text-slate-400" /> Use
          </button>
        </>
      )}
      
      {(role === 'manager' || role === 'editor') && (
        <button 
          onClick={() => { onAction('move', item); onClose(); }}
          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
        >
          <FolderInput className="h-4 w-4 text-slate-400" /> Move
        </button>
      )}
      
      {item.type === 'folder' && (
        <>
          {role === 'manager' && (
            <>
              <button 
                onClick={() => { onAction('rename', item); onClose(); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <Edit2 className="h-4 w-4 text-slate-400" /> Rename
              </button>
              <button 
                onClick={() => { onAction('share', item); onClose(); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <Share2 className="h-4 w-4 text-slate-400" /> Share
              </button>
            </>
          )}
        </>
      )}
      
      {role === 'manager' && (
        <>
          <div className="border-t border-slate-100 my-1"></div>
          
          <button 
            onClick={() => { onAction('delete', item); onClose(); }}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </>
      )}
    </div>
  );
}
