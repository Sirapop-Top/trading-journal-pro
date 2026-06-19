# 📱 Serverless AlphaTrader Deployment Guide (GitHub Pages + Google Sheets)

This guide shows you how to deploy AlphaTrader **completely serverless** (100% free, running 24/7 in the cloud with no PC running, and loading instantly on your mobile phone without any cold-start delay).

---

## 🏗️ How It Works
* **Frontend:** Hosted on **GitHub Pages** (always online, free, runs entirely in your mobile browser).
* **API & Database:** Hosted on **Google Sheets** using **Google Apps Script** (always online, free, reads/writes your trades, and fetches live prices from Yahoo Finance).
* **Local PC Sync:** When you turn on your PC and start the local app, it downloads new trades from Google Sheets and automatically updates your local `Trading Journal.xlsx` file.

---

## 📋 Step-by-Step Setup

### Step 1: Create your Google Sheet & Apps Script
1. Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet. Name it **Trading Journal Database**.
2. Rename the first sheet tab at the bottom to **Journal**.
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
4. Click **Share** (top right) &rarr; Change General Access to **"Anyone with the link"** &rarr; Ensure role is **Viewer**. Copy your **Google Sheet ID** from the address bar (the long code between `/d/` and `/edit`).
5. Click **Extensions** (top menu) &rarr; **Apps Script**.
6. Delete any existing code and paste the **Apps Script API Code** shown in the section below.
7. Click **Save** (floppy disk icon).
8. Click **Deploy** (top right) &rarr; **New deployment**.
9. Click the Gear icon &rarr; select **Web app**.
   * **Description:** `AlphaTrader Serverless API`
   * **Execute as:** `Me` (your Google Account)
   * **Who has access:** `Anyone` (required to let your mobile browser access the sheet)
10. Click **Deploy**. Authorize permissions when prompted (click *Advanced* &rarr; *Go to Untitled Project (unsafe)* to approve).
11. Copy the **Web app URL** (this is your `Apps Script URL`).

---

### Step 2: Push your Code to GitHub
1. Open Git Bash or your terminal in the `Trading Journal_pro` directory on your PC.
2. Run these commands to push your project files to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Initialize Serverless AlphaTrader"
   git branch -M main
   git remote add origin https://github.com/Sirapop-Top/trading-journal-pro.git
   git push -u origin main -f
   ```

---

### Step 3: Enable GitHub Pages
Once the code is pushed, GitHub will automatically build your frontend using GitHub Actions!
1. Go to your repository on [GitHub](https://github.com).
2. Go to **Settings** (top tab) &rarr; **Pages** (left sidebar).
3. Under **Build and deployment** &rarr; **Source**, select **Deploy from a branch**.
4. Under **Branch**, select **`gh-pages`** and folder **`/ (root)`**.
5. Click **Save**.
6. Wait 1 minute. Refresh the page, and GitHub will display your live website link (e.g. `https://YOUR_USERNAME.github.io/trading-journal-pro/`).

---

### Step 4: Open and Connect on Mobile
1. Open the **GitHub Pages URL** on your mobile phone web browser.
2. The app will open and show a setup prompt: **"Welcome to AlphaTrader Mobile! Please enter your Google Apps Script URL."**
3. Paste the **Apps Script URL** (from Step 1) and click **Connect**.
4. The app will instantly sync with your Google Sheet and fetch live stock prices! Save this page to your mobile home screen for quick access.

---

### Step 5: Sync to your PC Excel File
1. Open the local AlphaTrader app on your PC by running `Start_AlphaTrader.bat`.
2. Go to the **Settings** tab.
3. In the **Cloud Google Sheets & Mobile Sync** card, paste:
   * **Google Sheet ID (Read):** Your Sheet ID from Step 1.
   * **Apps Script URL (Write):** Your Apps Script URL from Step 1.
4. Click **Save Settings & Sync**.
5. Your local `Trading Journal.xlsx` file is now fully integrated and will auto-download all mobile entries on startup!

---

## 📜 Apps Script API Code
Paste this complete script inside your Google Apps Script editor (Step 1.6):

```javascript
function doGet(e) {
  var action = e.parameter.action;
  
  if (action === "getData") {
    return ContentService.createTextOutput(JSON.stringify(getDashboardData()))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  }
  
  return ContentService.createTextOutput(JSON.stringify({ error: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}

function doPost(e) {
  var contents = JSON.parse(e.postData.contents);
  var action = contents.action;
  
  if (action === "addTrade") {
    return ContentService.createTextOutput(JSON.stringify(addTrade(contents.trade)))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  } else if (action === "deleteTrade") {
    return ContentService.createTextOutput(JSON.stringify(deleteTrade(contents.tradeId)))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  }
  
  // Fallback for legacy direct form uploads
  return ContentService.createTextOutput(JSON.stringify(addTrade(contents)))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}

function getDashboardData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Journal");
  var rows = sheet.getDataRange().getValues();
  
  var trades = [];
  var portfolios = ["Main Trading", "BTC Stock", "Crypto"];
  var uniqueAssets = [];
  
  var headers = rows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  
  var dateIdx = headers.indexOf("date");
  var assetNameIdx = headers.indexOf("asset name");
  var assetTypeIdx = headers.indexOf("asset type");
  var currencyIdx = headers.indexOf("currency");
  var actionIdx = headers.indexOf("action");
  var quantityIdx = headers.indexOf("quantity");
  var priceUnitIdx = headers.indexOf("price/unit");
  var whyIdx = headers.indexOf("why (decision reason)");
  var remarkIdx = headers.indexOf("remark");
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var assetName = assetNameIdx !== -1 ? row[assetNameIdx].toString().trim() : "";
    var assetType = assetTypeIdx !== -1 ? row[assetTypeIdx].toString().trim() : "";
    
    if (!assetName) continue;
    
    var dateVal = "";
    if (dateIdx !== -1 && row[dateIdx]) {
      var d = row[dateIdx];
      if (d instanceof Date) {
        dateVal = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        dateVal = d.toString().split(" ")[0];
      }
    }
    
    var portfolio = "Main Trading";
    if (assetType.toLowerCase() === "crypto") {
      portfolio = "Crypto";
    } else if ((assetType.toLowerCase() === "global stock" || assetType.toLowerCase() === "us stock")) {
      portfolio = "BTC Stock";
    }
    
    var trade = {
      id: i.toString(),
      date: dateVal,
      portfolio: portfolio,
      assetName: assetName,
      assetType: assetType,
      currency: currencyIdx !== -1 ? row[currencyIdx].toString() : "THB",
      action: actionIdx !== -1 ? row[actionIdx].toString() : "Buy",
      quantity: quantityIdx !== -1 ? parseFloat(row[quantityIdx]) || 0 : 0,
      priceUnit: priceUnitIdx !== -1 ? parseFloat(row[priceUnitIdx]) || 0 : 0,
      why: whyIdx !== -1 ? row[whyIdx].toString() : "",
      remark: remarkIdx !== -1 ? row[remarkIdx].toString() : ""
    };
    
    trades.push(trade);
    
    if (uniqueAssets.indexOf(assetName) === -1) {
      uniqueAssets.push(assetName);
    }
    
    if (portfolio && portfolios.indexOf(portfolio) === -1) {
      portfolios.push(portfolio);
    }
  }
  
  // Fetch live prices and rates from Yahoo Finance
  var livePrices = {};
  var liveRates = { "THB": 1.0, "USD": 35.0, "EUR": 38.0 };
  
  try {
    liveRates.USD = fetchRateFromYahoo("USDTHB=X") || 35.0;
    liveRates.EUR = fetchRateFromYahoo("EURTHB=X") || 38.0;
  } catch (e) {}
  
  for (var j = 0; j < uniqueAssets.length; j++) {
    var asset = uniqueAssets[j];
    try {
      var price = fetchPriceFromYahoo(asset);
      if (price) livePrices[asset] = price;
    } catch(err) {}
  }
  
  return {
    trades: trades,
    portfolios: portfolios,
    livePrices: livePrices,
    liveRates: liveRates,
    syncTime: new Date().toISOString()
  };
}

function fetchRateFromYahoo(symbol) {
  try {
    var response = UrlFetchApp.fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + symbol, { muteHttpExceptions: true });
    var json = JSON.parse(response.getContentText());
    var meta = json.chart.result[0].meta;
    return meta.regularMarketPrice;
  } catch (e) {
    return null;
  }
}

function fetchPriceFromYahoo(asset) {
  var symbol = asset;
  var upperAsset = asset.toUpperCase().trim();
  var tickerMap = {
    "BJC": "BJC.BK",
    "KCE": "KCE.BK",
    "JMART": "JMART.BK",
    "ROJNA": "ROJNA.BK",
    "MSTR": "MSTR"
  };
  
  if (tickerMap[upperAsset]) {
    symbol = tickerMap[upperAsset];
  } else {
    if (upperAsset.length <= 5 && upperAsset !== "BTC" && upperAsset !== "ETH") {
      var price = fetchRateFromYahoo(upperAsset + ".BK");
      if (price) return price;
    }
  }
  
  return fetchRateFromYahoo(symbol);
}

function addTrade(trade) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Journal");
  var dateVal = trade.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  sheet.appendRow([
    new Date(), // Timestamp
    new Date(dateVal),
    trade.assetName,
    trade.assetType,
    trade.currency,
    trade.action,
    trade.quantity,
    trade.priceUnit,
    trade.why,
    trade.remark || ""
  ]);
  
  return { success: true };
}

function deleteTrade(tradeId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Journal");
  var rowIdx = parseInt(tradeId);
  
  if (rowIdx > 0 && rowIdx <= sheet.getLastRow()) {
    sheet.deleteRow(rowIdx);
    return { success: true };
  }
  
  return { success: false, error: "Row index out of range" };
}
```
