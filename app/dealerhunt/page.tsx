'use client'

import React, { useState, useEffect } from 'react'
import { 
  ResponsiveContainer, 
  AdaptiveGrid, 
  SmartCard, 
  SmartNav, 
  SmartModal, 
  SmartList, 
  SmartTable,
  useResponsive 
} from '@/components/ui/responsive-design-system'

// Real data interfaces
interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  price: number
  profit: number
  source: string
  mileage: string
  image: string
  hot: boolean
  vin: string
  location?: string
  condition?: string
  auctionEnd?: string
  bidCount?: number
}

interface Dealer {
  id: string
  name: string
  city: string
  state: string
  listings: number
  avgPrice: number
  avgProfit: number
  score: number
  type: string
  coordinates: [number, number]
  rating?: number
  phone?: string
  website?: string
}

export default function DealerHuntPage() {
  const { isMobile, isTablet, isDesktop, isWide } = useResponsive()
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [scrapingStatus, setScrapingStatus] = useState('idle')
  const [arbitrageOpportunities, setArbitrageOpportunities] = useState([])
  const [teardownAnalysis, setTeardownAnalysis] = useState(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Navigation items with responsive labels
  const navItems = [
    {
      id: 'dashboard',
      label: isMobile ? 'Home' : 'Dashboard',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>,
      badge: vehicles.filter(v => v.hot).length,
      onClick: () => setActiveScreen('dashboard')
    },
    {
      id: 'scanner',
      label: isMobile ? 'Scan' : 'Scanner',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>,
      onClick: () => setActiveScreen('scanner')
    },
    {
      id: 'arbitrage',
      label: isMobile ? 'Arbitrage' : 'Geographic Arbitrage',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>,
      onClick: () => setActiveScreen('arbitrage')
    },
    {
      id: 'parts',
      label: isMobile ? 'Parts' : 'Parts Calculator',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>,
      onClick: () => setActiveScreen('parts')
    },
    {
      id: 'dealers',
      label: isMobile ? 'Dealers' : 'Dealers',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>,
      onClick: () => setActiveScreen('dealers')
    },
    {
      id: 'profile',
      label: isMobile ? 'Profile' : 'Profile',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>,
      onClick: () => setActiveScreen('profile')
    }
  ]

  // Fetch real data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch vehicles
        const listingsResponse = await fetch('/api/listings?limit=20&sortBy=scrapedAt&sortOrder=desc')
        if (listingsResponse.ok) {
          const listingsData = await listingsResponse.json()
          const vehiclesData = listingsData.listings.map((item: any) => ({
            id: item.id,
            make: item.make || 'Unknown',
            model: item.model || 'Unknown',
            year: item.year || new Date().getFullYear(),
            price: item.price,
            profit: item.profit_score ? Math.round(item.price * (item.profit_score / 100)) : 0,
            source: item.source,
            mileage: item.mileage ? `${Math.round(item.mileage / 1000)}k` : 'Unknown',
            image: getVehicleImage(item.make, item.type),
            hot: item.profit_score && item.profit_score > 70,
            vin: item.vin || 'Unknown',
            location: item.location,
            condition: item.condition,
            auctionEnd: item.auction_end,
            bidCount: item.bid_count
          }))
          setVehicles(vehiclesData)
        } else {
          throw new Error('Failed to fetch listings')
        }
        
        // Fetch dealers
        const dealersResponse = await fetch('/api/dealers?limit=20&sortBy=score')
        if (dealersResponse.ok) {
          const dealersData = await dealersResponse.json()
          const formattedDealers = dealersData.dealers.map((item: any) => ({
            id: item.id,
            name: item.name,
            city: item.city,
            state: item.state,
            listings: item.total_listings,
            avgPrice: item.avg_price,
            avgProfit: item.profit_potential ? Math.round(item.profit_potential) : 0,
            score: item.deal_score,
            type: item.type,
            coordinates: item.coordinates,
            rating: item.rating,
            phone: item.phone,
            website: item.website
          }))
          setDealers(formattedDealers)
        } else {
          throw new Error('Failed to fetch dealers')
        }
        
      } catch (error) {
        console.error('Error fetching data:', error)
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])
  
  // Check scraping status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/scrape?status=true')
        const data = await response.json()
        setScrapingStatus(data.status)
      } catch (error) {
        console.error('Error checking scraping status:', error)
      }
    }
    
    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [])
  
  // Helper function to get vehicle emoji based on make/type
  const getVehicleImage = (make: string, type: string): string => {
    const makeLower = make.toLowerCase()
    if (makeLower.includes('tesla')) return '⚡'
    if (makeLower.includes('ford') || makeLower.includes('chevy') || makeLower.includes('chevrolet')) return '🚙'
    if (makeLower.includes('toyota') || makeLower.includes('honda') || makeLower.includes('nissan')) return '🚗'
    if (makeLower.includes('bmw') || makeLower.includes('mercedes') || makeLower.includes('audi')) return '🏎️'
    if (type === 'salvage' || type === 'parts') return '🔩'
    return '🚘'
  }

  // Start scraping
  const startScraping = async () => {
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: ['copart', 'iaa', 'facebook-marketplace'] })
      })
      const data = await response.json()
      console.log('Scraping started:', data)
    } catch (error) {
      console.error('Error starting scraping:', error)
    }
  }

  // Calculate arbitrage opportunities
  const calculateArbitrage = async (vehicle: any) => {
    try {
      const response = await fetch('/api/geographic/arbitrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          vehicle: {
            ...vehicle,
            sourceState: 'FL',
            sourceCity: 'Miami'
          },
          action: 'opportunities'
        })
      })
      const data = await response.json()
      setArbitrageOpportunities(data.slice(0, 5))
    } catch (error) {
      console.error('Error calculating arbitrage:', error)
    }
  }

  // Calculate tear-down analysis
  const calculateTearDown = async (vehicle: any) => {
    try {
      const response = await fetch('/api/parts/teardown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          vehicleInfo: {
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            purchasePrice: vehicle.price,
            condition: 'clean'
          },
          analysisType: 'teardown'
        })
      })
      const data = await response.json()
      setTeardownAnalysis(data)
    } catch (error) {
      console.error('Error calculating tear-down:', error)
    }
  }

  // Filter vehicles based on search and type
  const filteredVehicles = vehicles.filter((vehicle: Vehicle) => {
    const matchesSearch = vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vehicle.source.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = filterType === 'all' || 
                         (filterType === 'hot' && vehicle.hot) ||
                         (filterType === 'profit' && vehicle.profit > 5000)
    
    return matchesSearch && matchesFilter
  })

  // Render different screens based on selection
  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <DashboardScreen vehicles={filteredVehicles} dealers={dealers} />
      case 'scanner':
        return <ScannerScreen scrapingStatus={scrapingStatus} onStartScraping={startScraping} />
      case 'arbitrage':
        return <ArbitrageScreen opportunities={arbitrageOpportunities} onCalculate={calculateArbitrage} />
      case 'parts':
        return <PartsScreen analysis={teardownAnalysis} onCalculate={calculateTearDown} />
      case 'dealers':
        return <DealersScreen dealers={dealers} />
      case 'profile':
        return <ProfileScreen />
      default:
        return <DashboardScreen vehicles={filteredVehicles} dealers={dealers} />
    }
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">DH</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {isMobile ? 'DealerHunt' : 'DealerHunt Intelligence'}
              </h1>
            </div>
            
            {/* Search bar - responsive */}
            <div className="flex items-center space-x-2">
              {isDesktop && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search vehicles, dealers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              )}
              
              {/* Filter dropdown */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Vehicles</option>
                <option value="hot">Hot Deals</option>
                <option value="profit">High Profit</option>
              </select>
            </div>
          </div>
          
          {/* Mobile search */}
          {isMobile && (
            <div className="mt-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search vehicles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {renderScreen()}
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      {isMobile && (
        <SmartNav
          items={navItems}
          variant="bottom"
          activeId={activeScreen}
        />
      )}

      {/* Side Navigation - Desktop */}
      {isDesktop && (
        <SmartNav
          items={navItems}
          variant="sidebar"
          activeId={activeScreen}
          className="fixed left-0 top-16 w-64 h-full bg-white border-r border-gray-200"
        />
      )}

      {/* Vehicle Detail Modal */}
      <SmartModal
        isOpen={!!selectedVehicle}
        onClose={() => setSelectedVehicle(null)}
        size={isMobile ? 'full' : 'lg'}
        position={isMobile ? 'bottom' : 'center'}
      >
        {selectedVehicle && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
              </h2>
              <button
                onClick={() => setSelectedVehicle(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="text-4xl">{selectedVehicle.image}</div>
                <div>
                  <p className="text-gray-600">Source: {selectedVehicle.source}</p>
                  <p className="text-gray-600">Mileage: {selectedVehicle.mileage}</p>
                  <p className="text-gray-600">VIN: {selectedVehicle.vin}</p>
                  <p className="text-gray-600">Hot Deal: {selectedVehicle.hot ? 'Yes' : 'No'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <SmartCard variant="elevated">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Ask Price</p>
                    <p className="text-2xl font-bold text-blue-600">${selectedVehicle.price.toLocaleString()}</p>
                  </div>
                </SmartCard>
                <SmartCard variant="elevated">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Est. Profit</p>
                    <p className="text-2xl font-bold text-green-600">+${selectedVehicle.profit.toLocaleString()}</p>
                  </div>
                </SmartCard>
              </div>
              
              <div className="flex space-x-3">
                <button 
                  onClick={() => calculateArbitrage(selectedVehicle)}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Calculate Arbitrage
                </button>
                <button 
                  onClick={() => calculateTearDown(selectedVehicle)}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Parts Analysis
                </button>
              </div>
            </div>
          </div>
        )}
      </SmartModal>
    </div>
  )
}

// Dashboard Screen Component
function DashboardScreen({ vehicles, dealers }: { vehicles: any[], dealers: any[] }) {
  const { isMobile, isTablet, isDesktop } = useResponsive()

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <AdaptiveGrid cols={{ mobile: 2, tablet: 3, desktop: 4 }}>
        <SmartCard variant="elevated">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Vehicles</p>
            <p className="text-2xl font-bold text-gray-900">{vehicles.length}</p>
          </div>
        </SmartCard>
        <SmartCard variant="elevated">
          <div className="text-center">
            <p className="text-sm text-gray-600">Hot Deals</p>
            <p className="text-2xl font-bold text-red-600">{vehicles.filter(v => v.hot).length}</p>
          </div>
        </SmartCard>
        <SmartCard variant="elevated">
          <div className="text-center">
            <p className="text-sm text-gray-600">Avg Profit</p>
            <p className="text-2xl font-bold text-green-600">
              ${Math.round(vehicles.reduce((sum, v) => sum + v.profit, 0) / vehicles.length).toLocaleString()}
            </p>
          </div>
        </SmartCard>
        <SmartCard variant="elevated">
          <div className="text-center">
            <p className="text-sm text-gray-600">Active Dealers</p>
            <p className="text-2xl font-bold text-blue-600">{dealers.length}</p>
          </div>
        </SmartCard>
      </AdaptiveGrid>

      {/* Recent Vehicles */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Vehicles</h2>
        <AdaptiveGrid cols={{ mobile: 1, tablet: 2, desktop: 3 }}>
          {vehicles.slice(0, 6).map((vehicle) => (
            <SmartCard
              key={vehicle.id}
              hover={true}
              press={true}
              onClick={() => {/* Handle vehicle selection */}}
            >
              <div className="flex items-start space-x-3">
                <div className="text-3xl">{vehicle.image}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h3>
                  <p className="text-sm text-gray-600">{vehicle.source}</p>
                  <p className="text-sm text-gray-600">{vehicle.mileage} mi</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-blue-600">
                      ${vehicle.price.toLocaleString()}
                    </span>
                    <span className="text-sm font-medium text-green-600">
                      +${vehicle.profit.toLocaleString()}
                    </span>
                  </div>
                  {vehicle.hot && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                      🔥 Hot Deal
                    </span>
                  )}
                </div>
              </div>
            </SmartCard>
          ))}
        </AdaptiveGrid>
      </div>

      {/* Top Dealers */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Dealers</h2>
        <SmartList
          items={dealers.map(dealer => ({
            id: dealer.id,
            title: dealer.name,
            subtitle: `${dealer.city}, ${dealer.state} • ${dealer.listings} listings`,
            badge: dealer.score + '/100',
            onClick: () => {/* Handle dealer selection */}
          }))}
          variant={isMobile ? 'cards' : 'list'}
        />
      </div>
    </div>
  )
}

// Scanner Screen Component
function ScannerScreen({ scrapingStatus, onStartScraping }: { scrapingStatus: string, onStartScraping: () => void }) {
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const { isMobile } = useResponsive()

  const startScan = () => {
    setIsScanning(true)
    setScanProgress(0)
    onStartScraping()
    
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsScanning(false)
          return 100
        }
        return prev + 10
      })
    }, 500)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Vehicle Scanner</h2>
        <p className="text-gray-600">Scan multiple sources for profitable vehicles</p>
      </div>

      {/* Scanner Interface */}
      <SmartCard variant="elevated" className="p-8">
        <div className="text-center space-y-6">
          <div className="w-32 h-32 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${scrapingStatus === 'active' ? 'bg-green-500' : scrapingStatus === 'error' ? 'bg-red-500' : 'bg-gray-300'}`}></div>
            <span className="text-sm text-gray-600">
              Status: {scrapingStatus === 'active' ? 'Scanning...' : scrapingStatus === 'error' ? 'Error' : 'Idle'}
            </span>
          </div>
          
          {isScanning || scrapingStatus === 'active' ? (
            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-gray-600">Scanning... {scanProgress}%</p>
              <p className="text-sm text-gray-500">
                Checking Copart, IAA, ADESA, Facebook Marketplace...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={startScan}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Start Scan
              </button>
              <p className="text-sm text-gray-500">
                Scan 18+ sources for profitable vehicles
              </p>
            </div>
          )}
        </div>
      </SmartCard>
    </div>
  )
}

// Arbitrage Screen Component
function ArbitrageScreen({ opportunities, onCalculate }: { opportunities: any[], onCalculate: (vehicle: any) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Geographic Arbitrage</h2>
        <p className="text-gray-600">Find profit opportunities across different regions</p>
      </div>

      {opportunities.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Arbitrage Opportunities</h3>
          {opportunities.map((opp, index) => (
            <SmartCard key={index} variant="outlined">
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {opp.sourceRegion.city} → {opp.targetRegion.city}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {opp.arbitrage.distance} miles • {opp.targetRegion.state}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      +${opp.arbitrage.potentialProfit.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      {opp.arbitrage.profitMargin}% margin
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Source Price</p>
                    <p className="font-medium">${opp.arbitrage.sourcePrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Target Price</p>
                    <p className="font-medium">${opp.arbitrage.targetPrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Transport Cost</p>
                    <p className="font-medium">${opp.arbitrage.transportCost.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      opp.arbitrage.riskScore < 30 ? 'bg-green-100 text-green-800' :
                      opp.arbitrage.riskScore < 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      Risk: {opp.arbitrage.riskScore}/100
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      opp.marketFactors.targetDemand === 'high' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      Demand: {opp.marketFactors.targetDemand}
                    </span>
                  </div>
                </div>
              </div>
            </SmartCard>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p>Select a vehicle to calculate arbitrage opportunities</p>
          <p className="text-sm">Go to Dashboard and click on any vehicle</p>
        </div>
      )}
    </div>
  )
}

// Parts Screen Component
function PartsScreen({ analysis, onCalculate }: { analysis: any, onCalculate: (vehicle: any) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Parts Calculator</h2>
        <p className="text-gray-600">Analyze tear-down profit potential</p>
      </div>

      {analysis ? (
        <div className="space-y-6">
          {/* Summary */}
          <SmartCard variant="elevated">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tear-Down Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Total Part Value</p>
                  <p className="text-xl font-bold text-green-600">
                    ${analysis.summary.totalPartValue.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Removal Cost</p>
                  <p className="text-xl font-bold text-red-600">
                    -${analysis.summary.totalRemovalCost.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Net Profit</p>
                  <p className="text-xl font-bold text-blue-600">
                    ${analysis.summary.netProfit.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">ROI</p>
                  <p className="text-xl font-bold text-purple-600">
                    {analysis.summary.roi}%
                  </p>
                </div>
              </div>
            </div>
          </SmartCard>

          {/* Top Parts */}
          <SmartCard variant="outlined">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">High-Value Parts</h3>
              <div className="space-y-3">
                {analysis.parts
                  .sort((a: any, b: any) => b.estimatedValue - a.estimatedValue)
                  .slice(0, 5)
                  .map((part: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{part.name}</p>
                        <p className="text-sm text-gray-600">{part.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">${part.estimatedValue.toLocaleString()}</p>
                        <p className="text-sm text-gray-600">{part.removalTime}h removal</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </SmartCard>

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <SmartCard variant="outlined">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
                <div className="space-y-2">
                  {analysis.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="flex items-start space-x-2">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-gray-700">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SmartCard>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p>Select a vehicle to analyze parts potential</p>
          <p className="text-sm">Go to Dashboard and click on any vehicle</p>
        </div>
      )}
    </div>
  )
}

// Dealers Screen Component
function DealersScreen({ dealers }: { dealers: any[] }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dealer Network</h2>
        <p className="text-gray-600">Discover dealers across all 50 states</p>
      </div>

      <SmartList
        items={dealers.map(dealer => ({
          id: dealer.id,
          title: dealer.name,
          subtitle: `${dealer.city}, ${dealer.state} • ${dealer.listings} listings • Avg: $${dealer.avgPrice.toLocaleString()}`,
          badge: `${dealer.score}/100`,
          onClick: () => {/* Handle dealer selection */}
        }))}
        variant="cards"
      />
    </div>
  )
}

// Profile Screen Component
function ProfileScreen() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
      
      <SmartCard variant="elevated" className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xl font-bold">JD</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">John Dealer</h3>
            <p className="text-gray-600">Premium Member</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Member Since</span>
            <span className="font-medium">Jan 2024</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Vehicles Found</span>
            <span className="font-medium">247</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Profit</span>
            <span className="font-medium text-green-600">$892,450</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Success Rate</span>
            <span className="font-medium">94%</span>
          </div>
        </div>
      </SmartCard>
      
      <div className="space-y-3">
        <button className="w-full bg-gray-100 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors">
          Account Settings
        </button>
        <button className="w-full bg-gray-100 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors">
          Notifications
        </button>
        <button className="w-full bg-gray-100 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors">
          Help & Support
        </button>
        <button className="w-full bg-red-100 text-red-800 py-3 rounded-lg font-medium hover:bg-red-200 transition-colors">
          Sign Out
        </button>
      </div>
    </div>
  )
}
