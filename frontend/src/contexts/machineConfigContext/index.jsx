import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../authContext';
import { sanitizeEmailKey } from '../../constants/admins';
import { ALL_TELEMETRY_ADDRESSES, DEFAULT_ALL_ADDRESS_KEYS } from '../../constants/telemetryAddresses';
import api from '../../services/api';

const CUSTOM_REG_STORAGE_KEY = 'power_monitor_custom_registers';

// Dedicated baseline defaults for Power Monitoring machines
export const DEFAULT_MACHINES_CONFIG = {
  power_meters: {
    label: "Power Meters",
    allowed: [1],
    names: {
      "1": "Unit 001"
    },
    addresses: {
      "1": DEFAULT_ALL_ADDRESS_KEYS
    },
    customLabels: {
      "1": {}
    }
  }
};

const MachineConfigContext = createContext(null);

export const useMachineConfig = () => {
  const context = useContext(MachineConfigContext);
  if (!context) {
    throw new Error('useMachineConfig must be used within a MachineConfigProvider');
  }
  return context;
};

export const MachineConfigProvider = ({ children }) => {
  const { isAdmin, assignedMachines, userLoggedIn } = useAuth();
  const [machinesConfig, setMachinesConfig] = useState(DEFAULT_MACHINES_CONFIG);
  const [customRegisters, setCustomRegisters] = useState(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_REG_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [allUsers, setAllUsers] = useState({});
  const [isSyncedWithCloud, setIsSyncedWithCloud] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch users from Custom Backend (Admin only)
  const refreshUsers = useCallback(async () => {
    if (!isAdmin || !userLoggedIn) return;
    try {
      const res = await api.listUsers();
      if (res.success && Array.isArray(res.data?.users)) {
        const usersObj = {};
        res.data.users.forEach((u) => {
          const emailKey = sanitizeEmailKey(u.email);
          usersObj[emailKey] = {
            _id: u._id,
            id: u._id,
            email: u.email,
            role: u.role,
            assignedMachines: u.assignedMachines || [],
            allMachines: Boolean(u.allMachines),
            createdAt: u.createdAt,
          };
        });
        setAllUsers(usersObj);
      }
    } catch (err) {
      console.warn('Could not fetch users from custom backend:', err.message);
    }
  }, [isAdmin, userLoggedIn]);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  // Fetch machines from Custom Backend (MongoDB Atlas)
  const refreshMachines = useCallback(async () => {
    if (!userLoggedIn) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.listMachines();
      if (res.success && Array.isArray(res.data?.machines)) {
        const backendMachines = res.data.machines;
        const newConfig = { ...DEFAULT_MACHINES_CONFIG };

        backendMachines.forEach((m) => {
          const cat = m.category || 'power_meters';
          if (!newConfig[cat]) {
            newConfig[cat] = {
              label: cat.replace(/_/g, ' ').toUpperCase(),
              allowed: [],
              names: {},
              addresses: {},
              customLabels: {},
            };
          }

          const mKey = m.machineId || m._id;
          if (!newConfig[cat].allowed.includes(mKey)) {
            newConfig[cat].allowed.push(mKey);
          }
          newConfig[cat].names[mKey] = m.displayName || mKey;
          newConfig[cat].addresses[mKey] = DEFAULT_ALL_ADDRESS_KEYS;
          newConfig[cat].customLabels[mKey] = m.customLabels || {};
        });

        setMachinesConfig(newConfig);
        setIsSyncedWithCloud(true);
      }
    } catch (err) {
      console.warn('Could not fetch machines from custom backend:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userLoggedIn]);

  useEffect(() => {
    refreshMachines();
  }, [refreshMachines]);

  // Combined list of built-in addresses + custom registers
  const allTelemetryAddresses = useMemo(() => {
    const map = new Map();
    ALL_TELEMETRY_ADDRESSES.forEach((item) => {
      map.set(item.key, { ...item, isCustom: false });
    });
    Object.values(customRegisters || {}).forEach((item) => {
      if (item && item.key) {
        map.set(item.key, {
          key: item.key,
          name: item.name || item.key,
          group: item.group || 'Custom Registers',
          unit: item.unit || '',
          badgeColor: item.badgeColor || 'bg-indigo-50 text-indigo-700 border-indigo-200',
          isCustom: true,
          createdAt: item.createdAt || null,
        });
      }
    });
    return Array.from(map.values());
  }, [customRegisters]);

  const allAddressKeys = useMemo(() => allTelemetryAddresses.map((a) => a.key), [allTelemetryAddresses]);

  // Add a new machine to backend
  const addMachine = async (categoryKey, machineNumber, machineName, selectedAddresses = null) => {
    const machineIdStr = String(machineNumber).trim();
    if (!machineIdStr) throw new Error('Machine identifier is required');
    const nameStr = (machineName || '').trim() || `Machine ${machineIdStr}`;

    const res = await api.createMachine({
      machineId: machineIdStr,
      displayName: nameStr,
      category: categoryKey || 'power_meters',
    });

    if (!res.success) {
      throw new Error(res.error || 'Failed to create machine');
    }

    await refreshMachines();
    return { success: true };
  };

  // Update existing machine name
  const updateMachineName = async (categoryKey, machineNumber, newName) => {
    const machineIdStr = String(machineNumber).trim();
    const nameStr = (newName || '').trim();

    const res = await api.updateMachine(machineIdStr, {
      displayName: nameStr,
      category: categoryKey,
    });

    if (!res.success) {
      throw new Error(res.error || 'Failed to update machine name');
    }

    await refreshMachines();
    return { success: true };
  };

  // Update selected register addresses and custom register labels for a machine
  const updateMachineAddresses = async (categoryKey, machineNumber, addressKeys, customLabels = null) => {
    const machineIdStr = String(machineNumber).trim();

    if (customLabels !== null) {
      const res = await api.updateCustomLabels(machineIdStr, customLabels);
      if (!res.success) {
        throw new Error(res.error || 'Failed to update register labels');
      }
    }

    await refreshMachines();
    return { success: true };
  };

  // Remove a machine from custom backend
  const removeMachine = async (categoryKey, machineNumber) => {
    const machineIdStr = String(machineNumber).trim();
    const res = await api.deleteMachine(machineIdStr);

    if (!res.success) {
      throw new Error(res.error || 'Failed to delete machine');
    }

    await refreshMachines();
    return { success: true };
  };

  // Add or update a custom telemetry register
  const addCustomRegister = async ({ key, name, unit, group }) => {
    const cleanKey = (key || '').trim();
    if (!cleanKey) throw new Error('Register key is required');

    const regObj = {
      key: cleanKey,
      name: (name || '').trim() || cleanKey,
      unit: (unit || '').trim(),
      group: (group || '').trim() || 'Custom Registers',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      isCustom: true,
      createdAt: Date.now()
    };

    setCustomRegisters((prev) => {
      const updated = { ...prev, [cleanKey]: regObj };
      try {
        localStorage.setItem(CUSTOM_REG_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    return { success: true };
  };

  // Remove a custom register
  const removeCustomRegister = async (regKey) => {
    const cleanKey = (regKey || '').trim();
    if (!cleanKey) return { success: false, error: 'No key provided' };

    setCustomRegisters((prev) => {
      const updated = { ...prev };
      delete updated[cleanKey];
      try {
        localStorage.setItem(CUSTOM_REG_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    return { success: true };
  };

  // Reset a category back to original defaults
  const resetCategoryToDefault = async (categoryKey) => {
    setMachinesConfig((prev) => ({
      ...prev,
      [categoryKey]: DEFAULT_MACHINES_CONFIG[categoryKey] || { allowed: [], names: {}, addresses: {}, customLabels: {} }
    }));
    return { success: true };
  };

  // Seed defaults
  const syncDefaultsToCloud = async () => {
    await refreshMachines();
    return { success: true };
  };

  // Save or update user permissions and assigned machines
  const saveUserPermissions = async ({ email, role = 'user', assignedMachines = [], allMachines = false }) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Email is required');

    // Check if user already exists in allUsers
    const existing = Object.values(allUsers).find(
      (u) => (u.email || '').toLowerCase() === cleanEmail
    );

    if (existing && existing._id) {
      const res = await api.updateUser(existing._id, {
        role,
        assignedMachines,
        allMachines: Boolean(allMachines),
      });
      if (!res.success) throw new Error(res.error || 'Failed to update user');
    } else {
      const res = await api.createUser({
        email: cleanEmail,
        password: 'InitialPassword123',
        role,
        assignedMachines,
        allMachines: Boolean(allMachines),
      });
      if (!res.success) throw new Error(res.error || 'Failed to create user');
    }

    await refreshUsers();
    return { success: true };
  };

  // Remove a user's permissions and assignment
  const deleteUserPermissions = async (email) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return { success: false, error: 'No email provided' };

    const target = Object.values(allUsers).find(
      (u) => (u.email || '').toLowerCase() === cleanEmail
    );

    if (target && target._id) {
      const res = await api.deleteUser(target._id);
      if (!res.success) return { success: false, error: res.error };
    }

    await refreshUsers();
    return { success: true };
  };

  // Fast getter for consumption by dashboard components
  const getCategoryConfig = (categoryKey = 'power_meters') => {
    // Collect all machines, names, addresses, and customLabels across all categories
    const allNames = {};
    const allAddresses = {};
    const allCustomLabels = {};
    const allAllowed = [];

    Object.values(machinesConfig || {}).forEach((c) => {
      if (c && typeof c === 'object') {
        if (Array.isArray(c.allowed)) {
          c.allowed.forEach((num) => {
            if (!allAllowed.includes(num)) allAllowed.push(num);
          });
        }
        Object.assign(allNames, c.names || {});
        Object.assign(allAddresses, c.addresses || {});
        Object.assign(allCustomLabels, c.customLabels || {});
      }
    });

    // Filter machines by assignedMachines if user is not admin
    let effectiveAllowed = allAllowed;
    if (!isAdmin && Array.isArray(assignedMachines)) {
      effectiveAllowed = allAllowed.filter((num) =>
        assignedMachines.includes(num) || assignedMachines.includes(String(num))
      );
    }

    return {
      allowedNumbers: effectiveAllowed,
      allAllowedNumbers: allAllowed,
      machineNames: allNames,
      machineAddresses: allAddresses,
      machineCustomLabels: allCustomLabels,
      label: categoryKey,
      allTelemetryAddresses,
      allAddressKeys
    };
  };

  const value = {
    machinesConfig,
    customRegisters,
    allTelemetryAddresses,
    allAddressKeys,
    allUsers,
    isSyncedWithCloud,
    isLoading,
    addMachine,
    updateMachineName,
    updateMachineAddresses,
    removeMachine,
    resetCategoryToDefault,
    syncDefaultsToCloud,
    getCategoryConfig,
    addCustomRegister,
    removeCustomRegister,
    saveUserPermissions,
    deleteUserPermissions,
    refreshMachines,
  };

  return (
    <MachineConfigContext.Provider value={value}>
      {children}
    </MachineConfigContext.Provider>
  );
};
