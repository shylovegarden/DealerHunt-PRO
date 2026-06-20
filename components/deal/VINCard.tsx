import React from 'react';
import { VINData } from '@/lib/api/vin';

export function VINCard({ vin, vinData }: { vin: string; vinData: VINData }) {
  return (
    <div style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--r3)', overflow:'hidden' }}>
      {/* Photo strip */}
      {vinData.photos.length > 0 && (
        <div style={{ display:'flex', gap:4, overflowX:'auto', padding:10 }}>
          {vinData.photos.slice(0,5).map((p, i) => (
            <img key={i} src={p} alt="Vehicle" style={{ height:80, width:130, objectFit:'cover', borderRadius:6, flexShrink:0 }} />
          ))}
        </div>
      )}
      
      {/* Core specs */}
      <div style={{ padding:'10px 13px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {[
          [vinData.year + ' ' + vinData.make + ' ' + vinData.model, 'Vehicle'],
          [vinData.trim || '—', 'Trim'],
          [vinData.bodyClass || '—', 'Body'],
          [vinData.engine || '—', 'Engine'],
          [vinData.driveType || '—', 'Drive'],
          [vinData.fuelType || '—', 'Fuel'],
          [vinData.transmission || '—', 'Trans'],
          [vinData.gvwr || '—', 'GVWR'],
          [vinData.plantCountry || '—', 'Built'],
        ].map(([v, l]) => (
          <div key={l as string} style={{ background:'var(--s3)', borderRadius:5, padding:'5px 8px' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--t2)', marginBottom:1 }}>{v}</div>
            <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:.04, color:'var(--t5)' }}>{l}</div>
          </div>
        ))}
      </div>
      
      {/* Safety + Recalls */}
      <div style={{ display:'flex', padding:'0 13px 10px', gap:8 }}>
        {vinData.safetyRating && (
          <div style={{ background:'var(--glo)', border:'1px solid var(--gbd)', borderRadius:6, padding:'5px 10px', fontSize:11 }}>
            ⭐ {vinData.safetyRating}/5 NCAP Safety
          </div>
        )}
        {vinData.recallCount > 0 && (
          <div style={{ background:'var(--rlo)', border:'1px solid var(--rbd)', borderRadius:6, padding:'5px 10px', fontSize:11, color:'var(--red)', fontWeight:600 }}>
            ⚠ {vinData.recallCount} Open Recall{vinData.recallCount !== 1 ? 's' : ''}
          </div>
        )}
        {(vinData.mpgCombined > 0) && (
          <div style={{ background:'var(--blo)', border:'1px solid var(--bbd)', borderRadius:6, padding:'5px 10px', fontSize:11 }}>
            {vinData.mpgCombined} MPG combined
          </div>
        )}
      </div>
    </div>
  );
}
