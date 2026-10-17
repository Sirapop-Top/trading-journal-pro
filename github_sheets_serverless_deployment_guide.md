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


`javascript
// ==========================================
// AlphaTrader — Google Apps Script Backend
// Schema Version: 2.6 (Proven Yahoo Finance Live Market Fetch & Safe Schema Init)
// ==========================================

var SCHEMA_VERSION = "2.6";

function doGet(e) {
  var action = e ? e.parameter.action : "";
  
  if (action === "getData") {
    return ContentService.createTextOutput(JSON.stringify(getDashboardData()))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === "getPrices") {
    var syms = e && e.parameter && e.parameter.symbols ? e.parameter.symbols.split(",") : [];
    return ContentService.createTextOutput(JSON.stringify(getPricesData(syms)))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === "getHistory") {
    var syms = e && e.parameter && e.parameter.symbols ? e.parameter.symbols.split(",") : [];
    var rng = (e && e.parameter && e.parameter.range) ? e.parameter.range : "1y";
    return ContentService.createTextOutput(JSON.stringify(getHistory(syms, rng)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ error: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = {};
    if (e && e.postData && e.postData.contents) {
      try {
        contents = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid JSON in request: " + parseErr.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    var action = contents.action || "";
  
    if (action === "getData") {
      return ContentService.createTextOutput(JSON.stringify(getDashboardData()))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "getPrices") {
      return ContentService.createTextOutput(JSON.stringify(getPricesData(contents.symbols)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "addTrade") {
      return ContentService.createTextOutput(JSON.stringify(addTrade(contents.trade)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "addTradesBatch") {
      return ContentService.createTextOutput(JSON.stringify(addTradesBatch(contents.trades)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "getHistory") {
      return ContentService.createTextOutput(JSON.stringify(getHistory(contents.symbols, contents.range)))
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
    } else if (action === "savePair") {
      return ContentService.createTextOutput(JSON.stringify(savePair(contents.pair)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "setPairStatus") {
      return ContentService.createTextOutput(JSON.stringify(setPairStatus(contents.pairId, contents.status)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "deletePair") {
      return ContentService.createTextOutput(JSON.stringify(deletePair(contents.pairId)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "executeRebalance") {
      return ContentService.createTextOutput(JSON.stringify(executeRebalance(contents.rebalance)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "revertRebalance") {
      return ContentService.createTextOutput(JSON.stringify(revertRebalance(contents.rebalanceId)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "addCashEntry") {
      return ContentService.createTextOutput(JSON.stringify(addCashEntry(contents.entry)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "editCashEntry") {
      return ContentService.createTextOutput(JSON.stringify(editCashEntry(contents.entry)))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "deleteCashEntry") {
      return ContentService.createTextOutput(JSON.stringify(deleteCashEntry(contents.entryId)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Reject unknown actions rather than creating junk rows
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action: " + action }))
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
  "Remark", "Portfolio", "Fee Amount", "Rebalance ID", "FX To THB"
];

var PORTFOLIOS_HEADERS = [
  "Asset Name", "Portfolio", "Portfolio Names", "Initial Capital", "Target Stocks"
];

var REBALANCE_PAIRS_HEADERS = [
  "Pair ID", "Portfolio", "Pair Name", "Asset A", "Asset A Type", "Asset A Currency", 
  "Target A %", "Asset B", "Asset B Type", "Asset B Currency", "Target B %", 
  "Trigger Mode", "Drift Threshold %", "Schedule Frequency", "Schedule Anchor", 
  "Last Rebalanced", "Custom Fee", "Fee A Mode", "Fee A Value", "Fee B Mode", "Fee B Value", 
  "Status", "Created", "Notes"
];

var REBALANCE_LOG_HEADERS = [
  "Rebalance ID", "Pair ID", "Portfolio", "Executed On", "Trigger", 
  "Sell Asset", "Sell Qty", "Sell Price", "Sell Fee", 
  "Buy Asset", "Buy Qty", "Buy Price", "Buy Fee", 
  "Value Moved THB", "Before A %", "Target A %", "After A %", 
  "Realized PnL THB", "Reason", "Status", "Created"
];

var CASH_LEDGER_HEADERS = [
  "Entry ID", "Entry Date", "Portfolio", "Kind", "Asset", 
  "Currency", "Gross", "Withholding Tax", "Net", "FX To THB", 
  "Note", "Created"
];

// Self-healing database structure initialization with SCHEMA_VERSION check
function ensureTableStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var currentVersion = props.getProperty("SCHEMA_VERSION");
  var needsHeavyMigration = (currentVersion !== SCHEMA_VERSION);
  
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
        
        // Exact match check first (Trap T2 prevention)
        var exactMatch = false;
        for (var j = 0; j < JOURNAL_HEADERS.length; j++) {
          if (hLower === JOURNAL_HEADERS[j].toLowerCase()) {
            cleanH = JOURNAL_HEADERS[j];
            exactMatch = true;
            break;
          }
        }
        
        if (!exactMatch) {
          if (hLower.indexOf("rebalance") !== -1) {
            cleanH = "Rebalance ID";
          } else if (hLower.indexOf("timestamp") !== -1) {
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
          } else if (hLower.indexOf("fx") !== -1) {
            cleanH = "FX To THB";
          }
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
      
      // Self-heal: Clean up redundant duplicate columns beyond JOURNAL_HEADERS.length (Trap T1 prevention)
      var maxCol = journalSheet.getLastColumn();
      if (maxCol > JOURNAL_HEADERS.length) {
        var rawPostHeaders = journalSheet.getRange(1, 1, 1, maxCol).getValues()[0];
        // Only delete columns that are beyond the schema and not recognized
        var colsToDelete = maxCol - JOURNAL_HEADERS.length;
        if (colsToDelete > 0) {
          journalSheet.deleteColumns(JOURNAL_HEADERS.length + 1, colsToDelete);
        }
      }
      
      // Batch formula update logic: run only on migration / version bump (Trap T3 prevention)
      if (needsHeavyMigration) {
        var lastRow = journalSheet.getLastRow();
        if (lastRow >= 2) {
          var finalHeaders = journalSheet.getRange(1, 1, 1, journalSheet.getLastColumn()).getValues()[0];
          var finalHeadersLower = finalHeaders.map(function(h) { return h.toString().toLowerCase().trim(); });
          
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
          
          var qtyIdx = finalHeadersLower.indexOf("quantity");
          if (qtyIdx === -1) qtyIdx = finalHeadersLower.indexOf("qty");
          var priceIdx = finalHeadersLower.indexOf("price/unit");
          if (priceIdx === -1) priceIdx = finalHeadersLower.indexOf("price_unit");
          if (priceIdx === -1) priceIdx = finalHeadersLower.indexOf("price");
          var actIdx = finalHeadersLower.indexOf("action");
          var cPriceIdx = finalHeadersLower.indexOf("current price");
          var cValIdx = finalHeadersLower.indexOf("current value");
          var amtIdx = finalHeadersLower.indexOf("amount");
          var plIdx = finalHeadersLower.indexOf("p&l");
          var plPctIdx = finalHeadersLower.indexOf("p&l %");
          var fAmtIdx = finalHeadersLower.indexOf("fee amount");
          if (fAmtIdx === -1) fAmtIdx = finalHeadersLower.indexOf("fee");
          
          var qtyL = getColLetter(qtyIdx);
          var priceL = getColLetter(priceIdx);
          var actL = getColLetter(actIdx);
          var cPriceL = getColLetter(cPriceIdx);
          var cValL = getColLetter(cValIdx);
          var amtL = getColLetter(amtIdx);
          var plL = getColLetter(plIdx);
          var fAmtL = getColLetter(fAmtIdx);
          
          var amtFormulas = [];
          var valFormulas = [];
          var plFormulas = [];
          var plPctFormulas = [];
          
          for (var r = 2; r <= lastRow; r++) {
            var amtF = "";
            if (qtyL && priceL) {
              if (fAmtL) {
                amtF = '=IF(' + actL + r + '="Buy",(' + qtyL + r + '*' + priceL + r + ')+' + fAmtL + r + ',(' + qtyL + r + '*' + priceL + r + ')-' + fAmtL + r + ')';
              } else {
                amtF = "=" + qtyL + r + "*" + priceL + r;
              }
            }
            amtFormulas.push([amtF]);
            
            var valF = "";
            if (qtyL && cPriceL) {
              valF = "=" + qtyL + r + "*" + cPriceL + r;
            }
            valFormulas.push([valF]);
            
            var plF = "";
            if (actL && cValL && amtL) {
              plF = '=IF(' + actL + r + '="Buy",' + cValL + r + '-' + amtL + r + ',' + amtL + r + '-' + cValL + r + ')';
            }
            plFormulas.push([plF]);
            
            var plPctF = "";
            if (plL && amtL) {
              plPctF = "=IF(" + amtL + r + "=0,0," + plL + r + "/" + amtL + r + ")";
            }
            plPctFormulas.push([plPctF]);
          }
          
          if (amtIdx !== -1 && amtFormulas.length > 0) {
            journalSheet.getRange(2, amtIdx + 1, amtFormulas.length, 1).setFormulas(amtFormulas);
          }
          if (cValIdx !== -1 && valFormulas.length > 0) {
            journalSheet.getRange(2, cValIdx + 1, valFormulas.length, 1).setFormulas(valFormulas);
          }
          if (plIdx !== -1 && plFormulas.length > 0) {
            journalSheet.getRange(2, plIdx + 1, plFormulas.length, 1).setFormulas(plFormulas);
          }
          if (plPctIdx !== -1 && plPctFormulas.length > 0) {
            journalSheet.getRange(2, plPctIdx + 1, plPctFormulas.length, 1).setFormulas(plPctFormulas);
          }
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
    var pLastCol = portfoliosSheet.getLastColumn();
    if (pLastCol === 0) {
      portfoliosSheet.getRange(1, 1, 1, PORTFOLIOS_HEADERS.length).setValues([PORTFOLIOS_HEADERS]);
      portfoliosSheet.getRange(1, 1, 1, PORTFOLIOS_HEADERS.length).setFontWeight("bold");
      portfoliosSheet.setFrozenRows(1);
    } else {
      var rawHeaders = portfoliosSheet.getRange(1, 1, 1, pLastCol).getValues()[0];
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
        portfoliosSheet.getRange(1, pLastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
        portfoliosSheet.getRange(1, pLastCol + 1, 1, missingHeaders.length).setFontWeight("bold");
      }
    }
  }
  
  // 3. Repair or create Rebalance_Pairs sheet
  var pairsSheet = ss.getSheetByName("Rebalance_Pairs");
  if (!pairsSheet) {
    pairsSheet = ss.insertSheet("Rebalance_Pairs");
    pairsSheet.getRange(1, 1, 1, REBALANCE_PAIRS_HEADERS.length).setValues([REBALANCE_PAIRS_HEADERS]);
    pairsSheet.getRange(1, 1, 1, REBALANCE_PAIRS_HEADERS.length).setFontWeight("bold");
    pairsSheet.setFrozenRows(1);
  } else {
    var rpLastCol = pairsSheet.getLastColumn();
    if (rpLastCol === 0) {
      pairsSheet.getRange(1, 1, 1, REBALANCE_PAIRS_HEADERS.length).setValues([REBALANCE_PAIRS_HEADERS]);
      pairsSheet.getRange(1, 1, 1, REBALANCE_PAIRS_HEADERS.length).setFontWeight("bold");
      pairsSheet.setFrozenRows(1);
    }
  }
  
  // 4. Repair or create Rebalance_Log sheet
  var logSheet = ss.getSheetByName("Rebalance_Log");
  if (!logSheet) {
    logSheet = ss.insertSheet("Rebalance_Log");
    logSheet.getRange(1, 1, 1, REBALANCE_LOG_HEADERS.length).setValues([REBALANCE_LOG_HEADERS]);
    logSheet.getRange(1, 1, 1, REBALANCE_LOG_HEADERS.length).setFontWeight("bold");
    logSheet.setFrozenRows(1);
  } else {
    var rlLastCol = logSheet.getLastColumn();
    if (rlLastCol === 0) {
      logSheet.getRange(1, 1, 1, REBALANCE_LOG_HEADERS.length).setValues([REBALANCE_LOG_HEADERS]);
      logSheet.getRange(1, 1, 1, REBALANCE_LOG_HEADERS.length).setFontWeight("bold");
      logSheet.setFrozenRows(1);
    }
  }
  
  // 5. Repair or create Cash_Ledger sheet
  var cashSheet = ss.getSheetByName("Cash_Ledger");
  if (!cashSheet) {
    cashSheet = ss.insertSheet("Cash_Ledger");
    cashSheet.getRange(1, 1, 1, CASH_LEDGER_HEADERS.length).setValues([CASH_LEDGER_HEADERS]);
    cashSheet.getRange(1, 1, 1, CASH_LEDGER_HEADERS.length).setFontWeight("bold");
    cashSheet.setFrozenRows(1);
  } else {
    var clLastCol = cashSheet.getLastColumn();
    if (clLastCol === 0) {
      cashSheet.getRange(1, 1, 1, CASH_LEDGER_HEADERS.length).setValues([CASH_LEDGER_HEADERS]);
      cashSheet.getRange(1, 1, 1, CASH_LEDGER_HEADERS.length).setFontWeight("bold");
      cashSheet.setFrozenRows(1);
    } else {
      var rawHeaders = cashSheet.getRange(1, 1, 1, clLastCol).getValues()[0];
      var cleanHeaders = [];
      var changed = false;
      
      for (var i = 0; i < rawHeaders.length; i++) {
        var h = rawHeaders[i].toString().trim();
        var hLower = h.toLowerCase();
        var cleanH = h;
        
        for (var j = 0; j < CASH_LEDGER_HEADERS.length; j++) {
          if (hLower === CASH_LEDGER_HEADERS[j].toLowerCase()) {
            cleanH = CASH_LEDGER_HEADERS[j];
            break;
          }
        }
        if (cleanH !== h) changed = true;
        cleanHeaders.push(cleanH);
      }
      
      if (changed) {
        cashSheet.getRange(1, 1, 1, cleanHeaders.length).setValues([cleanHeaders]);
        cashSheet.getRange(1, 1, 1, cleanHeaders.length).setFontWeight("bold");
      }
      
      var currentHeadersLower = cleanHeaders.map(function(ch) { return ch.toLowerCase().trim(); });
      var missingHeaders = [];
      for (var i = 0; i < CASH_LEDGER_HEADERS.length; i++) {
        var hLower = CASH_LEDGER_HEADERS[i].toLowerCase().trim();
        if (currentHeadersLower.indexOf(hLower) === -1) {
          missingHeaders.push(CASH_LEDGER_HEADERS[i]);
        }
      }
      if (missingHeaders.length > 0) {
        cashSheet.getRange(1, clLastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
        cashSheet.getRange(1, clLastCol + 1, 1, missingHeaders.length).setFontWeight("bold");
      }
    }
  }
  
  if (needsHeavyMigration) {
    props.setProperty("SCHEMA_VERSION", SCHEMA_VERSION);
  }
}

// Sequence generator helper
function nextId(prefix) {
  var propKey = prefix + "_SEQ";
  var props = PropertiesService.getScriptProperties();
  var seqStr = props.getProperty(propKey);
  var seq = parseInt(seqStr, 10);
  if (isNaN(seq) || seq < 0) {
    seq = 0;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (prefix === "RP") {
      var pSheet = ss.getSheetByName("Rebalance_Pairs");
      if (pSheet && pSheet.getLastRow() >= 2) {
        var vals = pSheet.getRange(2, 1, pSheet.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < vals.length; i++) {
          var m = String(vals[i][0]).match(/RP-(\d+)/i);
          if (m) seq = Math.max(seq, parseInt(m[1], 10));
        }
      }
    } else if (prefix === "RB") {
      var lSheet = ss.getSheetByName("Rebalance_Log");
      if (lSheet && lSheet.getLastRow() >= 2) {
        var vals = lSheet.getRange(2, 1, lSheet.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < vals.length; i++) {
          var m = String(vals[i][0]).match(/RB-(\d+)/i);
          if (m) seq = Math.max(seq, parseInt(m[1], 10));
        }
      }
    } else if (prefix === "CL") {
      var cSheet = ss.getSheetByName("Cash_Ledger");
      if (cSheet && cSheet.getLastRow() >= 2) {
        var vals = cSheet.getRange(2, 1, cSheet.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < vals.length; i++) {
          var m = String(vals[i][0]).match(/CL-(\d+)/i);
          if (m) seq = Math.max(seq, parseInt(m[1], 10));
        }
      }
    }
  }
  seq += 1;
  props.setProperty(propKey, seq.toString());
  var numStr = ("0000" + seq).slice(-4);
  return prefix + "-" + numStr;
}

// Calculate held quantity for an asset within a specific portfolio
function getHeldQty(portfolio, assetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Journal");
  if (!sheet || sheet.getLastRow() <= 1) return 0;
  
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  var portIdx = headers.indexOf("portfolio");
  var assetIdx = headers.indexOf("asset name");
  var actIdx = headers.indexOf("action");
  var qtyIdx = headers.indexOf("quantity");
  if (qtyIdx === -1) qtyIdx = headers.indexOf("qty");
  
  var held = 0;
  var targetAsset = String(assetName || '').trim().toUpperCase();
  var targetPort = String(portfolio || '').trim();
  
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rPort = portIdx !== -1 ? String(r[portIdx] || '').trim() : '';
    if (rPort !== targetPort) continue;
    
    var rAsset = assetIdx !== -1 ? String(r[assetIdx] || '').trim().toUpperCase() : '';
    if (rAsset !== targetAsset) continue;
    
    var act = actIdx !== -1 ? String(r[actIdx] || '').trim().toLowerCase() : '';
    var q = qtyIdx !== -1 ? parseFloat(r[qtyIdx]) || 0 : 0;
    
    if (act === "buy") {
      held += q;
    } else if (act === "sell") {
      held -= q;
      if (held < 0) held = 0;
    }
  }
  return held;
}

function getDashboardData() {
  try {
    try { ensureTableStructure(); } catch (structureErr) {}
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Journal");
  var rows = sheet ? sheet.getDataRange().getValues() : [];
  
  var trades = [];
  var portfolios = ["Main Trading", "BTC Stock", "Crypto"];
  var uniqueAssets = [];
  var assetTypesMap = {};
  var assetCurrenciesMap = {};
  var livePrices = {};
  var liveRates = { "THB": 1.0, "USD": 32.69, "EUR": 38.04 };
  
  if (rows.length > 1) {
    var headers = rows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    
    function findColIdx(keywords) {
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        for (var k = 0; k < keywords.length; k++) {
          if (h === keywords[k] || h.indexOf(keywords[k]) !== -1) {
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
    var whyIdx = findColIdx(["why (decision reason)", "why", "decision", "reason"]);
    var remarkIdx = findColIdx(["remark", "note"]);
    var portfolioIdx = findColIdx(["portfolio", "port"]);
    var feeAmountIdx = findColIdx(["fee amount", "fee_amount", "fee"]);
    var rebalanceIdIdx = findColIdx(["rebalance id", "rebalance_id"]);
    var fxToThbIdx = findColIdx(["fx to thb", "fx_to_thb", "fxtothb"]);
    var currentPriceIdx = findColIdx(["current price", "current_price", "currentprice", "market price", "live price"]);
    
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
        if (assetType.toLowerCase() === "crypto" || assetType.toLowerCase() === "crypto short 1x") {
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
      
      var rebalanceId = rebalanceIdIdx !== -1 && row[rebalanceIdIdx] ? row[rebalanceIdIdx].toString().trim() : "";
      var parsedFx = fxToThbIdx !== -1 && row[fxToThbIdx] !== "" && !isNaN(parseFloat(row[fxToThbIdx])) ? parseFloat(row[fxToThbIdx]) : null;
      var curVal = currencyIdx !== -1 && row[currencyIdx] ? row[currencyIdx].toString().trim() : "THB";
      if (parsedFx === null && curVal === "THB") parsedFx = 1.0;
      
      var trade = {
        id: (i + 1).toString(), 
        date: dateVal,
        portfolio: portfolio,
        assetName: assetName,
        assetType: assetType,
        currency: curVal,
        action: actionIdx !== -1 && row[actionIdx] ? row[actionIdx].toString().trim() : "Buy",
        quantity: qty,
        priceUnit: price,
        why: whyIdx !== -1 && row[whyIdx] ? row[whyIdx].toString().trim() : "",
        remark: remarkIdx !== -1 && row[remarkIdx] ? row[remarkIdx].toString().trim() : "",
        feeAmount: feeAmount,
        rebalanceId: rebalanceId,
        fxToThb: parsedFx
      };
      
      trades.push(trade);
      
      var underlyingAsset = assetName.indexOf(":S1X") !== -1 ? assetName.replace(":S1X", "") : assetName;
      if (uniqueAssets.indexOf(underlyingAsset) === -1) {
        uniqueAssets.push(underlyingAsset);
        assetTypesMap[underlyingAsset] = assetType === "Crypto Short 1x" ? "Crypto" : assetType;
        assetCurrenciesMap[underlyingAsset] = curVal;
      }
      
      if (portfolio && portfolios.indexOf(portfolio) === -1) {
        portfolios.push(portfolio);
      }
    }
  }
  
  // Read Rebalance Pairs
  var rebalancePairs = [];
  try {
    var rpSheet = ss.getSheetByName("Rebalance_Pairs");
    if (rpSheet && rpSheet.getLastRow() >= 2) {
      var rpRows = rpSheet.getDataRange().getValues();
      var rpH = rpRows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
      
      function getRpVal(row, key, def) {
        var idx = rpH.indexOf(key.toLowerCase());
        return idx !== -1 && row[idx] !== undefined && row[idx] !== "" ? row[idx] : def;
      }
      
      for (var r = 1; r < rpRows.length; r++) {
        var rpRow = rpRows[r];
        var pId = getRpVal(rpRow, "pair id", "");
        if (!pId) continue;
        
        var pairObj = {
          pairId: String(pId),
          portfolio: String(getRpVal(rpRow, "portfolio", "")),
          pairName: String(getRpVal(rpRow, "pair name", "")),
          assetA: String(getRpVal(rpRow, "asset a", "")).toUpperCase(),
          assetAType: String(getRpVal(rpRow, "asset a type", "Crypto")),
          assetACurrency: String(getRpVal(rpRow, "asset a currency", "USD")),
          targetA: parseFloat(getRpVal(rpRow, "target a %", 50)) || 50,
          assetB: String(getRpVal(rpRow, "asset b", "")).toUpperCase(),
          assetBType: String(getRpVal(rpRow, "asset b type", "Crypto Short 1x")),
          assetBCurrency: String(getRpVal(rpRow, "asset b currency", "USD")),
          targetB: parseFloat(getRpVal(rpRow, "target b %", 50)) || 50,
          mode: String(getRpVal(rpRow, "trigger mode", "Drift")),
          driftThreshold: parseFloat(getRpVal(rpRow, "drift threshold %", 5)) || 5,
          scheduleFrequency: String(getRpVal(rpRow, "schedule frequency", "Monthly")),
          scheduleAnchor: String(getRpVal(rpRow, "schedule anchor", "")),
          lastRebalanced: String(getRpVal(rpRow, "last rebalanced", "")),
          customFee: getRpVal(rpRow, "custom fee", false) === true || String(getRpVal(rpRow, "custom fee", "")).toUpperCase() === "TRUE",
          feeAMode: String(getRpVal(rpRow, "fee a mode", "percent")),
          feeAValue: parseFloat(getRpVal(rpRow, "fee a value", 0)) || 0,
          feeBMode: String(getRpVal(rpRow, "fee b mode", "percent")),
          feeBValue: parseFloat(getRpVal(rpRow, "fee b value", 0)) || 0,
          status: String(getRpVal(rpRow, "status", "Active")),
          created: String(getRpVal(rpRow, "created", "")),
          notes: String(getRpVal(rpRow, "notes", ""))
        };
        rebalancePairs.push(pairObj);
        
        // Ensure live prices are fetched for pair assets
        if (pairObj.status === "Active") {
          [pairObj.assetA, pairObj.assetB].forEach(function(sym) {
            if (!sym) return;
            var cleanSym = sym.indexOf(":S1X") !== -1 ? sym.replace(":S1X", "") : sym;
            if (uniqueAssets.indexOf(cleanSym) === -1) {
              uniqueAssets.push(cleanSym);
              assetTypesMap[cleanSym] = "Crypto";
            }
          });
        }
      }
    }
  } catch (e) {}
  
  // Read Rebalance Log
  var rebalanceLog = [];
  try {
    var rlSheet = ss.getSheetByName("Rebalance_Log");
    if (rlSheet && rlSheet.getLastRow() >= 2) {
      var rlRows = rlSheet.getDataRange().getValues();
      var rlH = rlRows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
      
      function getRlVal(row, key, def) {
        var idx = rlH.indexOf(key.toLowerCase());
        return idx !== -1 && row[idx] !== undefined && row[idx] !== "" ? row[idx] : def;
      }
      
      for (var l = 1; l < rlRows.length; l++) {
        var rlRow = rlRows[l];
        var rId = getRlVal(rlRow, "rebalance id", "");
        if (!rId) continue;
        
        rebalanceLog.push({
          rebalanceId: String(rId),
          pairId: String(getRlVal(rlRow, "pair id", "")),
          portfolio: String(getRlVal(rlRow, "portfolio", "")),
          executedOn: String(getRlVal(rlRow, "executed on", "")),
          trigger: String(getRlVal(rlRow, "trigger", "")),
          sellAsset: String(getRlVal(rlRow, "sell asset", "")),
          sellQty: parseFloat(getRlVal(rlRow, "sell qty", 0)) || 0,
          sellPrice: parseFloat(getRlVal(rlRow, "sell price", 0)) || 0,
          sellFee: parseFloat(getRlVal(rlRow, "sell fee", 0)) || 0,
          buyAsset: String(getRlVal(rlRow, "buy asset", "")),
          buyQty: parseFloat(getRlVal(rlRow, "buy qty", 0)) || 0,
          buyPrice: parseFloat(getRlVal(rlRow, "buy price", 0)) || 0,
          buyFee: parseFloat(getRlVal(rlRow, "buy fee", 0)) || 0,
          valueMovedTHB: parseFloat(getRlVal(rlRow, "value moved thb", 0)) || 0,
          beforePctA: parseFloat(getRlVal(rlRow, "before a %", 0)) || 0,
          targetPctA: parseFloat(getRlVal(rlRow, "target a %", 0)) || 0,
          afterPctA: parseFloat(getRlVal(rlRow, "after a %", 0)) || 0,
          realizedPnLTHB: parseFloat(getRlVal(rlRow, "realized pnl thb", 0)) || 0,
          reason: String(getRlVal(rlRow, "reason", "")),
          status: String(getRlVal(rlRow, "status", "Done")),
          created: String(getRlVal(rlRow, "created", ""))
        });
      }
    }
  } catch (e) {}
  
  // Parallel Market Data Fetch
  var marketData = fetchMarketPrices(uniqueAssets, assetTypesMap, assetCurrenciesMap);
  livePrices = marketData.livePrices;
  liveRates = marketData.liveRates;
  
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
  
  // Read Cash Ledger
  var cashLedger = [];
  try {
    var clSheet = ss.getSheetByName("Cash_Ledger");
    if (clSheet && clSheet.getLastRow() >= 2) {
      var clRows = clSheet.getDataRange().getValues();
      var clH = clRows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
      
      function getClVal(row, key, def) {
        var idx = clH.indexOf(key.toLowerCase());
        return idx !== -1 && row[idx] !== undefined && row[idx] !== "" ? row[idx] : def;
      }
      
      for (var c = 1; c < clRows.length; c++) {
        var clRow = clRows[c];
        var eId = getClVal(clRow, "entry id", "");
        if (!eId) continue;
        
        var dVal = "";
        var rawD = getClVal(clRow, "entry date", "");
        if (rawD instanceof Date) {
          dVal = Utilities.formatDate(rawD, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else if (rawD) {
          dVal = rawD.toString().split(" ")[0].trim();
        }
        
        cashLedger.push({
          entryId: String(eId),
          date: dVal,
          portfolio: String(getClVal(clRow, "portfolio", "Main Trading")),
          kind: String(getClVal(clRow, "kind", "Deposit")),
          asset: String(getClVal(clRow, "asset", "")).toUpperCase(),
          currency: String(getClVal(clRow, "currency", "THB")),
          gross: parseFloat(getClVal(clRow, "gross", 0)) || 0,
          withholdingTax: parseFloat(getClVal(clRow, "withholding tax", 0)) || 0,
          net: parseFloat(getClVal(clRow, "net", 0)) || 0,
          fxToThb: parseFloat(getClVal(clRow, "fx to thb", 1.0)) || 1.0,
          note: String(getClVal(clRow, "note", "")),
          created: String(getClVal(clRow, "created", ""))
        });
      }
    }
  } catch (e) {}
  
    return {
      schemaVersion: SCHEMA_VERSION,
      trades: trades,
      portfolios: portfolios,
      portfolioConfigs: portfolioConfigs,
      rebalancePairs: rebalancePairs,
      rebalanceLog: rebalanceLog,
      cashLedger: cashLedger,
      livePrices: livePrices,
      liveRates: liveRates,
      priceDiagnostics: marketData.priceDiagnostics,
      syncTime: new Date().toISOString()
    };
  } catch (outerErr) {
    return {
      schemaVersion: SCHEMA_VERSION,
      trades: [],
      portfolios: ["Main Trading", "BTC Stock", "Crypto"],
      portfolioConfigs: {},
      rebalancePairs: [],
      rebalanceLog: [],
      cashLedger: [],
      livePrices: {},
      liveRates: { "THB": 1.0, "USD": 32.69, "EUR": 38.04 },
      priceDiagnostics: {},
      syncTime: new Date().toISOString(),
      error: outerErr.toString()
    };
  }
}

// Universal Ticker / Market Resolver
// Maps Thai Stocks to .BK, Crypto to -USD, and Global Stocks to direct US tickers
function resolveYahooSymbol(assetName, assetType, currency) {
  var raw = String(assetName || "").trim();
  if (!raw) return "";
  
  var clean = raw.replace(/:S1X|:SHORT/gi, "").trim().toUpperCase();
  
  // 1. Direct explicit map for known tickers
  var tickerMap = {
    "BJC": "BJC.BK",
    "KCE": "KCE.BK",
    "JMART": "JMART.BK",
    "ROJNA": "ROJNA.BK",
    "PTG": "PTG.BK",
    "IVL": "IVL.BK",
    "LH": "LH.BK",
    "CPALL": "CPALL.BK",
    "DELTA": "DELTA.BK",
    "AOT": "AOT.BK",
    "PTT": "PTT.BK",
    "ADVANC": "ADVANC.BK",
    "BDMS": "BDMS.BK",
    "GULF": "GULF.BK",
    "KBANK": "KBANK.BK",
    "SCB": "SCB.BK",
    "TRUE": "TRUE.BK",
    "SCC": "SCC.BK",
    "MSTR": "MSTR",
    "CRCL": "CRCL",
    "META": "META",
    "HOOD": "HOOD",
    "AAPL": "AAPL",
    "NVDA": "NVDA",
    "TSLA": "TSLA",
    "MSFT": "MSFT",
    "GOOGL": "GOOGL",
    "AMZN": "AMZN"
  };
  
  if (tickerMap[clean]) {
    return tickerMap[clean];
  }
  
  var typeLower = String(assetType || "").toLowerCase().trim();
  var curLower = String(currency || "").toLowerCase().trim();
  
  // 2. Crypto detection
  if (typeLower.indexOf("crypto") !== -1 || typeLower.indexOf("เหรียญ") !== -1 || typeLower.indexOf("คริปโต") !== -1) {
    if (clean.indexOf("-") === -1 && !clean.endsWith("USDT") && !clean.endsWith("USD")) {
      return clean + "-USD";
    }
    return clean;
  }
  
  // 3. Thai stock detection (via assetType OR currency = THB when not explicitly US/Global)
  var isThai = (
    typeLower.indexOf("thai") !== -1 ||
    typeLower.indexOf("set") !== -1 ||
    typeLower.indexOf("bkk") !== -1 ||
    typeLower.indexOf("หุ้นไทย") !== -1 ||
    typeLower === "thai stock" ||
    (curLower === "thb" && typeLower.indexOf("global") === -1 && typeLower.indexOf("us") === -1)
  );
  
  if (isThai && !clean.endsWith(".BK")) {
    return clean + ".BK";
  }
  
  // 4. Default: Global Stock (US / International) direct ticker
  return clean;
}

// Fetch Market Prices from Yahoo Finance (using V.เก่า native UrlFetchApp.fetchAll format + spark & query2 fallbacks) and Binance
function fetchMarketPrices(uniqueAssets, assetTypesMap, assetCurrenciesMap) {
  var livePrices = {};
  var liveRates = { "THB": 1.0, "USD": 32.69, "EUR": 38.04 };
  var priceDiagnostics = {};

  try {
    var fetchRequests = [];
    fetchRequests.push({ url: "https://query1.finance.yahoo.com/v8/finance/chart/USDTHB=X", muteHttpExceptions: true });
    fetchRequests.push({ url: "https://query1.finance.yahoo.com/v8/finance/chart/EURTHB=X", muteHttpExceptions: true });
    
    // Sanitize uniqueAssets to remove empty strings or whitespace
    var cleanAssets = [];
    for (var u = 0; u < uniqueAssets.length; u++) {
      var a = uniqueAssets[u];
      if (a && typeof a === "string" && a.trim().length > 0 && cleanAssets.indexOf(a.trim()) === -1) {
        cleanAssets.push(a.trim());
      }
    }
    
    var resolvedSymbols = [];
    for (var j = 0; j < cleanAssets.length; j++) {
      var asset = cleanAssets[j];
      var type = (assetTypesMap && assetTypesMap[asset]) || "";
      var cur = (assetCurrenciesMap && assetCurrenciesMap[asset]) || "";
      var symbol = resolveYahooSymbol(asset, type, cur);
      resolvedSymbols.push(symbol);
      fetchRequests.push({ url: "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol), muteHttpExceptions: true });
    }
    
    var responses = UrlFetchApp.fetchAll(fetchRequests);
    
    try {
      var usdRes = JSON.parse(responses[0].getContentText());
      var usdPrice = usdRes.chart.result[0].meta.regularMarketPrice || usdRes.chart.result[0].meta.chartPreviousClose;
      if (usdPrice) liveRates.USD = usdPrice;
    } catch(e) {}
    
    try {
      var eurRes = JSON.parse(responses[1].getContentText());
      var eurPrice = eurRes.chart.result[0].meta.regularMarketPrice || eurRes.chart.result[0].meta.chartPreviousClose;
      if (eurPrice) liveRates.EUR = eurPrice;
    } catch(e) {}
    
    var fallbackHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json"
    };

    for (var j = 0; j < cleanAssets.length; j++) {
      var asset = cleanAssets[j];
      var sym = resolvedSymbols[j];
      var upperAsset = asset.toUpperCase().trim();
      var responseIndex = j + 2; 
      var price = null;
      var status = 0;
      var errorMsg = "";

      try {
        var resp = responses[responseIndex];
        status = resp.getResponseCode ? resp.getResponseCode() : 200;
        var text = resp.getContentText();
        var res = JSON.parse(text);
        var meta = res && res.chart && res.chart.result && res.chart.result[0] && res.chart.result[0].meta;
        if (meta) {
          price = meta.regularMarketPrice;
          if (price === undefined || price === null || isNaN(price)) {
            price = meta.chartPreviousClose;
          }
        }
        if ((price === undefined || price === null || isNaN(price)) && res && res.chart && res.chart.result && res.chart.result[0].indicators && res.chart.result[0].indicators.quote && res.chart.result[0].indicators.quote[0]) {
          var closeArr = res.chart.result[0].indicators.quote[0].close;
          if (Array.isArray(closeArr)) {
            for (var c = closeArr.length - 1; c >= 0; c--) {
              if (closeArr[c] !== null && !isNaN(closeArr[c])) {
                price = closeArr[c];
                break;
              }
            }
          }
        }
      } catch(parseErr) {
        errorMsg = parseErr.toString();
      }

      // Fallback 1: Yahoo Finance /v8/finance/spark endpoint
      if (price === undefined || price === null || isNaN(price) || price <= 0) {
        try {
          var sparkResp = UrlFetchApp.fetch("https://query1.finance.yahoo.com/v8/finance/spark?symbols=" + encodeURIComponent(sym) + "&range=5d&interval=1d", { muteHttpExceptions: true });
          if (sparkResp.getResponseCode() === 200) {
            var sparkRes = JSON.parse(sparkResp.getContentText());
            var sparkEntry = sparkRes && sparkRes[sym];
            if (sparkEntry && Array.isArray(sparkEntry.close)) {
              for (var sc = sparkEntry.close.length - 1; sc >= 0; sc--) {
                if (sparkEntry.close[sc] !== null && !isNaN(sparkEntry.close[sc]) && sparkEntry.close[sc] > 0) {
                  price = sparkEntry.close[sc];
                  break;
                }
              }
            }
          }
        } catch (sparkErr) {}
      }

      // Fallback 2: query2.finance.yahoo.com with browser UA
      if (price === undefined || price === null || isNaN(price) || price <= 0) {
        try {
          var q2Resp = UrlFetchApp.fetch("https://query2.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym), { headers: fallbackHeaders, muteHttpExceptions: true });
          if (q2Resp.getResponseCode() === 200) {
            var q2Res = JSON.parse(q2Resp.getContentText());
            var q2Meta = q2Res && q2Res.chart && q2Res.chart.result && q2Res.chart.result[0] && q2Res.chart.result[0].meta;
            if (q2Meta) {
              price = q2Meta.regularMarketPrice || q2Meta.chartPreviousClose;
            }
          }
        } catch (q2Err) {
          if (!errorMsg) errorMsg = q2Err.toString();
        }
      }

      if (price !== undefined && price !== null && !isNaN(price) && price > 0) {
        livePrices[asset] = price;
        livePrices[upperAsset] = price;
        livePrices[sym] = price;
        if (sym.endsWith(".BK")) {
          livePrices[sym.replace(".BK", "")] = price;
        }
        livePrices[upperAsset + ":S1X"] = price;
        priceDiagnostics[asset] = { symbol: sym, ok: true, price: price, source: "yahoo", status: status };
      } else {
        priceDiagnostics[asset] = { symbol: sym, ok: false, price: null, source: "yahoo", status: status, error: errorMsg || "No price in Yahoo chart response" };
      }
    }

    // Direct Binance API fallback ONLY for crypto assets
    try {
      var cryptoOnlyAssets = cleanAssets.filter(function(a) {
        var t = (assetTypesMap && assetTypesMap[a]) || "";
        return t.toLowerCase().indexOf("crypto") !== -1;
      });

      if (cryptoOnlyAssets.length > 0) {
        var binanceRes = UrlFetchApp.fetch("https://api.binance.com/api/v3/ticker/price", { muteHttpExceptions: true });
        if (binanceRes.getResponseCode() === 200) {
          var bData = JSON.parse(binanceRes.getContentText());
          var bMap = {};
          for (var b = 0; b < bData.length; b++) {
            bMap[bData[b].symbol] = parseFloat(bData[b].price);
          }
          for (var k = 0; k < cryptoOnlyAssets.length; k++) {
            var cAsset = cryptoOnlyAssets[k];
            var uAsset = cAsset.toUpperCase().replace(/:S1X|:SHORT/gi, "").trim();
            var bPrice = bMap[uAsset + "USDT"] || bMap[uAsset + "USD"];
            if (bPrice !== undefined && !isNaN(bPrice) && bPrice > 0) {
              livePrices[cAsset] = bPrice;
              livePrices[uAsset] = bPrice;
              livePrices[uAsset + ":S1X"] = bPrice;
              priceDiagnostics[cAsset] = { symbol: uAsset + "USDT", ok: true, price: bPrice, source: "binance", status: 200 };
            }
          }
        }
      }
    } catch (bErr) {}
  } catch(e) {
    priceDiagnostics["_global"] = { ok: false, error: e.toString() };
  }

  return {
    livePrices: livePrices,
    liveRates: liveRates,
    priceDiagnostics: priceDiagnostics
  };
}

// Lightweight price endpoint action
function getPricesData(symbols) {
  var targetAssets = [];
  var assetTypesMap = {};
  var assetCurrenciesMap = {};

  if (symbols && Array.isArray(symbols) && symbols.length > 0) {
    targetAssets = symbols;
  } else {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Journal");
    if (sheet && sheet.getLastRow() > 1) {
      var rows = sheet.getDataRange().getValues();
      var headers = rows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
      var assetIdx = headers.indexOf("asset name");
      var typeIdx = headers.indexOf("asset type");
      var curIdx = headers.indexOf("currency");
      for (var i = 1; i < rows.length; i++) {
        var name = assetIdx !== -1 ? String(rows[i][assetIdx] || "").trim().toUpperCase() : "";
        var type = typeIdx !== -1 ? String(rows[i][typeIdx] || "").trim() : "";
        var cur = curIdx !== -1 ? String(rows[i][curIdx] || "").trim() : "";
        if (name) {
          var clean = name.replace(/:S1X|:SHORT/gi, "");
          if (targetAssets.indexOf(clean) === -1) {
            targetAssets.push(clean);
            assetTypesMap[clean] = type;
            assetCurrenciesMap[clean] = cur;
          }
        }
      }
    }
  }

  var result = fetchMarketPrices(targetAssets, assetTypesMap, assetCurrenciesMap);
  return {
    schemaVersion: SCHEMA_VERSION,
    livePrices: result.livePrices,
    liveRates: result.liveRates,
    priceDiagnostics: result.priceDiagnostics,
    syncTime: new Date().toISOString()
  };
}

// Build a Journal row array
function buildJournalRow(headers, newRowIdx, trade) {
  var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
  
  function getIndex(keywords) {
    for (var i = 0; i < headersLower.length; i++) {
      var h = headersLower[i];
      for (var k = 0; k < keywords.length; k++) {
        if (h === keywords[k] || h.indexOf(keywords[k]) !== -1) {
          return i;
        }
      }
    }
    return -1;
  }
  
  var rowValues = new Array(headers.length).fill("");
  
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
  var rebalanceIdIdx = getIndex(["rebalance id", "rebalance_id"]);
  var fxToThbIdx = getIndex(["fx to thb", "fx_to_thb", "fxtothb"]);
  
  var amountIdx = getIndex(["amount"]);
  var curPriceIdx = getIndex(["current price"]);
  var curValueIdx = getIndex(["current value"]);
  var pnlIdx = getIndex(["p&l"]);
  var pnlPctIdx = getIndex(["p&l %"]);
  
  function sanitizeString(str) {
    if (!str) return "";
    var s = str.toString().trim();
    if (s.indexOf("=") === 0 || s.indexOf("+") === 0 || s.indexOf("-") === 0 || s.indexOf("@") === 0) {
      return "'" + s;
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
  if (rebalanceIdIdx !== -1) rowValues[rebalanceIdIdx] = sanitizeString(trade.rebalanceId || "");
  if (fxToThbIdx !== -1) {
    rowValues[fxToThbIdx] = (trade.fxToThb !== undefined && trade.fxToThb !== null && trade.fxToThb !== '') ? parseFloat(trade.fxToThb) : (trade.currency === 'THB' ? 1.0 : "");
  }
  
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
  
  if (amountIdx !== -1 && qtyLetter && priceLetter) {
    if (feeLetter) {
      rowValues[amountIdx] = '=IF(' + actionLetter + newRowIdx + '="Buy",(' + qtyLetter + newRowIdx + '*' + priceLetter + newRowIdx + ')+' + feeLetter + newRowIdx + ',(' + qtyLetter + newRowIdx + '*' + priceLetter + newRowIdx + ')-' + feeLetter + newRowIdx + ')';
    } else {
      rowValues[amountIdx] = "=" + qtyLetter + newRowIdx + "*" + priceLetter + newRowIdx;
    }
  }
  
  if (curPriceIdx !== -1) {
    rowValues[curPriceIdx] = "";
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
  
  return rowValues;
}

// Atomic Batch Write for adding trade
function addTrade(trade) {
  ensureTableStructure();
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Journal");
  var lastRow = sheet.getLastRow();
  var newRowIdx = lastRow + 1;
  var lastCol = sheet.getLastColumn();
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rowValues = buildJournalRow(headers, newRowIdx, trade);
  sheet.getRange(newRowIdx, 1, 1, rowValues.length).setValues([rowValues]);
  return { success: true };
}

function deleteTrade(tradeId) {
  ensureTableStructure();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Journal");
  var lastRow = sheet.getLastRow();
  
  var idStr = tradeId.toString().trim();
  if (idStr.indexOf("sig-") === 0) {
    var rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) {
      return { success: false, error: "Journal is empty." };
    }
    
    var headers = rows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    var dateIdx = headers.indexOf("date");
    var assetIdx = headers.indexOf("asset name");
    var actIdx = headers.indexOf("action");
    var qtyIdx = headers.indexOf("quantity");
    if (qtyIdx === -1) qtyIdx = headers.indexOf("qty");
    var priceIdx = headers.indexOf("price/unit");
    if (priceIdx === -1) priceIdx = headers.indexOf("price_unit");
    if (priceIdx === -1) priceIdx = headers.indexOf("price");
    
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      try {
        var assetName = assetIdx !== -1 ? r[assetIdx].toString().trim().toUpperCase() : "";
        var action = actIdx !== -1 ? r[actIdx].toString().trim() : "";
        var qty = qtyIdx !== -1 ? parseFloat(r[qtyIdx]) || 0 : 0;
        var price = priceIdx !== -1 ? parseFloat(r[priceIdx]) || 0 : 0;
        
        var dateVal = "";
        if (dateIdx !== -1 && r[dateIdx]) {
          var d = r[dateIdx];
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
        sheet.getRange(i + 1, namesColIdx + 1).clearContent();
        return { success: true };
      }
    }
  }
  return { success: false, error: "Portfolio not found." };
}

function renamePortfolio(oldName, newName) {
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pSheet = ss.getSheetByName("Portfolios");
  var jSheet = ss.getSheetByName("Journal");
  
  // 1. Rename in Portfolios sheet
  var pLastRow = pSheet.getLastRow();
  var pHeaders = pSheet.getRange(1, 1, 1, pSheet.getLastColumn()).getValues()[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  var namesColIdx = pHeaders.indexOf("portfolio names");
  
  if (namesColIdx !== -1) {
    var nameValues = pSheet.getRange(1, namesColIdx + 1, pLastRow, 1).getValues();
    for (var i = 1; i < nameValues.length; i++) {
      if (nameValues[i][0].toString().trim().toLowerCase() === oldName.toLowerCase()) {
        pSheet.getRange(i + 1, namesColIdx + 1).setValue(newName);
        break;
      }
    }
  }
  
  // 2. Cascade rename across Journal rows
  var jLastRow = jSheet.getLastRow();
  if (jLastRow >= 2) {
    var jHeaders = jSheet.getRange(1, 1, 1, jSheet.getLastColumn()).getValues()[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    var portColIdx = jHeaders.indexOf("portfolio");
    if (portColIdx !== -1) {
      var portValues = jSheet.getRange(1, portColIdx + 1, jLastRow, 1).getValues();
      var batchUpdates = [];
      var hasChanges = false;
      
      for (var j = 1; j < portValues.length; j++) {
        var currentPort = portValues[j][0].toString().trim();
        if (currentPort.toLowerCase() === oldName.toLowerCase()) {
          batchUpdates.push([newName]);
          hasChanges = true;
        } else {
          batchUpdates.push([currentPort]);
        }
      }
      
      if (hasChanges) {
        jSheet.getRange(2, portColIdx + 1, batchUpdates.length, 1).setValues(batchUpdates);
      }
    }
  }
  
  return { success: true };
}

function transferPosition(assetName, targetPortfolio) {
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Journal");
  var lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return { success: false, error: "Journal is empty." };
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
  var assetIdx = headersLower.indexOf("asset name");
  var portIdx = headersLower.indexOf("portfolio");
  
  if (assetIdx === -1 || portIdx === -1) return { success: false, error: "Required columns missing." };
  
  var assetValues = sheet.getRange(2, assetIdx + 1, lastRow - 1, 1).getValues();
  var portValues = sheet.getRange(2, portIdx + 1, lastRow - 1, 1).getValues();
  var targetUpper = assetName.toUpperCase().trim();
  
  for (var i = 0; i < assetValues.length; i++) {
    if (assetValues[i][0].toString().toUpperCase().trim() === targetUpper) {
      portValues[i][0] = targetPortfolio;
    }
  }
  
  sheet.getRange(2, portIdx + 1, portValues.length, 1).setValues(portValues);
  return { success: true };
}

function validateTicker(symbol, assetType) {
  var symbolStripped = symbol ? symbol.toUpperCase().trim() : "";
  if (!symbolStripped) {
    return { valid: false, message: "Ticker symbol cannot be empty." };
  }
  
  var resolvedSymbol = resolveYahooSymbol(symbolStripped, assetType, "");
  var defaultHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json"
  };
  
  try {
    var response = UrlFetchApp.fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(resolvedSymbol), { headers: defaultHeaders, muteHttpExceptions: true });
    var json = JSON.parse(response.getContentText());
    var meta = json && json.chart && json.chart.result && json.chart.result[0] && json.chart.result[0].meta;
    var price = meta ? (meta.regularMarketPrice || meta.chartPreviousClose) : null;
    if (price !== null && price !== undefined && !isNaN(price)) {
      var currency = (meta && meta.currency) || "";
      return {
        valid: true,
        ticker: resolvedSymbol,
        price: price,
        currency: currency,
        message: "Ticker '" + resolvedSymbol + "' verified. Live Price: " + price + (currency ? " " + currency : "")
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

// ==========================================
// Rebalance Actions (Step 4 Backend Handlers)
// ==========================================

function savePair(pair) {
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pairsSheet = ss.getSheetByName("Rebalance_Pairs");
  var pRows = pairsSheet.getDataRange().getValues();
  var pH = pRows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  
  var pIdCol = pH.indexOf("pair id");
  var portCol = pH.indexOf("portfolio");
  var aCol = pH.indexOf("asset a");
  var bCol = pH.indexOf("asset b");
  
  var assetA = String(pair.assetA || "").trim().toUpperCase();
  var assetB = String(pair.assetB || "").trim().toUpperCase();
  var portfolio = String(pair.portfolio || "").trim();
  
  if (!portfolio) throw new Error("Portfolio is required.");
  if (!assetA || !assetB) throw new Error("Asset A and Asset B are required.");
  if (assetA === assetB) throw new Error("Asset A and Asset B cannot be the same asset.");
  
  var targetA = parseFloat(pair.targetA);
  if (isNaN(targetA) || targetA < 1 || targetA > 99) throw new Error("Target A % must be between 1 and 99.");
  var targetB = 100 - targetA;
  
  var mode = String(pair.mode || "Drift");
  if (["Drift", "Schedule", "Manual"].indexOf(mode) === -1) throw new Error("Invalid Trigger Mode.");
  
  var driftThreshold = parseFloat(pair.driftThreshold) || 5;
  if (mode === "Drift" && driftThreshold <= 0) throw new Error("Drift Threshold must be greater than 0.");
  
  if (mode === "Schedule") {
    if (!pair.scheduleFrequency) throw new Error("Schedule Frequency is required for Schedule mode.");
    if (!pair.scheduleAnchor) throw new Error("Schedule Anchor date is required for Schedule mode.");
  }
  
  var existingRow = -1;
  for (var r = 1; r < pRows.length; r++) {
    var rId = String(pRows[r][pIdCol] || "");
    if (pair.pairId && rId === String(pair.pairId)) {
      existingRow = r + 1;
      continue;
    }
    // Check duplicate pair in same portfolio
    var rPort = String(pRows[r][portCol] || "");
    var rA = String(pRows[r][aCol] || "").toUpperCase();
    var rB = String(pRows[r][bCol] || "").toUpperCase();
    if (rPort === portfolio && ((rA === assetA && rB === assetB) || (rA === assetB && rB === assetA))) {
      throw new Error("A pair with these assets already exists in portfolio '" + portfolio + "'.");
    }
  }
  
  var pairId = pair.pairId || nextId("RP");
  var pairName = pair.pairName || (assetA + " vs " + assetB);
  var customFee = pair.customFee === true || String(pair.customFee).toUpperCase() === "TRUE";
  var feeAMode = String(pair.feeAMode || "percent");
  var feeAValue = parseFloat(pair.feeAValue) || 0;
  var feeBMode = String(pair.feeBMode || "percent");
  var feeBValue = parseFloat(pair.feeBValue) || 0;
  var status = String(pair.status || "Active");
  var created = pair.created || new Date().toISOString();
  
  var rowVals = new Array(pH.length).fill("");
  function setVal(name, val) {
    var idx = pH.indexOf(name.toLowerCase());
    if (idx !== -1) rowVals[idx] = val;
  }
  
  setVal("Pair ID", pairId);
  setVal("Portfolio", portfolio);
  setVal("Pair Name", pairName);
  setVal("Asset A", assetA);
  setVal("Asset A Type", pair.assetAType || "Crypto");
  setVal("Asset A Currency", pair.assetACurrency || "USD");
  setVal("Target A %", targetA);
  setVal("Asset B", assetB);
  setVal("Asset B Type", pair.assetBType || "Crypto Short 1x");
  setVal("Asset B Currency", pair.assetBCurrency || "USD");
  setVal("Target B %", targetB);
  setVal("Trigger Mode", mode);
  setVal("Drift Threshold %", driftThreshold);
  setVal("Schedule Frequency", pair.scheduleFrequency || "Monthly");
  setVal("Schedule Anchor", pair.scheduleAnchor || "");
  setVal("Last Rebalanced", pair.lastRebalanced || "");
  setVal("Custom Fee", customFee);
  setVal("Fee A Mode", feeAMode);
  setVal("Fee A Value", feeAValue);
  setVal("Fee B Mode", feeBMode);
  setVal("Fee B Value", feeBValue);
  setVal("Status", status);
  setVal("Created", created);
  setVal("Notes", pair.notes || "");
  
  if (existingRow !== -1) {
    pairsSheet.getRange(existingRow, 1, 1, rowVals.length).setValues([rowVals]);
  } else {
    var nextRow = pairsSheet.getLastRow() + 1;
    pairsSheet.getRange(nextRow, 1, 1, rowVals.length).setValues([rowVals]);
  }
  
  return { success: true, pairId: pairId };
}

function setPairStatus(pairId, status) {
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Rebalance_Pairs");
  var rows = sheet.getDataRange().getValues();
  var pH = rows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  var idCol = pH.indexOf("pair id");
  var statusCol = pH.indexOf("status");
  
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][idCol]) === String(pairId)) {
      sheet.getRange(r + 1, statusCol + 1).setValue(status);
      return { success: true };
    }
  }
  return { success: false, error: "Pair ID not found: " + pairId };
}

function deletePair(pairId) {
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Rebalance_Pairs");
  var rows = sheet.getDataRange().getValues();
  var pH = rows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  var idCol = pH.indexOf("pair id");
  
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][idCol]) === String(pairId)) {
      sheet.deleteRow(r + 1);
      return { success: true };
    }
  }
  return { success: false, error: "Pair ID not found: " + pairId };
}

function executeRebalance(rebalance) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { success: false, error: "Server busy. Please try again." };
  }
  
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var journalSheet = ss.getSheetByName("Journal");
  var pairsSheet = ss.getSheetByName("Rebalance_Pairs");
  var logSheet = ss.getSheetByName("Rebalance_Log");
  
  if (!pairsSheet || !journalSheet || !logSheet) {
    lock.releaseLock();
    return { success: false, error: "Required sheets missing." };
  }
  
  var pRows = pairsSheet.getDataRange().getValues();
  var pH = pRows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  var pIdIdx = pH.indexOf("pair id");
  var portIdx = pH.indexOf("portfolio");
  var pNameIdx = pH.indexOf("pair name");
  var aIdx = pH.indexOf("asset a");
  var bIdx = pH.indexOf("asset b");
  var statusIdx = pH.indexOf("status");
  var lastRebIdx = pH.indexOf("last rebalanced");
  
  var pairRow = -1;
  var targetPair = null;
  for (var r = 1; r < pRows.length; r++) {
    if (String(pRows[r][pIdIdx]) === String(rebalance.pairId)) {
      pairRow = r + 1;
      targetPair = pRows[r];
      break;
    }
  }
  
  if (pairRow === -1) {
    lock.releaseLock();
    return { success: false, error: "Pair not found: " + rebalance.pairId };
  }
  
  var pairStatus = String(targetPair[statusIdx] || "");
  if (pairStatus !== "Active") {
    lock.releaseLock();
    return { success: false, error: "Pair is not Active: " + pairStatus };
  }
  
  var pairPort = String(targetPair[portIdx] || "");
  if (rebalance.portfolio !== pairPort) {
    lock.releaseLock();
    return { success: false, error: "Cross-portfolio rebalancing forbidden. Expected: " + pairPort + ", got: " + rebalance.portfolio };
  }
  
  var assetA = String(targetPair[aIdx] || "").toUpperCase();
  var assetB = String(targetPair[bIdx] || "").toUpperCase();
  var sellAsset = String(rebalance.sell.assetName || "").toUpperCase();
  var buyAsset = String(rebalance.buy.assetName || "").toUpperCase();
  
  if (!((sellAsset === assetA && buyAsset === assetB) || (sellAsset === assetB && buyAsset === assetA))) {
    lock.releaseLock();
    return { success: false, error: "Rebalance assets do not match pair: " + sellAsset + " -> " + buyAsset };
  }
  
  var heldQty = getHeldQty(pairPort, sellAsset);
  var sellQty = parseFloat(rebalance.sell.quantity) || 0;
  if (sellQty <= 0) {
    lock.releaseLock();
    return { success: false, error: "Sell quantity must be greater than 0." };
  }
  if (sellQty > heldQty + 1e-7) {
    lock.releaseLock();
    return { success: false, error: "Insufficient held quantity. Holding: " + heldQty + ", requested sell: " + sellQty };
  }
  
  var buyQty = parseFloat(rebalance.buy.quantity) || 0;
  if (buyQty <= 0) {
    lock.releaseLock();
    return { success: false, error: "Buy quantity must be greater than 0." };
  }
  
  var rbId = nextId("RB");
  var pairName = String(targetPair[pNameIdx] || "");
  
  var sellTrade = Object.assign({}, rebalance.sell, {
    portfolio: pairPort,
    date: rebalance.date,
    action: "Sell",
    why: "Rebalance " + pairName,
    remark: rebalance.reason || ("Rebalance " + rbId),
    rebalanceId: rbId
  });
  
  var buyTrade = Object.assign({}, rebalance.buy, {
    portfolio: pairPort,
    date: rebalance.date,
    action: "Buy",
    why: "Rebalance " + pairName,
    remark: rebalance.reason || ("Rebalance " + rbId),
    rebalanceId: rbId
  });
  
  var addedRowIndices = [];
  try {
    var jLastCol = journalSheet.getLastColumn();
    var jHeaders = journalSheet.getRange(1, 1, 1, jLastCol).getValues()[0];
    
    // Add Sell row
    var sellRowIdx = journalSheet.getLastRow() + 1;
    var sellRowVals = buildJournalRow(jHeaders, sellRowIdx, sellTrade);
    journalSheet.getRange(sellRowIdx, 1, 1, sellRowVals.length).setValues([sellRowVals]);
    addedRowIndices.push(sellRowIdx);
    
    // Add Buy row
    var buyRowIdx = journalSheet.getLastRow() + 1;
    var buyRowVals = buildJournalRow(jHeaders, buyRowIdx, buyTrade);
    journalSheet.getRange(buyRowIdx, 1, 1, buyRowVals.length).setValues([buyRowVals]);
    addedRowIndices.push(buyRowIdx);
    
    // Append to Rebalance_Log
    var logHeaders = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
    var logHeadersLower = logHeaders.map(function(h) { return h.toString().toLowerCase().trim(); });
    var logRowVals = new Array(logHeaders.length).fill("");
    
    function setLogVal(name, val) {
      var idx = logHeadersLower.indexOf(name.toLowerCase());
      if (idx !== -1) logRowVals[idx] = val;
    }
    
    var snap = rebalance.snapshot || {};
    setLogVal("Rebalance ID", rbId);
    setLogVal("Pair ID", rebalance.pairId);
    setLogVal("Portfolio", pairPort);
    setLogVal("Executed On", rebalance.date);
    setLogVal("Trigger", rebalance.trigger || "Manual");
    setLogVal("Sell Asset", sellAsset);
    setLogVal("Sell Qty", sellQty);
    setLogVal("Sell Price", parseFloat(rebalance.sell.priceUnit) || 0);
    setLogVal("Sell Fee", parseFloat(rebalance.sell.feeAmount) || 0);
    setLogVal("Buy Asset", buyAsset);
    setLogVal("Buy Qty", buyQty);
    setLogVal("Buy Price", parseFloat(rebalance.buy.priceUnit) || 0);
    setLogVal("Buy Fee", parseFloat(rebalance.buy.feeAmount) || 0);
    setLogVal("Value Moved THB", parseFloat(snap.valueMovedTHB) || 0);
    setLogVal("Before A %", parseFloat(snap.beforePctA) || 0);
    setLogVal("Target A %", parseFloat(snap.targetPctA) || 0);
    setLogVal("After A %", parseFloat(snap.afterPctA) || 0);
    setLogVal("Realized PnL THB", parseFloat(snap.realizedPnLTHB) || 0);
    setLogVal("Reason", rebalance.reason || "");
    setLogVal("Status", "Done");
    setLogVal("Created", new Date().toISOString());
    
    var logNextRow = logSheet.getLastRow() + 1;
    logSheet.getRange(logNextRow, 1, 1, logRowVals.length).setValues([logRowVals]);
    
    // Update Last Rebalanced in Rebalance_Pairs
    if (lastRebIdx !== -1) {
      pairsSheet.getRange(pairRow, lastRebIdx + 1).setValue(rebalance.date);
    }
  } catch (err) {
    for (var k = addedRowIndices.length - 1; k >= 0; k--) {
      try {
        journalSheet.deleteRow(addedRowIndices[k]);
      } catch (e2) {}
    }
    lock.releaseLock();
    return { success: false, error: "Execution failed: " + err.toString() };
  }
  
  lock.releaseLock();
  return { success: true, rebalanceId: rbId };
}

function revertRebalance(rebalanceId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { success: false, error: "Server busy. Please try again." };
  }
  
  ensureTableStructure();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var journalSheet = ss.getSheetByName("Journal");
  var logSheet = ss.getSheetByName("Rebalance_Log");
  var pairsSheet = ss.getSheetByName("Rebalance_Pairs");
  
  if (!logSheet || !journalSheet || !pairsSheet) {
    lock.releaseLock();
    return { success: false, error: "Required sheets missing." };
  }
  
  var lRows = logSheet.getDataRange().getValues();
  var lH = lRows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  var rbIdCol = lH.indexOf("rebalance id");
  var pIdCol = lH.indexOf("pair id");
  var statCol = lH.indexOf("status");
  var execDateCol = lH.indexOf("executed on");
  
  var targetLogRow = -1;
  var pairId = "";
  for (var r = 1; r < lRows.length; r++) {
    if (String(lRows[r][rbIdCol]) === String(rebalanceId)) {
      targetLogRow = r + 1;
      pairId = String(lRows[r][pIdCol] || "");
      break;
    }
  }
  
  if (targetLogRow === -1) {
    lock.releaseLock();
    return { success: false, error: "Rebalance ID not found in Log: " + rebalanceId };
  }
  
  var jRows = journalSheet.getDataRange().getValues();
  var jH = jRows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  var jRbCol = jH.indexOf("rebalance id");
  
  var matchedRows = [];
  if (jRbCol !== -1) {
    for (var i = 1; i < jRows.length; i++) {
      if (String(jRows[i][jRbCol]) === String(rebalanceId)) {
        matchedRows.push(i + 1);
      }
    }
  }
  
  // Delete rows from bottom to top
  matchedRows.sort(function(a, b) { return b - a; });
  for (var m = 0; m < matchedRows.length; m++) {
    journalSheet.deleteRow(matchedRows[m]);
  }
  
  if (statCol !== -1) {
    logSheet.getRange(targetLogRow, statCol + 1).setValue("Reverted");
  }
  
  // Recalculate Last Rebalanced for this pair
  if (pairId) {
    var refreshedLogs = logSheet.getDataRange().getValues();
    var latestDate = "";
    for (var l = 1; l < refreshedLogs.length; l++) {
      if (String(refreshedLogs[l][pIdCol]) === pairId && String(refreshedLogs[l][statCol]) === "Done") {
        var ed = String(refreshedLogs[l][execDateCol] || "");
        if (ed > latestDate) latestDate = ed;
      }
    }
    
    var pRows = pairsSheet.getDataRange().getValues();
    var pH = pRows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    var pIdIdx = pH.indexOf("pair id");
    var lastRebIdx = pH.indexOf("last rebalanced");
    if (pIdIdx !== -1 && lastRebIdx !== -1) {
      for (var pr = 1; pr < pRows.length; pr++) {
        if (String(pRows[pr][pIdIdx]) === pairId) {
          pairsSheet.getRange(pr + 1, lastRebIdx + 1).setValue(latestDate);
          break;
        }
      }
    }
  }
  
  lock.releaseLock();
  return { success: true };
}

// ==========================================
// Cash Ledger Functions (Step 5 Accounting)
// ==========================================

function addCashEntry(entry) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, error: "System is busy. Please try again in a few seconds." };
  }
  
  try {
    ensureTableStructure();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Cash_Ledger");
    if (!sheet) {
      throw new Error("Cash_Ledger sheet not found");
    }
    
    var entryId = nextId("CL");
    var gross = parseFloat(entry.gross) || 0;
    var wht = parseFloat(entry.withholdingTax) || 0;
    var net = (entry.net !== undefined && entry.net !== null && entry.net !== "") ? parseFloat(entry.net) : (gross - wht);
    var fxToThb = parseFloat(entry.fxToThb) || (entry.currency === "THB" ? 1.0 : 1.0);
    
    var rowValues = [
      entryId,
      entry.date ? new Date(entry.date) : new Date(),
      entry.portfolio || "Main Trading",
      entry.kind || "Deposit",
      (entry.asset || "").toString().trim().toUpperCase(),
      entry.currency || "THB",
      gross,
      wht,
      net,
      fxToThb,
      (entry.note || "").toString().trim(),
      new Date().toISOString()
    ];
    
    sheet.appendRow(rowValues);
    return { success: true, entryId: entryId };
  } catch (err) {
    return { success: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function editCashEntry(entry) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, error: "System is busy. Please try again in a few seconds." };
  }
  
  try {
    ensureTableStructure();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Cash_Ledger");
    if (!sheet) throw new Error("Cash_Ledger sheet not found");
    
    var targetId = String(entry.entryId || "").trim();
    if (!targetId) throw new Error("Missing entryId");
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    var idColIdx = headers.indexOf("entry id");
    if (idColIdx === -1) throw new Error("Entry ID column not found");
    
    var targetRowIdx = -1;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idColIdx]).trim() === targetId) {
        targetRowIdx = r + 1;
        break;
      }
    }
    
    if (targetRowIdx === -1) {
      throw new Error("Cash entry " + targetId + " not found");
    }
    
    function setColVal(key, val) {
      var col = headers.indexOf(key.toLowerCase());
      if (col !== -1) {
        sheet.getRange(targetRowIdx, col + 1).setValue(val);
      }
    }
    
    if (entry.date) setColVal("entry date", new Date(entry.date));
    if (entry.portfolio) setColVal("portfolio", entry.portfolio);
    if (entry.kind) setColVal("kind", entry.kind);
    if (entry.asset !== undefined) setColVal("asset", String(entry.asset).toUpperCase().trim());
    if (entry.currency) setColVal("currency", entry.currency);
    if (entry.gross !== undefined) setColVal("gross", parseFloat(entry.gross) || 0);
    if (entry.withholdingTax !== undefined) setColVal("withholding tax", parseFloat(entry.withholdingTax) || 0);
    
    var gross = entry.gross !== undefined ? parseFloat(entry.gross) || 0 : null;
    var wht = entry.withholdingTax !== undefined ? parseFloat(entry.withholdingTax) || 0 : null;
    var net = entry.net !== undefined ? parseFloat(entry.net) || 0 : (gross !== null && wht !== null ? gross - wht : null);
    if (net !== null) setColVal("net", net);
    
    if (entry.fxToThb !== undefined) setColVal("fx to thb", parseFloat(entry.fxToThb) || 1.0);
    if (entry.note !== undefined) setColVal("note", String(entry.note).trim());
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteCashEntry(entryId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, error: "System is busy. Please try again in a few seconds." };
  }
  
  try {
    ensureTableStructure();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Cash_Ledger");
    if (!sheet) throw new Error("Cash_Ledger sheet not found");
    
    var targetId = String(entryId || "").trim();
    if (!targetId) throw new Error("Missing entryId");
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    var idColIdx = headers.indexOf("entry id");
    if (idColIdx === -1) throw new Error("Entry ID column not found");
    
    var targetRowIdx = -1;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idColIdx]).trim() === targetId) {
        targetRowIdx = r + 1;
        break;
      }
    }
    
    if (targetRowIdx === -1) {
      throw new Error("Cash entry " + targetId + " not found");
    }
    
    sheet.deleteRow(targetRowIdx);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// Atomic Batch Write for adding multiple trades (up to 200 per batch)
function addTradesBatch(trades) {
  if (!trades || !trades.length) return { success: false, error: "No trades provided." };
  if (trades.length > 200) return { success: false, error: "Batch size exceeds maximum limit of 200 trades." };
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, error: "System is busy. Please try again in a few seconds." };
  }
  
  try {
    ensureTableStructure();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Journal");
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    var batchRows = [];
    for (var i = 0; i < trades.length; i++) {
      var rowIdx = lastRow + 1 + i;
      var rowValues = buildJournalRow(headers, rowIdx, trades[i]);
      batchRows.push(rowValues);
    }
    
    if (batchRows.length > 0) {
      sheet.getRange(lastRow + 1, 1, batchRows.length, headers.length).setValues(batchRows);
    }
    return { success: true, count: batchRows.length };
  } catch (err) {
    return { success: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// Fetch historical daily prices from Yahoo Finance with CacheService (6-hour cache)
function getHistory(symbols, range) {
  if (!symbols || !symbols.length) return { success: true, history: {} };
  var targetRange = range || "1y";
  var cache = CacheService.getScriptCache();
  var result = {};
  var uncachedSymbols = [];
  
  for (var i = 0; i < symbols.length; i++) {
    var sym = symbols[i];
    var cacheKey = "HIST_" + sym + "_" + targetRange;
    var cached = cache.get(cacheKey);
    if (cached) {
      try {
        result[sym] = JSON.parse(cached);
      } catch (e) {
        uncachedSymbols.push(sym);
      }
    } else {
      uncachedSymbols.push(sym);
    }
  }
  
  if (uncachedSymbols.length === 0) {
    return { success: true, history: result };
  }
  
  var defaultHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json"
  };
  
  var requests = uncachedSymbols.map(function(sym) {
    var resolvedSym = resolveYahooSymbol(sym, "", "");
    return {
      url: "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(resolvedSym) + "?range=" + targetRange + "&interval=1d",
      headers: defaultHeaders,
      muteHttpExceptions: true
    };
  });
  
  try {
    var responses = UrlFetchApp.fetchAll(requests);
    for (var j = 0; j < responses.length; j++) {
      var symOrig = uncachedSymbols[j];
      var resp = responses[j];
      if (resp && resp.getResponseCode() === 200) {
        try {
          var data = JSON.parse(resp.getContentText());
          var chartRes = data.chart && data.chart.result && data.chart.result[0];
          if (chartRes && chartRes.timestamp && chartRes.indicators && chartRes.indicators.quote && chartRes.indicators.quote[0].close) {
            var timestamps = chartRes.timestamp;
            var closes = chartRes.indicators.quote[0].close;
            var series = [];
            for (var k = 0; k < timestamps.length; k++) {
              if (closes[k] !== null && closes[k] !== undefined && !isNaN(closes[k])) {
                var dStr = new Date(timestamps[k] * 1000).toISOString().split('T')[0];
                series.push({ date: dStr, close: Math.round(closes[k] * 10000) / 10000 });
              }
            }
            result[symOrig] = series;
            
            var strVal = JSON.stringify(series);
            if (strVal.length < 100000) {
              cache.put("HIST_" + symOrig + "_" + targetRange, strVal, 21600);
            }
          }
        } catch (e) {}
      }
    }
  } catch (err) {}
  
  return { success: true, history: result };
}
`
