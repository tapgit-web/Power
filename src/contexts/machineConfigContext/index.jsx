import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { app } from '../../firebase/firebase';
import { ALL_TELEMETRY_ADDRESSES, DEFAULT_ALL_ADDRESS_KEYS } from '../../constants/telemetryAddresses';

const database = getDatabase(app);

// Dedicated Firebase Realtime Database path for Power Monitor project (isolated from other projects)
const POWER_CONFIG_PATH = 'power_app_config/machines';
const CUSTOM_REGISTERS_PATH = 'power_app_config/custom_registers';

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
  const [machinesConfig, setMachinesConfig] = useState(DEFAULT_MACHINES_CONFIG);
  const [customRegisters, setCustomRegisters] = useState({});
  const [isSyncedWithCloud, setIsSyncedWithCloud] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to Firebase RTDB node `/power_app_config/custom_registers`
  useEffect(() => {
    const customRegRef = ref(database, CUSTOM_REGISTERS_PATH);
    const unsubscribe = onValue(
      customRegRef,
      (snapshot) => {
        const val = snapshot.val();
        setCustomRegisters(val && typeof val === 'object' ? val : {});
      },
      (error) => {
        console.error('Error fetching custom registers from Firebase:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Combined list of built-in addresses + cloud custom registers
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

  // Subscribe to Firebase RTDB node `/power_app_config/machines`
  useEffect(() => {
    const configRef = ref(database, POWER_CONFIG_PATH);
    const unsubscribe = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        const merged = {};
        // Merge known default categories
        Object.keys(DEFAULT_MACHINES_CONFIG).forEach((key) => {
          merged[key] = {
            ...DEFAULT_MACHINES_CONFIG[key],
            ...(data[key] || {}),
            allowed: Array.isArray(data[key]?.allowed)
              ? data[key].allowed
              : DEFAULT_MACHINES_CONFIG[key].allowed,
            names: data[key]?.names || DEFAULT_MACHINES_CONFIG[key].names,
            addresses: data[key]?.addresses || DEFAULT_MACHINES_CONFIG[key].addresses || {},
            customLabels: data[key]?.customLabels || DEFAULT_MACHINES_CONFIG[key].customLabels || {}
          };
        });
        // Include any additional custom categories configured in the cloud
        Object.keys(data).forEach((key) => {
          if (!merged[key] && typeof data[key] === 'object') {
            merged[key] = {
              label: data[key].label || key,
              allowed: Array.isArray(data[key].allowed) ? data[key].allowed : [],
              names: data[key].names || {},
              addresses: data[key].addresses || {},
              customLabels: data[key].customLabels || {}
            };
          }
        });
        setMachinesConfig(merged);
        setIsSyncedWithCloud(true);
      } else {
        // No custom data stored in cloud yet
        setMachinesConfig(DEFAULT_MACHINES_CONFIG);
        setIsSyncedWithCloud(false);
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching machine config from Firebase:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper to persist current/updated configuration to Firebase
  const persistConfig = async (newConfig) => {
    try {
      const configRef = ref(database, POWER_CONFIG_PATH);
      await set(configRef, newConfig);
      setMachinesConfig(newConfig);
      setIsSyncedWithCloud(true);
      return { success: true };
    } catch (error) {
      console.error('Error saving machine config to Firebase:', error);
      return { success: false, error: error.message };
    }
  };

  // Add a new machine number, name, and optional selected addresses to a category
  const addMachine = async (categoryKey, machineNumber, machineName, selectedAddresses = null) => {
    const num = parseInt(machineNumber, 10);
    if (isNaN(num)) throw new Error('Machine number must be a valid number');
    const nameStr = (machineName || '').trim() || `Machine ${num}`;

    const currentCat = machinesConfig[categoryKey] || DEFAULT_MACHINES_CONFIG[categoryKey];
    const currentAllowed = currentCat.allowed || [];
    const currentNames = currentCat.names || {};
    const currentAddresses = currentCat.addresses || {};
    const currentCustomLabels = currentCat.customLabels || {};

    const updatedAllowed = currentAllowed.includes(num)
      ? currentAllowed
      : [...currentAllowed, num].sort((a, b) => a - b);

    const updatedNames = {
      ...currentNames,
      [String(num)]: nameStr
    };

    const updatedAddresses = {
      ...currentAddresses,
      [String(num)]: Array.isArray(selectedAddresses) && selectedAddresses.length > 0
        ? selectedAddresses
        : DEFAULT_ALL_ADDRESS_KEYS
    };

    const updatedCustomLabels = {
      ...currentCustomLabels,
      [String(num)]: {}
    };

    const updatedConfig = {
      ...machinesConfig,
      [categoryKey]: {
        ...currentCat,
        allowed: updatedAllowed,
        names: updatedNames,
        addresses: updatedAddresses,
        customLabels: updatedCustomLabels
      }
    };

    return await persistConfig(updatedConfig);
  };

  // Update existing machine name
  const updateMachineName = async (categoryKey, machineNumber, newName) => {
    const num = parseInt(machineNumber, 10);
    const nameStr = (newName || '').trim();

    const currentCat = machinesConfig[categoryKey] || DEFAULT_MACHINES_CONFIG[categoryKey];
    const updatedNames = {
      ...currentCat.names,
      [String(num)]: nameStr
    };

    const updatedConfig = {
      ...machinesConfig,
      [categoryKey]: {
        ...currentCat,
        names: updatedNames
      }
    };

    return await persistConfig(updatedConfig);
  };

  // Update selected register addresses and custom register labels for a machine
  const updateMachineAddresses = async (categoryKey, machineNumber, addressKeys, customLabels = null) => {
    const num = parseInt(machineNumber, 10);
    const currentCat = machinesConfig[categoryKey] || DEFAULT_MACHINES_CONFIG[categoryKey];
    const currentAddresses = currentCat.addresses || {};
    const currentCustomLabels = currentCat.customLabels || {};

    const updatedAddresses = {
      ...currentAddresses,
      [String(num)]: Array.isArray(addressKeys) ? addressKeys : DEFAULT_ALL_ADDRESS_KEYS
    };

    const updatedCustomLabels = {
      ...currentCustomLabels,
      ...(customLabels !== null ? { [String(num)]: customLabels } : {})
    };

    const updatedConfig = {
      ...machinesConfig,
      [categoryKey]: {
        ...currentCat,
        addresses: updatedAddresses,
        customLabels: updatedCustomLabels
      }
    };

    return await persistConfig(updatedConfig);
  };

  // Remove a machine from allowed list, names, addresses, and custom labels
  const removeMachine = async (categoryKey, machineNumber) => {
    const num = parseInt(machineNumber, 10);
    const currentCat = machinesConfig[categoryKey] || DEFAULT_MACHINES_CONFIG[categoryKey];

    const updatedAllowed = (currentCat.allowed || []).filter((n) => n !== num);
    const updatedNames = { ...(currentCat.names || {}) };
    delete updatedNames[String(num)];

    const updatedAddresses = { ...(currentCat.addresses || {}) };
    delete updatedAddresses[String(num)];

    const updatedCustomLabels = { ...(currentCat.customLabels || {}) };
    delete updatedCustomLabels[String(num)];

    const updatedConfig = {
      ...machinesConfig,
      [categoryKey]: {
        ...currentCat,
        allowed: updatedAllowed,
        names: updatedNames,
        addresses: updatedAddresses,
        customLabels: updatedCustomLabels
      }
    };

    return await persistConfig(updatedConfig);
  };

  // Add or update a custom telemetry register in Firebase RTDB
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

    const itemRef = ref(database, `${CUSTOM_REGISTERS_PATH}/${cleanKey}`);
    await set(itemRef, regObj);
    return { success: true };
  };

  // Remove a custom register from Firebase RTDB
  const removeCustomRegister = async (regKey) => {
    const cleanKey = (regKey || '').trim();
    if (!cleanKey) return { success: false, error: 'No key provided' };
    const itemRef = ref(database, `${CUSTOM_REGISTERS_PATH}/${cleanKey}`);
    await set(itemRef, null);
    return { success: true };
  };

  // Reset a category back to original defaults
  const resetCategoryToDefault = async (categoryKey) => {
    const updatedConfig = {
      ...machinesConfig,
      [categoryKey]: DEFAULT_MACHINES_CONFIG[categoryKey]
    };
    return await persistConfig(updatedConfig);
  };

  // Seed cloud database with all defaults
  const syncDefaultsToCloud = async () => {
    return await persistConfig(DEFAULT_MACHINES_CONFIG);
  };

  // Fast getter for consumption by dashboard components
  const getCategoryConfig = (categoryKey = 'power_meters') => {
    const cat =
      machinesConfig[categoryKey] ||
      Object.values(machinesConfig)[0] ||
      DEFAULT_MACHINES_CONFIG.power_meters;
    return {
      allowedNumbers: cat?.allowed || [],
      machineNames: cat?.names || {},
      machineAddresses: cat?.addresses || {},
      machineCustomLabels: cat?.customLabels || {},
      label: cat?.label || categoryKey,
      allTelemetryAddresses,
      allAddressKeys
    };
  };

  const value = {
    machinesConfig,
    customRegisters,
    allTelemetryAddresses,
    allAddressKeys,
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
    removeCustomRegister
  };

  return (
    <MachineConfigContext.Provider value={value}>
      {children}
    </MachineConfigContext.Provider>
  );
};
