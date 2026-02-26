/**
 * agent/observe.ts
 * 
 * Fetches all external data the agent needs to make decisions.
 * This is plain TypeScript — no AI here, just API calls.
 */

export interface MarketData {
  id: string;
  title: string;
  category: string;
  platform: 'kalshi' | 'polymarket';
  yes_price: number;
  volume: number;
  end_date?: string;
  url: string;
}

export interface Observations {
  kalshiMarkets: MarketData[];
  polymarketMarkets: MarketData[];
  movers: MarketData[];       // Markets with >10% price change in 24h
  trendingTopics: string[];   // From Google Trends or news
  newsHeadlines: string[];    // Recent headlines for context
  timestamp: string;
}

// --- Kalshi ---

async function fetchKalshiMarkets(): Promise<MarketData[]> {
  try {
    const response = await fetch(
      'https://api.elections.kalshi.com/trade-api/v2/markets?limit=200&status=open',
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      console.warn(`[Observe] Kalshi API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const markets: MarketData[] = (data.markets || [])
      .filter((m: any) => m.volume > 500)
      .map((m: any) => ({
        id: m.ticker,
        title: m.title,
        category: m.category || 'general',
        platform: 'kalshi' as const,
        yes_price: m.yes_ask || m.last_price || 0,
        volume: m.volume || 0,
        end_date: m.close_time,
        url: `https://kalshi.com/markets/${m.ticker}`,
      }));

    console.log(`[Observe] Fetched ${markets.length} active Kalshi markets`);
    return markets;
  } catch (error) {
    console.error('[Observe] Kalshi fetch error:', error);
    return [];
  }
}

// --- Polymarket ---

async function fetchPolymarketMarkets(): Promise<MarketData[]> {
  try {
    // Polymarket's CLOB API for active markets
    const response = await fetch(
      'https://clob.polymarket.com/markets?limit=100&active=true',
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      console.warn(`[Observe] Polymarket API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const markets: MarketData[] = (Array.isArray(data) ? data : data.data || [])
      .filter((m: any) => parseFloat(m.volume || '0') > 5000)
      .map((m: any) => ({
        id: m.condition_id || m.id,
        title: m.question || m.title || '',
        category: m.category || 'general',
        platform: 'polymarket' as const,
        yes_price: parseFloat(m.best_ask || m.price || '0'),
        volume: parseFloat(m.volume || '0'),
        end_date: m.end_date_iso,
        url: `https://polymarket.com/event/${m.slug || m.id}`,
      }));

    console.log(`[Observe] Fetched ${markets.length} active Polymarket markets`);
    return markets;
  } catch (error) {
    console.error('[Observe] Polymarket fetch error:', error);
    return [];
  }
}

// --- Trending Topics (lightweight approach using RSS) ---

async function fetchTrendingTopics(): Promise<string[]> {
  // Using Google News RSS as a free trending signal
  // In production, you might add SerpAPI or Google Trends API
  try {
    const response = await fetch(
      'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'
    );
    const text = await response.text();

    // Simple XML parsing for titles
    const titles: string[] = [];
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
    let match;
    while ((match = titleRegex.exec(text)) !== null) {
      const title = match[1] || match[2];
      if (title && title !== 'Google News' && title.length > 10) {
        titles.push(title);
      }
    }

    console.log(`[Observe] Found ${titles.length} trending headlines`);
    return titles.slice(0, 30);
  } catch (error) {
    console.error('[Observe] Trends fetch error:', error);
    return [];
  }
}

// --- Detect big movers ---

function detectMovers(
  currentMarkets: MarketData[],
  previousSnapshot?: MarketData[]
): MarketData[] {
  if (!previousSnapshot) return [];

  const previousMap = new Map(
    previousSnapshot.map(m => [`${m.platform}:${m.id}`, m])
  );

  return currentMarkets.filter(m => {
    const prev = previousMap.get(`${m.platform}:${m.id}`);
    if (!prev) return false;
    const change = Math.abs(m.yes_price - prev.yes_price);
    return change > 0.10; // >10 cent move
  });
}

// --- Main observe function ---

export interface ObserveOptions {
  kalshi?: boolean;
  polymarket?: boolean;
  trends?: boolean;
  previousSnapshot?: MarketData[];
}

export async function observe(options: ObserveOptions = {}): Promise<Observations> {
  const {
    kalshi = true,
    polymarket = true,
    trends = true,
    previousSnapshot,
  } = options;

  console.log('[Observe] Starting data collection...');

  const [kalshiMarkets, polymarketMarkets, trendingTopics] = await Promise.all([
    kalshi ? fetchKalshiMarkets() : Promise.resolve([]),
    polymarket ? fetchPolymarketMarkets() : Promise.resolve([]),
    trends ? fetchTrendingTopics() : Promise.resolve([]),
  ]);

  const allMarkets = [...kalshiMarkets, ...polymarketMarkets];
  const movers = detectMovers(allMarkets, previousSnapshot);

  console.log(`[Observe] Complete: ${allMarkets.length} markets, ${movers.length} movers, ${trendingTopics.length} trends`);

  return {
    kalshiMarkets,
    polymarketMarkets,
    movers,
    trendingTopics,
    newsHeadlines: trendingTopics.slice(0, 10), // Use top headlines as news
    timestamp: new Date().toISOString(),
  };
}
