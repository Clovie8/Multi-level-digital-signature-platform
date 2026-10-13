import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Select from '../../components/ui/Select';
import ContextMenu from '../../components/folders/ContextMenu';
import { useAsyncLock } from '../../hooks/useAsyncLock';
import {
  RotateCcw,
  Trash2,
  Clock,
  Search,
  Folder,
  LayoutTemplate,
  FileSignature,
  Info,
  Loader2,
} from 'lucide-react';

function Checkbox({ checked, onChange }) {
  return (
    <label className="relative flex items-center justify-center cursor-pointer group p-1 -m-1" onClick={e => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <div className="h-4 w-4 sm:h-[18px] sm:w-[18px] rounded border-2 border-slate-300 bg-white group-hover:border-slate-400 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-900 peer-focus-visible:ring-offset-1 transition-all
        peer-checked:bg-slate-900 peer-checked:border-slate-900 peer-checked:group-hover:bg-slate-800 peer-checked:group-hover:border-slate-800 flex items-center justify-center">
        <svg viewBox="0 0 14 14" fill="none" className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-white transition-transform duration-200 ${checked ? 'scale-100' : 'scale-0'}`}>
          <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </label>
  );
}

function TrashTableRow({ item, isChecked, onCheck, onRestore, onPurge, isRestoring, isPurging, onContextMenu }) {
  const getIcon = () => {
    if (item.type === 'folder') return <Folder className="h-4 w-4 md:h-5 md:w-5 text-indigo-600" />;
    if (item.type === 'template') return <LayoutTemplate className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />;
    return <FileSignature className="h-4 w-4 md:h-5 md:w-5 text-slate-600" />;
  };

  const getBg = () => {
    if (item.type === 'folder') return 'bg-indigo-50';
    if (item.type === 'template') return 'bg-purple-50';
    return 'bg-slate-100';
  };

  return (
    <tr
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu({ x: e.clientX, y: e.clientY, item });
      }}
      className="hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors"
    >
      <td className="w-10 md:w-[3%] px-2 md:px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={isChecked} onChange={() => onCheck(item.id)} />
      </td>
      <td className="px-2 md:px-3 py-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`h-8 w-8 rounded-lg ${getBg()} flex items-center justify-center flex-shrink-0`}>
            {getIcon()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate pr-2">{item.name}</p>
            <p className="text-xs text-slate-400 capitalize md:hidden">{item.type} · {item.daysRemaining}d left</p>
          </div>
        </div>
      </td>
      <td className="hidden md:table-cell px-3 py-3 text-sm text-slate-600 capitalize">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          {item.type}
        </span>
      </td>
      <td className="hidden md:table-cell px-3 py-3 text-sm text-slate-500">
        {item.originalLocation || 'Root'}
      </td>
      <td className="hidden md:table-cell px-3 py-3 text-sm text-slate-500">
        {item.trashedAt ? new Date(item.trashedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      <td className="hidden md:table-cell px-3 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          item.daysRemaining <= 5 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
        }`}>
          <Clock className="h-3 w-3" />
          {item.daysRemaining} days left
        </span>
      </td>
      <td className="px-2 md:px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end md:justify-start gap-1">
          <button
            onClick={() => onRestore(item)}
            disabled={isRestoring}
            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
            title="Restore item"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => onPurge(item)}
            disabled={isPurging}
            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Delete forever"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Trash() {
  const [trashItems, setTrashItems] = useState([]);
  const [isTrashLoading, setIsTrashLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedIds, setCheckedIds] = useState(new Set());

  const [itemToRestore, setItemToRestore] = useState(null);
  const [itemToPurge, setItemToPurge] = useState(null);
  const [isEmptyTrashOpen, setIsEmptyTrashOpen] = useState(false);
  const [bulkActionModal, setBulkActionModal] = useState(null); // { type: 'restore' | 'purge' }

  const [contextMenu, setContextMenu] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchTrash = useCallback(async () => {
    setIsTrashLoading(true);
    try {
      const res = await api.get('/api/trash');
      setTrashItems(res.data.items || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load trash');
    } finally {
      setIsTrashLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const [handleConfirmRestore, isRestoring] = useAsyncLock(async () => {
    if (!itemToRestore) return;
    try {
      await api.post('/api/trash/restore', {
        itemType: itemToRestore.type,
        itemId: itemToRestore.id
      });
      toast.success(`${itemToRestore.type === 'folder' ? 'Folder' : itemToRestore.type === 'template' ? 'Template' : 'Document'} restored from Trash`);
      setTrashItems(prev => prev.filter(i => i.id !== itemToRestore.id));
      setItemToRestore(null);
    } catch (error) {
      console.error('Error restoring:', error);
      toast.error(error.response?.data?.error || 'Failed to restore item');
    }
  });

  const [handleConfirmPurge, isPurging] = useAsyncLock(async () => {
    if (!itemToPurge) return;
    try {
      await api.delete('/api/trash/purge', {
        data: {
          itemType: itemToPurge.type,
          itemId: itemToPurge.id
        }
      });
      toast.success('Permanently deleted');
      setTrashItems(prev => prev.filter(i => i.id !== itemToPurge.id));
      setItemToPurge(null);
    } catch (error) {
      console.error('Error purging item:', error);
      toast.error(error.response?.data?.error || 'Failed to delete permanently');
    }
  });

  const [handleEmptyTrash, isEmptying] = useAsyncLock(async () => {
    try {
      await api.delete('/api/trash/empty');
      toast.success('Trash emptied');
      setTrashItems([]);
      setIsEmptyTrashOpen(false);
    } catch (error) {
      console.error('Error emptying trash:', error);
      toast.error(error.response?.data?.error || 'Failed to empty Trash');
    }
  });

  const [handleBulkRestore, isBulkRestoring] = useAsyncLock(async () => {
    if (checkedIds.size === 0) return;
    const selected = trashItems.filter(item => checkedIds.has(item.id));
    try {
      await api.post('/api/trash/bulk-restore', {
        items: selected.map(s => ({ type: s.type, id: s.id }))
      });
      toast.success(`${selected.length} items restored from Trash`);
      setCheckedIds(new Set());
      setBulkActionModal(null);
      fetchTrash();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to restore selected items');
    }
  });

  const [handleBulkPurge, isBulkPurging] = useAsyncLock(async () => {
    if (checkedIds.size === 0) return;
    const selected = trashItems.filter(item => checkedIds.has(item.id));
    try {
      await api.delete('/api/trash/bulk-purge', {
        data: {
          items: selected.map(s => ({ type: s.type, id: s.id }))
        }
      });
      toast.success(`${selected.length} items permanently deleted`);
      setCheckedIds(new Set());
      setBulkActionModal(null);
      fetchTrash();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to permanently delete items');
    }
  });

  const filteredTrash = useMemo(() => {
    return trashItems.filter((item) => {
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [trashItems, searchQuery]);

  const paginatedTrash = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTrash.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTrash, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTrash.length / itemsPerPage);

  const toggleCheck = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCheckAll = () => {
    setCheckedIds((prev) =>
      prev.size === filteredTrash.length ? new Set() : new Set(filteredTrash.map((d) => d.id))
    );
  };

  const clearChecked = () => setCheckedIds(new Set());

  const handleContextMenuAction = (action, item) => {
    if (action === 'restore') {
      setItemToRestore(item);
    } else if (action === 'purge') {
      setItemToPurge(item);
    }
    setContextMenu(null);
  };

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-[1400px] mx-auto px-2 sm:px-6 py-6 sm:py-8">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Document tracking</p>
            <h1 className="text-2xl font-semibold text-slate-900">Trash</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Items in Trash are automatically deleted forever after 30 days.
            </p>
          </div>
        </div>

        {/* 30-day banner + Empty Trash button */}
        <div className="mb-4 bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-amber-900 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Info className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <span>Items in Trash are automatically deleted forever after <strong>30 days</strong>.</span>
          </div>
          <button
            onClick={() => setIsEmptyTrashOpen(true)}
            disabled={trashItems.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" /> Empty Trash
          </button>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search trash..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900"
            />
          </div>
        </div>

        {/* Bulk Action Bar */}
        {checkedIds.size > 0 && (
          <div className="flex items-center gap-4 bg-slate-900 text-white text-sm font-medium rounded-lg px-4 py-2.5 mb-4">
            <span>{checkedIds.size} selected</span>
            <button
              onClick={() => setBulkActionModal({ type: 'restore' })}
              disabled={isBulkRestoring}
              className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4" /> Restore
            </button>
            <button
              onClick={() => setBulkActionModal({ type: 'purge' })}
              disabled={isBulkPurging}
              className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" /> Delete Forever
            </button>
            <button onClick={clearChecked} className="ml-auto text-white/60 hover:text-white transition-colors">
              Clear
            </button>
          </div>
        )}

        {/* Trash Items Table */}
        <div className="bg-white rounded-md border border-slate-200 shadow-sm">
          {isTrashLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Clock className="h-6 w-6 mb-2 animate-pulse" />
              <p className="text-sm">Loading…</p>
            </div>
          ) : filteredTrash.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Trash2 className="h-10 w-10 text-slate-300 mb-3" />
              <h2 className="text-sm font-semibold text-slate-900">Trash is empty</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Items in the trash will be automatically deleted forever after 30 days.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-visible min-h-[250px]">
                <table className="w-full text-left table-fixed">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="w-10 md:w-[3%] px-2 md:px-3 py-1.5">
                        <Checkbox
                          checked={checkedIds.size > 0 && checkedIds.size === filteredTrash.length}
                          onChange={toggleCheckAll}
                        />
                      </th>
                      <th className="w-auto md:w-[30%] px-2 md:px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Item</th>
                      <th className="hidden md:table-cell w-[10%] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Type</th>
                      <th className="hidden md:table-cell w-[17%] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Original Location</th>
                      <th className="hidden md:table-cell w-[15%] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Date Deleted</th>
                      <th className="hidden md:table-cell w-[15%] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Remaining</th>
                      <th className="w-16 md:w-[10%] px-2 md:px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-right md:text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTrash.map((item) => (
                      <TrashTableRow
                        key={item.id}
                        item={item}
                        isChecked={checkedIds.has(item.id)}
                        onCheck={toggleCheck}
                        onRestore={(it) => setItemToRestore(it)}
                        onPurge={(it) => setItemToPurge(it)}
                        isRestoring={isRestoring && itemToRestore?.id === item.id}
                        isPurging={isPurging && itemToPurge?.id === item.id}
                        onContextMenu={setContextMenu}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-2 sm:px-4 py-3 border-t border-slate-200 gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="hidden sm:inline text-sm text-slate-500">Show</span>
                  <Select
                    value={itemsPerPage}
                    onChange={(val) => {
                      setItemsPerPage(Number(val));
                      setCurrentPage(1);
                    }}
                    options={[
                      { value: 10, label: '10' },
                      { value: 50, label: '50' },
                      { value: 100, label: '100' }
                    ]}
                    className="w-16 sm:w-20 text-[11px] sm:text-sm"
                  />
                  <span className="text-[10px] sm:text-sm text-slate-500">entries</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-2 sm:px-3 py-1.5 sm:py-1 text-[10px] sm:text-sm font-medium text-slate-600 bg-slate-50 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                  >
                    <span className="sm:hidden">Prev</span>
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  <span className="text-[10px] sm:text-sm font-medium text-slate-700 mx-0.5 sm:mx-2 whitespace-nowrap">
                    <span className="hidden sm:inline">Page </span>{currentPage} / {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-2 sm:px-3 py-1.5 sm:py-1 text-[10px] sm:text-sm font-medium text-slate-600 bg-slate-50 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {itemToRestore && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => !isRestoring && setItemToRestore(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Restore Item</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to restore <span className="font-semibold text-slate-700">"{itemToRestore.name || itemToRestore.fileName}"</span> from Trash? It will be moved back to its original location.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => !isRestoring && setItemToRestore(null)}
                  disabled={isRestoring}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-70"
                >
                  {isRestoring && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                  {isRestoring ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purge Confirmation Modal */}
      {itemToPurge && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => !isPurging && setItemToPurge(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Forever</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to permanently delete <span className="font-semibold text-slate-700">"{itemToPurge.name || itemToPurge.fileName}"</span>? This action cannot be undone and files will be removed immediately.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => !isPurging && setItemToPurge(null)}
                  disabled={isPurging}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmPurge}
                  disabled={isPurging}
                  className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-70"
                >
                  {isPurging && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                  {isPurging ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty Trash Confirmation Modal */}
      {isEmptyTrashOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => !isEmptying && setIsEmptyTrashOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Empty Trash</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to empty the Trash? All items will be permanently deleted forever. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => !isEmptying && setIsEmptyTrashOpen(false)}
                  disabled={isEmptying}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleEmptyTrash}
                  disabled={isEmptying}
                  className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-70"
                >
                  {isEmptying && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                  {isEmptying ? 'Emptying...' : 'Empty Trash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Confirmation Modal */}
      {bulkActionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => !(isBulkRestoring || isBulkPurging) && setBulkActionModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {bulkActionModal.type === 'restore' ? 'Restore Selected Items' : 'Delete Selected Forever'}
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                {bulkActionModal.type === 'restore'
                  ? `Are you sure you want to restore ${checkedIds.size} selected item(s) from Trash?`
                  : `Are you sure you want to permanently delete ${checkedIds.size} selected item(s)? This action cannot be undone.`}
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => !(isBulkRestoring || isBulkPurging) && setBulkActionModal(null)}
                  disabled={isBulkRestoring || isBulkPurging}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={bulkActionModal.type === 'restore' ? handleBulkRestore : handleBulkPurge}
                  disabled={isBulkRestoring || isBulkPurging}
                  className={`flex items-center justify-center px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-70 ${
                    bulkActionModal.type === 'restore' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {(isBulkRestoring || isBulkPurging) && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                  {bulkActionModal.type === 'restore'
                    ? (isBulkRestoring ? 'Restoring...' : 'Restore')
                    : (isBulkPurging ? 'Deleting...' : 'Delete Forever')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onClose={() => setContextMenu(null)}
          onAction={handleContextMenuAction}
          activeTab="trash"
        />
      )}
    </div>
  );
}
