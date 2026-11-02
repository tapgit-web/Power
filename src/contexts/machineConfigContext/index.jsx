import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { app } from '../../firebase/firebase';

const database = getDatabase(app);

// Baseline defaults in case Firebase has not been seeded yet
export const DEFAULT_MACHINES_CONFIG = {
  chiller_300L: {
    label: "300L Chillers",
    allowed: [1, 6, 10, 110, 111, 12, 13, 14, 16, 17, 20, 21, 22, 26, 27, 28, 29, 30, 31, 32, 33, 34],
    names: {
      "1": "Unit 001",
      "6": "RAIPUR",
      "10": "GUNTUR",
      "110": "GUNTUR",
      "111": "Nellore-2",
      "12": "SANGLI",
      "13": "NAGPUR-2",
      "14": "Vellore",
      "16": "Hubli",
      "17": "Satara",
      "20": "Annamayya",
      "21": "Anantapur",
      "22": "Akola",
      "26": "Salem",
      "27": "Rayachoti",
      "28": "Machine 28",
      "29": "Chandrapur",
      "30": "Vijayawada",
      "31": "Nalgonda",
      "32": "Machine 32",
      "33": "Nashik-2",
      "34": "Ranipet"
    }
  },
  chiller_200L: {
    label: "200L Chillers",
    allowed: [3, 4, 7, 9, 15, 18, 19, 24, 25],
    names: {
      "3": "NAGPUR",
      "4": "NARASARAOPET",
      "7": "Ahmednagar",
      "9": "BELGUM",
      "15": "Chennai OMR",
      "18": "Jamshedpur",
      "19": "Ahmedabad",
      "24": "TIRUPATI",
      "25": "Nandyalaya"
    }
  },
  chiller_60L: {
    label: "60L Chillers",
    allowed: [5, 23],
    names: {
      "5": "DODABALLAPUR",
      "23": "CHECKBALLAPUR"
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

  // Subscribe to Firebase RTDB node `/app_config/machines`
  useEffect(() => {
    const configRef = ref(database, 'app_config/machines');
    const unsubscribe = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        // Merge with defaults to ensure all categories and fields remain intact
        const merged = {
          chiller_300L: {
            ...DEFAULT_MACHINES_CONFIG.chiller_300L,
            ...(data.chiller_300L || {}),
            allowed: Array.isArray(data.chiller_300L?.allowed)
              ? data.chiller_300L.allowed
              : DEFAULT_MACHINES_CONFIG.chiller_300L.allowed,
            names: data.chiller_300L?.names || DEFAULT_MACHINES_CONFIG.chiller_300L.names
          },
          chiller_200L: {
            ...DEFAULT_MACHINES_CONFIG.chiller_200L,
            ...(data.chiller_200L || {}),
            allowed: Array.isArray(data.chiller_200L?.allowed)
              ? data.chiller_200L.allowed
              : DEFAULT_MACHINES_CONFIG.chiller_200L.allowed,
            names: data.chiller_200L?.names || DEFAULT_MACHINES_CONFIG.chiller_200L.names
          },
          chiller_60L: {
            ...DEFAULT_MACHINES_CONFIG.chiller_60L,
            ...(data.chiller_60L || {}),
            allowed: Array.isArray(data.chiller_60L?.allowed)
              ? data.chiller_60L.allowed
              : DEFAULT_MACHINES_CONFIG.chiller_60L.allowed,
            names: data.chiller_60L?.names || DEFAULT_MACHINES_CONFIG.chiller_60L.names
          }
        };
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
      const configRef = ref(database, 'app_config/machines');
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
  const getCategoryConfig = (categoryKey) => {
    const cat = machinesConfig[categoryKey] || DEFAULT_MACHINES_CONFIG[categoryKey];
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
