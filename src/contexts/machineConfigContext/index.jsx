import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { app } from '../../firebase/firebase';

const database = getDatabase(app);

// Dedicated Firebase Realtime Database path for Power Monitor project (isolated from other projects)
const POWER_CONFIG_PATH = 'power_app_config/machines';

// Dedicated baseline defaults for Power Monitoring machines
export const DEFAULT_MACHINES_CONFIG = {
  power_meters: {
    label: "Power Meters",
    allowed: [1],
    names: {
      "1": "Unit 001"
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
  const [isSyncedWithCloud, setIsSyncedWithCloud] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
            names: data[key]?.names || DEFAULT_MACHINES_CONFIG[key].names
          };
        });
        // Include any additional custom categories configured in the cloud
        Object.keys(data).forEach((key) => {
          if (!merged[key] && typeof data[key] === 'object') {
            merged[key] = {
              label: data[key].label || key,
              allowed: Array.isArray(data[key].allowed) ? data[key].allowed : [],
              names: data[key].names || {}
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

  // Add a new machine number and name to a category
  const addMachine = async (categoryKey, machineNumber, machineName) => {
    const num = parseInt(machineNumber, 10);
    if (isNaN(num)) throw new Error('Machine number must be a valid number');
    const nameStr = (machineName || '').trim() || `Machine ${num}`;

    const currentCat = machinesConfig[categoryKey] || DEFAULT_MACHINES_CONFIG[categoryKey];
    const currentAllowed = currentCat.allowed || [];
    const currentNames = currentCat.names || {};

    const updatedAllowed = currentAllowed.includes(num)
      ? currentAllowed
      : [...currentAllowed, num].sort((a, b) => a - b);

    const updatedNames = {
      ...currentNames,
      [String(num)]: nameStr
    };

    const updatedConfig = {
      ...machinesConfig,
      [categoryKey]: {
        ...currentCat,
        allowed: updatedAllowed,
        names: updatedNames
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

  // Remove a machine from allowed list and names
  const removeMachine = async (categoryKey, machineNumber) => {
    const num = parseInt(machineNumber, 10);
    const currentCat = machinesConfig[categoryKey] || DEFAULT_MACHINES_CONFIG[categoryKey];

    const updatedAllowed = (currentCat.allowed || []).filter((n) => n !== num);
    const updatedNames = { ...(currentCat.names || {}) };
    delete updatedNames[String(num)];

    const updatedConfig = {
      ...machinesConfig,
      [categoryKey]: {
        ...currentCat,
        allowed: updatedAllowed,
        names: updatedNames
      }
    };

    return await persistConfig(updatedConfig);
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
      label: cat?.label || categoryKey
    };
  };

  const value = {
    machinesConfig,
    isSyncedWithCloud,
    isLoading,
    addMachine,
    updateMachineName,
    removeMachine,
    resetCategoryToDefault,
    syncDefaultsToCloud,
    getCategoryConfig
  };

  return (
    <MachineConfigContext.Provider value={value}>
      {children}
    </MachineConfigContext.Provider>
  );
};
