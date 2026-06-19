'use client';
import React, { useState } from 'react';
import { Map as MapIcon, Navigation, TrendingUp, AlertCircle } from 'lucide-react';

// Mock deals for the map
const ARBITRAGE_DEALS = [
  { id: 1, title: '2021 Ford F-150', city: 'Dallas', state: 'TX', x: 45, y: 70, profit: 4200, status: 'hot' },
  { id: 2, title: '2019 Toyota Tacoma', city: 'Miami', state: 'FL', x: 75, y: 85, profit: 3100, status: 'warm' },
  { id: 3, title: '2022 Honda Civic', city: 'Seattle', state: 'WA', x: 10, y: 15, profit: 2800, status: 'warm' },
  { id: 4, title: '2018 Jeep Wrangler', city: 'Denver', state: 'CO', x: 30, y: 45, profit: 5500, status: 'hot' },
];

export default function ArbitrageMap() {
  const [selectedDeal, setSelectedDeal] = useState(ARBITRAGE_DEALS[0]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-8 font-sans">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <MapIcon className="w-8 h-8 text-indigo-400" />
            National Arbitrage Map
          </h1>
          <p className="text-gray-400 mt-2">Visualizing cross-state profit margins in real-time.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: The Map */}
        <div className="lg:col-span-3 bg-[#121217] border border-white/10 rounded-2xl p-6 shadow-xl relative min-h-[600px] flex items-center justify-center overflow-hidden">
          {/* Simulated Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

          {ARBITRAGE_DEALS.map(deal => (
            <button
              key={deal.id}
              onClick={() => setSelectedDeal(deal)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 group transition-all`}
              style={{ left: `${deal.x}%`, top: `${deal.y}%` }}
            >
              {/* Glowing Pulse */}
              <div className={`absolute -inset-4 rounded-full blur-md opacity-40 group-hover:opacity-100 transition-opacity animate-pulse ${deal.status === 'hot' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
              {/* Core Marker */}
              <div className={`relative w-4 h-4 rounded-full border-2 border-[#121217] shadow-[0_0_15px_rgba(0,0,0,0.5)] ${deal.status === 'hot' ? 'bg-emerald-400' : 'bg-indigo-400'} ${selectedDeal.id === deal.id ? 'scale-150 ring-2 ring-white/50' : ''} transition-transform`}></div>
              
              {/* Tooltip */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm border border-white/10 rounded px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                <p className="text-xs font-bold text-white">{deal.city}, {deal.state}</p>
                <p className="text-xs text-emerald-400 font-semibold">+${deal.profit.toLocaleString()}</p>
              </div>
            </button>
          ))}
          
          <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]"></div>
              <span className="text-gray-300">High Arbitrage (+$4k)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-400 shadow-[0_0_10px_#818cf8]"></div>
              <span className="text-gray-300">Standard Margin</span>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Deal Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-b from-[#16181E] to-[#121217] border border-white/10 rounded-2xl p-6 shadow-2xl h-full">
            <h3 className="text-gray-400 font-semibold mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
              <Navigation className="w-4 h-4 text-indigo-400" />
              Target Acquisition
            </h3>
            
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{selectedDeal.title}</h2>
                <p className="text-gray-400 flex items-center gap-1.5">
                  <MapIcon className="w-4 h-4" />
                  {selectedDeal.city}, {selectedDeal.state}
                </p>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-sm text-emerald-500/80 mb-1 font-semibold">Projected Net Profit</p>
                <div className="text-4xl font-extrabold text-emerald-400 flex items-center gap-2">
                  <TrendingUp className="w-8 h-8" />
                  ${selectedDeal.profit.toLocaleString()}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/5 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Source</span>
                  <span className="text-gray-200">Independent Dealer</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Est. Transport (to HQ)</span>
                  <span className="text-red-400">-$850</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Demand Score</span>
                  <span className="text-indigo-400 font-bold">High (92/100)</span>
                </div>
              </div>

              <button className="w-full mt-8 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-colors shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                Analyze Full Deal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
