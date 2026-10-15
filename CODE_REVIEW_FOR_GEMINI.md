# Code Review & Fix Brief for Gemini — AlphaTrader (Trading Journal Pro)

Reviewer: Claude. Scope: the "live price / Paper P&L" work from commit `6fca1f3`, plus a general code and UI/UX review.

**How to read this.** Each finding is tagged:
- `[VERIFIED]` — I read the code and the problem is visible there.
- `[HYPOTHESIS]` — likely cause, but I could not run the app against the user's real Google Sheet. **Confirm with the diagnostic in §1.3 before "fixing".**

---

## 0. Executive summary

1. **Stocks have no real live price, so Paper P&L is 0 — and the last commit made it worse.** Crypto can get a price from the browser (Binance); stocks can only get one from the Apps Script → Yahoo path, which is currently not delivering (see §1.4). Meanwhile Gemini's last commit started reading the sheet's `Current Price` column as a live price, but **that column is just a copy of the entry price** (written by `Code.gs` itself). So the app now treats cost as market price. When no price arrives the app silently falls back to cost basis (`wac`) and shows `+0.00` in green, which looks like real data. Yahoo itself is fine (tested), so the work is to make the Apps Script → Yahoo path reliable and observable.
2. **The previous commit was declared fixed without an end-to-end check.** All 55 tests mock the network. Nothing tests `resolveLivePrice`, `syncMarketData`, or the price merge.
3. **The previous change introduced a regression:** the page load now `await`s a Binance request (no timeout) *before* `setTrades`. This blocks rendering and is the reason `Cash.test.jsx` started failing and had to be patched.
4. **The failure mode is invisible to the user.** Missing prices, failed sync, and stale cache all look identical to "everything is fine" (green dot, `+0.00`, success toast).

---

## 1. The bug: stocks never get a market price

### 1.1 Root-cause candidates (ranked)

| # | Candidate | Tag | Where |
|---|---|---|---|
| A | Apps Script was never re-deployed as a **New version**, so the live web app still runs the old `Code.gs`. Editing `Code.gs` in the repo does nothing for a deployed script. | HYPOTHESIS | `apps-script/Code.gs`, user's Google account |
| B | Yahoo `v8/finance/chart` returns 429/403/empty from Google datacenter IPs. Code swallows every error with `catch(e) {}`, so there is no signal. | HYPOTHESIS | `Code.gs` market-data block, `try { JSON.parse(...) } catch(e) {}` |
| C | ~~Ticker mapping: `.BK` only appended for Asset Type `Thai Stock`.~~ **Ruled out** — the user's Asset Types are correct (§1.4). | RULED OUT | — |
| D | ~~`Current Price` column holds `#N/A`.~~ **Reframed:** the column holds the **entry price** (not live). Using it as a price source is itself a bug that makes P&L ≈ 0 (§1.4 #3). | VERIFIED | `Code.gs buildJournalRow`, `fetchDirectFromGoogleSheet` |
| E | **Binance overwrites stock prices** (see §2.2). A Thai/US ticker that equals a Binance base asset gets a USD crypto price. | VERIFIED | `fetchBinanceCryptoPrices`, merge order |
| F | The `Current Price` price is taken from **whichever row of that asset comes last**, even if that row is blank/stale. | VERIFIED | `sheetPrices[...] = parsedCurrentPrice` in the row loop |

### 1.2 What to change

1. **Stop hiding missing prices.** In `computePositions` ([portfolioEngine.js](file:///C:/Users/sirap/Desktop/AI/Trading%20Journal_Pro/frontend/src/lib/portfolioEngine.js)) the line `resolveLivePrice(holding.assetName, livePrices, wac)` falls back to `wac`, which forces `unrealizedPnL = 0`. Instead:
   - Return `livePrice: null`, `priceSource: 'missing' | 'sheet' | 'binance' | 'yahoo' | 'manual'`, and `priceAsOf` per position.
   - Exclude missing-price positions from `totalUnrealizedPnL` **and** mark the KPI as "partial" (e.g. "Paper P&L ฿X — 3 of 7 holdings unpriced").
   - Add unit tests for `resolveLivePrice` and for the "missing price" path.
2. **Add a per-asset price source + status** and show it (see UI section). The user must be able to see *which* asset failed and *why* (HTTP status / parse error / no ticker match).
3. **Apps Script: return diagnostics, not silence.** Replace the empty `catch(e) {}` blocks with per-symbol results, e.g. `priceStatus: { "PTT": {symbol:"PTT.BK", http:200, ok:true, price:34.5}, "ABC": {symbol:"ABC", http:429, ok:false} }`, and return it in the JSON. Split a lightweight `action=getPrices` from `getDashboardData` (today every sync re-reads the whole sheet and calls Yahoo for every asset).
4. **Make ticker resolution explicit and testable.** Move the `tickerMap` / suffix logic into one pure function shared (or at least mirrored with tests) by the frontend and Apps Script. Don't rely on the sheet's Asset Type spelling; normalise it (`trim().toLowerCase()`), and treat unknown types as "try both `X.BK` and `X`".
5. **Offer a reliable fallback for stocks** since Yahoo from a browser is blocked by CORS and from Google IPs is flaky. Pick one and implement it end to end:
   - **Manual price override per asset** (stored in `localStorage` and optionally a `Prices` sheet tab). Cheapest and always works.
   - Document and *validate in the UI* the `=GOOGLEFINANCE("BKK:PTT","price")` approach, including the `BKK:` prefix, and surface `#N/A` as an explicit "sheet price invalid" state.
   - (Optional) a tiny serverless proxy (e.g. Cloudflare Worker) for Yahoo with proper headers.
6. **First-run self-test.** In Settings add "Test connection": checks Sheet ID readable, Apps Script URL reachable, **Apps Script version/`SCHEMA_VERSION` matches the app**, and runs one price lookup. This directly catches candidate A.

### 1.3 Diagnostic to run before coding (5 minutes)

- Open the Apps Script URL with `?action=getData` in a browser. Does `livePrices` contain the stock tickers? If the JSON has no `livePrices` for stocks → B/C. If it shows old behaviour (no `Current Price` keys) → A.
- In the browser console, run `JSON.parse(localStorage.getItem('alphatrader_live_prices'))` and check which assets have keys.
- Check the Journal sheet's `Asset Type` values for the stocks and the contents of the `Current Price` column. *(Done by Claude — see §1.4.)*

### 1.4 Findings from the user's real sheet (read via gviz CSV) and a live Yahoo test — `[VERIFIED]`

Sheet: `1kUYZcvNnbw-ihbPFkr4xbGHW3597UKC-n9B1jnS2djs`, tab `Journal`.

1. **Asset Types are correct** (`Thai Stock`: BJC, KCE, JMART, ROJNA, PTG, LH, IVL; `Global Stock`: MSTR, CRCL, META, HOOD). Candidate C is **ruled out**; `.BK` mapping is not the problem. The 7 currently-held assets are BJC, KCE, PTG, IVL, MSTR, CRCL, META.
2. **Yahoo itself works.** From Claude's PC (not Google IPs), `v8/finance/chart` returned `KCE.BK=75.5 THB`, `BJC.BK=18.1 THB`, `MSTR=143.24 USD`. So the data exists; the failure is on the **Apps Script → Yahoo path** (Google datacenter IPs and/or the deployed script version). Keep Yahoo as the source (user decision), but make it observable (§1.2.3).
3. **🔴 The sheet's `Current Price` column is NOT a live price — it is a copy of the entry price.** Every row has `Current Price == Price/Unit` (e.g. BJC 15.6/15.6, KCE 19/19, MSTR 127/127), and `Code.gs` `buildJournalRow` explicitly writes it that way: `rowValues[curPriceIdx] = parseFloat(trade.priceUnit)` ([Code.gs lines 1151-1153](file:///C:/Users/sirap/Desktop/AI/Trading%20Journal_Pro/apps-script/Code.gs#L1151-L1153)). Gemini's last commit reads this column as a *live* price in three places (`fetchDirectFromGoogleSheet`, `Code.gs getDashboardData`, and the guide copy). That **feeds the entry price in as the "market" price**, so Paper P&L collapses to ~0 (or to "last buy price − WAC") even when everything else works. It also gets persisted into `localStorage` (`alphatrader_live_prices`) and merged forever.
   **Required fix:** remove the `currentPriceIdx`/`sheetPrices` feature from `useJournalData.js`, `Code.gs`, and `github_sheets_serverless_deployment_guide.md`. Do **not** use the `Current Price` column as a price source. Then purge poisoned cache: on app start delete/ignore any `alphatrader_live_prices` entries lacking `{source, asOf}` (or bump a cache key version, e.g. `alphatrader_live_prices_v2`).
4. **Junk rows in the Journal (rows 35–36):** two rows with `Action = getHistory`, blank asset, dated today. This proves the deployed script's `doPost` did not recognise `getHistory` and fell through to the "legacy direct uploads" branch, which **appends any unknown request as a trade** (`return ...addTrade(contents)` at the end of `doPost`). Two consequences:
   - The deployed Apps Script was **older than the repo** when that call happened. Verify the redeploy truly took effect (Deploy → *Manage deployments* → pencil → *New version* → Deploy, and the app must use that same `/exec` URL). Add a `SCHEMA_VERSION`/`BUILD` field to the `getData` response and show it in Settings so this is checkable in 5 seconds.
   - **Make the fallback reject unknown actions** (`{success:false, error:'Unknown action'}`) instead of writing rows. Tell the user to delete rows 35–36.
5. Older rows have `Timestamp = 1/1/1970` (a `Date(0)` default). Minor; write `new Date()` when the timestamp is missing, and ignore it in the UI.


---

## 2. Code review findings

### 2.1 Regression: network call blocks load — `[VERIFIED]` — **High**
In `fetchDirectFromGoogleSheet` ([useJournalData.js](file:///C:/Users/sirap/Desktop/AI/Trading%20Journal_Pro/frontend/src/hooks/useJournalData.js)), `await fetchBinanceCryptoPrices(...)` runs **before** `setTrades(...)`. Consequences: the whole dashboard waits on `api.binance.com`; there is **no timeout**; `api.binance.com` returns HTTP 451 in some regions (e.g. US), in which case it just stalls then fails silently.
**Fix:** call `setTrades/setPortfolios` first; fetch prices after, non-blocking, with `AbortController` + ~5s timeout. Use `https://api.binance.com/api/v3/ticker/price?symbols=["BTCUSDT",...]` (only held symbols) instead of downloading all ~3,700 tickers on every sync/auto-refresh. Consider `data-api.binance.vision` as a fallback host.

### 2.2 Binance prices applied to non-crypto assets — `[VERIFIED]` — **High**
`fetchBinanceCryptoPrices(uniqueAssetNames)` is called with **every** asset name and the result is merged last (`Object.assign(sheetPrices, cryptoPrices)` / `...cryptoPrices`), so it overrides stock/sheet prices. Binance base assets collide with real tickers (e.g. `ONE`, `ACE`, `TRU`…), and the price is in **USD** while the position may be THB.
**Fix:** only request symbols whose `assetType` is `Crypto`/`Crypto Short 1x`; never let Binance override a non-crypto asset; and make merge precedence explicit and documented (e.g. manual > sheet > Binance(crypto only) > Yahoo/Apps Script). Also reconcile currency: a USD price on a THB-denominated holding must be converted or rejected.

### 2.3 Short 1x priced as the underlying outside the rebalance engine — `[VERIFIED]` — Low (not in user's data today)
`:S1X` is a synthetic short defined in `rebalanceEngine.js` (unit value `max(0, 2*entry − current)`). `rebalanceEngine` handles it correctly, but `resolveLivePrice` / `computePositions` / `Code.gs` strip the suffix and value the position at the **underlying's long price**, so a short held in the Journal would show inverted P&L on Positions/Dashboard. The user's Journal currently has **no** `:S1X` rows, so this is low priority: either route shorts through the same `2*entry − current` formula in `computePositions`, or explicitly document that shorts are only valued inside Rebalance. Add a test either way.

### 2.4 `resolveLivePrice` design — `[VERIFIED]` — Medium
- 8 near-identical `if (livePrices[x] !== undefined && ... !isNaN(...))` blocks. Replace with a candidate list + a small `getNum(key)` helper.
- Over-eager matching (`X` ↔ `X-USD` ↔ `XUSDT`) can match the wrong instrument. Prefer matching on the asset's known type.
- It returns the fallback silently (see §1.2). Return `{price, source}`.

### 2.5 Inconsistent price lookup between desktop and mobile — `[VERIFIED]` — Medium
[PositionsTab.jsx](file:///C:/Users/sirap/Desktop/AI/Trading%20Journal_Pro/frontend/src/components/positions/PositionsTab.jsx#L241) mobile card reads `livePrices[pos.assetName]` directly (shows `-` when missing), while desktop shows `pos.livePriceConverted` (shows **WAC** when missing). Same asset, two different outputs. Use the position's resolved price everywhere.

### 2.6 Silent failures and misleading success — `[VERIFIED]` — **High (UX/trust)**
- `fetchData` / `syncMarketData` only `console.warn` when Apps Script fails. The user sees nothing.
- `syncMarketData` shows success if **any** crypto price came back, even when all stocks failed. The toast says "Live market prices synced (N assets)" where N counts alias keys (`BTC`, `BTCUSDT`, `BTC:S1X`…), not assets.
- [AppHeader.jsx](file:///C:/Users/sirap/Desktop/AI/Trading%20Journal_Pro/frontend/src/components/layout/AppHeader.jsx#L250-L254) always renders a green 🟢 timestamp, and `setSyncTime` is set even when nothing updated.
**Fix:** report `{updated, failed:[...], stale:[...]}`; show a warning toast listing failed tickers; colour the sync indicator by health (green/amber/red); count distinct assets, not alias keys.

### 2.7 Price cache never expires — `[VERIFIED]` — Medium
`alphatrader_live_prices` in `localStorage` is merged forever (`{...prev, ...new}`), so a price fetched weeks ago is shown as "live" and keeps old keys for removed assets. Store `{price, asOf, source}` per asset, drop entries older than a threshold (or flag them "stale"), and prune assets no longer held.

### 2.8 Sheet `Current Price` parsing — `[VERIFIED]` — Medium
- Last-row-wins (§1.1 F). Use the most recent **non-empty valid** value per asset, or the row with the latest date.
- `replace(/[$,฿]/g,'')` doesn't handle `#N/A`, `Loading...`, or Thai/other locale number formats; treat those as "invalid" and record a reason.
- It fills keys for `assetName`, upper, clean, and `:S1X` — a short row will register the **underlying** key too (pollutes the long asset's price).

### 2.9 Structure / maintainability — `[VERIFIED]` — Medium
- [useJournalData.js](file:///C:/Users/sirap/Desktop/AI/Trading%20Journal_Pro/frontend/src/hooks/useJournalData.js) is ~600 lines doing CSV parsing, 6 sheet tabs, pricing, FX, sync, and settings. Extract `parseJournalRows`, `parseCashLedger`, `priceService` (pure, unit-testable).
- `Code.gs` (~2,190 lines) is **copy-pasted** into `github_sheets_serverless_deployment_guide.md` (~2,240 lines). They already drifted once. Generate the guide section from `Code.gs` in a script, or link to the file, so there is one source of truth.
- `findColIdx` uses substring matching with `indexOf`, so `'port'` matches any header containing "port", and `'price'` can match `Current Price` if `Price/Unit` is renamed. Prefer exact header match, then fallback.
- Duplicated `getVal` closures for every tab. One shared helper.

### 2.10 Tests — `[VERIFIED]` — **High**
- 55 tests pass, but none cover: `resolveLivePrice`, `fetchBinanceCryptoPrices`, `syncMarketData` merge/precedence, the "no price" path, stale cache, or Apps Script response variants.
- `Cash.test.jsx` was "fixed" by wrapping assertions in `waitFor` and loosening a matcher. That treats the symptom of §2.1. After fixing §2.1, revert to strict assertions if possible.
- Add a `Code.gs` price-parsing test (extract the pure parsing into a function that can be run in Node).
- Test output is dominated by antd deprecation warnings (below), which hides real warnings.

### 2.11 Security & hygiene — `[VERIFIED]` — **High**
- The GitHub PAT is embedded in the git remote URL (`.git/config`) and was pasted into chat. **Revoke and rotate it**, then use a credential helper / SSH. Never commit tokens.
- Sheet is shared "Anyone with the link" and Apps Script is "Anyone"; anyone with the Web App URL can call write actions (`addTrade`, `deleteTrade`…) — `doPost` has no auth. Add a shared secret/token check for write actions at minimum.
- `doPost` calls `JSON.parse(e.postData.contents)` *outside* the `try` block → malformed input throws an unhandled error.
- The in-app passcode is client-side only; treat it as a privacy screen, not security (I did not audit `security.js`).

### 2.12 Performance / build — `[VERIFIED]` — Low/Medium
- Single JS chunk ≈ 2 MB (585 kB gzip) precached by the PWA. Lazy-load tabs (`React.lazy`) and chart libs.
- Full `/ticker/price` download on every auto-refresh (see §2.1).
- `syncMarketData` depends on `trades`, so the auto-refresh interval is torn down/recreated on every trades change.

### 2.13 antd deprecations (tech debt) — `[VERIFIED]`
`Card.bordered`→`variant`, `Space.direction`→`orientation`, `Alert.message`→`title`, `Spin.tip`→`description`, `Progress.trailColor`→`railColor`, `Menu children`→`items`, static `message` outside `<App>` (no theme context). Fix in one pass so test logs become readable.

---

## 3. UI / UX comments

Based on the dashboard screenshot and the component code. Goal: easier to use and harder to misread.

### 3.1 Trust & data health (highest value)
- **`+฿ 0.00` in green reads as real data.** When prices are missing show `—` with an amber "Prices unavailable" chip and an explanation, never a confident green zero.
- Add a **"Data health" popover** from the sync button: per-asset price, source, age, and failure reason, with a "Set manual price" action. This single feature would have made the current bug self-diagnosing.
- Replace the always-green timestamp with a status dot (green = all priced & fresh, amber = partial/stale, red = sync failed). Show "Last synced 2 min ago" rather than a raw datetime.
- `AUTO` toggle is ambiguous. Label it "Auto-refresh" and show the interval (e.g. "every 60s"); let users change it.

### 3.2 Numbers that don't reconcile (confusing)
- NAV card says **ROI +0.74% (+฿2,354.93)** while Total Return card says **+0.70%** for the **same ฿2,354.93**. Two percentages for one amount with different (unlabelled) denominators. Pick one definition (e.g. vs. initial capital) or label each ("vs. initial capital" / "vs. cost basis").
- "Size / Slot ฿4,571.07" appears to be `cash ÷ 11 target slots` (≈ 50,281 ÷ 11), but only 4 slots are open; cash ÷ open slots would be ≈ ฿12,570. Please confirm the intended formula and label it ("Cash per open slot").
- The same fact is repeated three times: "7 / 11 Target Slots", "63.6% Occupancy / 4 slots open", "Slot Allocation 7 of 11". Show it once.

### 3.3 Information architecture & copy
- The **"No Opening Deposit Recorded"** banner occupies the top of the dashboard permanently and pushes KPIs down. Make it dismissible/collapsible, or move it into a small "Setup checklist" (Sheet connected ✓, Prices working ✗, Opening deposit ✗).
- Jargon: "Holdings Blueprint", "Slots", "Paper P&L", "Occupancy". Use plainer labels ("Positions", "Unrealized P&L", "Target positions") with tooltips; keep Thai/English consistent for the target user.
- Header is crowded (Port, Period, FX, Auto, time, Censor, Lock, Sync). Group filters on the left, move Censor/Lock to icon-only buttons with tooltips, and keep one primary action (Sync).
- Make **"Log trade"** reachable from every screen (header button or mobile FAB); it's the primary action of a journal app.
- 7+ sidebar tabs: consider grouping (Portfolio: Dashboard/Positions/Cash · Activity: Journal/Rebalance · Insights: Analytics) and put Settings in the footer.

### 3.4 Visual design
- The `฿` glyph renders like **₿ (Bitcoin)** in the monospace "financial-num" font in the screenshot — in a crypto-adjacent app this is genuinely confusing. Use a font with a proper Thai baht glyph or show `THB`.
- Colour is the only gain/loss cue; add ▲/▼ everywhere (cards already do, tables/mobile don't) for colour-blind users.
- 10–11px secondary-colour uppercase labels are hard to read on the dark background; raise to ≥12px and check contrast (WCAG AA).
- Lots of inline `style={{...}}` and hard-coded hex values in [KpiCards.jsx](file:///C:/Users/sirap/Desktop/AI/Trading%20Journal_Pro/frontend/src/components/dashboard/KpiCards.jsx). Extract a reusable `KpiTile`/`StatRow` component + CSS variables; the three cards share one structure.

### 3.5 Positions table
- Add a **Price source/age** column or badge and highlight rows with missing/stale prices.
- Make Unrealized P&L the default sort; show ▲/▼ and % together (already partly done).
- 11 columns with horizontal scroll: let the user hide columns; keep Asset + Live Price + Unrealized P&L pinned on the left on narrow screens.
- Mobile: portfolio names truncated to 8 chars in the header select; emoji-prefixed options; reconsider.

### 3.6 Onboarding & settings
- First-run wizard: 1) paste Sheet ID → test, 2) paste Apps Script URL → test + version check, 3) pick price strategy (Apps Script / Sheet column / manual), 4) add opening deposit. Each step shows pass/fail.
- Explain the `GOOGLEFINANCE` option in-app with a copy-paste formula (`=GOOGLEFINANCE("BKK:"&C2,"price")` for Thai stocks) and show if a cell evaluates to `#N/A`.

---

## 4. Suggested order of work for Gemini

1. **First, revert the `Current Price`-as-live-price feature and purge the poisoned `localStorage` cache (§1.4 #3); make `Code.gs` reject unknown actions (§1.4 #4); then run the §1.3 diagnostics on the Apps Script URL and report whether Yahoo returns prices from Google IPs (candidate A vs B).**
2. Fix regressions §2.1 and §2.2 (non-blocking, timeout, crypto-only Binance, explicit precedence). Revert the loosened `Cash.test.jsx` assertions if they pass strictly.
3. Introduce the price model (`price`, `source`, `asOf`, `status`) and stop falling back to `wac` (§1.2.1, §2.4–2.8). Add tests, including the "all stocks unpriced" scenario.
4. Add Apps Script diagnostics + `getPrices` + version check (§1.2.3, §1.2.6); decide on the stock fallback (manual override recommended).
5. UI: Data-health popover, partial-data KPI state, sync indicator, then the reconcile/copy fixes in §3.2–3.3.
6. Housekeeping: rotate the PAT, add write-auth to Apps Script, de-duplicate `Code.gs` vs the guide, antd deprecations, code-split.

## 5. Decisions from the user (answered)

1. **`:S1X`** — user did not know what it is. It is the *Rebalance* feature's synthetic "Short 1x" (see [rebalanceEngine.js](file:///C:/Users/sirap/Desktop/AI/Trading%20Journal_Pro/frontend/src/lib/rebalanceEngine.js#L1-L13)): a USD-margined short of a crypto, unit value `max(0, 2*entryPrice − currentPrice)`. **The user's Journal has no `:S1X` rows**, so it is out of scope for this bug. Do not touch the S1X logic except to fix §2.3.
2. **Price source = Yahoo Finance.** User remembers the older version working. Do **not** replace Yahoo with another stock source; make the Yahoo path observable and reliable (see §1.4). Manual override stays only as an optional safety net.
3. **Headline return = vs. initial capital.** Use `(NAV − initialCapital) / initialCapital` for the NAV card **and** the Total Return card, with the same label, so both cards show the same % for the same ฿ amount.
4. **Asset Types are fine** (all `Thai Stock` / `Global Stock`, see §1.4). User says Apps Script was re-deployed as a *New version*; the evidence in §1.4 suggests this should still be verified.

