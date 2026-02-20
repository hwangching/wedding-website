# Wedding Website & Live Wall

這是一個專為婚禮設計的綜合型網頁應用程式，包含**婚禮官方網站首頁**、**賓客座位管理系統**、**賓客上傳頁面**與現場投影的**即時動態牆**。

## 功能特色 (Features)

*   **🤵 首頁 (`/index.html`)**:
    *   婚禮資訊展示與倒數計時。
    *   整合 Spotify 等背景音樂播放。

*   **🪑 座位管理系統 (Admin Seat Manager - `/admin.html`)**:
    *   後台介面，需密碼登入保護。
    *   **視覺化排座位**：可自由新增長桌或圓桌，透過拖拉 (Drag-and-Drop) 安排賓客座位。
    *   **場地拖拉模式**：根據真實場地平面圖，自由擺放桌次位置。
    *   **Google Sheets 同步**：名單與座位資料存放於 Google 試算表，支援讀取草稿與正式發佈功能。

*   **📸 賓客上傳頁面 (`/upload.html`)**:
    *   整合 **LINE Login (LIFF)** 自動帶入賓客暱稱。
    *   支援多張照片同時上傳與本地圖片壓縮。
    *   即時上傳至 Firebase Storage 與 Firestore。

*   **📺 即時動態牆 (`/live.html`)**:
    *   **Masonry 瀑布流佈局**，保留照片原始比例不裁切。
    *   **彈幕留言 (Danmaku)**：賓客祝福語以「隨機幾何圖形」頭像緩慢飄過，不遮擋照片。
    *   即時監聽 Firestore，新留言與照片會立刻加入輪播。

## 專案架構 (Architecture)

本專案使用 **Vite** 作為建置工具，並採用現代化前端技術，無依賴大型前端框架：

*   **Framework**: Vanilla JS + Vite (Multi-page App)
*   **Database (Photos)**: Firebase (Firestore, Cloud Storage)
*   **Database (Seating)**: Google Apps Script + Google Sheets
*   **Authentication**: LINE LIFF (Login integration)
*   **Animations**: GSAP (GreenSock Animation Platform)
*   **CI/CD**: GitHub Actions (部署至 GitHub Pages)

### 檔案結構
```
.
├── src/
│   ├── admin.js       # 座位管理系統邏輯 (Drag & Drop, GAS API)
│   ├── upload.js      # 上傳頁面邏輯 (LIFF, 壓縮, 上傳)
│   ├── live.js        # 動態牆邏輯 (Marquee, Danmaku, Animation)
│   └── firebase.js    # Firebase 初始化設定
├── public/            # 靜態資源 (不經 Vite 打包，直接輸出至根目錄)
│   ├── images_webp/   # 圖片、底圖資源
│   └── CNAME          # 自定義網域設定檔
├── .github/workflows/ # GitHub Actions 自動部署腳本
├── index.html         # 婚禮首頁
├── admin.html         # 管理員座位表介面
├── live.html          # 動態牆主頁面
├── upload.html        # 上傳主頁面
├── admin_gas.js       # Google Apps Script 後端程式碼 (需部署至 GAS)
├── .env               # 環境變數 (API Keys)
└── vite.config.js     # Vite 多頁面打包設定
```

## 設定步驟 (Setup)

### 1. 安裝依賴
確認已安裝 Node.js (建議 v20+)。
```bash
npm install
```

### 2. 環境變數 (.env)
複製 `.env.example` 建立 `.env` 檔案：
```bash
cp .env.example .env
```
請填寫對應的參數（詳見 `.env.example` 內容）：
*   **Firebase**: 用於存放照片與留言 (`upload.html` & `live.html`)。
*   **LINE LIFF**: 用於取得賓客 LINE 暱稱。
*   **Admin Settings**: 設定後台登入密碼 (`VITE_ADMIN_PASSWORD`) 與 GAS 後端網址 (`VITE_GAS_ADMIN_URL`)。

### 3. Google Apps Script 部署 (座位系統後端)
1.  建立一個新的 Google 試算表 (Google Sheets)。
2.  點擊工具列的 `擴充功能` -> `Apps Script`。
3.  將 `admin_gas.js` 檔案的內容複製貼上。
4.  點擊 `部署` -> `新增部署作業` -> 類型選擇 `網頁應用程式 (Web App)`。
5.  設定「執行身分」為您自己，「誰可以存取」設為**所有人**。
6.  按下部署，授權後取得 **Web App URL** 並填入 `.env` 的 `VITE_GAS_ADMIN_URL`。

## 啟動服務 (Running Locally)

啟動本地伺服器，支援熱更新 (Hot Reload)。
```bash
npm run dev
```
啟動後開啟下方網址 (依您的 port 號為主)：
*   **首頁**: `http://localhost:5173/`
*   **座位後台**: `http://localhost:5173/admin.html`
*   **上傳頁**: `http://localhost:5173/upload.html`
*   **動態牆**: `http://localhost:5173/live.html`
    *   *(Live 頁面支援加上 `?demo=true` 來啟動無後端本地圖片輪播模式)*

## 自動部署 (Deployment)

專案已整合 **GitHub Actions**，只要推送至 `main` 分支，便會自動進行 Vite Build 並部署至 **GitHub Pages**。

### 部署前設定
由於 `.env` 不會進 Git，您必須前往 GitHub Repo：
1.  `Settings` -> `Secrets and variables` -> `Actions`。
2.  點擊 `New repository secret`，將 `.env` 內的所有 Key-Value 加入 GitHub Secrets 中。

### 自定義網域 (Custom Domain)
請在網域供應商 (例如 GoDaddy, Cloudflare) 設定 DNS 的 **A Record** 指向 GitHub Pages IP（`185.199.108.153` 系列），並確認 `public/CNAME` 內包含您的網域名稱。
部署後進入 Repo 的 **Settings -> Pages**，等待 DNS 生效後勾選 **Enforce HTTPS** 即可。
