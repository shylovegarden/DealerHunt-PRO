'use client';

import React, { useState } from 'react';
import { DealAnalyzer } from './DealAnalyzer';

// Replace with actual generated types later
interface VehicleCardProps {
  listing: {
    image_url?: string;
    title?: string;
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    ask_price?: number;
    price_mmr?: number;
    vin?: string;
    mileage?: number;
    damage_type?: string;
    title_status?: string;
    source_id?: string;
  };
}

export default function VehicleCard({ listing }: VehicleCardProps) {
  const [showAnalyzer, setShowAnalyzer] = useState(false);

  // We fallback to 0 if not provided
  const purchasePrice = Number(listing.ask_price) || 0;
  const auctionFee = purchasePrice * 0.1; // Estimate 10% fee
  const transportCost = 450; // Flat estimate
  const mmrValue = Number(listing.price_mmr) || purchasePrice * 1.4; // Estimate 40% markup if MMR is missing

  const projectedProfit = mmrValue - (purchasePrice + auctionFee + transportCost);
  const profitColor = projectedProfit > 0 ? 'text-[#10B981]' : 'text-[#EF4444]';

  return (
    <div className="bg-[#111115] border border-[rgba(255,255,255,.06)] rounded-2xl overflow-hidden hover:border-[rgba(245,158,11,.22)] transition-colors">
      <div className="flex flex-col md:flex-row">
        {/* Left: Image */}
        <div className="md:w-1/3 h-48 md:h-auto bg-[#0C0C0F] relative border-b md:border-b-0 md:border-r border-[rgba(255,255,255,.06)]">
          {listing.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-[#62627A] font-mono text-sm">
              NO IMAGE
            </div>
          )}
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-xs px-2 py-1 rounded text-[#FAFAFA] font-mono uppercase border border-[rgba(255,255,255,.10)]">
            {listing.source_id || 'UNKNOWN SOURCE'}
          </div>
        </div>

        {/* Right: Info */}
        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-bold text-[#FAFAFA] truncate">
                {listing.year} {listing.make} {listing.model} {listing.trim}
              </h2>
              <div className="text-right">
                <div className="text-xl font-mono text-[#FAFAFA]">${purchasePrice.toLocaleString()}</div>
                <div className="text-xs text-[#62627A] uppercase">Ask Price</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm font-mono text-[#9898A8]">
              <div>
                <span className="block text-xs text-[#62627A] uppercase">VIN</span>
                {listing.vin || 'N/A'}
              </div>
              <div>
                <span className="block text-xs text-[#62627A] uppercase">Mileage</span>
                {listing.mileage ? `${listing.mileage.toLocaleString()} mi` : 'N/A'}
              </div>
              <div>
                <span className="block text-xs text-[#62627A] uppercase">Damage</span>
                {listing.damage_type || 'None Reported'}
              </div>
              <div>
                <span className="block text-xs text-[#62627A] uppercase">Status</span>
                <span className="capitalize">{listing.title_status || 'Clean'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[rgba(255,255,255,.06)]">
            <div>
              <div className="text-xs text-[#62627A] uppercase">Est. Profit (As-Is)</div>
              <div className={`text-lg font-bold font-mono ${profitColor}`}>
                {projectedProfit > 0 ? '+' : ''}${Math.round(projectedProfit).toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => setShowAnalyzer(!showAnalyzer)}
              className="bg-[#18181D] hover:bg-[#F59E0B] hover:text-[#07070A] text-[#FAFAFA] px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              {showAnalyzer ? 'Close Analyzer' : 'Deal Analyzer'}
            </button>
          </div>
        </div>
      </div>

      {/* Deal Analyzer Dropdown */}
      {showAnalyzer && (
        <div className="border-t border-[rgba(255,255,255,.06)] bg-[#0C0C0F] p-1">
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
