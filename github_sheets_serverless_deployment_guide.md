# 📱 Serverless AlphaTrader Deployment Guide (GitHub Pages + Google Sheets)

This guide shows you how to deploy AlphaTrader **completely serverless** (100% free, running 24/7 in the cloud, and loading instantly on any device without any cold-start delay).

---

## 🏗️ How It Works
* **Frontend:** Hosted on **GitHub Pages** (always online, free, runs on any device browser).
* **API & Database:** Hosted on **Google Sheets** using **Google Apps Script** (always online, free, reads/writes your trades, and fetches live prices from Yahoo Finance).

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

### Step 4: Open and Connect on Your Device
1. Open the **GitHub Pages URL** on your phone or PC web browser.
2. The app will open and show a setup prompt: **"Welcome to AlphaTrader Mobile! Please enter your Google Apps Script URL."**
3. Paste the **Apps Script URL** (from Step 1) and click **Connect**.
4. The app will instantly sync with your Google Sheet and fetch live stock prices! Save this page to your mobile home screen for quick access.

---

## 📜 Apps Script API Code
Paste this complete script inside your Google Apps Script editor (Step 1.6):

```javascript
function doGet(e) {
  var action = e.parameter.action;
  
  if (action === "getData") {
    return ContentService.createTextOutput(JSON.stringify(getDashboardData()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ error: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var contents = JSON.parse(e.postData.contents);
  var action = contents.action;
  
  try {
    if (action === "addTrade") {
      return ContentService.createTextOutput(JSON.stringify(addTrade(contents.trade)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "deleteTrade") {
      return ContentService.createTextOutput(JSON.stringify(deleteTrade(contents.tradeId)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "addPortfolio") {
      return ContentService.createTextOutput(JSON.stringify(addPortfolio(contents.name)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "deletePortfolio") {
      return ContentService.createTextOutput(JSON.stringify(deletePortfolio(contents.portfolioName)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "renamePortfolio") {
      return ContentService.createTextOutput(JSON.stringify(renamePortfolio(contents.oldName, contents.newName)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "transferPosition") {
      return ContentService.createTextOutput(JSON.stringify(transferPosition(contents.assetName, contents.targetPortfolio)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "validateTicker") {
      return ContentService.createTextOutput(JSON.stringify(validateTicker(contents.symbol, contents.assetType)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "updateTradeStrategy") {
      return ContentService.createTextOutput(JSON.stringify(updateTradeStrategy(contents.tradeId, contents.why, contents.remark)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "editTrade") {
      return ContentService.createTextOutput(JSON.stringify(editTrade(contents.tradeId, contents.quantity, contents.priceUnit, contents.feeAmount, contents.why, contents.remark)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "updateTradePortfolio") {
      return ContentService.createTextOutput(JSON.stringify(updateTradePortfolio(contents.tradeId, contents.targetPortfolio)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "updatePortfolioConfig") {
      return ContentService.createTextOutput(JSON.stringify(updatePortfolioConfig(contents.name, contents.initialCapital, contents.targetStocks)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Fallback for legacy direct uploads
    return ContentService.createTextOutput(JSON.stringify(addTrade(contents)))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Global schemas to keep the database structurally sound
var JOURNAL_HEADERS = [
  "Timestamp", "Date", "Asset Name", "Asset Type", "Currency", 
  "Action", "Quantity", "Price/Unit", "Amount", "Current Price", 
  "Current Value", "P&L", "P&L %", "Why (Decision Reason)", 
  "Remark", "Portfolio", "Fee Amount"
];

var PORTFOLIOS_HEADERS = [
  "Asset Name", "Portfolio", "Portfolio Names", "Initial Capital", "Target Stocks"
];

// Self-healing database structure initialization
function ensureTableStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Repair or create Journal sheet
  var journalSheet = ss.getSheetByName("Journal");
  if (!journalSheet) {
    journalSheet = ss.insertSheet("Journal");
    journalSheet.getRange(1, 1, 1, JOURNAL_HEADERS.length).setValues([JOURNAL_HEADERS]);
    journalSheet.getRange(1, 1, 1, JOURNAL_HEADERS.length).setFontWeight("bold");
    journalSheet.setFrozenRows(1);
  } else {
    var lastCol = journalSheet.getLastColumn();
    if (lastCol === 0) {
      journalSheet.getRange(1, 1, 1, JOURNAL_HEADERS.length).setValues([JOURNAL_HEADERS]);
      journalSheet.getRange(1, 1, 1, JOURNAL_HEADERS.length).setFontWeight("bold");
      journalSheet.setFrozenRows(1);
    } else {
      // Overwrite/sanitize headers to fix trailing spaces or any corrupted values
      var rawHeaders = journalSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var cleanHeaders = [];
      var changed = false;
      
      for (var i = 0; i < rawHeaders.length; i++) {
        var h = rawHeaders[i].toString().trim();
        var hLower = h.toLowerCase();
        var cleanH = h;
        
        if (hLower.indexOf("timestamp") !== -1) {
          cleanH = "Timestamp";
        } else if (hLower.indexOf("date") !== -1) {
          cleanH = "Date";
        } else if (hLower.indexOf("asset name") !== -1 || hLower.indexOf("asset_name") !== -1) {
          cleanH = "Asset Name";
        } else if (hLower.indexOf("asset type") !== -1 || hLower.indexOf("asset_type") !== -1) {
          cleanH = "Asset Type";
        } else if (hLower.indexOf("currency") !== -1) {
          cleanH = "Currency";
        } else if (hLower.indexOf("action") !== -1) {
          cleanH = "Action";
        } else if (hLower.indexOf("quantity") !== -1 || hLower.indexOf("qty") !== -1) {
          cleanH = "Quantity";
        } else if (hLower.indexOf("price/unit") !== -1 || hLower.indexOf("price_unit") !== -1 || hLower.indexOf("price unit") !== -1) {
          cleanH = "Price/Unit";
        } else if (hLower.indexOf("portfolio") !== -1 || hLower.indexOf("port") !== -1) {
          cleanH = "Portfolio";
        } else if (hLower.indexOf("fee") !== -1) {
          cleanH = "Fee Amount";
        } else if (hLower.indexOf("amount") !== -1) {
          cleanH = "Amount";
        } else if (hLower.indexOf("current price") !== -1) {
          cleanH = "Current Price";
        } else if (hLower.indexOf("current value") !== -1) {
          cleanH = "Current Value";
        } else if (hLower.indexOf("p&l %") !== -1) {
          cleanH = "P&L %";
        } else if (hLower.indexOf("p&l") !== -1) {
          cleanH = "P&L";
        } else if (hLower.indexOf("why") !== -1 || hLower.indexOf("decision") !== -1 || hLower.indexOf("reason") !== -1) {
          cleanH = "Why (Decision Reason)";
        } else if (hLower.indexOf("remark") !== -1 || hLower.indexOf("note") !== -1) {
          cleanH = "Remark";
        }
        
        if (cleanH !== h) changed = true;
        cleanHeaders.push(cleanH);
      }
      
      if (changed) {
        journalSheet.getRange(1, 1, 1, cleanHeaders.length).setValues([cleanHeaders]);
        journalSheet.getRange(1, 1, 1, cleanHeaders.length).setFontWeight("bold");
      }
      
      // Auto-append missing headers
      var currentHeadersLower = cleanHeaders.map(function(ch) { return ch.toLowerCase().trim(); });
      var missingHeaders = [];
      for (var i = 0; i < JOURNAL_HEADERS.length; i++) {
        var hLower = JOURNAL_HEADERS[i].toLowerCase().trim();
        if (currentHeadersLower.indexOf(hLower) === -1) {
          missingHeaders.push(JOURNAL_HEADERS[i]);
        }
      }
      if (missingHeaders.length > 0) {
        journalSheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
        journalSheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setFontWeight("bold");
      }
      
      // Self-heal: Clean up duplicate "Amount" columns from Q to AG, and restore "Fee Amount" back to column Q (index 17)
      var maxCol = journalSheet.getLastColumn();
      if (maxCol > 17) {
        var rawHeaders = journalSheet.getRange(1, 1, 1, maxCol).getValues()[0];
        var feeColIdx = -1;
        for (var i = 17; i < rawHeaders.length; i++) {
          if (rawHeaders[i].toString().toLowerCase().trim().indexOf("fee") !== -1) {
            feeColIdx = i;
            break;
          }
        }
        if (feeColIdx !== -1) {
          var lastRow = journalSheet.getLastRow();
          if (lastRow >= 1) {
            var feeValues = journalSheet.getRange(1, feeColIdx + 1, lastRow, 1).getValues();
            journalSheet.getRange(1, 17, lastRow, 1).setValues(feeValues);
          }
        }
        journalSheet.getRange(1, 17).setValue("Fee Amount");
        var colsToDelete = maxCol - 17;
        if (colsToDelete > 0) {
          journalSheet.deleteColumns(18, colsToDelete);
        }
      }
    }
  }
  
  // 2. Repair or create Portfolios sheet
  var portfoliosSheet = ss.getSheetByName("Portfolios");
  if (!portfoliosSheet) {
    portfoliosSheet = ss.insertSheet("Portfolios");
    portfoliosSheet.getRange(1, 1, 1, PORTFOLIOS_HEADERS.length).setValues([PORTFOLIOS_HEADERS]);
    portfoliosSheet.getRange(1, 1, 1, PORTFOLIOS_HEADERS.length).setFontWeight("bold");
    portfoliosSheet.setFrozenRows(1);
    
    // Set default seed data
    portfoliosSheet.getRange(2, 3, 3, 1).setValues([["Main Trading"], ["BTC Stock"], ["Crypto"]]);
    portfoliosSheet.getRange(2, 4, 3, 2).setValues([
      [2000000, 50],
      [2000000, 50],
      [2000000, 50]
    ]);
  } else {
    var lastCol = portfoliosSheet.getLastColumn();
    if (lastCol === 0) {
      portfoliosSheet.getRange(1, 1, 1, PORTFOLIOS_HEADERS.length).setValues([PORTFOLIOS_HEADERS]);
      portfoliosSheet.getRange(1, 1, 1, PORTFOLIOS_HEADERS.length).setFontWeight("bold");
      portfoliosSheet.setFrozenRows(1);
    } else {
      var rawHeaders = portfoliosSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var cleanHeaders = [];
      var changed = false;
      
      for (var i = 0; i < rawHeaders.length; i++) {
        var h = rawHeaders[i].toString().trim();
        var hLower = h.toLowerCase();
        var cleanH = h;
        
        if (hLower.indexOf("asset name") !== -1 || hLower.indexOf("asset_name") !== -1) {
          cleanH = "Asset Name";
        } else if (hLower.indexOf("portfolio names") !== -1 || hLower.indexOf("portfolio_names") !== -1) {
          cleanH = "Portfolio Names";
        } else if (hLower.indexOf("portfolio") !== -1) {
          cleanH = "Portfolio";
        } else if (hLower.indexOf("initial capital") !== -1 || hLower.indexOf("initial_capital") !== -1) {
          cleanH = "Initial Capital";
        } else if (hLower.indexOf("target stocks") !== -1 || hLower.indexOf("target_stocks") !== -1) {
          cleanH = "Target Stocks";
        }
        
        if (cleanH !== h) changed = true;
        cleanHeaders.push(cleanH);
      }
      
      if (changed) {
        portfoliosSheet.getRange(1, 1, 1, cleanHeaders.length).setValues([cleanHeaders]);
        portfoliosSheet.getRange(1, 1, 1, cleanHeaders.length).setFontWeight("bold");
      }
      
      var currentHeadersLower = cleanHeaders.map(function(ch) { return ch.toLowerCase().trim(); });
      var missingHeaders = [];
      for (var i = 0; i < PORTFOLIOS_HEADERS.length; i++) {
        var hLower = PORTFOLIOS_HEADERS[i].toLowerCase().trim();
        if (currentHeadersLower.indexOf(hLower) === -1) {
          missingHeaders.push(PORTFOLIOS_HEADERS[i]);
        }
      }
      if (missingHeaders.length > 0) {
        portfoliosSheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
        portfoliosSheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setFontWeight("bold");
      }
    }
  }
}

function getDashboardData() {
  ensureTableStructure();
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Journal");
  var rows = sheet.getDataRange().getValues();
  
  var trades = [];
  var portfolios = ["Main Trading", "BTC Stock", "Crypto"];
  var uniqueAssets = [];
  var assetTypesMap = {};
  
  if (rows.length <= 1) {
    return {
      trades: [],
      portfolios: portfolios,
      portfolioConfigs: {},
      livePrices: {},
      liveRates: { "THB": 1.0, "USD": 35.0, "EUR": 38.0 },
      syncTime: new Date().toISOString()
    };
  }
  
  var headers = rows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  
  function findColIdx(keywords) {
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      for (var k = 0; k < keywords.length; k++) {
        if (h.indexOf(keywords[k]) !== -1) {
          return i;
        }
      }
    }
    return -1;
  }
  
  var dateIdx = findColIdx(["date"]);
  var assetNameIdx = findColIdx(["asset name", "asset_name", "asset"]);
  var assetTypeIdx = findColIdx(["asset type", "asset_type", "type"]);
  var currencyIdx = findColIdx(["currency"]);
  var actionIdx = findColIdx(["action"]);
  var quantityIdx = findColIdx(["quantity", "qty"]);
  var priceUnitIdx = findColIdx(["price/unit", "price_unit", "price unit", "price"]);
  var whyIdx = findColIdx(["why", "decision", "reason"]);
  var remarkIdx = findColIdx(["remark", "note"]);
  var portfolioIdx = findColIdx(["portfolio", "port"]);
  var feeAmountIdx = findColIdx(["fee amount", "fee_amount", "fee"]);
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var assetName = assetNameIdx !== -1 ? row[assetNameIdx].toString().trim().toUpperCase() : "";
    var assetType = assetTypeIdx !== -1 ? row[assetTypeIdx].toString().trim() : "Thai Stock";
    
    if (!assetName) continue;
    
    var dateVal = "";
    if (dateIdx !== -1 && row[dateIdx]) {
      var d = row[dateIdx];
      if (d instanceof Date) {
        dateVal = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        dateVal = d.toString().split(" ")[0].trim();
      }
    } else {
      dateVal = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    
    var portfolio = "Main Trading";
    if (portfolioIdx !== -1 && row[portfolioIdx]) {
      portfolio = row[portfolioIdx].toString().trim();
    } else {
      if (assetType.toLowerCase() === "crypto") {
        portfolio = "Crypto";
      } else if (assetType.toLowerCase() === "global stock" || assetType.toLowerCase() === "us stock") {
        portfolio = "BTC Stock";
      }
    }
    
    var qty = quantityIdx !== -1 ? parseFloat(row[quantityIdx]) : 0.0;
    if (isNaN(qty)) qty = 0.0;
    
    var price = priceUnitIdx !== -1 ? parseFloat(row[priceUnitIdx]) : 0.0;
    if (isNaN(price)) price = 0.0;
    
    var feeAmount = 0.0;
    if (feeAmountIdx !== -1 && row[feeAmountIdx]) {
      try {
        var rawFee = row[feeAmountIdx].toString().replace("%", "").trim();
        feeAmount = parseFloat(rawFee) || 0.0;
      } catch (e) {}
    }
    
    var trade = {
      id: (i + 1).toString(), 
      date: dateVal,
      portfolio: portfolio,
      assetName: assetName,
      assetType: assetType,
      currency: currencyIdx !== -1 && row[currencyIdx] ? row[currencyIdx].toString().trim() : "THB",
      action: actionIdx !== -1 && row[actionIdx] ? row[actionIdx].toString().trim() : "Buy",
      quantity: qty,
      priceUnit: price,
      why: whyIdx !== -1 && row[whyIdx] ? row[whyIdx].toString().trim() : "",
      remark: remarkIdx !== -1 && row[remarkIdx] ? row[remarkIdx].toString().trim() : "",
      feeAmount: feeAmount
    };
    
    trades.push(trade);
    
    if (uniqueAssets.indexOf(assetName) === -1) {
      uniqueAssets.push(assetName);
      assetTypesMap[assetName] = assetType;
    }
    
    if (portfolio && portfolios.indexOf(portfolio) === -1) {
      portfolios.push(portfolio);
    }
  }
  
  // High Performance Parallel Market Data Fetch (Converts O(N) calls to O(1) concurrent batch request)
  var livePrices = {};
  var liveRates = { "THB": 1.0, "USD": 35.0, "EUR": 38.0 };
  
  try {
    var fetchRequests = [];
    fetchRequests.push({ url: "https://query1.finance.yahoo.com/v8/finance/chart/USDTHB=X", muteHttpExceptions: true });
    fetchRequests.push({ url: "https://query1.finance.yahoo.com/v8/finance/chart/EURTHB=X", muteHttpExceptions: true });
    
    for (var j = 0; j < uniqueAssets.length; j++) {
      var asset = uniqueAssets[j];
      var type = (assetTypesMap && assetTypesMap[asset]) || "";
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
        var typeLower = (type || "").toLowerCase().trim();
        if (typeLower === "crypto" && upperAsset.indexOf("-") === -1) {
          symbol = upperAsset + "-USD";
        } else if (typeLower === "thai stock" && !upperAsset.endsWith(".BK")) {
          symbol = upperAsset + ".BK";
        }
      }
      fetchRequests.push({ url: "https://query1.finance.yahoo.com/v8/finance/chart/" + symbol, muteHttpExceptions: true });
    }
    
    var responses = UrlFetchApp.fetchAll(fetchRequests);
    
    try {
      var usdRes = JSON.parse(responses[0].getContentText());
      liveRates.USD = usdRes.chart.result[0].meta.regularMarketPrice || 35.0;
    } catch(e) {}
    
    try {
      var eurRes = JSON.parse(responses[1].getContentText());
      liveRates.EUR = eurRes.chart.result[0].meta.regularMarketPrice || 38.0;
    } catch(e) {}
    
    for (var j = 0; j < uniqueAssets.length; j++) {
      var asset = uniqueAssets[j];
      var responseIndex = j + 2; 
      try {
        var res = JSON.parse(responses[responseIndex].getContentText());
        var price = res.chart.result[0].meta.regularMarketPrice;
        if (price !== undefined && price !== null) {
          livePrices[asset] = price;
        }
      } catch(e) {}
    }
  } catch(e) {}
  
  // Read Custom Portfolios configurations
  var portfolioConfigs = {};
  try {
    var pSheet = ss.getSheetByName("Portfolios");
    var pRowIdx = pSheet.getLastRow();
    if (pRowIdx >= 2) {
      var pHeaders = pSheet.getRange(1, 1, 1, pSheet.getLastColumn()).getValues()[0].map(function(h) {
        return h.toString().toLowerCase().trim();
      });
      
      var pNameColIdx = pHeaders.indexOf("portfolio names");
      var pCapitalColIdx = pHeaders.indexOf("initial capital");
      var pStocksColIdx = pHeaders.indexOf("target stocks");
      
      var customPorts = pSheet.getRange(2, 1, pRowIdx - 1, pSheet.getLastColumn()).getValues();
      var tempPorts = [];
      for (var k = 0; k < customPorts.length; k++) {
        if (pNameColIdx !== -1) {
          var pName = customPorts[k][pNameColIdx].toString().trim();
          if (pName) {
            tempPorts.push(pName);
            var capital = pCapitalColIdx !== -1 ? (parseFloat(customPorts[k][pCapitalColIdx]) || 2000000.0) : 2000000.0;
            var stocks = pStocksColIdx !== -1 ? (parseInt(customPorts[k][pStocksColIdx]) || 50) : 50;
            portfolioConfigs[pName] = { initialCapital: capital, targetStocks: stocks };
          }
        }
      }
      if (tempPorts.length > 0) {
        portfolios = tempPorts;
      }
    }
  } catch(e) {}
  
  return {
    trades: trades,
    portfolios: portfolios,
    portfolioConfigs: portfolioConfigs,
    livePrices: livePrices,
    liveRates: liveRates,
    syncTime: new Date().toISOString()
  };
}

// Atomic Batch Write (Writes all columns concurrently to avoid row-loop round-trip lag)
function addTrade(trade) {
  ensureTableStructure();
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Journal");
  var lastRow = sheet.getLastRow();
  var newRowIdx = lastRow + 1;
  var lastCol = sheet.getLastColumn();
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
  
  function getIndex(keywords) {
    for (var i = 0; i < headersLower.length; i++) {
      var h = headersLower[i];
      for (var k = 0; k < keywords.length; k++) {
        if (h.indexOf(keywords[k]) !== -1) {
          return i;
        }
      }
    }
    return -1;
  }
  
  var rowValues = new Array(lastCol).fill("");
  
  var tsIdx = getIndex(["timestamp"]);
  var dateIdx = getIndex(["date"]);
  var assetNameIdx = getIndex(["asset name", "asset_name", "asset"]);
  var assetTypeIdx = getIndex(["asset type", "asset_type", "type"]);
  var currencyIdx = getIndex(["currency"]);
  var actionIdx = getIndex(["action"]);
  var quantityIdx = getIndex(["quantity", "qty"]);
  var priceUnitIdx = getIndex(["price/unit", "price_unit", "price unit", "price"]);
  var whyIdx = getIndex(["why (decision reason)", "why", "decision", "reason"]);
  var remarkIdx = getIndex(["remark", "note"]);
  var portfolioIdx = getIndex(["portfolio", "port"]);
  var feeAmountIdx = getIndex(["fee amount", "fee_amount", "fee"]);
  
  var amountIdx = getIndex(["amount"]);
  var curPriceIdx = getIndex(["current price"]);
  var curValueIdx = getIndex(["current value"]);
  var pnlIdx = getIndex(["p&l"]);
  var pnlPctIdx = getIndex(["p&l %"]);
  
  function sanitizeString(str) {
    if (!str) return "";
    var s = str.toString().trim();
    if (s.indexOf("=") === 0 || s.indexOf("+") === 0 || s.indexOf("-") === 0 || s.indexOf("@") === 0) {
      return "'" + s; // Escape formula injection
    }
    return s;
  }
  
  if (tsIdx !== -1) rowValues[tsIdx] = trade.timestamp ? new Date(trade.timestamp) : new Date();
  if (dateIdx !== -1) rowValues[dateIdx] = trade.date ? new Date(trade.date) : new Date();
  if (assetNameIdx !== -1) rowValues[assetNameIdx] = (trade.assetName || "").toString().trim().toUpperCase();
  if (assetTypeIdx !== -1) rowValues[assetTypeIdx] = trade.assetType || "Thai Stock";
  if (currencyIdx !== -1) rowValues[currencyIdx] = trade.currency || "THB";
  if (actionIdx !== -1) rowValues[actionIdx] = trade.action || "Buy";
  if (quantityIdx !== -1) rowValues[quantityIdx] = parseFloat(trade.quantity) || 0.0;
  if (priceUnitIdx !== -1) rowValues[priceUnitIdx] = parseFloat(trade.priceUnit) || 0.0;
  if (whyIdx !== -1) rowValues[whyIdx] = sanitizeString(trade.why);
  if (remarkIdx !== -1) rowValues[remarkIdx] = sanitizeString(trade.remark);
  if (portfolioIdx !== -1) rowValues[portfolioIdx] = trade.portfolio || "Main Trading";
  if (feeAmountIdx !== -1) rowValues[feeAmountIdx] = parseFloat(trade.feeAmount) || 0.0;
  
  function getColLetter(colIdx) {
    if (colIdx === -1) return "";
    var temp = colIdx + 1;
    var letter = "";
    while (temp > 0) {
      var mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - mod - 1) / 26);
    }
    return letter;
  }
  
  var qtyLetter = getColLetter(quantityIdx);
  var priceLetter = getColLetter(priceUnitIdx);
  var actionLetter = getColLetter(actionIdx);
  var curPriceLetter = getColLetter(curPriceIdx);
  var curValueLetter = getColLetter(curValueIdx);
  var amountLetter = getColLetter(amountIdx);
  var pnlLetter = getColLetter(pnlIdx);
  var feeLetter = getColLetter(feeAmountIdx);
  
  // Set calculation formulas
  if (amountIdx !== -1 && qtyLetter && priceLetter) {
    if (feeLetter) {
      rowValues[amountIdx] = '=IF(' + actionLetter + newRowIdx + '="Buy",(' + qtyLetter + newRowIdx + '*' + priceLetter + newRowIdx + ')+' + feeLetter + newRowIdx + ',(' + qtyLetter + newRowIdx + '*' + priceLetter + newRowIdx + ')-' + feeLetter + newRowIdx + ')';
    } else {
      rowValues[amountIdx] = "=" + qtyLetter + newRowIdx + "*" + priceLetter + newRowIdx;
    }
  }
  
  if (curPriceIdx !== -1) {
    rowValues[curPriceIdx] = parseFloat(trade.priceUnit) || 0.0;
  }
  
  if (curValueIdx !== -1 && qtyLetter && curPriceLetter) {
    rowValues[curValueIdx] = "=" + qtyLetter + newRowIdx + "*" + curPriceLetter + newRowIdx;
  }
  
  if (pnlIdx !== -1 && actionLetter && curValueLetter && amountLetter) {
    rowValues[pnlIdx] = '=IF(' + actionLetter + newRowIdx + '="Buy",' + curValueLetter + newRowIdx + '-' + amountLetter + newRowIdx + ',' + amountLetter + newRowIdx + '-' + curValueLetter + newRowIdx + ')';
  }
  
  if (pnlPctIdx !== -1 && pnlLetter && amountLetter) {
    rowValues[pnlPctIdx] = "=IF(" + amountLetter + newRowIdx + "=0,0," + pnlLetter + newRowIdx + "/" + amountLetter + newRowIdx + ")";
  }
  
  sheet.getRange(newRowIdx, 1, 1, rowValues.length).setValues([rowValues]);
  return { success: true };
}

function deleteTrade(tradeId) {
  ensureTableStructure();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Journal");
  var lastRow = sheet.getLastRow();
  
  var idStr = tradeId.toString().trim();
  if (idStr.indexOf("sig-") === 0) {
    // Locate row by composite signature
    var rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) {
      return { success: false, error: "Journal is empty." };
    }
    
    var headers = rows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    function findColIdx(keywords) {
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        for (var k = 0; k < keywords.length; k++) {
          if (h.indexOf(keywords[k]) !== -1) return i;
        }
      }
      return -1;
    }
    
    var dateIdx = findColIdx(["date"]);
    var assetNameIdx = findColIdx(["asset name", "asset_name", "asset"]);
    var actionIdx = findColIdx(["action"]);
    var quantityIdx = findColIdx(["quantity", "qty"]);
    var priceUnitIdx = findColIdx(["price/unit", "price_unit", "price unit", "price"]);
    var tsIdx = findColIdx(["timestamp"]);
    
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      
      // Match by written timestamp signature first
      var tsVal = tsIdx !== -1 ? row[tsIdx].toString().trim() : "";
      if (tsVal === idStr) {
        sheet.deleteRow(i + 1);
        return { success: true, deletedRow: i + 1, method: "timestamp" };
      }
      
      // Fallback: reconstruct signature
      try {
        var assetName = assetNameIdx !== -1 ? row[assetNameIdx].toString().trim().toUpperCase() : "";
        var action = actionIdx !== -1 ? row[actionIdx].toString().trim() : "Buy";
        action = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
        
        var qty = quantityIdx !== -1 ? parseFloat(row[quantityIdx]) : 0.0;
        var price = priceUnitIdx !== -1 ? parseFloat(row[priceUnitIdx]) : 0.0;
        
        var dateVal = "";
        if (dateIdx !== -1 && row[dateIdx]) {
          var d = row[dateIdx];
          if (d instanceof Date) {
            dateVal = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
          } else {
            dateVal = d.toString().split(" ")[0].trim();
          }
        }
        
        var rowSig = ("sig-" + dateVal + "-" + assetName + "-" + action + "-" + qty + "-" + price).trim();
        if (rowSig === idStr) {
          sheet.deleteRow(i + 1);
          return { success: true, deletedRow: i + 1, method: "reconstructed_signature" };
        }
      } catch (e) {}
    }
    return { success: false, error: "Trade signature not found: " + idStr };
  } else {
    // Locate row by direct row index (Cloud Mode deletes)
    var rowIdx = parseInt(tradeId);
    if (rowIdx > 1 && rowIdx <= lastRow) {
      sheet.deleteRow(rowIdx);
      return { success: true, deletedRow: rowIdx, method: "row_index" };
    }
    return { success: false, error: "Row index out of range: " + rowIdx + " (lastRow=" + lastRow + ")" };
  }
}

function addPortfolio(name) {
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Portfolios");
  var lastRow = sheet.getLastRow();
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
  var namesColIdx = headersLower.indexOf("portfolio names");
  var capColIdx = headersLower.indexOf("initial capital");
  var stocksColIdx = headersLower.indexOf("target stocks");
  
  if (namesColIdx === -1) return { success: false, error: "Portfolio Names column missing." };
  
  var nameValues = sheet.getRange(1, namesColIdx + 1, lastRow, 1).getValues();
  for (var i = 1; i < nameValues.length; i++) {
    if (nameValues[i][0].toString().trim().toLowerCase() === name.toLowerCase()) {
      return { success: true, message: "Portfolio already exists" };
    }
  }
  
  var targetRow = lastRow + 1;
  for (var i = 1; i < nameValues.length; i++) {
    if (nameValues[i][0] === "") {
      targetRow = i + 1;
      break;
    }
  }
  
  sheet.getRange(targetRow, namesColIdx + 1).setValue(name);
  if (capColIdx !== -1) sheet.getRange(targetRow, capColIdx + 1).setValue(2000000.0);
  if (stocksColIdx !== -1) sheet.getRange(targetRow, stocksColIdx + 1).setValue(50);
  
  return { success: true };
}

function updatePortfolioConfig(name, initialCapital, targetStocks) {
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Portfolios");
  var lastRow = sheet.getLastRow();
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
  var namesColIdx = headersLower.indexOf("portfolio names");
  var capColIdx = headersLower.indexOf("initial capital");
  var stocksColIdx = headersLower.indexOf("target stocks");
  
  if (namesColIdx === -1) return { success: false, error: "Portfolio Names column missing." };
  
  var nameValues = sheet.getRange(1, namesColIdx + 1, lastRow, 1).getValues();
  var found = false;
  for (var i = 1; i < nameValues.length; i++) {
    if (nameValues[i][0].toString().trim().toLowerCase() === name.toLowerCase()) {
      var row = i + 1;
      if (capColIdx !== -1) sheet.getRange(row, capColIdx + 1).setValue(initialCapital);
      if (stocksColIdx !== -1) sheet.getRange(row, stocksColIdx + 1).setValue(targetStocks);
      found = true;
      break;
    }
  }
  
  if (!found) {
    addPortfolio(name);
    var newLastRow = sheet.getLastRow();
    if (capColIdx !== -1) sheet.getRange(newLastRow, capColIdx + 1).setValue(initialCapital);
    if (stocksColIdx !== -1) sheet.getRange(newLastRow, stocksColIdx + 1).setValue(targetStocks);
  }
  
  return { success: true };
}

function deletePortfolio(portfolioName) {
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Portfolios");
  var lastRow = sheet.getLastRow();
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
  var namesColIdx = headersLower.indexOf("portfolio names");
  
  if (namesColIdx !== -1) {
    var nameValues = sheet.getRange(1, namesColIdx + 1, lastRow, 1).getValues();
    for (var i = 1; i < nameValues.length; i++) {
      if (nameValues[i][0].toString().trim().toLowerCase() === portfolioName.toLowerCase()) {
        sheet.getRange(i + 1, namesColIdx + 1).setValue(""); 
        // Also clear configuration values
        var capColIdx = headersLower.indexOf("initial capital");
        var stocksColIdx = headersLower.indexOf("target stocks");
        if (capColIdx !== -1) sheet.getRange(i + 1, capColIdx + 1).setValue("");
        if (stocksColIdx !== -1) sheet.getRange(i + 1, stocksColIdx + 1).setValue("");
      }
    }
  }
  
  var assetColIdx = headersLower.indexOf("asset name");
  var portColIdx = headersLower.indexOf("portfolio");
  if (assetColIdx !== -1 && portColIdx !== -1) {
    var mappingValues = sheet.getRange(1, 1, lastRow, Math.max(assetColIdx, portColIdx) + 1).getValues();
    for (var j = lastRow; j >= 2; j--) {
      var mappedPort = mappingValues[j-1][portColIdx].toString().trim();
      if (mappedPort.toLowerCase() === portfolioName.toLowerCase()) {
        sheet.getRange(j, assetColIdx + 1).clearContent();
        sheet.getRange(j, portColIdx + 1).clearContent();
      }
    }
  }
  
  return { success: true };
}

function renamePortfolio(oldName, newName) {
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Portfolios");
  var lastRow = sheet.getLastRow();
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
  var namesColIdx = headersLower.indexOf("portfolio names");
  
  if (namesColIdx !== -1) {
    var nameValues = sheet.getRange(1, namesColIdx + 1, lastRow, 1).getValues();
    for (var i = 1; i < nameValues.length; i++) {
      if (nameValues[i][0].toString().trim().toLowerCase() === oldName.toLowerCase()) {
        sheet.getRange(i + 1, namesColIdx + 1).setValue(newName);
      }
    }
  }
  
  var portColIdx = headersLower.indexOf("portfolio");
  if (portColIdx !== -1) {
    var portValues = sheet.getRange(1, portColIdx + 1, lastRow, 1).getValues();
    for (var j = 2; j <= lastRow; j++) {
      var mappedPort = portValues[j-1][0].toString().trim();
      if (mappedPort.toLowerCase() === oldName.toLowerCase()) {
        sheet.getRange(j, portColIdx + 1).setValue(newName);
      }
    }
  }
  
  return { success: true };
}

function transferPosition(assetName, targetPortfolio) {
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Portfolios");
  var lastRow = sheet.getLastRow();
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
  var assetColIdx = headersLower.indexOf("asset name");
  var portColIdx = headersLower.indexOf("portfolio");
  
  if (assetColIdx === -1 || portColIdx === -1) {
    return { success: false, error: "Asset mappings columns missing." };
  }
  
  var mappingValues = sheet.getRange(1, 1, lastRow, Math.max(assetColIdx, portColIdx) + 1).getValues();
  var found = false;
  
  for (var i = 1; i < mappingValues.length; i++) {
    if (mappingValues[i][assetColIdx].toString().trim().toUpperCase() === assetName.toUpperCase()) {
      sheet.getRange(i + 1, portColIdx + 1).setValue(targetPortfolio);
      found = true;
      break;
    }
  }
  
  if (!found) {
    var targetRow = lastRow + 1;
    for (var i = 1; i < mappingValues.length; i++) {
      if (mappingValues[i][assetColIdx] === "" && mappingValues[i][portColIdx] === "") {
        targetRow = i + 1;
        break;
      }
    }
    sheet.getRange(targetRow, assetColIdx + 1).setValue(assetName.toUpperCase());
    sheet.getRange(targetRow, portColIdx + 1).setValue(targetPortfolio);
  }
  
  addPortfolio(targetPortfolio);
  return { success: true };
}

function validateTicker(symbol, assetType) {
  var symbolStripped = symbol.toUpperCase().trim();
  if (!symbolStripped) {
    return { valid: false, message: "Ticker symbol cannot be empty." };
  }
  
  var resolvedSymbol = symbolStripped;
  var tickerMap = {
    "BJC": "BJC.BK",
    "KCE": "KCE.BK",
    "JMART": "JMART.BK",
    "ROJNA": "ROJNA.BK",
    "MSTR": "MSTR"
  };
  
  if (tickerMap[resolvedSymbol]) {
    resolvedSymbol = tickerMap[resolvedSymbol];
  } else {
    var assetLower = (assetType || "").toLowerCase().trim();
    if (assetLower === "thai stock" && !resolvedSymbol.endsWith(".BK")) {
      resolvedSymbol = resolvedSymbol + ".BK";
    } else if (assetLower === "crypto" && resolvedSymbol.indexOf("-") === -1) {
      resolvedSymbol = resolvedSymbol + "-USD";
    }
  }
  
  try {
    var response = UrlFetchApp.fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + resolvedSymbol, { muteHttpExceptions: true });
    var json = JSON.parse(response.getContentText());
    var price = json.chart.result[0].meta.regularMarketPrice;
    if (price !== null && price !== undefined && !isNaN(price)) {
      return {
        valid: true,
        ticker: resolvedSymbol,
        message: "Ticker '" + resolvedSymbol + "' verified. Live Price: " + price
      };
    } else {
      return { valid: false, message: "No price data found for '" + resolvedSymbol + "' on Yahoo Finance." };
    }
  } catch (e) {
    return { valid: false, message: "Error verifying ticker '" + resolvedSymbol + "': " + e.toString() };
  }
}

function updateTradeStrategy(tradeId, why, remark) {
  ensureTableStructure();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Journal");
  var rowIdx = parseInt(tradeId);
  var lastRow = sheet.getLastRow();
  
  if (rowIdx > 1 && rowIdx <= lastRow) {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
    
    var whyIdx = headersLower.indexOf("why (decision reason)");
    if (whyIdx === -1) whyIdx = headersLower.indexOf("why");
    
    var remarkIdx = headersLower.indexOf("remark");
    if (remarkIdx === -1) remarkIdx = headersLower.indexOf("note");
    
    if (whyIdx !== -1) {
      sheet.getRange(rowIdx, whyIdx + 1).setValue(why);
    }
    if (remarkIdx !== -1) {
      sheet.getRange(rowIdx, remarkIdx + 1).setValue(remark || "");
    }
    return { success: true };
  }
  return { success: false, error: "Row index out of bounds." };
}

function editTrade(tradeId, quantity, priceUnit, feeAmount, why, remark) {
  ensureTableStructure();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Journal");
  var rowIdx = parseInt(tradeId);
  var lastRow = sheet.getLastRow();
  
  if (rowIdx > 1 && rowIdx <= lastRow) {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
    
    var qtyIdx = headersLower.indexOf("quantity");
    if (qtyIdx === -1) qtyIdx = headersLower.indexOf("qty");
    
    var priceIdx = headersLower.indexOf("price/unit");
    if (priceIdx === -1) priceIdx = headersLower.indexOf("price_unit");
    if (priceIdx === -1) priceIdx = headersLower.indexOf("price");
    
    var feeIdx = headersLower.indexOf("fee amount");
    if (feeIdx === -1) feeIdx = headersLower.indexOf("fee");
    
    var whyIdx = headersLower.indexOf("why (decision reason)");
    if (whyIdx === -1) whyIdx = headersLower.indexOf("why");
    
    var remarkIdx = headersLower.indexOf("remark");
    if (remarkIdx === -1) remarkIdx = headersLower.indexOf("note");
    
    if (qtyIdx !== -1) {
      sheet.getRange(rowIdx, qtyIdx + 1).setValue(parseFloat(quantity) || 0.0);
    }
    if (priceIdx !== -1) {
      sheet.getRange(rowIdx, priceIdx + 1).setValue(parseFloat(priceUnit) || 0.0);
    }
    if (feeIdx !== -1) {
      sheet.getRange(rowIdx, feeIdx + 1).setValue(parseFloat(feeAmount) || 0.0);
    }
    if (whyIdx !== -1) {
      sheet.getRange(rowIdx, whyIdx + 1).setValue(why || "");
    }
    if (remarkIdx !== -1) {
      sheet.getRange(rowIdx, remarkIdx + 1).setValue(remark || "");
    }
    return { success: true };
  }
  return { success: false, error: "Row index out of bounds." };
}

function updateTradePortfolio(tradeId, targetPortfolio) {
  ensureTableStructure();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Journal");
  var rowIdx = parseInt(tradeId);
  var lastRow = sheet.getLastRow();
  
  if (rowIdx > 1 && rowIdx <= lastRow) {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
    
    var portIdx = headersLower.indexOf("portfolio");
    if (portIdx === -1) portIdx = headersLower.indexOf("port");
    
    if (portIdx !== -1) {
      sheet.getRange(rowIdx, portIdx + 1).setValue(targetPortfolio);
    } else {
      var newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue("Portfolio");
      sheet.getRange(rowIdx, newCol).setValue(targetPortfolio);
    }
    return { success: true };
  }
  return { success: false, error: "Row index out of bounds." };
}
```

