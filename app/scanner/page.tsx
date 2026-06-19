'use client';
import React, { useState } from 'react';
import { Terminal, Play, Loader2, Search, Database } from 'lucide-react';
import { DealAnalyzer } from '../../components/DealAnalyzer';

export default function LiveScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);

  const startScan = async () => {
    setIsScanning(true);
    setLogs([]);
    setResults([]);
    
    // Simulate terminal logs for Phase 1 UI demo
    const mockLogs = [
      "Initializing DealerHunt Live Scanner...",
      "Spinning up Bright Data proxy network [US-Central]...",
      "Target acquired: Independent Dealers (50 sources)",
      "[AE Miami] Extracting VDP links...",
      "[AE Miami] Found 14 potential deals.",
      "Feeding links to AI Parsing Queue...",
      "[AI] Processing 2021 Ford F-150 Lariat...",
      "[AI] Valuation complete: Wholesale $44k | Ask $38.5k",
      "Arbitrage opportunity detected. Checking local database for scraped inventory..."
    ];

    for (let i = 0; i < mockLogs.length; i++) {
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
      setLogs(prev => [...prev, mockLogs[i]]);
    }

    // Fetch live data from Supabase (via Chrome Extension ingest)
    try {
      const res = await fetch('/api/deals', { cache: 'no-store' });
      const data = await res.json();
      
      const mappedResults = data.deals.map((v: any) => ({
        id: v.id,
        title: v.title,
        ask_price: Number(v.price),
        ai_wholesale_estimate: Number(v.est_retail_value || v.price + 4000),
        estimated_transport_cost: 500,
        estimated_repair_cost: Number(v.est_repair_cost || 0),
        location_city: (v.location || 'Dallas').split(',')[0],
        location_state: (v.location || ', TX').split(',')[1]?.trim() || 'TX',
        images: [v.image_url || 'https://images.unsplash.com/photo-1605816988015-4fa2c6cd6921?auto=format&fit=crop&q=80&w=800']
      }));
      
      setResults(mappedResults);
      setLogs(prev => [...prev, `Scan complete. ${mappedResults.length} deal(s) found from Chrome Extension sync.`]);
    } catch(err) {
      setLogs(prev => [...prev, `Scan error: Could not fetch deals.`]);
    }
    setIsScanning(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold flex items-center gap-3">
          <Search className="w-8 h-8 text-indigo-400" />
          Live Deal Scanner
        </h1>
        <p className="text-gray-400 mt-2">Scraping 18+ sources in real-time to find hidden arbitrage opportunities.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Controls & Terminal */}
        <div className="lg:col-span-1 space-y-6">
          <button 
            onClick={startScan}
            disabled={isScanning}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          >
            {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {isScanning ? 'SCANNING...' : 'SCAN NOW'}
          </button>

          <div className="bg-black/80 border border-white/10 rounded-xl p-4 font-mono text-xs text-green-400 h-[500px] overflow-y-auto shadow-inner relative">
            <div className="absolute top-4 right-4 text-white/20">
              <Terminal className="w-5 h-5" />
            </div>
            {logs.length === 0 && !isScanning && (
              <span className="text-gray-600">Awaiting scan command...</span>
            )}
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="animate-fade-in-up">
                  <span className="text-gray-500 mr-2">{'>'}</span>{log}
                </div>
              ))}
              {isScanning && (
                <div className="animate-pulse flex items-center mt-2">
                  <div className="w-2 h-4 bg-green-400" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Results Grid */}
        <div className="lg:col-span-2">
          {results.length === 0 && !isScanning && (
            <div className="h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl text-gray-500">
              <Database className="w-12 h-12 mb-4 opacity-50" />
              <p>Scan to reveal deals</p>
            </div>
          )}
          
          <div className="space-y-6">
            {results.map((res) => (
              <div key={res.id} className="bg-[#121217] border border-white/5 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-xl">
                <div className="md:w-1/3">
                  <img src={res.images[0]} alt={res.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-6 md:w-2/3 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">{res.title}</h3>
                    <p className="text-sm text-gray-400 mb-6">{res.location_city}, {res.location_state}</p>
                  </div>
                  
                  {/* Reuse the DealAnalyzer inline! */}
                  <DealAnalyzer 
                    askPrice={res.ask_price}
                    wholesaleEstimate={res.ai_wholesale_estimate}
                    baseTransportCost={res.estimated_transport_cost}
                    baseRepairCost={res.estimated_repair_cost}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
