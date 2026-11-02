import React, { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { app } from "../../firebase/firebase";
import { useMachineConfig } from "../../contexts/machineConfigContext";

const database = getDatabase(app);

export const Iot_chiller = ({ searchQuery = "" }) => {
  const { getCategoryConfig } = useMachineConfig();
  const { allowedNumbers, machineNames } = getCategoryConfig("chiller_300L");

  const [machineKeys, setMachineKeys] = useState([]);
  const [allMachineData, setAllMachineData] = useState({});

  const formatTS = (ts) => {
    if (!ts) return "-";

    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");

    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
  };

  // 🔹 Fetch machine keys (supports MC_001, M001, MC001, M_001, etc.)
  useEffect(() => {
    const rootRef = ref(database);
    return onValue(rootRef, (snapshot) => {
      const rootData = snapshot.val();
      if (!rootData) return;

      const keys = Object.keys(rootData)
        .filter((key) => {
          if (!/^(MC_|MC|M_|M)(?=\d)/i.test(key)) return false;
          const num = parseInt(key.replace(/^(MC_|MC|M_|M)/i, "").trim(), 10);
          return !allowedNumbers || allowedNumbers.length === 0 || allowedNumbers.includes(num);
        })
        .sort((a, b) => {
          const numA = parseInt(a.replace(/^(MC_|MC|M_|M)/i, "").trim(), 10) || 0;
          const numB = parseInt(b.replace(/^(MC_|MC|M_|M)/i, "").trim(), 10) || 0;
          return numA - numB;
        });

      setMachineKeys((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(keys)) {
          return prev;
        }
        return keys;
      });
    });
  }, [allowedNumbers]);

  // 🔹 Fetch read data for all active machines
  useEffect(() => {
    const unsubscribes = [];

    machineKeys.forEach((machine) => {
      const readRef = ref(database, `/${machine}/read`);
      const unsubRead = onValue(readRef, (snapshot) => {
        const raw = snapshot.val();
        if (!raw) return;

        const deviceKey = Object.keys(raw)[0];
        if (!deviceKey) return;

        const rawDeviceData = raw[deviceKey];
        if (!rawDeviceData) return;

        // Support both array and object structures
        const deviceData = Array.isArray(rawDeviceData)
          ? rawDeviceData
          : Object.values(rawDeviceData);

        const records = deviceData.map(({ ts, values }) => {
          let v1 = null;
          let v2 = null;
          let v3 = null;

          if (values) {
            // Check 0-indexed voltages (V_0, V_1, V_2 or V0, V1, V2)
            if (
              values.V_0 !== undefined ||
              values.v_0 !== undefined ||
              values.V0 !== undefined ||
              values.v0 !== undefined
            ) {
              v1 = values.V_0 ?? values.v_0 ?? values.V0 ?? values.v0;
              v2 = values.V_1 ?? values.v_1 ?? values.V1 ?? values.v1;
              v3 = values.V_2 ?? values.v_2 ?? values.V2 ?? values.v2;
            } else {
              // 1-indexed voltages (V1, V2, V3 or V_1, V_2, V_3)
              v1 = values.V1 ?? values.v1 ?? values.V_1 ?? values.v_1 ?? null;
              v2 = values.V2 ?? values.v2 ?? values.V_2 ?? values.v_2 ?? null;
              v3 = values.V3 ?? values.v3 ?? values.V_3 ?? values.v_3 ?? null;
            }
          }

          const kwh =
            values?.KWH ?? values?.kwh ?? values?.kWh ?? values?.Kwh ?? values?.energy ?? null;

          return {
            ts,
            v1,
            v2,
            v3,
            kwh,
          };
        });

        setAllMachineData((prev) => ({
          ...prev,
          [machine]: {
            ...(prev[machine] || {}),
            records,
          },
        }));
      });
      unsubscribes.push(unsubRead);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [machineKeys]);

  const filteredMachineKeys = machineKeys.filter((machine) => {
    const machineNumber = parseInt(machine.replace(/^(MC_|MC|M_|M)/i, "").trim(), 10);
    const rawName =
      machineNames[String(machineNumber)] ||
      machineNames[machineNumber] ||
      `Machine ${machineNumber}`;
    const displayName = rawName ? (rawName.startsWith("-") ? rawName : ` - ${rawName}`) : "";
    const fullName = `${machine}${displayName}`.toLowerCase();
    const query = (searchQuery || "").toLowerCase().trim();

    if (!query) return true;
    return (
      fullName.includes(query) ||
      machine.toLowerCase().includes(query) ||
      `m${String(machineNumber).padStart(3, "0")}`.includes(query) ||
      `mc_${String(machineNumber).padStart(3, "0")}`.includes(query) ||
      String(machineNumber).includes(query)
    );
  });

  if (machineKeys.length > 0 && filteredMachineKeys.length === 0 && searchQuery) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm max-w-md mx-auto">
          <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm font-semibold text-slate-700">No machine matches "{searchQuery}"</p>
          <p className="text-xs text-slate-500 mt-1">Try searching by ID (e.g. MC_001) or machine location name.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
      {machineKeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 sm:p-12 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm text-center">
          <div className="relative flex h-4 w-4 sm:h-5 sm:w-5 mb-3 sm:mb-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 sm:h-5 sm:w-5 bg-emerald-500"></span>
          </div>
          <p className="text-sm sm:text-base font-semibold text-slate-800">Connecting to Telemetry Stream...</p>
          <p className="text-xs text-slate-500 mt-1">Scanning database for active MC-series machines.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {filteredMachineKeys.map((machine) => {
            const machineData = allMachineData[machine] || {};
            const records = machineData.records || [];

            const latestRecord =
              records.length > 0 ? records[records.length - 1] : null;

            const machineNumber = parseInt(
              machine.replace(/^(MC_|MC|M_|M)/i, "").trim(),
              10
            );
            const locationName =
              machineNames[String(machineNumber)] ||
              machineNames[machineNumber] ||
              `Machine ${machineNumber}`;

            const v1Val = latestRecord?.v1 != null ? Number(latestRecord.v1).toFixed(1) : null;
            const v2Val = latestRecord?.v2 != null ? Number(latestRecord.v2).toFixed(1) : null;
            const v3Val = latestRecord?.v3 != null ? Number(latestRecord.v3).toFixed(1) : null;
            const kwhVal = latestRecord?.kwh != null ? Number(latestRecord.kwh).toFixed(2) : null;

            // Calculate average voltage
            const voltages = [v1Val, v2Val, v3Val].filter((v) => v !== null).map(Number);
            const avgVoltage =
              voltages.length > 0
                ? (voltages.reduce((a, b) => a + b, 0) / voltages.length).toFixed(1)
                : null;

            return (
              <div
                key={machine}
                className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 p-4 sm:p-6 lg:p-7 flex flex-col justify-between overflow-hidden relative group"
              >
                {/* Decorative Top Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-green-500"></div>

                {/* 1. Header: Machine ID, Location Name, Online Badge, Timestamp */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 sm:pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-brand font-black text-xs sm:text-sm tracking-widest shadow-sm shadow-emerald-500/20 shrink-0">
                      {machine}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-lg font-bold text-slate-900 leading-tight truncate">
                        {locationName}
                      </h2>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 tracking-wide uppercase">
                          Live Active
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg sm:rounded-xl border border-slate-200/60 self-start sm:self-center">
                    <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium truncate">
                      {latestRecord ? formatTS(latestRecord.ts) : "No data"}
                    </span>
                  </div>
                </div>

                {/* 2. Hero Energy Card (KWH) */}
                <div className="my-3.5 sm:my-5 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white shadow-md relative overflow-hidden">
                  {/* Subtle Background Glow */}
                  <div className="absolute -right-8 -bottom-8 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none"></div>

                  <div className="flex items-center justify-between relative z-10 gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-emerald-400 shadow-inner border border-white/10 shrink-0">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                          Total Energy
                        </span>
                        <h4 className="text-[11px] sm:text-xs text-slate-300 font-medium">Cumulative Active</h4>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-baseline justify-end gap-1">
                        <span className="text-2xl sm:text-4xl font-telemetry font-bold tracking-tight text-white">
                          {kwhVal !== null ? kwhVal : "--"}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-emerald-300 uppercase">kWh</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. 3-Phase Voltage Monitor (V1, V2, V3) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider">
                      3-Phase Voltage (L-N)
                    </span>
                    {avgVoltage && (
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-500">
                        Avg: <strong className="text-slate-800 font-telemetry font-bold">{avgVoltage} V</strong>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {/* Phase 1 / V1 */}
                    <div className="p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50/90 border border-slate-200/80 hover:bg-emerald-50/40 hover:border-emerald-300 transition-all duration-200 text-center flex flex-col justify-between">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 shrink-0"></span>
                        <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-600 uppercase tracking-tight sm:tracking-wider truncate">
                          <span className="hidden sm:inline">Phase </span>1 (V1)
                        </span>
                      </div>
                      <div className="text-lg sm:text-2xl md:text-3xl font-telemetry font-bold text-slate-900 tracking-tight my-0.5 sm:my-1">
                        {v1Val !== null ? v1Val : "--"}
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                        Volts (V)
                      </div>
                    </div>

                    {/* Phase 2 / V2 */}
                    <div className="p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50/90 border border-slate-200/80 hover:bg-emerald-50/40 hover:border-emerald-300 transition-all duration-200 text-center flex flex-col justify-between">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 shrink-0"></span>
                        <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-600 uppercase tracking-tight sm:tracking-wider truncate">
                          <span className="hidden sm:inline">Phase </span>2 (V2)
                        </span>
                      </div>
                      <div className="text-lg sm:text-2xl md:text-3xl font-telemetry font-bold text-slate-900 tracking-tight my-0.5 sm:my-1">
                        {v2Val !== null ? v2Val : "--"}
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                        Volts (V)
                      </div>
                    </div>

                    {/* Phase 3 / V3 */}
                    <div className="p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50/90 border border-slate-200/80 hover:bg-emerald-50/40 hover:border-emerald-300 transition-all duration-200 text-center flex flex-col justify-between">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 shrink-0"></span>
                        <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-600 uppercase tracking-tight sm:tracking-wider truncate">
                          <span className="hidden sm:inline">Phase </span>3 (V3)
                        </span>
                      </div>
                      <div className="text-lg sm:text-2xl md:text-3xl font-telemetry font-bold text-slate-900 tracking-tight my-0.5 sm:my-1">
                        {v3Val !== null ? v3Val : "--"}
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                        Volts (V)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
