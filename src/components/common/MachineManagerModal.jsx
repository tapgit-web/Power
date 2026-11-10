import React, { useState, useEffect } from 'react';
import { useMachineConfig } from '../../contexts/machineConfigContext';
import { useAuth } from '../../contexts/authContext';

export const MachineManagerModal = ({ isOpen, onClose }) => {
  const { isAdmin } = useAuth();
  const {
    machinesConfig,
    isSyncedWithCloud,
    addMachine,
    updateMachineName,
    removeMachine,
    syncDefaultsToCloud,
    resetCategoryToDefault
  } = useMachineConfig();

  const [activeCategory, setActiveCategory] = useState('power_meters');
  const [machineNumber, setMachineNumber] = useState('');
  const [machineName, setMachineName] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingNumber, setEditingNumber] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Ensure active category is valid when config changes
  useEffect(() => {
    if (!machinesConfig[activeCategory]) {
      const firstKey = Object.keys(machinesConfig)[0] || 'power_meters';
      setActiveCategory(firstKey);
    }
  }, [machinesConfig, activeCategory]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (feedback.message) {
      const timer = setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  if (!isOpen || !isAdmin) return null;

  const currentCategoryData = machinesConfig[activeCategory] || { allowed: [], names: {} };
  const allowedList = currentCategoryData.allowed || [];
  const namesMap = currentCategoryData.names || {};

  const formatMachineCode = (num) => `MC_${String(num).padStart(3, '0')}`;

  // Filtered list based on search
  const filteredList = allowedList.filter((num) => {
    const code = formatMachineCode(num).toLowerCase();
    const name = (namesMap[String(num)] || '').toLowerCase();
    const query = searchFilter.toLowerCase().trim();
    return (
      String(num).includes(query) ||
      code.includes(query) ||
      name.includes(query)
    );
  });

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const num = parseInt(machineNumber.trim(), 10);
    if (isNaN(num) || num <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive machine number (e.g. 1 for MC_001).' });
      return;
    }

    if (allowedList.includes(num)) {
      setFeedback({ type: 'error', message: `Machine ${formatMachineCode(num)} already exists in this category.` });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addMachine(activeCategory, num, machineName);
      if (res.success) {
        setFeedback({ type: 'success', message: `Successfully added ${formatMachineCode(num)} (${machineName || `Machine ${num}`})!` });
        setMachineNumber('');
        setMachineName('');
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to save to cloud.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (num) => {
    setEditingNumber(num);
    setEditingNameValue(namesMap[String(num)] || '');
  };

  const handleSaveEdit = async (num) => {
    try {
      await updateMachineName(activeCategory, num, editingNameValue);
      setEditingNumber(null);
      setFeedback({ type: 'success', message: `Updated name for ${formatMachineCode(num)}.` });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleRemove = async (num) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${formatMachineCode(num)} from the ${currentCategoryData.label || 'power monitor'} dashboard?`
    );
    if (!confirmed) return;

    try {
      await removeMachine(activeCategory, num);
      setFeedback({ type: 'success', message: `Removed ${formatMachineCode(num)}.` });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleResetCategory = async () => {
    const confirmed = window.confirm(
      `Reset ${currentCategoryData.label} machines to system defaults? Any custom machines added will be removed.`
    );
    if (!confirmed) return;

    try {
      await resetCategoryToDefault(activeCategory);
      setFeedback({ type: 'success', message: `Reset ${currentCategoryData.label} to defaults.` });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleSyncToCloud = async () => {
    setIsSubmitting(true);
    try {
      const res = await syncDefaultsToCloud();
      if (res.success) {
        setFeedback({ type: 'success', message: 'All machine configurations saved to Firebase Cloud!' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to sync to cloud.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      {/* Modal Dialog Card */}
      <div 
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden text-gray-800 transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-700 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <svg className="w-6 h-6 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Machine Manager</h2>
              <p className="text-xs text-emerald-100">Add, rename, or configure machines in Firebase in real-time</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isSyncedWithCloud ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-100 border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse"></span>
                Cloud Synced
              </span>
            ) : (
              <button
                onClick={handleSyncToCloud}
                disabled={isSubmitting}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/30 text-amber-100 hover:bg-amber-500/40 border border-amber-300/40 transition-colors"
                title="Initialize Firebase cloud node with current defaults"
              >
                ☁️ Save Defaults to Cloud
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-4 pb-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {Object.keys(machinesConfig).map((catId) => {
              const cat = machinesConfig[catId];
              return (
                <button
                  key={catId}
                  onClick={() => {
                    setActiveCategory(catId);
                    setEditingNumber(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    activeCategory === catId
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-white text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200'
                  }`}
                >
                  <span>{cat?.label || catId}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeCategory === catId ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {(cat?.allowed || []).length}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleResetCategory}
            className="text-xs text-gray-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            title="Reset this category to default hardcoded machines"
          >
            Reset to Defaults
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div className={`mx-6 mt-4 p-3 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between shadow-sm animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback({ type: '', message: '' })} className="font-bold ml-2">✕</button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Add New Machine Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/50 via-green-50/20 to-white border border-emerald-100 shadow-sm">
            <h3 className="text-sm font-bold text-emerald-950 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Add New Machine to {currentCategoryData.label}
            </h3>

            <form onSubmit={handleAddSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Machine Number */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Machine Number (ID) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-gray-400 select-none">
                    MC_
                  </span>
                  <input
                    type="number"
                    placeholder="e.g. 1 or 001"
                    value={machineNumber}
                    onChange={(e) => setMachineNumber(e.target.value)}
                    required
                    min="1"
                    className="w-full pl-14 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Machine Name / Location */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Location / Machine Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ranipet, Hyderabad-2"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
                />
              </div>

              {/* Add Button */}
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/30 transition-all duration-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Machine</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Machine List Section */}
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  Configured Machines ({filteredList.length} of {allowedList.length})
                </h3>
                <p className="text-xs text-gray-500">
                  Machines displayed in the {currentCategoryData.label} dashboard
                </p>
              </div>

              {/* Search filter within modal */}
              <div className="w-full sm:w-64 relative">
                <input
                  type="text"
                  placeholder="Filter machines or names..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Machines Grid */}
            {filteredList.length === 0 ? (
              <div className="text-center py-10 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-sm font-semibold text-gray-500">No machines match your filter</p>
                <p className="text-xs text-gray-400 mt-1">Add a new machine using the form above or clear the filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredList.map((num) => {
                  const currentName = namesMap[String(num)] || 'Unnamed Machine';
                  const isEditing = editingNumber === num;

                  return (
                    <div
                      key={num}
                      className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800">
                            {formatMachineCode(num)}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-gray-400">
                            ID: {num}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => (isEditing ? handleSaveEdit(num) : handleStartEdit(num))}
                            className="p-1 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title={isEditing ? 'Save Name' : 'Edit Name'}
                          >
                            {isEditing ? (
                              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            )}
                          </button>

                          <button
                            onClick={() => handleRemove(num)}
                            className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove Machine"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Machine Name (Editable or Read-Only) */}
                      <div>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              type="text"
                              value={editingNameValue}
                              onChange={(e) => setEditingNameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(num);
                                if (e.key === 'Escape') setEditingNumber(null);
                              }}
                              autoFocus
                              className="w-full px-2 py-1 text-xs bg-gray-50 border border-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="Location name..."
                            />
                            <button
                              onClick={() => handleSaveEdit(num)}
                              className="px-2 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs font-semibold text-gray-700 truncate" title={currentName}>
                            📍 {currentName}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <span>
            💡 Changes save to <strong>Firebase Realtime Database</strong> and apply instantly to all connected screens.
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 font-semibold text-gray-700 bg-white hover:bg-gray-100 rounded-xl border border-gray-300 transition-colors cursor-pointer shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
