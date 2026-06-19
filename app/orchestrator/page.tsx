import React from 'react';
import { SOURCES } from '../../lib/scrapers/orchestrator';

export default function OrchestratorDashboard() {
  // Simulate some stats for the dashboard
  const stats = {
    totalVehiclesFound24h: 12450,
    totalPartsFound24h: 8900,
    activeProxies: 42,
    bannedProxies: 3,
    estimatedApiCost: 14.50
  };

  return (
    <div className="min-h-screen bg-[#0E0F13] text-[#E8ECF2] p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header with Speed Line */}
        <div className="mb-8 border-b border-[#1F2228] pb-6 relative">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#E8961A] to-transparent"></div>
          <div className="mt-4 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Scraper Orchestration Engine</h1>
              <p className="text-sm text-gray-400">Monitoring {SOURCES.length} stealth scrapers across vehicles and parts.</p>
            </div>
            <button className="bg-[#E8961A] hover:bg-[#c77f15] text-[#0E0F13] px-6 py-2 rounded font-bold transition-colors shadow-[0_0_15px_rgba(232,150,26,0.2)]">
              Force Run All Now
            </button>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-[#16181E] p-5 rounded-lg border border-[#1F2228]">
            <div className="text-sm text-gray-400 mb-1">Vehicles Found (24h)</div>
            <div className="text-2xl font-bold font-mono text-white">{stats.totalVehiclesFound24h.toLocaleString()}</div>
          </div>
          <div className="bg-[#16181E] p-5 rounded-lg border border-[#1F2228]">
            <div className="text-sm text-gray-400 mb-1">Parts Found (24h)</div>
            <div className="text-2xl font-bold font-mono text-white">{stats.totalPartsFound24h.toLocaleString()}</div>
          </div>
          <div className="bg-[#16181E] p-5 rounded-lg border border-[#1F2228]">
            <div className="text-sm text-gray-400 mb-1">Active Proxies</div>
            <div className="text-2xl font-bold font-mono text-green-500">{stats.activeProxies}</div>
          </div>
          <div className="bg-[#16181E] p-5 rounded-lg border border-[#1F2228]">
            <div className="text-sm text-gray-400 mb-1">Banned IPs (24h)</div>
            <div className="text-2xl font-bold font-mono text-red-500">{stats.bannedProxies}</div>
          </div>
          <div className="bg-[#16181E] p-5 rounded-lg border border-[#1F2228]">
            <div className="text-sm text-gray-400 mb-1">Est. Scraping Cost</div>
            <div className="text-2xl font-bold font-mono text-white">${stats.estimatedApiCost.toFixed(2)}</div>
          </div>
        </div>

        {/* Source Matrix */}
        <h2 className="text-xl font-bold text-white mb-4">Source Matrix & Schedule</h2>
        <div className="bg-[#16181E] border border-[#1F2228] rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0E0F13] text-gray-400 text-xs uppercase tracking-wider">
                <th className="p-4 border-b border-[#1F2228]">Source Name</th>
                <th className="p-4 border-b border-[#1F2228]">Type</th>
                <th className="p-4 border-b border-[#1F2228]">Priority</th>
                <th className="p-4 border-b border-[#1F2228]">Frequency</th>
                <th className="p-4 border-b border-[#1F2228]">Stealth Required</th>
                <th className="p-4 border-b border-[#1F2228] text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2228] text-sm">
              {SOURCES.map(source => (
                <tr key={source.id} className="hover:bg-[#1F2228] transition-colors">
                  <td className="p-4 font-medium text-white">{source.name}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${source.type === 'vehicle' ? 'bg-blue-900/30 text-blue-400' : 'bg-purple-900/30 text-purple-400'}`}>
                      {source.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      source.priority === 'high' ? 'bg-red-900/30 text-red-400' :
                      source.priority === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {source.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-gray-300">Every {source.frequencyMinutes}m</td>
                  <td className="p-4">
                    {source.stealthRequired ? (
                      <span className="flex items-center text-orange-400">
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Yes
                      </span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <span className="flex items-center justify-end text-green-500">
                      <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                      Healthy
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
