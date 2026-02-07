# Wedding Live Wall & Gallery

這是一個專為婚禮設計的即時照片牆應用程式，包含賓客上傳頁面與現場投影的即時輪播牆。

## 功能特色 (Features)

*   **賓客上傳頁面 (`/upload.html`)**:
    *   整合 **LINE Login (LIFF)** 自動帶入賓客暱稱。
    *   支援多張照片同時上傳。
    *   **客戶端圖片壓縮**，節省流量並加快上傳速度。
    *   即時上傳至 Firebase Storage 與 Firestore。

*   **即時動態牆 (`/live.html`)**:
    *   **Masonry 瀑布流佈局**：三列橫向滾動，照片大小錯落有致。
    *   **不裁切展示**：保留照片原始比例，完整呈現每一張畫面。
    *   **彈幕留言 (Danmaku)**：賓客祝福語以「標籤」形式緩慢飄過，不遮擋照片。
    *   **即時更新**：透過 Firestore 監聽，新照片會即時加入輪播。
    *   **Demo 模式**：支援無後端預覽模式 (`?demo=true`)。

## 專案架構 (Architecture)

本專案使用 **Vite** 作為建置工具，並採用現代化前端技術：

*   **Framework**: Vanilla JS + Vite (Multi-page App)
*   **Backend**: Firebase (Firestore Database, Cloud Storage)
*   **Authentication**: LINE LIFF (Login integration)
*   **Animations**: GSAP (GreenSock Animation Platform)
*   **Styling**: CSS3 (Flexbox, CSS Variables)

### 檔案結構
```
.
├── src/
│   ├── upload.js      # 上傳頁面邏輯 (LIFF, 壓縮, 上傳)
│   ├── live.js        # 動態牆邏輯 (Marquee, Danmaku, Animation)
│   └── firebase.js    # Firebase 初始化設定
├── live.html          # 動態牆主頁面
├── upload.html        # 上傳主頁面
├── index.html         # 婚禮網站首頁
├── images_webp/       # 本地圖檔 (Demo 用)
├── .env               # 環境變數 (API Keys)
└── vite.config.js     # Vite 設定檔
```

## 設定步驟 (Setup)

### 1. 安裝依賴
請先確認已安裝 Node.js (建議 v18+)。
```bash
npm install
```

### 2. 設定環境變數
請複製 `.env.example` 建立 `.env` 檔案，並填入您的 Firebase 與 LINE 設定。
```bash
cp .env.example .env
```

**`.env` 內容範例：**
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_LIFF_ID=your_liff_id
```

### 3. Firebase 設定
1.  進入 [Firebase Console](https://console.firebase.google.com/) 建立專案。
2.  **Firestore**: 建立資料庫，並設定規則 (初期測試可設為公開或根據 Auth 限制)。
3.  **Storage**: 啟用 Storage，並設定 CORS 以允許從您的網域上傳。
    *   CORS 設定需透過 `gsutil` 或 Google Cloud Console 設定。

### 4. LINE Developers 設定 (LIFF)
1.  進入 [LINE Developers Console](https://developers.line.biz/console/)。
2.  建立 Provider 與 Channel (LINE Login)。
3.  啟用 **LIFF** 功能，並新增一個 LIFF App。
4.  將 LIFF ID 填入 `.env`。
5.  **Endpoint URL**: 開發時填入 `https://<your-local-ip>:5173/upload.html`，上線後更新為正式網址。

## 啟動網頁 (Running)

### 開發模式 (Development)
啟動本地伺服器，支援熱更新 (Hot Reload)。
```bash
npm run dev
```
啟動後，請使用瀏覽器開啟顯示的網址 (通常是 `http://localhost:5173`)。

*   **上傳頁**: `http://localhost:5173/upload.html`
*   **動態牆**: `http://localhost:5173/live.html`
*   **動態牆 (Demo模式)**: `http://localhost:5173/live.html?demo=true`
    *   *Demo 模式會使用 `images_webp` 資料夾內的照片與假資料進行輪播，不需連接 Firebase。*

### 建置生產版本 (Production Build)
打包程式碼以供部署 (如 Firebase Hosting, Vercel)。
```bash
npm run build
```
打包後的檔案會產生在 `dist/` 資料夾中。

## 部署 (Deployment)

建議使用 **Firebase Hosting**：

1.  安裝 Firebase CLI: `npm install -g firebase-tools`
2.  登入: `firebase login`
3.  初始化: `firebase init hosting` (選擇 `dist` 作為 public directory，並設定為 single-page app: No)
4.  部署: `firebase deploy`
