import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

function yahooFinanceSnapshotPlugin() {
  const fetchYahooSymbols = async (symbolList, existingPrices = {}, existingRates = { THB: 1.0, USD: 33.42, EUR: 37.54 }) => {
    const livePrices = { ...existingPrices };
    const liveRates = { ...existingRates };
    const uniqueSyms = Array.from(new Set(symbolList.map(s => String(s || '').trim().toUpperCase()).filter(Boolean)));

    // Fetch in chunks of 15 via Yahoo Finance spark endpoint
    for (let i = 0; i < uniqueSyms.length; i += 15) {
      const chunk = uniqueSyms.slice(i, i + 15);
      try {
        const sparkUrl = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(chunk.join(','))}&range=5d&interval=1d`;
        const sparkRes = await fetch(sparkUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000)
        });
        if (sparkRes.ok) {
          const data = await sparkRes.json();
          for (const sym of chunk) {
            const closeArr = (data[sym]?.close || []).filter(v => v !== null && !isNaN(v) && v > 0);
            if (closeArr.length > 0) {
              const latest = closeArr[closeArr.length - 1];
              if (sym === 'USDTHB=X') liveRates.USD = latest;
              else if (sym === 'EURTHB=X') liveRates.EUR = latest;
              else {
                livePrices[sym] = latest;
                if (sym.endsWith('.BK')) {
                  livePrices[sym.replace('.BK', '')] = latest;
                } else if (sym.endsWith('-USD')) {
                  livePrices[sym.replace('-USD', '')] = latest;
                }
              }
            }
          }
        }
      } catch {
        // Continue to chart fallback for missing symbols
      }
    }

    // Fallback to v8/finance/chart/<SYM> for any newly bought symbol not yet resolved
    const missing = uniqueSyms.filter(
      sym => sym !== 'USDTHB=X' && sym !== 'EURTHB=X' && livePrices[sym] === undefined
    );
    for (const sym of missing.slice(0, 10)) {
      try {
        const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
        const cRes = await fetch(chartUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4000)
        });
        if (cRes.ok) {
          const cData = await cRes.json();
          const meta = cData?.chart?.result?.[0]?.meta;
          const price = meta?.regularMarketPrice || meta?.chartPreviousClose;
          if (price && !isNaN(price) && price > 0) {
            livePrices[sym] = price;
            if (sym.endsWith('.BK')) livePrices[sym.replace('.BK', '')] = price;
            if (sym.endsWith('-USD')) livePrices[sym.replace('-USD', '')] = price;
          }
        }
      } catch {}
    }

    return { livePrices, liveRates };
  };

  const attachYahooMiddleware = (server) => {
    server.middlewares.use('/api/yahoo-live', async (req, res) => {
      try {
        const urlObj = new URL(req.url || '', 'http://localhost');
        const rawSymbols = urlObj.searchParams.get('symbols') || '';
        const requested = rawSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        const coreSymbols = [
          ...requested,
          'BJC.BK', 'KCE.BK', 'JMART.BK', 'ROJNA.BK', 'PTG.BK', 'IVL.BK', 'LH.BK',
          'MSTR', 'CRCL', 'META', 'HOOD', 'USDTHB=X', 'EURTHB=X'
        ];

        const { livePrices, liveRates } = await fetchYahooSymbols(coreSymbols);

        // Persist newly fetched symbols to snapshot so subsequent reloads have them immediately
        try {
          const snapshotPath = path.resolve(process.cwd(), 'src/data/yahooPricesSnapshot.json');
          if (fs.existsSync(snapshotPath)) {
            const existing = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
            const mergedPrices = { ...(existing.livePrices || {}), ...livePrices };
            fs.writeFileSync(
              snapshotPath,
              JSON.stringify({ updatedAt: new Date().toISOString(), liveRates, livePrices: mergedPrices }, null, 2)
            );
          }
        } catch {}

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, updatedAt: new Date().toISOString(), livePrices, liveRates }));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
  };

  return {
    name: 'yahoo-finance-snapshot',
    configureServer: attachYahooMiddleware,
    configurePreviewServer: attachYahooMiddleware,
    async buildStart() {
      if (process.env.VITEST) return;
      try {
        const snapshotPath = path.resolve(process.cwd(), 'src/data/yahooPricesSnapshot.json');
        if (!fs.existsSync(snapshotPath)) return;
        const existing = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

        const sheetSymbols = [
          'BJC.BK', 'KCE.BK', 'JMART.BK', 'ROJNA.BK', 'PTG.BK', 'IVL.BK', 'LH.BK',
          'MSTR', 'CRCL', 'META', 'HOOD', 'USDTHB=X', 'EURTHB=X'
        ];

        // Dynamically discover any newly bought stocks from the user's Google Sheet
        try {
          const sheetCsvUrl = 'https://docs.google.com/spreadsheets/d/1kUYZcvNnbw-ihbPFkr4xbGHW3597UKC-n9B1jnS2djs/gviz/tq?tqx=out:csv&sheet=Journal';
          const sheetRes = await fetch(sheetCsvUrl, { signal: AbortSignal.timeout(4000) });
          if (sheetRes.ok) {
            const csvText = await sheetRes.text();
            const lines = csvText.split(/\r?\n/).slice(1);
            for (const line of lines) {
              const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
              const asset = (cols[2] || '').replace(/:S1X|:SHORT/gi, '').trim().toUpperCase();
              const type = (cols[3] || '').toLowerCase();
              const cur = (cols[4] || '').toUpperCase();
              if (!asset) continue;
              if (type.includes('crypto')) {
                sheetSymbols.push(asset.endsWith('-USD') ? asset : `${asset}-USD`);
              } else if (type.includes('thai') || (cur === 'THB' && !type.includes('global') && !type.includes('us'))) {
                sheetSymbols.push(asset.endsWith('.BK') ? asset : `${asset}.BK`);
              } else {
                sheetSymbols.push(asset);
              }
            }
          }
        } catch {}

        const { livePrices, liveRates } = await fetchYahooSymbols(
          sheetSymbols,
          existing.livePrices || {},
          existing.liveRates || { THB: 1.0, USD: 33.42, EUR: 37.54 }
        );

        fs.writeFileSync(
          snapshotPath,
          JSON.stringify({ updatedAt: new Date().toISOString(), liveRates, livePrices }, null, 2)
        );
      } catch {
        // Keep existing snapshot on offline/timeout
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  test: {
    testTimeout: 20000,
    environment: 'jsdom'
  },
  plugins: [
    yahooFinanceSnapshotPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'AlphaTrader Pro',
        short_name: 'AlphaTrader',
        description: 'Serverless Multi-Asset Portfolio Journal & Rebalance Terminal',
        theme_color: '#06080f',
        background_color: '#06080f',
        display: 'standalone',
        orientation: 'portrait',
        scope: './',
        start_url: './',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Strictly avoid caching external API requests to Google, Yahoo, or Binance
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(script\.google\.com|docs\.google\.com|open\.er-api\.com|query1\.finance\.yahoo\.com|query2\.finance\.yahoo\.com|api\.binance\.com|data-api\.binance\.vision)/,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ]
});
