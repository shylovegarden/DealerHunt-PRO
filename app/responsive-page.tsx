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

// Mock data for demonstration
const mockVehicles = [
  {
    id: '1',
    make: 'Ford',
    model: 'F-150 XLT',
    year: 2019,
    price: 14200,
    profit: 5200,
    source: 'ADESA Dallas',
    mileage: '78k',
    image: '🚙',
    hot: true
  },
  {
    id: '2', 
    make: 'Tesla',
    model: 'Model 3 LR',
    year: 2022,
    price: 21800,
    profit: 5700,
    source: 'Manheim National',
    mileage: '28k',
    image: '⚡',
    hot: false
  },
  {
    id: '3',
    make: 'Chevy',
    model: 'Silverado',
    year: 2018,
    price: 6400,
    profit: 5900,
    source: 'Copart Houston',
    mileage: '112k',
    image: '🔩',
    hot: true
  },
  {
    id: '4',
    make: 'Toyota',
    model: 'Camry SE',
    year: 2021,
    price: 16500,
    profit: 4700,
    source: 'FB Marketplace',
    mileage: '42k',
    image: '🚗',
    hot: false
  },
  {
    id: '5',
    make: 'Honda',
    model: 'Accord Sport',
    year: 2020,
    price: 15900,
    profit: 4200,
    source: 'Indi Dealer Chicago',
    mileage: '58k',
    image: '🚘',
    hot: false
  }
]

const mockDealers = [
  {
    id: '1',
    name: 'AE Miami 74 Auto',
    city: 'Miami',
    state: 'FL',
    listings: 74,
    avgPrice: 18500,
    avgProfit: 3200,
    score: 91,
    type: 'independent'
  },
  {
    id: '2',
    name: '111 Auto Resale',
    city: 'Houston',
    state: 'TX', 
    listings: 111,
    avgPrice: 14200,
    avgProfit: 2800,
    score: 88,
    type: 'independent'
  },
  {
    id: '3',
    name: 'STL Auction Pipeline',
    city: 'St. Louis',
    state: 'MO',
    listings: 89,
    avgPrice: 16800,
    avgProfit: 3100,
    score: 85,
    type: 'auction'
  }
]

export default function ResponsiveDealerHuntPage() {
  const { isMobile, isTablet, isDesktop, isWide } = useResponsive()
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  // Navigation items with responsive labels
  const navItems = [
    {
      id: 'dashboard',
      label: isMobile ? 'Home' : 'Dashboard',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>,
      badge: mockVehicles.filter(v => v.hot).length,
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
      id: 'watchlist',
      label: isMobile ? 'Watch' : 'Watchlist',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>,
      badge: mockVehicles.length,
      onClick: () => setActiveScreen('watchlist')
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

  // Filter vehicles based on search and type
  const filteredVehicles = mockVehicles.filter(vehicle => {
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
        return <DashboardScreen vehicles={filteredVehicles} dealers={mockDealers} />
      case 'scanner':
        return <ScannerScreen />
      case 'watchlist':
        return <WatchlistScreen vehicles={filteredVehicles} />
      case 'dealers':
        return <DealersScreen dealers={mockDealers} />
      case 'profile':
        return <ProfileScreen />
      default:
        return <DashboardScreen vehicles={filteredVehicles} dealers={mockDealers} />
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
                <button className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Add to Watchlist
                </button>
                <button className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors">
                  View Details
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
function ScannerScreen() {
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const { isMobile } = useResponsive()

  const startScan = () => {
    setIsScanning(true)
    setScanProgress(0)
    
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
          
          {isScanning ? (
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

      {/* Recent Scan Results */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Results</h3>
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No recent scans</p>
          <p className="text-sm">Start a scan to see results here</p>
        </div>
      </div>
    </div>
  )
}

// Watchlist Screen Component
function WatchlistScreen({ vehicles }: { vehicles: any[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Watchlist</h2>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          {vehicles.length} vehicles
        </span>
      </div>

      <SmartList
        items={vehicles.map(vehicle => ({
          id: vehicle.id,
          title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          subtitle: `${vehicle.source} • ${vehicle.mileage} mi`,
          icon: <span className="text-2xl">{vehicle.image}</span>,
          badge: `$${vehicle.profit.toLocaleString()}`,
          onClick: () => {/* Handle vehicle selection */}
        }))}
        variant="cards"
      />
    </div>
  )
}

// Dealers Screen Component
function DealersScreen({ dealers }: { dealers: any[] }) {
  const { isMobile } = useResponsive()

  const tableColumns = [
    { key: 'name', label: 'Dealer Name', sortable: true },
    { key: 'location', label: 'Location', sortable: true },
    { key: 'listings', label: 'Listings', sortable: true },
    { key: 'avgPrice', label: 'Avg Price', sortable: true },
    { key: 'avgProfit', label: 'Avg Profit', sortable: true },
    { key: 'score', label: 'Score', sortable: true }
  ]

  const tableData = dealers.map(dealer => ({
    ...dealer,
    location: `${dealer.city}, ${dealer.state}`,
    avgPrice: `$${dealer.avgPrice.toLocaleString()}`,
    avgProfit: `+$${dealer.avgProfit.toLocaleString()}`,
    score: `${dealer.score}/100`
  }))

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dealers</h2>

      <SmartTable
        columns={tableColumns}
        data={tableData}
        sortable={true}
        filterable={true}
        paginated={true}
        pageSize={isMobile ? 5 : 10}
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
