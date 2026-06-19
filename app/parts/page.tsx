'use client';
import React, { useState } from 'react';
import { Settings, Wrench, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';

export default function PartsTeardownCalculator() {
  const [salvageCost, setSalvageCost] = useState(6400);
  
  // Default values for a standard teardown
  const [parts, setParts] = useState([
    { id: 1, name: 'Complete Engine Assembly', value: 3500, selected: true },
    { id: 2, name: 'Transmission', value: 1800, selected: true },
    { id: 3, name: 'Catalytic Converter', value: 800, selected: true },
    { id: 4, name: 'Front Bumper Assembly', value: 450, selected: false }, // assuming front end damage
    { id: 5, name: 'Headlights (Pair)', value: 600, selected: false }, // assuming front end damage
    { id: 6, name: 'Doors (x4)', value: 1200, selected: true },
    { id: 7, name: 'Infotainment System', value: 450, selected: true },
    { id: 8, name: 'Seats & Interior Trim', value: 960, selected: true },
  ]);

  const totalPartsValue = parts.filter(p => p.selected).reduce((acc, p) => acc + p.value, 0);
  const netProfit = totalPartsValue - salvageCost;
  const roi = ((netProfit / salvageCost) * 100).toFixed(1);

  const togglePart = (id: number) => {
    setParts(parts.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-8 font-sans">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Wrench className="w-8 h-8 text-indigo-400" />
            Teardown ROI Calculator
          </h1>
          <p className="text-gray-400 mt-2">Calculate the hidden profit of parting out a salvage vehicle.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Cost Input & Results */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#121217] border border-white/10 rounded-2xl p-6 shadow-xl">
            <label className="block text-sm font-semibold text-gray-400 mb-2">Salvage Purchase Cost</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
              <input 
                type="number" 
                value={salvageCost}
                onChange={(e) => setSalvageCost(Number(e.target.value))}
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xl font-bold text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/80">Labor costs are excluded. Ensure you have the dismantling infrastructure or adjust margin accordingly.</p>
            </div>
          </div>

          {/* Results Card */}
          <div className="bg-gradient-to-b from-[#16181E] to-[#121217] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp className="w-24 h-24" />
            </div>
            
            <h3 className="text-gray-400 font-semibold mb-6">Estimated Recovery</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-white/5 pb-4">
                <span className="text-gray-400 text-sm">Total Parts Value</span>
                <span className="text-2xl font-bold text-white">${totalPartsValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b border-white/5 pb-4">
                <span className="text-gray-400 text-sm">Salvage Cost</span>
                <span className="text-xl font-semibold text-red-400">-${salvageCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-emerald-400 font-semibold flex items-center gap-2">
                  Net Profit
                </span>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-emerald-400">${netProfit.toLocaleString()}</div>
                  <div className="text-sm font-bold text-emerald-500/70">{roi}% ROI</div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" 
                style={{ width: `${Math.min(100, Math.max(0, (totalPartsValue / (salvageCost * 2)) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Parts List */}
        <div className="lg:col-span-2">
          <div className="bg-[#121217] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                Salvageable Components
              </h2>
              <span className="text-sm text-gray-400">Deselect damaged parts</span>
            </div>
            
            <div className="divide-y divide-white/5">
              {parts.map((part) => (
                <div 
                  key={part.id} 
                  onClick={() => togglePart(part.id)}
                  className={`p-4 flex items-center justify-between cursor-pointer transition-all ${part.selected ? 'hover:bg-white/5' : 'opacity-50 hover:opacity-70 bg-black/20'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${part.selected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-600'}`}>
                      {part.selected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className={`font-medium ${part.selected ? 'text-gray-200' : 'text-gray-500 line-through'}`}>{part.name}</span>
                  </div>
                  <span className={`font-bold ${part.selected ? 'text-white' : 'text-gray-600'}`}>${part.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-indigo-500/10 border-t border-indigo-500/20 text-center text-sm text-indigo-300 cursor-pointer hover:bg-indigo-500/20 transition-colors">
              + Add Custom Component
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
