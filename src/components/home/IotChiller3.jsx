import React, { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { app } from "../../firebase/firebase";
import { useMachineConfig } from "../../contexts/machineConfigContext";

const database = getDatabase(app);

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

const MachineTelemetryCard = ({ machine, locationName, latestRecord }) => {
  const [activeTab, setActiveTab] = useState("VLN"); // "VLN" | "VLL" | "I" | "VAF"
  const [vafSubTab, setVafSubTab] = useState("R"); // "R" | "Y" | "B"

  const v1Val = latestRecord?.v1 != null ? Number(latestRecord.v1).toFixed(2) : null;
  const v2Val = latestRecord?.v2 != null ? Number(latestRecord.v2).toFixed(2) : null;
  const v3Val = latestRecord?.v3 != null ? Number(latestRecord.v3).toFixed(2) : null;

  const ryVal = latestRecord?.ry != null ? Number(latestRecord.ry).toFixed(2) : null;
  const ybVal = latestRecord?.yb != null ? Number(latestRecord.yb).toFixed(2) : null;
  const brVal = latestRecord?.br != null ? Number(latestRecord.br).toFixed(2) : null;

  const i1Val = latestRecord?.i1 != null ? Number(latestRecord.i1).toFixed(2) : null;
  const i2Val = latestRecord?.i2 != null ? Number(latestRecord.i2).toFixed(2) : null;
  const i3Val = latestRecord?.i3 != null ? Number(latestRecord.i3).toFixed(2) : null;

  const kwhVal = latestRecord?.kwh != null ? Number(latestRecord.kwh).toFixed(2) : null;
  const freqVal = latestRecord?.frequency != null ? Number(latestRecord.frequency).toFixed(2) : null;

  // Average calculations
  const vlnVoltages = [v1Val, v2Val, v3Val].filter((v) => v !== null).map(Number);
  const avgVln =
    vlnVoltages.length > 0
      ? (vlnVoltages.reduce((a, b) => a + b, 0) / vlnVoltages.length).toFixed(1)
      : null;

  const vllVoltages = [ryVal, ybVal, brVal].filter((v) => v !== null).map(Number);
  const avgVll =
    vllVoltages.length > 0
      ? (vllVoltages.reduce((a, b) => a + b, 0) / vllVoltages.length).toFixed(1)
      : null;

  const currents = [i1Val, i2Val, i3Val].filter((i) => i !== null).map(Number);
  const avgCurrent =
    currents.length > 0
      ? (currents.reduce((a, b) => a + b, 0) / currents.length).toFixed(2)
      : null;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 p-4 sm:p-6 lg:p-7 flex flex-col justify-between overflow-hidden relative group">
      {/* Decorative Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-green-500"></div>

      {/* 1. Header: Machine ID, Location Name, Online Badge, Timestamp in Single Line */}
      <div className="flex flex-row items-center justify-between gap-1.5 sm:gap-3 pb-2.5 sm:pb-4 border-b border-slate-100">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <div className="px-2 sm:px-3.5 py-0.5 sm:py-1 rounded-md sm:rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-brand font-black text-[11px] sm:text-sm tracking-wider shadow-sm shadow-emerald-500/20 shrink-0">
            {machine}
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <h2 className="text-xs sm:text-base lg:text-lg font-bold text-slate-900 leading-tight truncate">
              {locationName}
            </h2>
            <div className="flex items-center gap-1 shrink-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[9px] font-semibold text-emerald-700 uppercase sm:hidden">
                Live
              </span>
              <span className="hidden sm:inline text-[10px] sm:text-[11px] font-semibold text-emerald-700 tracking-wide uppercase">
                Live Active
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-slate-500 bg-slate-50 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-xl border border-slate-200/60 shrink-0">
          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium whitespace-nowrap">
            {latestRecord ? formatTS(latestRecord.ts) : "No data"}
          </span>
        </div>
      </div>

      {/* 2. Hero Energy Card (1. KWH & 2. Frequency - Column layout on mobile) */}
      <div className="my-3 sm:my-4 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none"></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 relative z-10">
          {/* Address: KWH */}
          <div className="flex flex-col justify-between pb-2.5 sm:pb-0 sm:pr-3 border-b sm:border-b-0 sm:border-r border-white/10">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-400/30">
                KWH
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                Active Energy
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl sm:text-3xl font-telemetry font-bold tracking-tight text-white">
                {kwhVal !== null ? kwhVal : "--"}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-emerald-300 uppercase">kWh</span>
            </div>
          </div>

          {/* Address: Frequency */}
          <div className="flex flex-col justify-between pt-0.5 sm:pt-0 sm:pl-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-teal-500/25 text-teal-300 border border-teal-400/30">
                Frequency
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-teal-300">
                Grid Frequency
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl sm:text-3xl font-telemetry font-bold tracking-tight text-white">
                {freqVal !== null ? freqVal : "--"}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-teal-300 uppercase">Hz</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Navigation Tabs: [ VLN ] [ VLL ] [ I ] [ VAF ] */}
      <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 rounded-xl mb-3.5 border border-slate-200/80">
        {[
          { id: "VLN", label: "VLN", sub: "R, Y, B" },
          { id: "VLL", label: "VLL", sub: "RY, YB, BR" },
          { id: "I", label: "I", sub: "I1, I2, I3" },
          { id: "VAF", label: "VAF", sub: "V · A · F" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 sm:py-2 px-1.5 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all duration-200 flex flex-col items-center justify-center cursor-pointer ${
              activeTab === tab.id
                ? "bg-emerald-700 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[9px] font-medium leading-none mt-0.5 hidden sm:inline ${
                activeTab === tab.id ? "text-emerald-100" : "text-slate-400"
              }`}
            >
              {tab.sub}
            </span>
          </button>
        ))}
      </div>

      {/* 4. Tab Panels */}
      {/* 4A. TAB: VLN (R, Y, B) */}
      {activeTab === "VLN" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Phase Voltages (Line to Neutral)
              </span>
              <span className="text-[9px] font-mono text-slate-400 font-medium">
                [R, Y, B]
              </span>
            </div>
            {avgVln && (
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                Avg: <strong className="text-slate-800 font-telemetry font-bold">{avgVln} V</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {/* R */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-rose-300 transition-all text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  R
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                  Phase R
                </span>
              </div>
              <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                {v1Val !== null ? v1Val : "--"}
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                Volts (V)
              </div>
            </div>

            {/* Y */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-amber-300 transition-all text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Y
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                  Phase Y
                </span>
              </div>
              <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                {v2Val !== null ? v2Val : "--"}
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                Volts (V)
              </div>
            </div>

            {/* B */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  B
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                  Phase B
                </span>
              </div>
              <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                {v3Val !== null ? v3Val : "--"}
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                Volts (V)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4B. TAB: VLL (RY, YB, BR) */}
      {activeTab === "VLL" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Line-to-Line Voltages
              </span>
              <span className="text-[9px] font-mono text-slate-400 font-medium">
                [RY, YB, BR]
              </span>
            </div>
            {avgVll && (
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                Avg: <strong className="text-slate-800 font-telemetry font-bold">{avgVll} V</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {/* RY */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-indigo-300 transition-all text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  RY
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                  Line R-Y
                </span>
              </div>
              <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                {ryVal !== null ? ryVal : "--"}
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                Volts (V)
              </div>
            </div>

            {/* YB */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-indigo-300 transition-all text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  YB
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                  Line Y-B
                </span>
              </div>
              <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                {ybVal !== null ? ybVal : "--"}
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                Volts (V)
              </div>
            </div>

            {/* BR */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-indigo-300 transition-all text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  BR
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                  Line B-R
                </span>
              </div>
              <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                {brVal !== null ? brVal : "--"}
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                Volts (V)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4C. TAB: I (I1, I2, I3) */}
      {activeTab === "I" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Phase Currents
              </span>
              <span className="text-[9px] font-mono text-slate-400 font-medium">
                [I1, I2, I3]
              </span>
            </div>
            {avgCurrent && (
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                Avg: <strong className="text-slate-800 font-telemetry font-bold">{avgCurrent} A</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {/* I1 */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-teal-300 transition-all text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                  I1
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                  Current R
                </span>
              </div>
              <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                {i1Val !== null ? i1Val : "--"}
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                Amps (A)
              </div>
            </div>

            {/* I2 */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-teal-300 transition-all text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                  I2
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                  Current Y
                </span>
              </div>
              <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                {i2Val !== null ? i2Val : "--"}
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                Amps (A)
              </div>
            </div>

            {/* I3 */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-teal-300 transition-all text-center flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                  I3
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                  Current B
                </span>
              </div>
              <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                {i3Val !== null ? i3Val : "--"}
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                Amps (A)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4D. TAB: VAF (Volt - Amp - Frequency) with Sub-tabs: R, Y, B */}
      {activeTab === "VAF" && (
        <div>
          {/* Sub-tab header selector for R, Y, B */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              VAF by Phase
            </span>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
              {[
                { id: "R", label: "R Phase", color: "bg-rose-600" },
                { id: "Y", label: "Y Phase", color: "bg-amber-500" },
                { id: "B", label: "B Phase", color: "bg-blue-600" },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setVafSubTab(sub.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide transition-all cursor-pointer ${
                    vafSubTab === sub.id
                      ? `${sub.color} text-white shadow-xs`
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-tab R: R (Volt), I1 (Amp), Frequency */}
          {vafSubTab === "R" && (
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {/* Volt R */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-rose-300 transition-all text-center flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                  <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    R
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                    Voltage
                  </span>
                </div>
                <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                  {v1Val !== null ? v1Val : "--"}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                  Volts (V)
                </div>
              </div>

              {/* Amp I1 */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-teal-300 transition-all text-center flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                    I1
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                    Current
                  </span>
                </div>
                <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                  {i1Val !== null ? i1Val : "--"}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                  Amps (A)
                </div>
              </div>

              {/* Frequency */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-emerald-300 transition-all text-center flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Freq
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                    Frequency
                  </span>
                </div>
                <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                  {freqVal !== null ? freqVal : "--"}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                  Hertz (Hz)
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab Y: Y (Volt), I2 (Amp), Frequency */}
          {vafSubTab === "Y" && (
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {/* Volt Y */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-amber-300 transition-all text-center flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    Y
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                    Voltage
                  </span>
                </div>
                <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                  {v2Val !== null ? v2Val : "--"}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                  Volts (V)
                </div>
              </div>

              {/* Amp I2 */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-teal-300 transition-all text-center flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                    I2
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                    Current
                  </span>
                </div>
                <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                  {i2Val !== null ? i2Val : "--"}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                  Amps (A)
                </div>
              </div>

              {/* Frequency */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-emerald-300 transition-all text-center flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Freq
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                    Frequency
                  </span>
                </div>
                <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                  {freqVal !== null ? freqVal : "--"}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                  Hertz (Hz)
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab B: B (Volt), I3 (Amp), Frequency */}
          {vafSubTab === "B" && (
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {/* Volt B */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all text-center flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                  <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    B
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                    Voltage
                  </span>
                </div>
                <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                  {v3Val !== null ? v3Val : "--"}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                  Volts (V)
                </div>
              </div>

              {/* Amp I3 */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-teal-300 transition-all text-center flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                    I3
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                    Current
                  </span>
                </div>
                <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                  {i3Val !== null ? i3Val : "--"}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                  Amps (A)
                </div>
              </div>

              {/* Frequency */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-emerald-300 transition-all text-center flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span className="text-[9px] font-mono font-black px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Freq
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">
                    Frequency
                  </span>
                </div>
                <div className="text-base sm:text-xl font-telemetry font-bold text-slate-900 my-0.5">
                  {freqVal !== null ? freqVal : "--"}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                  Hertz (Hz)
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const Iot_chiller = ({ searchQuery = "" }) => {
  const { getCategoryConfig } = useMachineConfig();
  const { allowedNumbers, machineNames } = getCategoryConfig("power_meters");

  const [machineKeys, setMachineKeys] = useState([]);
  const [allMachineData, setAllMachineData] = useState({});

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
      // Listen to the machine node directly to support both /{machine} and /{machine}/read structures
      const machineRef = ref(database, `/${machine}`);
      const unsubRead = onValue(machineRef, (snapshot) => {
        const rawNode = snapshot.val();
        if (!rawNode) return;

        // Support data located at /{machine}/read or directly under /{machine}
        const raw =
          rawNode.read !== undefined && typeof rawNode.read === "object"
            ? rawNode.read
            : rawNode;

        const isDirectTelemetry = (obj) =>
          obj &&
          typeof obj === "object" &&
          (obj.R !== undefined ||
            obj.r !== undefined ||
            obj.Y !== undefined ||
            obj.y !== undefined ||
            obj.B !== undefined ||
            obj.b !== undefined ||
            obj.BR !== undefined ||
            obj.RY !== undefined ||
            obj.YB !== undefined ||
            obj.I1 !== undefined ||
            obj.I2 !== undefined ||
            obj.I3 !== undefined ||
            obj.V1 !== undefined ||
            obj.v1 !== undefined ||
            obj.V_0 !== undefined ||
            obj.KWH !== undefined ||
            obj.kwh !== undefined ||
            obj.Frequency !== undefined ||
            obj.values !== undefined);

        // Normalize device data into an array of items
        let rawItems = [];
        if (isDirectTelemetry(raw)) {
          rawItems = [raw];
        } else if (Array.isArray(raw)) {
          rawItems = raw;
        } else if (typeof raw === "object") {
          const firstKey = Object.keys(raw)[0];
          const firstVal = raw[firstKey];
          if (Array.isArray(firstVal)) {
            rawItems = firstVal;
          } else if (firstVal && typeof firstVal === "object" && isDirectTelemetry(firstVal)) {
            rawItems = Object.values(raw);
          } else if (firstVal && typeof firstVal === "object") {
            const nestedVals = Object.values(firstVal);
            rawItems = nestedVals.length > 0 ? nestedVals : Object.values(raw);
          } else {
            rawItems = [raw];
          }
        }

        const records = rawItems
          .map((item) => {
            if (!item || typeof item !== "object") return null;

            const ts = item.ts ?? item.timestamp ?? item.time ?? null;
            const values =
              item.values && typeof item.values === "object" ? item.values : item;

            let v1 = null;
            let v2 = null;
            let v3 = null;

            if (values) {
              // 1. Check R, Y, B (3-Phase color standard: Red, Yellow, Blue from energy meters)
              if (
                values.R !== undefined ||
                values.r !== undefined ||
                values.Y !== undefined ||
                values.y !== undefined ||
                values.B !== undefined ||
                values.b !== undefined
              ) {
                v1 = values.R ?? values.r ?? null;
                v2 = values.Y ?? values.y ?? null;
                v3 = values.B ?? values.b ?? null;
              }
              // 2. Check 0-indexed voltages (V_0, V_1, V_2 or V0, V1, V2)
              else if (
                values.V_0 !== undefined ||
                values.v_0 !== undefined ||
                values.V0 !== undefined ||
                values.v0 !== undefined
              ) {
                v1 = values.V_0 ?? values.v_0 ?? values.V0 ?? values.v0;
                v2 = values.V_1 ?? values.v_1 ?? values.V1 ?? values.v1;
                v3 = values.V_2 ?? values.v_2 ?? values.V2 ?? values.v2;
              }
              // 3. Check 1-indexed voltages (V1, V2, V3 or V_1, V_2, V_3)
              else {
                v1 = values.V1 ?? values.v1 ?? values.V_1 ?? values.v_1 ?? null;
                v2 = values.V2 ?? values.v2 ?? values.V_2 ?? values.v_2 ?? null;
                v3 = values.V3 ?? values.v3 ?? values.V_3 ?? values.v_3 ?? null;
              }
            }

            const kwh =
              values?.KWH ?? values?.kwh ?? values?.kWh ?? values?.Kwh ?? values?.energy ?? null;

            const frequency =
              values?.Frequency ?? values?.frequency ?? values?.freq ?? values?.Freq ?? null;

            const ry = values?.RY ?? values?.ry ?? values?.Ry ?? null;
            const yb = values?.YB ?? values?.yb ?? values?.Yb ?? null;
            const br = values?.BR ?? values?.br ?? values?.Br ?? null;

            const i1 = values?.I1 ?? values?.i1 ?? values?.I_1 ?? null;
            const i2 = values?.I2 ?? values?.i2 ?? values?.I_2 ?? null;
            const i3 = values?.I3 ?? values?.i3 ?? values?.I_3 ?? null;

            return {
              ts,
              v1,
              v2,
              v3,
              kwh,
              frequency,
              ry,
              yb,
              br,
              i1,
              i2,
              i3,
            };
          })
          .filter(Boolean);

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

            return (
              <MachineTelemetryCard
                key={machine}
                machine={machine}
                locationName={locationName}
                latestRecord={latestRecord}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
