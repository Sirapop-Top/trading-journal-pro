# 🗺️ AlphaTrader System Blueprint & Architecture Summary

This blueprint is designed for future developers and AI assistants to quickly understand the structure, data flows, and design patterns of AlphaTrader.

---

## 🚀 Project Overview
AlphaTrader is a personal trading journal application designed to log financial transactions, calculate real-time portfolio performance (using Yahoo Finance market prices), and synchronize data serverlessly.

The system operates in a single, robust deployment mode:
* **Serverless Cloud Mode:** React Frontend (hosted on GitHub Pages) + Google Sheets Database (integrated via a Google Apps Script Web App API) allowing 24/7 logging from any mobile or desktop web browser.

---

## 🏗️ System Architecture & Data Flow

```mermaid
flowchart LR
    A[Mobile or Desktop Web Browser] -->|Static Hosting| B(GitHub Pages Frontend)
    A -->|Get Trades (CORS-safe CSV)| E[(Google Sheets Cloud DB)]
    A -->|Add/Delete/Modify Trades| C(Google Apps Script API)
    C -->|Fetch Yahoo Finance Prices| D(Yahoo API)
    C -->|Write/Update Sheets| E[(Google Sheets Cloud DB)]
```

### Data Loading Flow (CORS Fallback Architecture)
To guarantee high availability and bypass cross-origin restrictions on strict mobile browsers (such as iOS Safari and Brave):
1. **Mandatory Primary Read (CORS-safe):** The frontend queries the Google Sheets CSV export endpoint (`gviz/tq?tqx=out:csv`). This endpoint never redirects, always returns `Access-Control-Allow-Origin: *`, and allows the app to load historical trades and build the portfolios list immediately.
2. **Best-Effort Live Metrics Read:** The frontend then triggers the Google Apps Script Web App API (`?action=getData`). This script runs Yahoo Finance price calls in parallel to retrieve current asset valuations and exchange rates. If it fails or is blocked by CORS tracking protection, the frontend gracefully falls back to the Weighted Average Cost (WAC) as the market price and queries a free public exchange rates API (`open.er-api.com`).
3. **API Mutations:** All logging, deletion, strategy editing, and portfolio configuration operations are sent via POST requests (with `Content-Type: text/plain` to bypass preflight OPTIONS checks) to the Google Apps Script endpoint.

---

## 📂 File Directory Map

```
Trading Journal_pro/
│
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions pipeline to compile & deploy frontend to GitHub Pages
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # React UI containing the Dashboard, Portfolio Analysis, and Settings panels
│   │   ├── App.css             # Main stylesheet customization
│   │   ├── index.css           # Global design system & style tokens
│   │   └── main.jsx            # React root mount point
│   │
│   ├── index.html              # Static HTML shell
│   ├── vite.config.js          # Vite config (set to base: './' for GitHub Pages compatibility)
│   └── package.json            # Node.js dependencies
│
├── .gitignore                  # Prevents private trade config caches from leaking to GitHub
├── USER_MANUAL.md              # Operations manual and guide
├── system_blueprint.md         # This document
└── github_sheets_serverless_deployment_guide.md # Google Apps Script & Sheets setup instructions
```

---

## 📊 Core Data Schema & Models

### 1. Trade JSON Object Schema
The frontend compiles and exchanges the following JSON representation of a trade transaction:

```typescript
interface Trade {
  id: string;          // Spreadsheet row number (e.g. "2", "3")
  date: string;        // Transaction date format: YYYY-MM-DD (e.g. "2026-06-19")
  portfolio: string;   // Target portfolio label (e.g. "Main Trading", "Crypto")
  assetName: string;   // Asset symbol (e.g. "BJC", "MSTR", "BTC-USD")
  assetType: string;   // Category ("Thai Stock" | "Global Stock" | "Crypto")
  currency: string;    // Base currency for entry ("THB" | "USD" | "EUR")
  action: string;      // Action Type: "Buy" | "Sell"
  quantity: number;    // Count of units traded
  priceUnit: number;   // Unit cost in base currency
  why: string;         // Strategic reason / signal (e.g. "CDC Action Zone")
  remark: string;      // Optional comments or notes
  feeAmount: number;   // Optional transaction fee amount (e.g. 50.0)
}
```

### 2. Google Sheet Column Layout (Journal Tab)
* **Col 1 (A):** `Timestamp` (Auto-injected by script)
* **Col 2 (B):** `Date`
* **Col 3 (C):** `Asset Name`
* **Col 4 (D):** `Asset Type`
* **Col 5 (E):** `Currency`
* **Col 6 (F):** `Action`
* **Col 7 (G):** `Quantity`
* **Col 8 (H):** `Price/Unit`
* **Col 9 (I):** `Amount` (Computed via cell formula including fee rate)
* **Col 10 (J):** `Current Price` (Cached / live Yahoo Finance quote)
* **Col 11 (K):** `Current Value` (Computed via formula: `Quantity * Current Price`)
* **Col 12 (L):** `P&L` (Computed via formula: difference between Value and Cost)
* **Col 13 (M):** `P&L %` (Computed via formula: `P&L / Cost`)
* **Col 14 (N):** `Why (Decision Reason)`
* **Col 15 (O):** `Remark`
* **Col 16 (P):** `Portfolio`
* **Col 17 (Q):** `Fee Amount`

---

## 🔒 Security Best Practices
1. **Secure Local Keys:** The Google Sheet ID and the Google Apps Script Web App URL are stored client-side inside the user's browser `LocalStorage`. No credentials, tokens, or links are hardcoded in the built static assets or public repositories.
2. **Access Control:** The spreadsheet itself only requires "Anyone with link can view" (Read-only) permissions. Write access is secured and handled exclusively through the deployed Apps Script Web App, executing as the owner.
3. **Passcode Protection:** Users can set a passcode to restrict access to the journal. Auto-lock triggers on idle timers, and incorrect attempts activate a temporary lockout cooldown to prevent brute force access.

---

## 🐛 Selected Historical Bug Fix Log

### Fix: Zero Balance on Mobile / GitHub Pages
* **Issue:** Direct fetch requests to Apps Script Web App URL were blocked on mobile Safari/Brave due to cross-origin redirects from `script.google.com` to `script.googleusercontent.com`.
* **Fix:** Structured the frontend to load transaction data using Google's direct CSV export endpoint (`gviz/tq?tqx=out:csv`) which is CORS-safe and does not issue redirects. Apps Script is only queried subsequently as a non-blocking best-effort call to fetch live market prices.

### Fix: Deleting a Trade Removes the Wrong Row
* **Issue:** Trade IDs were keyed to loop indexes starting at `1`, but `deleteRow()` expects actual spreadsheet rows. This caused an off-by-1 index mismatch where headers were deleted or wrong trades were removed.
* **Fix:** Shifted the ID scheme so that `ID` is permanently mapped to the actual spreadsheet row number (`index + 2`). The deletion endpoint was updated to accept direct row numbers and composite trade signatures to verify targets.

### Fix: Duplicate Trade Rendering on Optimistic Update
* **Issue:** Logging a trade caused the item to render twice until tab refresh because the optimistic React update used `trades.length + 1` for the temporary ID, colliding with the actual spreadsheet row indices.
* **Fix:** Aligned the client-side optimistic ID offset to `trades.length + 2` to mirror Google Sheet row conventions and prevent key collision warnings.

### Fix: Absolute Fees, Widescreen Modal Layout, and Unified Editing
* **Issue:** Trading fees were handled as percentages (`feeRate`), causing inaccurate real-cost calculations and complex checkbox inputs. The "Log New Trade Entry" modal action segmented control was positioned lower in the form, and the "Edit" button only supported changing strategy/remarks, not quantities or prices.
* **Fix:** Migrated to absolute `feeAmount` across the codebase, simplifying inputs to a direct numeric field. Rearranged the new trade modal layout to put the BUY/SELL Action control prominently at the top. Expanded the Edit Strategy modal into a full **Edit Trade Entry** dialog, allowing editing of Quantity, Price per unit, and Fee Amount alongside strategy/remarks on both PC and mobile viewports.

### Fix: Recursive Header Loop & Outdated Formulas in Google Sheet
* **Issue:** In `ensureTableStructure()`, the `"amount"` header match was checked before `"fee"`, causing `"Fee Amount"` to match `"amount"`, rename to `"Amount"`, trigger a "missing column" detection, and append a new `"Fee Amount"` column on every write. This created columns Q to AG named `"Amount"` and pushed the actual fee values to Column AH. Additionally, old rows kept using the outdated percentage-based formulas.
* **Fix:** Reordered header sanitization checks to run `"fee"` first. Appended a **Self-Healing Cleanup Engine** that automatically moves misplaced fee values back to Column Q and deletes duplicate columns (R onwards). Integrated a **Batch Formula Repair Engine** that loops over all existing rows and rewrites their cells with correct, absolute-fee formulas (`Amount`, `Value`, `P&L`, `P&L %`).
