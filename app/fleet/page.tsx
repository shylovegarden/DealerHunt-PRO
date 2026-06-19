'use client';
import React, { useState } from 'react';
import { LayoutDashboard, Clock, DollarSign, AlertTriangle, Truck, Wrench, Tag } from 'lucide-react';

const FLOORPLAN_RATE = 0.08; // 8% APR

const INITIAL_FLEET = [
  { id: 1, title: '2021 Ford F-150', cost: 38500, daysOnLot: 4, status: 'transit', img: 'https://images.unsplash.com/photo-1605816988015-4fa2c6cd6921?auto=format&fit=crop&q=80&w=400' },
  { id: 2, title: '2019 Toyota Tacoma', cost: 24000, daysOnLot: 12, status: 'recon', img: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&q=80&w=400' },
  { id: 3, title: '2022 Honda Civic', cost: 18500, daysOnLot: 2, status: 'transit', img: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=400' },
  { id: 4, title: '2018 Jeep Wrangler', cost: 29000, daysOnLot: 32, status: 'listed', img: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=400' },
];

export default function FleetTracker() {
  const [fleet] = useState(INITIAL_FLEET);

  const getCarryingCost = (cost: number, days: number) => {
    return (cost * FLOORPLAN_RATE / 365) * days;
  };

  const columns = [
    { id: 'transit', title: 'In Transit', icon: <Truck className="w-5 h-5 text-blue-400" />, color: 'border-blue-500/30 bg-blue-500/5' },
    { id: 'recon', title: 'In Recon', icon: <Wrench className="w-5 h-5 text-amber-400" />, color: 'border-amber-500/30 bg-amber-500/5' },
    { id: 'listed', title: 'Listed Active', icon: <Tag className="w-5 h-5 text-emerald-400" />, color: 'border-emerald-500/30 bg-emerald-500/5' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-8 font-sans overflow-x-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-indigo-400" />
            Fleet & Recon Tracker
          </h1>
          <p className="text-gray-400 mt-2">Monitor floorplan bleeding costs and pipeline velocity.</p>
        </div>
      </header>

      <div className="flex gap-6 min-w-max">
        {columns.map(col => (
          <div key={col.id} className={`w-96 rounded-2xl border ${col.color} flex flex-col h-[calc(100vh-160px)]`}>
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
              <h2 className="font-bold flex items-center gap-2">
                {col.icon}
                {col.title}
              </h2>
              <span className="bg-white/10 text-xs px-2 py-1 rounded-full font-bold">
                {fleet.filter(f => f.status === col.id).length}
              </span>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {fleet.filter(f => f.status === col.id).map(vehicle => {
                const bleed = getCarryingCost(vehicle.cost, vehicle.daysOnLot);
                const isWarning = vehicle.daysOnLot > 30;
                
                return (
                  <div key={vehicle.id} className="bg-[#16181E] border border-white/10 rounded-xl overflow-hidden shadow-lg hover:border-indigo-500/50 transition-colors cursor-pointer group">
                    <div className="h-32 overflow-hidden relative">
                      <img src={vehicle.img} alt={vehicle.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 text-xs font-bold flex items-center gap-1">
                        <Clock className={`w-3 h-3 ${isWarning ? 'text-red-400' : 'text-gray-400'}`} />
                        <span className={isWarning ? 'text-red-400' : 'text-gray-200'}>{vehicle.daysOnLot} Days</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold mb-1 truncate">{vehicle.title}</h3>
                      <div className="text-sm text-gray-500 mb-4 font-mono">Cost: ${vehicle.cost.toLocaleString()}</div>
                      
                      <div className={`p-3 rounded-lg flex items-center justify-between ${isWarning ? 'bg-red-500/10 border border-red-500/20' : 'bg-black/40 border border-white/5'}`}>
                        <div className="flex items-center gap-1.5">
                          {isWarning ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <DollarSign className="w-4 h-4 text-gray-400" />}
                          <span className={`text-xs font-semibold ${isWarning ? 'text-red-400' : 'text-gray-400'}`}>Floorplan Bleed</span>
                        </div>
                        <span className={`font-bold ${isWarning ? 'text-red-400' : 'text-gray-300'}`}>-${bleed.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
