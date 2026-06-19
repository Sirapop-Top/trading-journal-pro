# AlphaTrader Data Backup & Transfer Guide 💾🚀

AlphaTrader is designed to keep your data local and under your control. When moving to a new PC, migrating your data is simple because all records are stored directly inside the project folder.

---

## 🗂️ 1. Where is your data stored?

Your data resides in two primary files inside your project directory (`Trading Journal_pro`):

1. **`Trading Journal.xlsx` (Excel Spreadsheet)**:
   * **Purpose**: This is the **Single Source of Truth** for all your logged transactions. It stores the date, portfolio, asset symbol, action (BUY/SELL), quantity, price, currency, notes, and strategies.
   * **Location**: Root of the `Trading Journal_pro` folder.

2. **`db.json` (JSON Database)**:
   * **Purpose**: Stores settings and metadata, specifically your **custom portfolio names** (e.g. "Retirement", "Swing Trade") and renaming records.
   * **Location**: Root of the `Trading Journal_pro` folder.

---

## 📋 2. Step-by-Step Migration to a New PC

Follow these steps to transfer your journal:

### Option A: Transfer the Entire Folder (Recommended)
Since the app includes the frontend build and backend code, transferring the entire folder is the easiest way to ensure all configuration and data are preserved.

1. **Close the servers** on your old PC (close the command prompt or batch file running the server).
2. **Copy the entire `Trading Journal_pro` folder** to a USB drive or upload it to a cloud drive (Google Drive, OneDrive, etc.).
3. **Paste the folder** onto the new PC in your preferred directory (e.g., your Desktop or Documents).
4. **Install Python and Node.js** on the new PC if they are not already installed.
5. Launch the app on the new PC by running:
   ```bash
   Start_AlphaTrader.bat
   ```

### Option B: Transfer Only the Data (Clean Install)
If you have set up a fresh clone of the AlphaTrader codebase on the new PC, you only need to copy the data files:

1. Locate the fresh `Trading Journal_pro` folder on your new PC.
2. Copy **`Trading Journal.xlsx`** and **`db.json`** from your old PC.
3. Paste and **overwrite** them in the root of the new `Trading Journal_pro` folder.
4. Start the server on the new PC.

---

## ☁️ 3. Automatic Cloud Backup Option
Since the transactions database is a standard `.xlsx` spreadsheet, you can easily synchronize it:
* Put the `Trading Journal_pro` folder inside a cloud-synced directory (e.g. OneDrive, Dropbox, iCloud, or Google Drive folder).
* The spreadsheet will automatically backup to the cloud whenever a new transaction is logged, providing effortless safety!
