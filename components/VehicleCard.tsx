'use client';

import React, { useState } from 'react';
import { DealAnalyzer } from './DealAnalyzer';

// Replace with actual generated types later
type Listing = any;

interface VehicleCardProps {
  listing: Listing;
}

export default function VehicleCard({ listing }: VehicleCardProps) {
  const [showAnalyzer, setShowAnalyzer] = useState(false);

  // We fallback to 0 if not provided
  const purchasePrice = Number(listing.ask_price) || 0;
  const auctionFee = purchasePrice * 0.1; // Estimate 10% fee
  const transportCost = 450; // Flat estimate
  const mmrValue = Number(listing.price_mmr) || purchasePrice * 1.4; // Estimate 40% markup if MMR is missing

  const projectedProfit = mmrValue - (purchasePrice + auctionFee + transportCost);
  const profitColor = projectedProfit > 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="bg-[#16181E] border border-[#1F2228] rounded-xl overflow-hidden hover:border-[#E8961A]/50 transition-colors">
      <div className="flex flex-col md:flex-row">
        
        {/* Left: Image */}
        <div className="md:w-1/3 h-48 md:h-auto bg-[#0E0F13] relative border-b md:border-b-0 md:border-r border-[#1F2228]">
          {listing.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-gray-600 font-mono text-sm">
              NO IMAGE
            </div>
          )}
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-xs px-2 py-1 rounded text-white font-mono uppercase border border-white/10">
            {listing.source_id || 'UNKNOWN SOURCE'}
          </div>
        </div>

        {/* Right: Info */}
        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-bold text-white font-sans truncate">
                {listing.year} {listing.make} {listing.model} {listing.trim}
              </h2>
              <div className="text-right">
                <div className="text-xl font-mono text-white">${purchasePrice.toLocaleString()}</div>
                <div className="text-xs text-gray-500 font-sans uppercase">Ask Price</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm font-mono text-gray-400">
              <div>
                <span className="block text-xs text-gray-500 font-sans uppercase">VIN</span>
                {listing.vin || 'N/A'}
              </div>
              <div>
                <span className="block text-xs text-gray-500 font-sans uppercase">Mileage</span>
                {listing.mileage ? `${listing.mileage.toLocaleString()} mi` : 'N/A'}
              </div>
              <div>
                <span className="block text-xs text-gray-500 font-sans uppercase">Damage</span>
                {listing.damage_type || 'None Reported'}
              </div>
              <div>
                <span className="block text-xs text-gray-500 font-sans uppercase">Status</span>
                <span className="capitalize">{listing.title_status || 'Clean'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1F2228]">
            <div>
              <div className="text-xs text-gray-500 font-sans uppercase">Est. Profit (As-Is)</div>
              <div className={`text-lg font-bold font-mono ${profitColor}`}>
                {projectedProfit > 0 ? '+' : ''}${Math.round(projectedProfit).toLocaleString()}
              </div>
            </div>
            <button 
              onClick={() => setShowAnalyzer(!showAnalyzer)}
              className="bg-[#1F2228] hover:bg-[#E8961A] text-white hover:text-[#0E0F13] px-4 py-2 rounded text-sm font-bold transition-colors"
            >
              {showAnalyzer ? 'Close Analyzer' : 'Deal Analyzer'}
            </button>
          </div>
        </div>
      </div>

      {/* Deal Analyzer Dropdown */}
      {showAnalyzer && (
        <div className="border-t border-[#1F2228] bg-[#0E0F13] p-1">
          <DealAnalyzer 
            askPrice={purchasePrice}
            wholesaleEstimate={mmrValue}
            baseTransportCost={transportCost}
            baseRepairCost={auctionFee}
          />
        </div>
      )}
    </div>
  );
}
