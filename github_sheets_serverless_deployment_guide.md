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
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ error: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var contents = JSON.parse(e.postData.contents);
  var action = contents.action;
  
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
  }
  
  // Fallback for legacy direct form uploads
  return ContentService.createTextOutput(JSON.stringify(addTrade(contents)))
    .setMimeType(ContentService.MimeType.JSON);
}

function getDashboardData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Journal");
  var rows = sheet.getDataRange().getValues();
  
  var trades = [];
  var portfolios = ["Main Trading", "BTC Stock", "Crypto"];
  var uniqueAssets = [];
  
  if (rows.length <= 1) {
    return {
      trades: [],
      portfolios: portfolios,
      livePrices: {},
      liveRates: { "THB": 1.0, "USD": 35.0, "EUR": 38.0 },
      syncTime: new Date().toISOString()
    };
  }
  
  var headers = rows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  
  // Helper to find column index matching keywords
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
        dateVal = d.toString().split(" ")[0].trim();
      }
    } else {
      dateVal = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    
    var portfolio = "Main Trading";
    if (assetType.toLowerCase() === "crypto") {
      portfolio = "Crypto";
    } else if (assetType.toLowerCase() === "global stock" || assetType.toLowerCase() === "us stock") {
      portfolio = "BTC Stock";
    }
    
    var qty = quantityIdx !== -1 ? parseFloat(row[quantityIdx]) : 0;
    if (isNaN(qty)) qty = 0;
    
    var price = priceUnitIdx !== -1 ? parseFloat(row[priceUnitIdx]) : 0;
    if (isNaN(price)) price = 0;
    
    var trade = {
      id: (i + 1).toString(), // ID = actual sheet row number (header=row1, data row i=1 → row 2 → ID "2")
      date: dateVal,
      portfolio: portfolio,
      assetName: assetName,
      assetType: assetType,
      currency: currencyIdx !== -1 && row[currencyIdx] ? row[currencyIdx].toString().trim() : "THB",
      action: actionIdx !== -1 && row[actionIdx] ? row[actionIdx].toString().trim() : "Buy",
      quantity: qty,
      priceUnit: price,
      why: whyIdx !== -1 && row[whyIdx] ? row[whyIdx].toString().trim() : "",
      remark: remarkIdx !== -1 && row[remarkIdx] ? row[remarkIdx].toString().trim() : ""
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
  var lastRow = sheet.getLastRow();
  var newRowIdx = lastRow + 1;
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headersLower = headers.map(function(h) { return h.toString().toLowerCase().trim(); });
  
  function writeCell(keywords, value) {
    for (var i = 0; i < headersLower.length; i++) {
      var h = headersLower[i];
      for (var k = 0; k < keywords.length; k++) {
        if (h.indexOf(keywords[k]) !== -1) {
          sheet.getRange(newRowIdx, i + 1).setValue(value);
          return i;
        }
      }
    }
    return -1;
  }
  
  var dateVal = trade.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  var tsToWrite = trade.timestamp ? trade.timestamp : new Date();
  writeCell(["timestamp"], tsToWrite);
  writeCell(["date"], new Date(dateVal));
  writeCell(["asset name", "asset_name", "asset"], trade.assetName);
  writeCell(["asset type", "asset_type", "type"], trade.assetType);
  writeCell(["currency"], trade.currency);
  writeCell(["action"], trade.action);
  writeCell(["quantity", "qty"], trade.quantity);
  writeCell(["price/unit", "price_unit", "price unit", "price"], trade.priceUnit);
  writeCell(["why (decision reason)", "why", "decision", "reason"], trade.why);
  writeCell(["remark", "note"], trade.remark || "");
  
  // Try to write formulas dynamically for computed columns (Amount, Current Value, P&L, etc.)
  var qtyIdx = findIdxInArray(headersLower, ["quantity", "qty"]);
  var priceIdx = findIdxInArray(headersLower, ["price/unit", "price_unit", "price unit", "price"]);
  var curPriceIdx = findIdxInArray(headersLower, ["current price"]);
  var actionIdx = findIdxInArray(headersLower, ["action"]);
  var amountIdx = findIdxInArray(headersLower, ["amount"]);
  var curValueIdx = findIdxInArray(headersLower, ["current value"]);
  var pnlIdx = findIdxInArray(headersLower, ["p&l"]);
  var pnlPctIdx = findIdxInArray(headersLower, ["p&l %"]);
  
  var qtyLetter = getColumnLetter(qtyIdx + 1);
  var priceLetter = getColumnLetter(priceIdx + 1);
  var actionLetter = getColumnLetter(actionIdx + 1);
  var curPriceLetter = getColumnLetter(curPriceIdx + 1);
  var amountLetter = getColumnLetter(amountIdx + 1);
  var pnlLetter = getColumnLetter(pnlIdx + 1);

  if (amountIdx !== -1 && qtyLetter && priceLetter) {
    sheet.getRange(newRowIdx, amountIdx + 1).setFormula("=" + qtyLetter + newRowIdx + "*" + priceLetter + newRowIdx);
  }
  
  if (curPriceIdx !== -1) {
    sheet.getRange(newRowIdx, curPriceIdx + 1).setValue(trade.priceUnit); // default live price to purchase price
  }
  
  if (curValueIdx !== -1 && qtyLetter && curPriceLetter) {
    sheet.getRange(newRowIdx, curValueIdx + 1).setFormula("=" + qtyLetter + newRowIdx + "*" + curPriceLetter + newRowIdx);
  }
  
  if (pnlIdx !== -1 && actionLetter && curPriceLetter && priceLetter && qtyLetter) {
    sheet.getRange(newRowIdx, pnlIdx + 1).setFormula('=IF(' + actionLetter + newRowIdx + '="Buy",(' + curPriceLetter + newRowIdx + '-' + priceLetter + newRowIdx + ')*' + qtyLetter + newRowIdx + ',(' + priceLetter + newRowIdx + '-' + curPriceLetter + newRowIdx + ')*' + qtyLetter + newRowIdx + ')');
  }
  
  if (pnlPctIdx !== -1 && pnlLetter && amountLetter) {
    sheet.getRange(newRowIdx, pnlPctIdx + 1).setFormula("=IF(" + amountLetter + newRowIdx + "=0,0," + pnlLetter + newRowIdx + "/" + amountLetter + newRowIdx + ")");
  }
  
  return { success: true };
}

function findIdxInArray(array, keywords) {
  for (var i = 0; i < array.length; i++) {
    var item = array[i];
    for (var k = 0; k < keywords.length; k++) {
      if (item.indexOf(keywords[k]) !== -1) {
        return i;
      }
    }
  }
  return -1;
}

function getColumnLetter(colIdx) {
  if (colIdx <= 0) return null;
  var letter = "";
  while (colIdx > 0) {
    var temp = (colIdx - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    colIdx = (colIdx - temp - 1) / 26;
  }
  return letter;
}

function deleteTrade(tradeId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Journal");
  // tradeId is the actual spreadsheet row number (e.g. "2" = first data row after header).
  // getDashboardData assigns id = (i + 1).toString() where i starts at 1,
  // so the first data row (sheet row 2) gets id "2", not "1".
  var rowIdx = parseInt(tradeId);
  var lastRow = sheet.getLastRow();
  
  // rowIdx must be > 1 (never delete header row 1) and within bounds
  if (rowIdx > 1 && rowIdx <= lastRow) {
    sheet.deleteRow(rowIdx);
    return { success: true, deletedRow: rowIdx };
  }
  
  return { success: false, error: "Row index out of range: " + rowIdx + " (lastRow=" + lastRow + ")" };
}

// Helper to get or create the Portfolios config sheet
function getOrCreatePortfoliosSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Portfolios");
  if (!sheet) {
    sheet = ss.insertSheet("Portfolios");
    // Write headers
    sheet.getRange(1, 1, 1, 3).setValues([["Asset Name", "Portfolio", "Portfolio Names"]]);
    // Initialize default portfolios in column C
    sheet.getRange(2, 3, 3, 1).setValues([["Main Trading"], ["BTC Stock"], ["Crypto"]]);
  }
  return sheet;
}

// Create a new portfolio custom name
function addPortfolio(name) {
  var sheet = getOrCreatePortfoliosSheet();
  var lastRow = sheet.getLastRow();
  var values = sheet.getRange(1, 3, lastRow, 1).getValues();
  
  // Check if it already exists
  for (var i = 1; i < values.length; i++) {
    if (values[i][0].toString().trim().toLowerCase() === name.toLowerCase()) {
      return { success: true, message: "Portfolio already exists" };
    }
  }
  
  // Find first empty cell in Column C or append
  var targetRow = 2;
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === "") {
      targetRow = i + 1;
      break;
    }
    if (i === values.length - 1) {
      targetRow = lastRow + 1;
    }
  }
  if (lastRow === 1) targetRow = 2;
  
  sheet.getRange(targetRow, 3).setValue(name);
  return { success: true };
}

// Delete portfolio and all its asset mappings
function deletePortfolio(portfolioName) {
  var sheet = getOrCreatePortfoliosSheet();
  var lastRow = sheet.getLastRow();
  
  // 1. Remove from portfolio names list (column C)
  var nameValues = sheet.getRange(1, 3, lastRow, 1).getValues();
  for (var i = 1; i < nameValues.length; i++) {
    if (nameValues[i][0].toString().trim().toLowerCase() === portfolioName.toLowerCase()) {
      sheet.getRange(i + 1, 3).setValue(""); // clear the value
    }
  }
  
  // 2. Remove mappings for assets assigned to this portfolio (columns A-B)
  var mappingValues = sheet.getRange(1, 1, lastRow, 2).getValues();
  // Delete rows from bottom up to avoid shifting index problems
  for (var j = lastRow; j >= 2; j--) {
    var mappedPort = mappingValues[j-1][1].toString().trim();
    if (mappedPort.toLowerCase() === portfolioName.toLowerCase()) {
      sheet.getRange(j, 1, 1, 2).clearContent();
    }
  }
  
  return { success: true };
}

// Rename a custom portfolio name and update all associated asset mappings
function renamePortfolio(oldName, newName) {
  var sheet = getOrCreatePortfoliosSheet();
  var lastRow = sheet.getLastRow();
  
  // 1. Update in portfolio names list (column C)
  var nameValues = sheet.getRange(1, 3, lastRow, 1).getValues();
  for (var i = 1; i < nameValues.length; i++) {
    if (nameValues[i][0].toString().trim().toLowerCase() === oldName.toLowerCase()) {
      sheet.getRange(i + 1, 3).setValue(newName);
    }
  }
  
  // 2. Update mappings (columns A-B)
  var mappingValues = sheet.getRange(1, 1, lastRow, 2).getValues();
  for (var j = 2; j <= lastRow; j++) {
    var mappedPort = mappingValues[j-1][1].toString().trim();
    if (mappedPort.toLowerCase() === oldName.toLowerCase()) {
      sheet.getRange(j, 2).setValue(newName);
    }
  }
  
  return { success: true };
}

// Map asset to portfolio and ensure portfolio name is defined
function transferPosition(assetName, targetPortfolio) {
  var sheet = getOrCreatePortfoliosSheet();
  var lastRow = sheet.getLastRow();
  
  var mappingValues = sheet.getRange(1, 1, lastRow, 2).getValues();
  var found = false;
  
  // Look for existing asset mapping
  for (var i = 1; i < mappingValues.length; i++) {
    if (mappingValues[i][0].toString().trim().toUpperCase() === assetName.toUpperCase()) {
      sheet.getRange(i + 1, 2).setValue(targetPortfolio);
      found = true;
      break;
    }
  }
  
  // If not found, find an empty row in Columns A-B, or append
  if (!found) {
    var targetRow = lastRow + 1;
    for (var i = 1; i < mappingValues.length; i++) {
      if (mappingValues[i][0] === "" && mappingValues[i][1] === "") {
        targetRow = i + 1;
        break;
      }
    }
    if (lastRow === 1) targetRow = 2;
    sheet.getRange(targetRow, 1).setValue(assetName.toUpperCase());
    sheet.getRange(targetRow, 2).setValue(targetPortfolio);
  }
  
  // Also ensure target portfolio name is in Column C
  addPortfolio(targetPortfolio);
  
  return { success: true };
}
```
