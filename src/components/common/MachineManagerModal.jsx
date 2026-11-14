import React, { useState, useEffect } from 'react';
import { useMachineConfig } from '../../contexts/machineConfigContext';
import { useAuth } from '../../contexts/authContext';
import { ALL_TELEMETRY_ADDRESSES, DEFAULT_ALL_ADDRESS_KEYS } from '../../constants/telemetryAddresses';

export const MachineManagerModal = ({ isOpen, onClose }) => {
  const { userLoggedIn, isAdmin } = useAuth();
  const {
    machinesConfig,
    isSyncedWithCloud,
    addMachine,
    updateMachineName,
    updateMachineAddresses,
    removeMachine,
    syncDefaultsToCloud,
    resetCategoryToDefault,
    allTelemetryAddresses = ALL_TELEMETRY_ADDRESSES,
    addCustomRegister,
    removeCustomRegister
  } = useMachineConfig();

  const [activeCategory, setActiveCategory] = useState('power_meters');
  const [machineNumber, setMachineNumber] = useState('');
  const [machineName, setMachineName] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingNumber, setEditingNumber] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Address selection & custom name editing state for a specific machine
  const [configuringNumber, setConfiguringNumber] = useState(null);
  const [selectedAddressKeys, setSelectedAddressKeys] = useState([]);
  const [customLabelMap, setCustomLabelMap] = useState({});

  // Add Register Setup state (for defining new register read keys and display names)
  const [showAddRegisterForm, setShowAddRegisterForm] = useState(false);
  const [newRegKey, setNewRegKey] = useState('');
  const [newRegName, setNewRegName] = useState('');
  const [newRegUnit, setNewRegUnit] = useState('');
  const [newRegGroup, setNewRegGroup] = useState('Power Metrics');
  const [isSavingRegister, setIsSavingRegister] = useState(false);

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

  if (!isOpen || !userLoggedIn) return null;

  const currentCategoryData = machinesConfig[activeCategory] || { allowed: [], names: {}, addresses: {}, customLabels: {} };
  const allowedList = currentCategoryData.allowed || [];
  const namesMap = currentCategoryData.names || {};
  const addressesMap = currentCategoryData.addresses || {};
  const customLabelsMap = currentCategoryData.customLabels || {};

  const formatMachineCode = (num) => `MC_${String(num).padStart(3, '0')}`;

  const handleOpenAddressConfig = (num) => {
    setConfiguringNumber(num);
    const existing = addressesMap[String(num)];
    const fallbackAll = allTelemetryAddresses.map((a) => a.key);
    setSelectedAddressKeys(
      Array.isArray(existing) && existing.length > 0 ? existing : fallbackAll
    );
    const existingLabels = customLabelsMap[String(num)] || {};
    setCustomLabelMap({ ...existingLabels });
    setShowAddRegisterForm(false);
  };

  const handleToggleAddress = (key) => {
    setSelectedAddressKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleCustomLabelChange = (key, value) => {
    setCustomLabelMap((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleResetSingleLabel = (key) => {
    setCustomLabelMap((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleResetAllLabels = () => {
    setCustomLabelMap({});
  };

  const handleSelectAllAddresses = () => {
    setSelectedAddressKeys(allTelemetryAddresses.map((a) => a.key));
  };

  const handleClearAllAddresses = () => {
    setSelectedAddressKeys([]);
  };

  const handleSelectPreset = (keys) => {
    setSelectedAddressKeys(keys);
  };

  const handleAddNewRegister = async (e) => {
    e?.preventDefault();
    const cleanKey = newRegKey.trim();
    if (!cleanKey) {
      setFeedback({ type: 'error', message: 'Please enter a register key to read from Firebase.' });
      return;
    }
    setIsSavingRegister(true);
    try {
      await addCustomRegister({
        key: cleanKey,
        name: newRegName.trim() || cleanKey,
        unit: newRegUnit.trim(),
        group: newRegGroup.trim() || 'Power Metrics'
      });
      // Automatically enable this register for the current machine
      setSelectedAddressKeys((prev) => (prev.includes(cleanKey) ? prev : [...prev, cleanKey]));
      setFeedback({
        type: 'success',
        message: `Register "${cleanKey}" added successfully! It is now readable from Firebase.`
      });
      setNewRegKey('');
      setNewRegName('');
      setNewRegUnit('');
      setShowAddRegisterForm(false);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to add register.' });
    } finally {
      setIsSavingRegister(false);
    }
  };

  const handleDeleteCustomRegister = async (keyToDelete, e) => {
    e?.stopPropagation();
    if (window.confirm(`Delete custom register "${keyToDelete}"? This will remove it for all machines.`)) {
      try {
        await removeCustomRegister(keyToDelete);
        setSelectedAddressKeys((prev) => prev.filter((k) => k !== keyToDelete));
        setFeedback({ type: 'success', message: `Register "${keyToDelete}" removed.` });
      } catch (err) {
        setFeedback({ type: 'error', message: err.message || 'Failed to remove register.' });
      }
    }
  };

  const handleSaveAddressConfig = async () => {
    if (!configuringNumber) return;
    setIsSubmitting(true);
    try {
      // Clean custom labels: only store non-empty strings
      const cleanLabels = {};
      Object.entries(customLabelMap).forEach(([k, v]) => {
        if (typeof v === 'string' && v.trim()) {
          cleanLabels[k] = v.trim();
        }
      });

      const res = await updateMachineAddresses(
        activeCategory,
        configuringNumber,
        selectedAddressKeys,
        cleanLabels
      );
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Saved visible addresses & custom names for ${formatMachineCode(configuringNumber)}.`
        });
        setConfiguringNumber(null);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update addresses.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white uppercase tracking-wider">
              {isAdmin ? "Admin" : "User"}
            </span>
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

                      {/* Visible Telemetry Addresses Configuration Button */}
                      <div className="mt-1 pt-2 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                          Visible Addresses:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenAddressConfig(num)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            (addressesMap[String(num)] || DEFAULT_ALL_ADDRESS_KEYS).length === allTelemetryAddresses.length
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                          }`}
                          title="Configure which Modbus register addresses to display for this machine"
                        >
                          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                          </svg>
                          <span>{(addressesMap[String(num)] || DEFAULT_ALL_ADDRESS_KEYS).length} / {allTelemetryAddresses.length} Addresses</span>
                        </button>
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

        {/* Address Configuration Popup Dialog */}
        {configuringNumber && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
            <div 
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-700 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <span>Configure Visible Addresses</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/20 text-xs font-black">
                      {formatMachineCode(configuringNumber)}
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    {namesMap[String(configuringNumber)] || `Machine ${configuringNumber}`} — Select which telemetry addresses to display on the dashboard
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfiguringNumber(null)}
                  className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              {/* Quick Actions & Presets */}
              <div className="px-5 py-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="font-bold text-gray-500 mr-1 text-[11px] uppercase">Quick Select:</span>
                  <button
                    type="button"
                    onClick={handleSelectAllAddresses}
                    className="px-2 py-1 rounded-md bg-white border border-gray-300 hover:bg-emerald-50 hover:text-emerald-700 font-semibold text-gray-700 cursor-pointer"
                  >
                    Select All ({allTelemetryAddresses.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllAddresses}
                    className="px-2 py-1 rounded-md bg-white border border-gray-300 hover:bg-red-50 hover:text-red-700 font-semibold text-gray-700 cursor-pointer"
                  >
                    Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(["R", "Y", "B", "RY", "YB", "BR"])}
                    className="px-2 py-1 rounded-md bg-white border border-gray-300 hover:bg-indigo-50 hover:text-indigo-700 font-semibold text-gray-700 cursor-pointer"
                  >
                    Voltages Only (6)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(["I1", "I2", "I3"])}
                    className="px-2 py-1 rounded-md bg-white border border-gray-300 hover:bg-teal-50 hover:text-teal-700 font-semibold text-gray-700 cursor-pointer"
                  >
                    Currents Only (3)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(["W", "PF", "KVA", "KVAR"])}
                    className="px-2 py-1 rounded-md bg-white border border-gray-300 hover:bg-amber-50 hover:text-amber-700 font-semibold text-gray-700 cursor-pointer"
                  >
                    Power Only (4)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(["KWH", "Frequency"])}
                    className="px-2 py-1 rounded-md bg-white border border-gray-300 hover:bg-emerald-50 hover:text-emerald-700 font-semibold text-gray-700 cursor-pointer"
                  >
                    Energy & Grid (2)
                  </button>
                  <button
                    type="button"
                    onClick={handleResetAllLabels}
                    className="px-2 py-1 rounded-md bg-white border border-amber-300 hover:bg-amber-50 hover:text-amber-800 font-semibold text-amber-700 cursor-pointer"
                    title="Reset all custom names back to default"
                  >
                    Reset Names
                  </button>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
                  {selectedAddressKeys.length} of {allTelemetryAddresses.length} Selected
                </span>
              </div>

              {/* Add New Telemetry Register Setup Banner & Expandable Form */}
              <div className="border-b border-emerald-100 bg-emerald-50/70 px-5 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <div>
                      <span className="text-xs font-bold text-emerald-950">Add Register Setup</span>
                      <span className="text-[11px] text-emerald-700 ml-2 hidden sm:inline">
                        Set the Firebase key to read and configure its display name & unit
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddRegisterForm((prev) => !prev)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                  >
                    <span>{showAddRegisterForm ? "✕ Close Setup" : "➕ Add Register"}</span>
                  </button>
                </div>

                {/* Expandable Register Creation Form */}
                {showAddRegisterForm && (
                  <form onSubmit={handleAddNewRegister} className="mt-3 pt-3 border-t border-emerald-200/80">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      {/* Key to Read in Firebase */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Key to Read <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={newRegKey}
                          onChange={(e) => setNewRegKey(e.target.value)}
                          placeholder="e.g. W, PF, THD, temp_1"
                          className="w-full text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-800"
                          required
                        />
                        <span className="text-[9px] text-slate-500">Exact Firebase field name</span>
                      </div>

                      {/* Display Name */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={newRegName}
                          onChange={(e) => setNewRegName(e.target.value)}
                          placeholder="e.g. Active Power, Frequency"
                          className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-800"
                        />
                        <span className="text-[9px] text-slate-500">Label shown on dashboard</span>
                      </div>

                      {/* Unit */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={newRegUnit}
                          onChange={(e) => setNewRegUnit(e.target.value)}
                          placeholder="e.g. W, cos φ, kVA, °C, bar"
                          className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-800"
                        />
                        <span className="text-[9px] text-slate-500">Measurement unit</span>
                      </div>

                      {/* Group */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Group
                        </label>
                        <input
                          type="text"
                          value={newRegGroup}
                          onChange={(e) => setNewRegGroup(e.target.value)}
                          placeholder="Power Metrics"
                          list="group-presets"
                          className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-800"
                        />
                        <datalist id="group-presets">
                          <option value="Power Metrics" />
                          <option value="Energy & Frequency" />
                          <option value="Phase Voltages (VLN)" />
                          <option value="Line Voltages (VLL)" />
                          <option value="Phase Currents (I)" />
                          <option value="Sensors & Temperature" />
                          <option value="Custom Registers" />
                        </datalist>
                        <span className="text-[9px] text-slate-500">Category section</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-emerald-200">
                      <button
                        type="button"
                        onClick={() => setShowAddRegisterForm(false)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/80 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingRegister || !newRegKey.trim()}
                        className="px-3.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1"
                      >
                        {isSavingRegister ? "Saving..." : "✓ Save Register to Firebase"}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Address List with Editable Additional Names grouped by Category */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {Array.from(new Set(allTelemetryAddresses.map((a) => a.group))).map((groupName) => {
                  const groupAddresses = allTelemetryAddresses.filter((a) => a.group === groupName);
                  const isGroupAllSelected = groupAddresses.every((a) => selectedAddressKeys.includes(a.key));

                  return (
                    <div key={groupName} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {groupName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (isGroupAllSelected) {
                              setSelectedAddressKeys((prev) =>
                                prev.filter((k) => !groupAddresses.some((a) => a.key === k))
                              );
                            } else {
                              setSelectedAddressKeys((prev) => [
                                ...prev,
                                ...groupAddresses.map((a) => a.key).filter((k) => !prev.includes(k)),
                              ]);
                            }
                          }}
                          className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                        >
                          {isGroupAllSelected ? "Deselect Group" : "Select Group"}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {groupAddresses.map((item) => {
                          const isChecked = selectedAddressKeys.includes(item.key);
                          const customVal = customLabelMap[item.key];
                          const isCustomized = customVal !== undefined && customVal.trim() !== "" && customVal !== item.name;

                          return (
                            <div
                              key={item.key}
                              className={`flex flex-col p-2.5 rounded-xl border text-xs transition-all ${
                                isChecked
                                  ? "bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500/20"
                                  : "bg-slate-100/70 border-slate-200 text-slate-400 opacity-80"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                                <label className="flex items-center gap-1.5 cursor-pointer select-none min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleAddress(item.key)}
                                    className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500 cursor-pointer shrink-0"
                                  />
                                  <div className="flex items-center gap-1 min-w-0">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Key:</span>
                                    <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] border truncate ${item.badgeColor || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                      {item.key}
                                    </span>
                                  </div>
                                </label>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                                    {item.unit || "--"}
                                  </span>
                                  {isCustomized && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetSingleLabel(item.key)}
                                      title="Reset to default name"
                                      className="text-[10px] font-bold text-amber-600 hover:text-rose-600 hover:underline cursor-pointer"
                                    >
                                      Reset
                                    </button>
                                  )}
                                  {item.isCustom && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteCustomRegister(item.key, e)}
                                      title="Delete this custom register"
                                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 cursor-pointer"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="mt-0.5">
                                <div className="flex items-center justify-between mb-0.5 text-[9px] text-slate-400 font-bold uppercase">
                                  <span>Display Name</span>
                                  <span className="font-normal text-[8px] text-slate-400">Editable</span>
                                </div>
                                <input
                                  type="text"
                                  value={customVal !== undefined ? customVal : item.name}
                                  onChange={(e) => handleCustomLabelChange(item.key, e.target.value)}
                                  placeholder={item.name}
                                  className={`w-full text-xs font-semibold px-2 py-1 rounded border transition-colors outline-hidden ${
                                    isCustomized
                                      ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold"
                                      : "bg-white border-slate-200 text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400"
                                  }`}
                                  title="Edit display name for this register"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dialog Footer */}
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-500">
                  Visible addresses will immediately reflect on the dashboard for this machine.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfiguringNumber(null)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAddressConfig}
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? "Saving..." : "Save Addresses"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
