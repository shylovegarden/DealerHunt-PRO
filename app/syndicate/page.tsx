'use client';

import React, { useState } from 'react';
import { Megaphone, CheckCircle2, Circle, Loader2, Link as LinkIcon, Facebook, Car, FileText, Share2 } from 'lucide-react';

const inventory = [
  { id: '1', year: 2021, make: 'Ford', model: 'F-150 Lariat', vin: '1FT...9281', price: '$38,500', profit: '+$4,200' },
  { id: '2', year: 2019, make: 'Toyota', model: 'Tacoma TRD', vin: '3TM...9121', price: '$24,000', profit: '+$3,800' },
];

const platforms = [
  { id: 'fb', name: 'Facebook Marketplace', icon: Facebook, color: 'text-blue-500' },
  { id: 'at', name: 'AutoTrader', icon: Car, color: 'text-orange-500' },
  { id: 'cg', name: 'CarGurus', icon: Car, color: 'text-emerald-500' },
  { id: 'cars', name: 'Cars.com', icon: Car, color: 'text-purple-500' },
  { id: 'cl', name: 'Craigslist', icon: FileText, color: 'text-gray-400' },
];

export default function SyndicationPage() {
  const [selectedVehicle, setSelectedVehicle] = useState(inventory[0].id);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['fb', 'at', 'cg']);
  const [blastStatus, setBlastStatus] = useState<'idle' | 'blasting' | 'complete'>('idle');
  const [progress, setProgress] = useState<Record<string, 'pending' | 'loading' | 'success'>>({});

  const togglePlatform = (id: string) => {
    if (blastStatus !== 'idle') return;
    setSelectedPlatforms(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleBlast = async () => {
    if (selectedPlatforms.length === 0) return;
    
    setBlastStatus('blasting');
    const newProgress: Record<string, 'pending' | 'loading' | 'success'> = {};
    selectedPlatforms.forEach(p => newProgress[p] = 'pending');
    setProgress({ ...newProgress });

    // Sequential fake delay to simulate real-time API blasts
    for (const platformId of selectedPlatforms) {
      setProgress(prev => ({ ...prev, [platformId]: 'loading' }));
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 600)); // 0.8-1.4s per platform
      setProgress(prev => ({ ...prev, [platformId]: 'success' }));
    }

    setBlastStatus('complete');
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-24 md:pb-8">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-white/10 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter flex items-center gap-3">
            <Megaphone className="text-indigo-400 w-8 h-8" />
            Listing Syndication
          </h1>
          <p className="text-gray-400 mt-2 text-sm md:text-base">One-click blast to all major marketplaces.</p>
        </div>
        <div className="flex gap-4">
          <a href="/api/feed" target="_blank" className="text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 rounded px-3 py-2 flex items-center gap-2 transition-colors">
            <LinkIcon className="w-3 h-3" /> /api/feed.xml
          </a>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left Col: Vehicle Selection */}
        <div className="md:col-span-1 space-y-4">
          <h2 className="text-lg font-bold border-b border-white/5 pb-2">1. Select Inventory</h2>
          <div className="space-y-3">
            {inventory.map(car => (
              <div 
                key={car.id}
                onClick={() => blastStatus === 'idle' && setSelectedVehicle(car.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedVehicle === car.id 
                    ? 'border-indigo-500 bg-indigo-500/10' 
                    : 'border-white/10 bg-[#111113] hover:border-white/20'
                } ${blastStatus !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="font-bold">{car.year} {car.make} {car.model}</div>
                <div className="text-sm font-mono text-gray-400 mt-1">VIN: {car.vin}</div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                  <div className="text-sm font-bold text-white">{car.price}</div>
                  <div className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                    Est. {car.profit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Platforms & Action */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-bold border-b border-white/5 pb-2">2. Select Platforms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {platforms.map(platform => {
              const isSelected = selectedPlatforms.includes(platform.id);
              const pStatus = progress[platform.id];

              return (
                <div 
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                    blastStatus === 'idle' ? 'cursor-pointer hover:border-white/30' : 'cursor-default'
                  } ${isSelected ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10 bg-[#111113]'}`}
                >
                  <div className="flex items-center gap-3">
                    <platform.icon className={`w-5 h-5 ${platform.color}`} />
                    <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                      {platform.name}
                    </span>
                  </div>
                  
                  {blastStatus === 'idle' ? (
                    isSelected ? <CheckCircle2 className="text-indigo-500 w-5 h-5" /> : <Circle className="text-gray-600 w-5 h-5" />
                  ) : (
                    isSelected && (
                      pStatus === 'loading' ? <Loader2 className="text-indigo-400 w-5 h-5 animate-spin" /> :
                      pStatus === 'success' ? <CheckCircle2 className="text-emerald-500 w-5 h-5" /> :
                      <Circle className="text-gray-600 w-5 h-5" />
                    )
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-8 p-6 bg-gradient-to-br from-[#16161a] to-[#0a0a0c] border border-white/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Ready to Syndicate</h3>
              <p className="text-sm text-gray-400">
                Broadcasting to {selectedPlatforms.length} {selectedPlatforms.length === 1 ? 'platform' : 'platforms'}.
              </p>
            </div>
            
            {blastStatus === 'idle' && (
              <button 
                onClick={handleBlast}
                disabled={selectedPlatforms.length === 0}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                BLAST INVENTORY
              </button>
            )}

            {blastStatus === 'blasting' && (
              <div className="w-full sm:w-auto px-8 py-4 bg-indigo-600/50 text-white font-bold rounded-xl flex items-center justify-center gap-3 border border-indigo-500/50">
                <Loader2 className="w-5 h-5 animate-spin" />
                SYNDICATING...
              </div>
            )}

            {blastStatus === 'complete' && (
              <div className="w-full sm:w-auto px-8 py-4 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 font-bold rounded-xl flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                BLAST COMPLETE
              </div>
            )}
          </div>

          {blastStatus === 'complete' && (
             <div className="text-center pt-4">
               <button 
                 onClick={() => {
                   setBlastStatus('idle');
                   setProgress({});
                 }}
                 className="text-sm text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
               >
                 Syndicate Another Vehicle
               </button>
             </div>
          )}

        </div>
      </div>
    </div>
  );
}
