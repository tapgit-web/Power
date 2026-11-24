import React, { useState } from 'react';
import { useMachineConfig } from '../../contexts/machineConfigContext';
import { adminCreateUser } from '../../firebase/auth';
import { ADMIN_EMAILS } from '../../constants/admins';

export const UserManagerModal = ({ isOpen, onClose }) => {
  const {
    allUsers,
    getCategoryConfig,
    saveUserPermissions,
    deleteUserPermissions
  } = useMachineConfig();

  const { allAllowedNumbers = [], machineNames = {} } = getCategoryConfig('power_meters');

  // Form states for adding user
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newAllMachines, setNewAllMachines] = useState(false);
  const [newSelectedMachines, setNewSelectedMachines] = useState([]);

  // Form states for editing existing user
  const [editingEmail, setEditingEmail] = useState(null);
  const [editRole, setEditRole] = useState('user');
  const [editAllMachines, setEditAllMachines] = useState(false);
  const [editSelectedMachines, setEditSelectedMachines] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  if (!isOpen) return null;

  // Combine RTDB users and known ADMIN_EMAILS
  const usersMap = { ...(allUsers || {}) };
  ADMIN_EMAILS.forEach((adminEmail) => {
    const clean = adminEmail.toLowerCase().trim();
    const key = clean.replace(/[.#$[\]]/g, '_');
    if (!usersMap[key]) {
      usersMap[key] = {
        email: clean,
        role: 'admin',
        allMachines: true,
        assignedMachines: allAllowedNumbers,
        isDefaultAdmin: true,
      };
    }
  });

  const usersList = Object.values(usersMap).sort((a, b) =>
    (a.email || '').localeCompare(b.email || '')
  );

  const filteredUsers = usersList.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (u.email || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
  });

  const toggleNewMachine = (num) => {
    setNewSelectedMachines((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  const toggleEditMachine = (num) => {
    setEditSelectedMachines((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  const handleSelectAllNew = () => {
    setNewSelectedMachines([...allAllowedNumbers]);
  };

  const handleDeselectAllNew = () => {
    setNewSelectedMachines([]);
  };

  const handleSelectAllEdit = () => {
    setEditSelectedMachines([...allAllowedNumbers]);
  };

  const handleDeselectAllEdit = () => {
    setEditSelectedMachines([]);
  };

  const handleStartEdit = (user) => {
    setEditingEmail(user.email);
    setEditRole(user.role || 'user');
    setEditAllMachines(user.allMachines || user.role === 'admin');
    setEditSelectedMachines(
      Array.isArray(user.assignedMachines) ? [...user.assignedMachines] : []
    );
    setFeedback({ type: '', message: '' });
  };

  const handleSaveEdit = async () => {
    if (!editingEmail) return;
    setIsSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      await saveUserPermissions({
        email: editingEmail,
        role: editRole,
        allMachines: editAllMachines || editRole === 'admin',
        assignedMachines: editAllMachines || editRole === 'admin' ? allAllowedNumbers : editSelectedMachines,
      });

      setFeedback({
        type: 'success',
        message: `Machine access for "${editingEmail}" updated successfully!`,
      });
      setEditingEmail(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update user assignments.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanPass = newPassword.trim();

    if (!cleanEmail) {
      setFeedback({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    if (cleanPass.length < 6) {
      setFeedback({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create user in Firebase Auth without signing out current admin
      await adminCreateUser(cleanEmail, cleanPass);

      // 2. Save role and machine assignment to Firebase Realtime Database
      await saveUserPermissions({
        email: cleanEmail,
        role: newRole,
        allMachines: newAllMachines || newRole === 'admin',
        assignedMachines:
          newAllMachines || newRole === 'admin' ? allAllowedNumbers : newSelectedMachines,
      });

      setFeedback({
        type: 'success',
        message: `User "${cleanEmail}" created and machine permissions assigned successfully!`,
      });

      // Reset form
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      setNewAllMachines(false);
      setNewSelectedMachines([]);
      setShowAddForm(false);
    } catch (err) {
      console.error('Create user error:', err);
      let msg = 'Failed to create user. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists in Firebase Auth.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'The email address format is invalid.';
      } else if (err.message) {
        msg = err.message;
      }
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (ADMIN_EMAILS.some((adm) => adm.toLowerCase() === user.email.toLowerCase())) {
      setFeedback({ type: 'error', message: 'Cannot delete primary administrator.' });
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to remove machine access and permissions for "${user.email}"?`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteUserPermissions(user.email);
      setFeedback({
        type: 'success',
        message: `Permissions for "${user.email}" deleted successfully.`,
      });
      if (editingEmail === user.email) {
        setEditingEmail(null);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to remove user permissions.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">User & Machine Access</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 uppercase tracking-wider">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Create user accounts and assign specific machines to each user
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between shadow-sm animate-fadeIn ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback({ type: '', message: '' })}
              className="font-bold ml-2 hover:opacity-75"
            >
              ✕
            </button>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-4 pb-3 bg-slate-50 border-b border-gray-200">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search users by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setFeedback({ type: '', message: '' });
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              showAddForm
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            <span>{showAddForm ? '✕ Close Form' : '+ Create New User'}</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Create User Collapsible Form */}
          {showAddForm && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-white border border-emerald-200 shadow-sm animate-fadeIn">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-emerald-100">
                <h3 className="text-sm font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Create User & Assign Machines
                </h3>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      User Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="operator1@factory.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs text-gray-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Initial Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs text-gray-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Account Role
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => {
                        setNewRole(e.target.value);
                        if (e.target.value === 'admin') setNewAllMachines(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs text-gray-800 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="user">Standard User (View Assigned Only)</option>
                      <option value="user_editor">Standard User (View Assigned and editable reg address name)</option>
                      <option value="admin">Administrator (Full Access)</option>
                    </select>
                  </div>
                </div>

                {/* Machine Assignment Selection */}
                <div className="p-3.5 bg-white rounded-xl border border-emerald-100">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                        Assigned Machines
                      </span>
                      <label className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold cursor-pointer ml-3">
                        <input
                          type="checkbox"
                          checked={newAllMachines || newRole === 'admin'}
                          disabled={newRole === 'admin'}
                          onChange={(e) => setNewAllMachines(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>All Machines (Unrestricted)</span>
                      </label>
                    </div>

                    {!newAllMachines && newRole !== 'admin' && (
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={handleSelectAllNew}
                          className="text-emerald-700 font-bold hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={handleDeselectAllNew}
                          className="text-gray-500 font-medium hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {!newAllMachines && newRole !== 'admin' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {allAllowedNumbers.map((num) => {
                        const isSelected = newSelectedMachines.includes(num);
                        const machineId = `MC_${String(num).padStart(3, '0')}`;
                        const locName = machineNames[String(num)] || `Unit ${num}`;
                        return (
                          <button
                            type="button"
                            key={num}
                            onClick={() => toggleNewMachine(num)}
                            className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <div className="truncate pr-1">
                              <span className="text-[11px] block text-emerald-800 font-mono">
                                {machineId}
                              </span>
                              <span className="text-[10px] text-gray-500 block truncate">
                                {locName}
                              </span>
                            </div>
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 font-bold ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'border border-gray-300 text-transparent'
                              }`}
                            >
                              ✓
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic py-1">
                      {newRole === 'admin'
                        ? 'Administrators automatically have access to all machines.'
                        : 'User will have unrestricted access to view all machines in the plant.'}
                    </p>
                  )}
                </div>

                {/* Submit Row */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating User...' : '✓ Create User & Save'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users List Directory */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                User Directory & Machine Permissions ({filteredUsers.length})
              </h3>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-200">
                <p className="text-xs text-gray-500">No users match your search query.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => {
                  const isEditing = editingEmail === user.email;
                  const isUserAdmin = user.role === 'admin';
                  const isAllMachines = user.allMachines || isUserAdmin;
                  const assigned = Array.isArray(user.assignedMachines)
                    ? user.assignedMachines
                    : [];

                  return (
                    <div
                      key={user.email}
                      className="p-4 rounded-2xl border border-gray-200 hover:border-emerald-300 bg-white shadow-xs transition-all"
                    >
                      {/* User Summary Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-gray-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-xs font-black uppercase text-emerald-800 shadow-inner">
                            {user.email.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-bold text-gray-900">
                                {user.email}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  isUserAdmin
                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                    : user.role === 'user_editor'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {isUserAdmin ? 'Admin' : user.role === 'user_editor' ? 'Editor' : 'User'}
                              </span>
                              {user.isDefaultAdmin && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-medium">
                                  Whitelist
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-500">
                              {isUserAdmin
                                ? 'Full Administrative Access'
                                : user.role === 'user_editor'
                                ? `Can view & edit register names for ${isAllMachines ? 'all machines' : `${assigned.length} machines`}`
                                : `View only: ${isAllMachines ? 'all machines' : `${assigned.length} machines`}`}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {!isEditing ? (
                            <>
                              <button
                                onClick={() => handleStartEdit(user)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200 transition-colors"
                              >
                                ⚙️ Edit Machines
                              </button>
                              {!user.isDefaultAdmin && (
                                <button
                                  onClick={() => handleDeleteUser(user)}
                                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                                  title="Delete user permissions"
                                >
                                  🗑️
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => setEditingEmail(null)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Display assigned machine chips (when not editing) */}
                      {!isEditing && (
                        <div className="pt-2.5 flex flex-wrap items-center gap-1.5">
                          {isAllMachines ? (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              🌐 Full Access (All {allAllowedNumbers.length} Machines)
                            </span>
                          ) : assigned.length > 0 ? (
                            assigned.map((num) => {
                              const mId = `MC_${String(num).padStart(3, '0')}`;
                              const name = machineNames[String(num)] || `Unit ${num}`;
                              return (
                                <span
                                  key={num}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200"
                                >
                                  <strong className="text-emerald-700 font-mono">{mId}</strong>
                                  <span className="text-gray-400">•</span>
                                  <span>{name}</span>
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                              ⚠️ No machines currently assigned
                            </span>
                          )}
                        </div>
                      )}

                      {/* Inline Machine Editor */}
                      {isEditing && (
                        <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-emerald-200 animate-fadeIn">
                          {/* Role Selector in Inline Editor */}
                          <div className="mb-3 pb-2.5 border-b border-gray-200">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Account Role
                            </label>
                            <select
                              value={editRole}
                              disabled={user.isDefaultAdmin}
                              onChange={(e) => {
                                setEditRole(e.target.value);
                                if (e.target.value === 'admin') setEditAllMachines(true);
                              }}
                              className="w-full sm:w-auto px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs text-gray-800 focus:outline-none focus:border-emerald-500"
                            >
                              <option value="user">Standard User (View Assigned Only)</option>
                              <option value="user_editor">Standard User (View Assigned and editable reg address name)</option>
                              <option value="admin">Administrator (Full Access)</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-1.5 text-xs text-emerald-900 font-bold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editAllMachines}
                                onChange={(e) => setEditAllMachines(e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>Assign All Machines</span>
                            </label>

                            {!editAllMachines && (
                              <div className="flex items-center gap-2 text-xs">
                                <button
                                  type="button"
                                  onClick={handleSelectAllEdit}
                                  className="text-emerald-700 font-bold hover:underline"
                                >
                                  Select All
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                  type="button"
                                  onClick={handleDeselectAllEdit}
                                  className="text-gray-500 font-medium hover:underline"
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                          </div>

                          {!editAllMachines ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                              {allAllowedNumbers.map((num) => {
                                const isSelected = editSelectedMachines.includes(num);
                                const machineId = `MC_${String(num).padStart(3, '0')}`;
                                const locName = machineNames[String(num)] || `Unit ${num}`;
                                return (
                                  <button
                                    type="button"
                                    key={num}
                                    onClick={() => toggleEditMachine(num)}
                                    className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                                      isSelected
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                                  >
                                    <div className="truncate pr-1">
                                      <span className="text-[11px] block text-emerald-800 font-mono">
                                        {machineId}
                                      </span>
                                      <span className="text-[10px] text-gray-500 block truncate">
                                        {locName}
                                      </span>
                                    </div>
                                    <span
                                      className={`w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 font-bold ${
                                        isSelected
                                          ? 'bg-emerald-600 text-white'
                                          : 'border border-gray-300 text-transparent'
                                      }`}
                                    >
                                      ✓
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500 italic py-1">
                              User has access to all machines.
                            </p>
                          )}

                          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-gray-200">
                            <button
                              type="button"
                              onClick={() => setEditingEmail(null)}
                              className="px-3 py-1.5 text-xs font-semibold text-gray-600"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={isSubmitting}
                              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            >
                              {isSubmitting ? 'Saving...' : '✓ Save Machine Access'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-gray-500">
            Machine assignments take effect instantly via Firebase Realtime Database.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
