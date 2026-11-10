// 11 Modbus telemetry register addresses read from Firebase
export const ALL_TELEMETRY_ADDRESSES = [
  {
    key: "KWH",
    name: "Active Energy",
    group: "Energy & Frequency",
    unit: "kWh",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    key: "Frequency",
    name: "Grid Frequency",
    group: "Energy & Frequency",
    unit: "Hz",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
  },
  {
    key: "R",
    name: "Phase R Voltage (L-N)",
    group: "Phase Voltages (VLN)",
    unit: "V",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    key: "Y",
    name: "Phase Y Voltage (L-N)",
    group: "Phase Voltages (VLN)",
    unit: "V",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    key: "B",
    name: "Phase B Voltage (L-N)",
    group: "Phase Voltages (VLN)",
    unit: "V",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    key: "RY",
    name: "Line Voltage R-Y",
    group: "Line Voltages (VLL)",
    unit: "V",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    key: "YB",
    name: "Line Voltage Y-B",
    group: "Line Voltages (VLL)",
    unit: "V",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    key: "BR",
    name: "Line Voltage B-R",
    group: "Line Voltages (VLL)",
    unit: "V",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    key: "I1",
    name: "Phase R Current",
    group: "Phase Currents (I)",
    unit: "A",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
  },
  {
    key: "I2",
    name: "Phase Y Current",
    group: "Phase Currents (I)",
    unit: "A",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
  },
  {
    key: "I3",
    name: "Phase B Current",
    group: "Phase Currents (I)",
    unit: "A",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
  },
];

export const DEFAULT_ALL_ADDRESS_KEYS = ALL_TELEMETRY_ADDRESSES.map((a) => a.key);
