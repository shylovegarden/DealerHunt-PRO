export const FREE_TOOLS = {
  
  // ── VIN DECODE ──────────────────────────────────────────────
  
  VIN_MCP: {
    name: 'mcp.vin',
    url: 'https://mcp.vin/api/vin/{VIN}',
    github: 'github.com/keptlive/vin-mcp',
    cost: 'FREE forever',
    auth: 'None',
    rateLimit: '30 req/min',
    returns: 'NHTSA + Recalls + Safety Ratings + EPA MPG + Complaints + Photos',
    batch: 'POST https://mcp.vin/api/batch — up to 50 VINs',
    selfHost: true,
    priority: 1, // Use this first
  },
  
  NHTSA_VIN: {
    name: 'NHTSA vPIC',
    url: 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json',
    cost: 'FREE, government API',
    auth: 'None',
    rateLimit: 'No official limit (be reasonable)',
    returns: '140+ fields — make, model, year, trim, engine, body, drivetrain',
    priority: 2, // Fallback
  },
  
  NHTSA_RECALLS: {
    name: 'NHTSA Recalls',
    url: 'https://api.nhtsa.gov/recalls/recallsByVehicle?make={make}&model={model}&modelYear={year}',
    cost: 'FREE',
    auth: 'None',
    returns: 'Open NHTSA recall campaigns with remedy details',
    priority: 1,
  },
  
  NHTSA_SAFETY: {
    name: 'NHTSA Safety Ratings',
    url: 'https://api.nhtsa.gov/SafetyRatings/modelyear/{year}/make/{make}/model/{model}',
    cost: 'FREE',
    auth: 'None',
    returns: 'NCAP crash test star ratings (overall, frontal, side, rollover)',
    priority: 1,
  },
  
  NHTSA_COMPLAINTS: {
    name: 'NHTSA Complaints',
    url: 'https://api.nhtsa.gov/complaints/complaintsByVehicle?make={make}&model={model}&modelYear={year}',
    cost: 'FREE',
    auth: 'None',
    returns: 'Consumer complaints with crash/fire/injury/death stats',
    priority: 1,
  },
  
  EPA_FUEL: {
    name: 'EPA Fuel Economy',
    url: 'https://www.fueleconomy.gov/ws/rest/vehicle/menu/options?year={year}&make={make}&model={model}',
    cost: 'FREE, government API',
    auth: 'None',
    returns: 'City/hwy/combined MPG, annual fuel cost, CO2 emissions, EV range',
    priority: 1,
  },
  
  CARDOG_SDK: {
    name: 'Cardog API',
    url: 'https://api.cardog.app',
    docs: 'docs.cardog.app',
    install: 'npm install @cardog/sdk',
    cost: '100 free/month, then pay-as-you-go',
    auth: 'API key (free signup)',
    returns: 'VIN + recalls + market pricing + Canada support + MCP server',
    bonus: 'Has native MCP server for Cursor/Windsurf/Claude integration',
    priority: 3, // Use as premium upgrade path
  },
  
  CARSTAT: {
    name: 'Carstat API',
    url: 'https://carstat.app',
    cost: 'Free tier available',
    auth: 'Bearer token (free signup)',
    returns: 'VIN decode + specs + recalls + crash tests via REST or MCP',
    bonus: 'Native MCP server works with Cursor, Windsurf, ChatGPT',
    priority: 3,
  },
  
  // ── PROXY & BYPASS ──────────────────────────────────────────
  
  FLARESOLVERR: {
    name: 'FlareSolverr',
    github: 'github.com/FlareSolverr/FlareSolverr',
    cost: 'FREE, MIT license',
    deploy: 'docker run -d -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest',
    use: 'Cloudflare bypass for Copart, Facebook, ADESA',
    priority: 1,
  },
  
  PATCHRIGHT: {
    name: 'Patchright',
    github: 'github.com/Kaliiiiiiiiii-Vinyzu/patchright',
    install: 'npm install patchright',
    cost: 'FREE, Apache 2.0',
    use: 'Drop-in Playwright replacement, patches Chromium fingerprint leaks',
    priority: 1,
  },
  
  CAMOUFOX: {
    name: 'Camoufox',
    github: 'github.com/daijro/camoufox',
    install: 'npx camoufox@latest install',
    cost: 'FREE, MIT',
    use: 'Stealth Firefox — 0% detection score in CreepJS tests',
    best: 'Sites that specifically detect Chromium (Facebook, some finance sites)',
    priority: 1,
  },
  
  FREE_PROXIES: {
    name: 'TheSpeedX Proxy List',
    github: 'github.com/TheSpeedX/PROXY-List',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    cost: 'FREE, updated every 24hr',
    use: 'Free proxy rotation for Craigslist, IAA, Cars.com',
    note: 'Test proxies before use, ~30% work at any given time',
    priority: 1,
  },
  
  SCRAPOXY: {
    name: 'Scrapoxy',
    github: 'github.com/scrapoxy/scrapoxy',
    cost: 'FREE, MIT, 2.2k stars',
    use: 'Self-hosted proxy orchestrator — rotates IPs automatically',
    priority: 2,
  },
  
  FLARE_BYPASSER: {
    name: 'FlareBypasser',
    github: 'github.com/yoori/flarebypasser',
    cost: 'FREE, MIT',
    use: 'Post-October 2024 Cloudflare bypass (newer than FlareSolverr)',
    priority: 2,
  },
  
  CAPSOLVER: {
    name: 'CapSolver',
    url: 'capsolver.com',
    cost: '1,000 free CAPTCHA solves/day',
    use: 'When Cloudflare escalates to CAPTCHA (Copart sometimes does this)',
    priority: 2,
  },
  
  // ── SCRAPING ────────────────────────────────────────────────
  
  CHEERIO: {
    name: 'Cheerio',
    install: 'npm install cheerio',
    cost: 'FREE, MIT',
    use: 'Static HTML parsing — IAA, Craigslist, Cars.com, CarGurus, eBay',
    speed: '200-500ms per page, very fast',
    priority: 1,
  },
  
  BULLMQ: {
    name: 'BullMQ',
    install: 'npm install bullmq',
    cost: 'FREE, MIT',
    use: 'Job queue for scraper scheduling',
    note: 'Already in codebase — just needs worker running',
    priority: 1,
  },
  
  // ── MAPS & DISTANCE ─────────────────────────────────────────
  
  LEAFLET: {
    name: 'Leaflet + OpenStreetMap',
    install: 'npm install leaflet react-leaflet',
    cost: 'FREE, BSD',
    use: 'Dealer map, already in codebase',
    note: 'No API key, no usage limits',
    priority: 1,
  },
  
  OSRM: {
    name: 'OSRM (Open Source Routing Machine)',
    url: 'https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}',
    cost: 'FREE, no auth',
    use: 'Actual driving distance between two cities for transport quotes',
    priority: 2,
  },
  
  // ── DATABASE & BACKEND ──────────────────────────────────────
  
  SUPABASE: {
    name: 'Supabase',
    url: 'supabase.com',
    cost: 'FREE — 50k MAU, 500MB, 2 projects',
    use: 'Already in codebase — PostgreSQL + Auth + Storage + Realtime',
    priority: 1,
  },
  
  UPSTASH_REDIS: {
    name: 'Upstash Redis',
    url: 'upstash.com',
    cost: 'FREE — 10k req/day, 256MB',
    use: 'BullMQ queue backend',
    priority: 1,
  },
  
  VERCEL: {
    name: 'Vercel',
    url: 'vercel.com',
    cost: 'FREE — 100GB bandwidth, unlimited deploys',
    use: 'Frontend hosting, already configured',
    priority: 1,
  },
  
  RAILWAY: {
    name: 'Railway.app',
    url: 'railway.app',
    cost: 'FREE — $5 credit/month = ~500 hours',
    use: 'Scraper workers, FlareSolverr deployment',
    priority: 1,
  },
};
