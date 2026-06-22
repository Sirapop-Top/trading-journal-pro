# 📖 AlphaTrader User Manual & Operation Guide

Welcome to **AlphaTrader**, a serverless cloud trading journal and portfolio analysis application designed to keep track of your financial assets, compute real-time performance using live Yahoo Finance feeds, and sync seamlessly with your Google Sheets database.

---

## 📑 Table of Contents
1. [⚙️ System Architecture Overview](#-system-architecture-overview)
2. [☁️ Cloud Serverless Mode Operations](#%EF%B8%8F-cloud-serverless-mode-operations)
3. [📈 Core Features Walkthrough](#-core-features-walkthrough)
   - [Log New Trade (with Ticker Verification)](#log-new-trade-with-ticker-verification)
   - [Adjusting Trade Strategy & Notes](#adjusting-trade-strategy--notes)
   - [Security Lock & Lock-out Cooldown](#security-lock--lock-out-cooldown)
   - [Advanced Analytics & Performance Metrics](#advanced-analytics--performance-metrics)
4. [🛠️ Troubleshooting & Frequently Asked Questions](#%EF%B8%8F-troubleshooting--frequently-asked-questions)

---

## ⚙️ System Architecture Overview

AlphaTrader operates in a purely **Serverless Cloud Mode**:
* **Frontend:** Hosted on **GitHub Pages** (always online, free, runs entirely in your browser).
* **Database & API:** Powered by **Google Sheets** and **Google Apps Script** (manages read/write operations for trades, portfolios, and configurations, and proxies real-time Yahoo Finance market quotes).

---

## ☁️ Cloud Serverless Mode Operations

You can access your journal 24/7 on any device (PC, tablet, or mobile phone) without keeping any computer running.

### Step 1: Create your Google Sheet Database
1. Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet.
2. Rename the first sheet tab to **Journal**.
3. In the top row (row 1), enter these columns exactly:
   * **A1:** `Timestamp`
   * **B1:** `Date`
   * **C1:** `Asset Name`
   * **D1:** `Asset Type`
   * **E1:** `Currency`
   * **F1:** `Action`
   * **G1:** `Quantity`
   * **H1:** `Price/Unit`
   * **I1:** `Why (Decision Reason)`
   * **J1:** `Remark`
4. Click **Share** (top right) &rarr; Change General Access to **"Anyone with the link can view"** &rarr; Ensure the role is **Viewer**. Copy the **Google Sheet ID** from the address bar (the long code between `/d/` and `/edit`).

### Step 2: Deploy Google Apps Script
1. Click **Extensions** (top menu) &rarr; **Apps Script**.
2. Paste the script from **`github_sheets_serverless_deployment_guide.md`** into the editor.
3. Click **Save** &rarr; **Deploy** &rarr; **New deployment**.
4. Select **Web app**:
   * *Execute as:* `Me`
   * *Who has access:* `Anyone`
5. Deploy, approve permissions (Advanced &rarr; Go to Untitled Project), and copy the **Web app URL** (`Apps Script URL`).

### Step 3: Connect Frontend
1. Open your deployed GitHub Pages URL on your device.
2. Paste the **Sheet ID** and **Apps Script URL** into the setup prompt and click **Connect**.

---

## 📈 Core Features Walkthrough

### Log New Trade (with Ticker Verification)
To keep calculations accurate, AlphaTrader validates symbols against Yahoo Finance before writing to the database:
1. Click **Log Trade** in the top-right menu of the terminal.
2. Select your portfolio, action type, date, quantity, and currency.
3. Enter the ticker symbol:
   * **Thai Stocks:** Key in standard symbols (e.g. `BJC`, `KCE`). The system automatically appends `.BK` under the hood.
   * **Global Stocks:** Key in directly (e.g. `MSTR`, `TSLA`).
   * **Crypto Assets:** Key in standard tokens (e.g. `BTC`, `ETH`). When selecting the **Crypto** asset category, the app automatically appends `-USD` (e.g. `BTC` becomes `BTC-USD`) and auto-corrects the form field. This prevents Yahoo Finance validation from colliding with global stock ETFs (such as NYSE ClearShares Piton ETF `BTC`) and ensures the correct crypto pair is queried.
4. Click **Verify** next to the Asset Name field:
   * **Green Check:** Verified on Yahoo Finance! The corrected ticker name is saved, and live market prices will load dynamically.
   * **Red Cross:** Invalid ticker. Checks will run again if you attempt to submit.
   * **Offline Override:** If the verification server is unreachable, a confirmation dialog will prompt: *"Ticker Verification Unreachable. Do you want to log this trade anyway?"* Select **Log Anyway** if you are offline and certain the symbol is correct.

### Adjusting Trade Strategy & Notes
If you change your trading model or wish to log emotional diary states after recording a transaction:
1. Navigate to the **Trading Journal** tab.
2. Locate the transaction in the history table.
3. In the **Actions** column, click the **Edit (Pencil)** icon.
4. An **Edit Strategy** modal will open:
   * **Strategy / Decision Reason:** Select a preset trigger (e.g. `CDC Action Zone`, `Breakout`, `Support Bounce`) or type a custom strategy.
   * **Private Notes / Diary:** Document your target exit plan, status, or remarks.
5. Click **Save Changes**. This updates Google Sheets via the Apps Script API.
6. Rows with a strategy or notes will display an expander icon `>` in the history table. Click it to view the full Trade Analysis.

### Security Lock & Lock-out Cooldown
To protect your net worth and private trading logs from prying eyes:
1. Navigate to **Terminal Settings** &rarr; **App Security & Lock**.
2. Toggle **Enable Passcode Lock**.
3. Type a **Passcode** (numeric PIN or password) and select an **Auto-Lock on Idle** duration (e.g. 5 minutes).
4. Click **Save Security Settings**.
5. Once configured:
   * **Automatic Protection:** The terminal will display a glassmorphic blur lock screen on initial boot or after the specified inactivity timer.
   * **Manual Protection:** Click the **Lock App** button in the header bar to lock the screen instantly.
   * **Lock-out Cooldown:** Typing the incorrect passcode 5 consecutive times triggers a **60-second lockout timer**. The keyboard input is completely disabled during this security cooldown.

### Advanced Analytics & Performance Metrics
Traders need metrics that help them evaluate edge. The top of the **Dashboard** includes a detailed quantitative metrics grid:
* **Win Rate %:** Percentage of completed/realized trades that closed in profit.
* **Profit Factor:** Gross Profit divided by Gross Loss. Values above `1.5` represent a healthy edge.
* **Risk-Reward Ratio:** Ratio between your average losing trade and average winning trade.
* **Avg Win / Avg Loss:** Converted average values of winning and losing trades.
* **Max Win / Max Loss:** The largest closed-out winning and losing trades in your log history.

---

## 🛠️ Troubleshooting & Frequently Asked Questions

#### Q: How do I update my cloud app code if I modify settings?
**A:** If you make changes to the Google Apps Script functions, you must copy the new code from `github_sheets_serverless_deployment_guide.md` &rarr; paste it into Google Apps Script console (`script.google.com`) &rarr; click **Save** &rarr; click **Deploy** &rarr; select **Manage deployments** &rarr; edit the active deployment and increment the version &rarr; click **Redeploy**.

#### Q: The verification fails on valid tickers in Cloud Mode.
**A:** Ensure your Apps Script URL is set. Direct browser CORS restrictions block direct requests to Yahoo Finance, so validations are proxied through your Apps Script Web App. If your URL is missing or incorrect, cloud validation will fail.

#### Q: I forgot my passcode. How can I reset the app?
**A:** Since security parameters are client-side stored:
1. Right-click anywhere in your browser page &rarr; select **Inspect** &rarr; go to **Application** tab (Chrome/Edge) or **Storage** tab (Firefox).
2. Expand **Local Storage** on the left &rarr; click on the app domain.
3. Locate `alphatrader_passcode` and delete the value.
4. Refresh the page to bypass the lock screen.
