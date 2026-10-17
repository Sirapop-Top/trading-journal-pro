import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

function yahooFinanceSnapshotPlugin() {
  const attachYahooMiddleware = (server) => {
    server.middlewares.use('/api/yahoo-live', async (req, res) => {
      try {
        const urlObj = new URL(req.url || '', 'http://localhost');
        const rawSymbols = urlObj.searchParams.get('symbols') || '';
        const requested = rawSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        const coreSymbols = Array.from(new Set([
          ...requested,
          'BJC.BK', 'KCE.BK', 'JMART.BK', 'ROJNA.BK', 'PTG.BK', 'IVL.BK', 'LH.BK',
          'MSTR', 'CRCL', 'META', 'HOOD', 'USDTHB=X', 'EURTHB=X'
        ]));

        const livePrices = {};
        const liveRates = { THB: 1.0, USD: 33.42, EUR: 37.54 };

        const sparkUrl = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(coreSymbols.join(','))}&range=5d&interval=1d`;
        const sparkRes = await fetch(sparkUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(6000)
        });

        if (sparkRes.ok) {
          const data = await sparkRes.json();
          for (const sym of coreSymbols) {
            const closeArr = (data[sym]?.close || []).filter(v => v !== null && !isNaN(v) && v > 0);
            if (closeArr.length > 0) {
              const latest = closeArr[closeArr.length - 1];
              if (sym === 'USDTHB=X') liveRates.USD = latest;
              else if (sym === 'EURTHB=X') liveRates.EUR = latest;
              else {
                livePrices[sym] = latest;
                if (sym.endsWith('.BK')) {
                  livePrices[sym.replace('.BK', '')] = latest;
                }
              }
            }
          }
        }

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
        const prices = { ...(existing.livePrices || {}) };
        const rates = { ...(existing.liveRates || { THB: 1.0, USD: 33.42, EUR: 37.54 }) };

        // Refresh core user holdings + FX rates in a fast 1.5s batch call
        const coreSymbols = [
          'BJC.BK', 'KCE.BK', 'JMART.BK', 'ROJNA.BK', 'PTG.BK', 'IVL.BK', 'LH.BK',
          'MSTR', 'CRCL', 'META', 'HOOD', 'USDTHB=X', 'EURTHB=X'
        ];
        const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(coreSymbols.join(','))}&range=5d&interval=1d`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
          const data = await res.json();
          for (const sym of coreSymbols) {
            const closeArr = (data[sym]?.close || []).filter(v => v !== null && !isNaN(v) && v > 0);
            if (closeArr.length > 0) {
              const latest = closeArr[closeArr.length - 1];
              if (sym === 'USDTHB=X') rates.USD = latest;
              else if (sym === 'EURTHB=X') rates.EUR = latest;
              else {
                prices[sym] = latest;
                if (sym.endsWith('.BK')) {
                  prices[sym.replace('.BK', '')] = latest;
                }
              }
            }
          }
          fs.writeFileSync(
            snapshotPath,
            JSON.stringify({ updatedAt: new Date().toISOString(), liveRates: rates, livePrices: prices }, null, 2)
          );
        }
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
