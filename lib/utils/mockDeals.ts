export interface MockDeal {
  id: string
  year: number
  make: string
  model: string
  trim?: string
  price: number
  mmr: number
  mileage: number
  vin: string
  source: string
  damage?: string
  title: string
  location: string
  image?: string
  postedAt: string
  profit: number
  roi: number
  score: number
  hot?: boolean
}

export const MOCK_DEALS: MockDeal[] = [
  {
    id: '1',
    year: 2021,
    make: 'Ford',
    model: 'F-150',
    trim: 'Lariat 4x4',
    price: 38500,
    mmr: 44200,
    mileage: 34200,
    vin: '1FTFW1E51MFA12345',
    source: 'Copart',
    damage: 'Hail',
    title: 'Clean',
    location: 'Dallas, TX',
    postedAt: '2h ago',
    profit: 5700,
    roi: 14.8,
    score: 82,
    hot: true,
  },
  {
    id: '2',
    year: 2019,
    make: 'Toyota',
    model: 'Tacoma',
    trim: 'TRD Off-Road',
    price: 29000,
    mmr: 33500,
    mileage: 48000,
    vin: '3TMCZ5AN9KM123456',
    source: 'IAAI',
    damage: 'Minor front',
    title: 'Clean',
    location: 'Phoenix, AZ',
    postedAt: '4h ago',
    profit: 4500,
    roi: 15.5,
    score: 78,
  },
  {
    id: '3',
    year: 2022,
    make: 'Tesla',
    model: 'Model 3',
    trim: 'Long Range',
    price: 31000,
    mmr: 37200,
    mileage: 22000,
    vin: '5YJ3E1EA1PF123456',
    source: 'Facebook',
    damage: 'Clean',
    title: 'Clean',
    location: 'Austin, TX',
    postedAt: '6h ago',
    profit: 6200,
    roi: 20.0,
    score: 88,
    hot: true,
  },
  {
    id: '4',
    year: 2020,
    make: 'Chevrolet',
    model: 'Silverado',
    trim: 'LT Crew Cab',
    price: 34500,
    mmr: 39800,
    mileage: 56000,
    vin: '3GCUYDED9LG123456',
    source: 'Copart',
    damage: 'Rear',
    title: 'Clean',
    location: 'Houston, TX',
    postedAt: '8h ago',
    profit: 5300,
    roi: 15.4,
    score: 74,
  },
  {
    id: '5',
    year: 2018,
    make: 'Honda',
    model: 'Civic',
    trim: 'Si',
    price: 18500,
    mmr: 22400,
    mileage: 41000,
    vin: '2HGFC3A53JH123456',
    source: 'AutoTrader',
    damage: 'Clean',
    title: 'Clean',
    location: 'Miami, FL',
    postedAt: '12h ago',
    profit: 3900,
    roi: 21.1,
    score: 71,
  },
  {
    id: '6',
    year: 2021,
    make: 'RAM',
    model: '1500',
    trim: 'Laramie',
    price: 41200,
    mmr: 46800,
    mileage: 29000,
    vin: '1C6SRFHT2MN123456',
    source: 'IAAI',
    damage: 'Side',
    title: 'Rebuilt',
    location: 'Denver, CO',
    postedAt: '1d ago',
    profit: 5600,
    roi: 13.6,
    score: 68,
  },
]
