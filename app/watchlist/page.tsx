'use client';

import React, { useState } from 'react';
import { Bell, TrendingDown, Clock, Trash2, ExternalLink, Star, Plus } from 'lucide-react';

const MOCK_WATCHLIST = [
  {
    id: 'w1',
    title: '2021 Ford F-150 Lariat 4x4',
    ask_price: 38500,
    profit_estimate: 5500,
    source_url: '#',
    source: 'Facebook Marketplace',
    image_url: 'https://images.unsplash.com/photo-1605816988015-4fa2c6cd6921?auto=format&fit=crop&q=80&w=800',
    auction_end_at: new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString(), // Ending in 1.5h
    price_drop: -1200,
    notes: 'Clean title, one owner. Needs detail only.',
  },
  {
    id: 'w2',
    title: '2019 Toyota Tacoma TRD Off-Road',
    ask_price: 29000,
    profit_estimate: 4500,
    source_url: '#',
    source: 'Copart',
    image_url: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&q=80&w=800',
    auction_end_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Ending in 24h
    price_drop: 0,
    notes: '',
  },
  {
    id: 'w3',
    title: '2022 Tesla Model 3 Long Range',
    ask_price: 31000,
    profit_estimate: 3000,
    source_url: '#',
    source: 'Craigslist',
    image_url: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&q=80&w=800',
    auction_end_at: null,
    price_drop: -800,
    notes: '',
  },
];

type Tab = 'all' | 'price_drops' | 'ending_soon';

export default function WatchlistPage() {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [watchlist, setWatchlist] = useState(MOCK_WATCHLIST);

  const isEndingSoon = (isoDate: string | null) => {
    if (!isoDate) return false;
    return new Date(isoDate) < new Date(Date.now() + 2 * 60 * 60 * 1000);
  };

  const timeUntil = (isoDate: string | null) => {
    if (!isoDate) return null;
    const diff = new Date(isoDate).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const filtered = watchlist.filter(item => {
    if (activeTab === 'price_drops') return item.price_drop < 0;
    if (activeTab === 'ending_soon') return isEndingSoon(item.auction_end_at);
    return true;
  });

  const removeItem = (id: string) => setWatchlist(prev => prev.filter(w => w.id !== id));

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All Saved', count: watchlist.length },
    { id: 'price_drops', label: 'Price Drops', count: watchlist.filter(w => w.price_drop < 0).length },
    { id: 'ending_soon', label: 'Ending Soon', count: watchlist.filter(w => isEndingSoon(w.auction_end_at)).length },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24 md:pb-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter flex items-center gap-3">
            <Star className="text-amber-400 w-8 h-8" />
            Watchlist
          </h1>
          <p className="text-gray-400 mt-1 text-sm">Track listings and get price-drop alerts.</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-4 py-2">
          <Bell className="w-4 h-4 text-indigo-400" />
          <span className="text-sm text-indigo-300 font-medium">Alerts Active</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            <span className={`ml-2 px-1.5 py-0.5 rounded-md text-xs font-bold ${activeTab === tab.id ? 'bg-white/20' : 'bg-white/5'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="py-24 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl text-center text-gray-500">
            <Star className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-semibold">Nothing here yet</p>
            <p className="text-sm mt-1">Save deals from the scanner to track them here.</p>
          </div>
        )}

        {filtered.map(item => {
          const ending = isEndingSoon(item.auction_end_at);
          const countdown = timeUntil(item.auction_end_at);
          
          return (
            <div key={item.id} className="bg-[#111113] border border-white/10 rounded-2xl overflow-hidden flex flex-col sm:flex-row hover:border-white/20 transition-colors group">
              <div className="sm:w-48 h-40 sm:h-auto relative overflow-hidden flex-shrink-0">
                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#111113]/40 sm:block hidden" />
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur text-[10px] font-bold uppercase px-2 py-1 rounded text-gray-300 border border-white/10">
                  {item.source}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <h3 className="font-bold text-lg">{item.title}</h3>
                    <div className="flex gap-2 flex-wrap">
                      {item.price_drop < 0 && (
                        <span className="text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-full flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" />
                          ${Math.abs(item.price_drop).toLocaleString()} Drop
                        </span>
                      )}
                      {ending && countdown && (
                        <span className="text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {countdown} left
                        </span>
                      )}
                    </div>
                  </div>

                  {item.notes && (
                    <p className="text-sm text-gray-400 italic mb-3">"{item.notes}"</p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2">
                  <div className="flex gap-6">
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-semibold mb-0.5">Ask Price</div>
                      <div className="text-xl font-bold font-mono">${item.ask_price.toLocaleString()}</div>
                    </div>
                    {item.profit_estimate > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-semibold mb-0.5">Est. Profit</div>
                        <div className="text-xl font-bold font-mono text-emerald-400">+${item.profit_estimate.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
