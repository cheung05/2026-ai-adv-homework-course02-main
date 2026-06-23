# 花卉電商網站（backend-project）

提供前台商品瀏覽、購物車、訂單管理，以及後台商品與訂單管理功能。支援會員登入（JWT）與訪客購物車（X-Session-Id）雙模式認證，並完整串接綠界 ECPay AIO 金流，是一套使用 Node.js + Express + SQLite + EJS + Tailwind CSS 實作的全端電商平台。

---

## 技術棧

本專案之技術棧明細如下：

| 分類 | 技術名稱 | 套件 / 工具 | 版本 | 說明與用途 |
| :--- | :--- | :--- | :--- | :--- |
| **核心運行環境** | Node.js | — | — | 伺服器端執行環境。 |
| **Web 框架** | Express | `express` | `~4.16.1` | 後端路由分發、EJS 模板渲染與 API 服務。 |
| **資料庫** | SQLite | `better-sqlite3` | `^12.8.0` | 嵌入式關聯型資料庫，採用同步 API 與 WAL 模式以提升讀寫效能。 |
| **模板引擎** | EJS | `ejs` | `^5.0.1` | 伺服器端渲染 HTML 頁面。 |
| **CSS 框架** | Tailwind CSS | `tailwindcss` / `@tailwindcss/cli` | `^4.2.2` | 樣式系統，使用 v4 獨立 CLI 編譯壓縮。 |
| **身份認證** | JWT | `jsonwebtoken` | `^9.0.2` | 用於會員註冊、登入與保護 API/後台頁面之身份認證。 |
| **密碼安全性** | bcrypt | `bcrypt` | `^6.0.0` | 密碼雜湊與比對，測試環境使用 1 round，生產環境使用 10 rounds。 |
| **唯一碼生成** | UUID | `uuid` (v4) | `^11.1.0` | 生成使用者 ID、商品 ID、購物車品項 ID 以及訂單 ID。 |
| **跨域存取** | CORS | `cors` | `^2.8.5` | 設定跨來源資源共用，支援前端頁面串接 API。 |
| **環境變數管理** | dotenv | `dotenv` | `^16.4.7` | 從 `.env` 檔案載入環境變數。 |
| **API 文件** | Swagger | `swagger-jsdoc` | `^6.2.8` | 從程式碼中的 JSDoc 註解自動生成 OpenAPI 3.0.3 規格文件。 |
| **測試框架** | Vitest | `vitest` | `^2.1.9` | 單元與整合測試執行器，本專案設定為循序執行。 |
| **HTTP 測試工具** | Supertest | `supertest` | `^7.2.2` | 模擬 HTTP 請求以測試 Express 路由而無須真正啟動伺服器。 |

---

## 快速開始

請依以下步驟快速部署並啟動本專案：

```bash
# 1. 克隆或下載本專案，並切換至專案根目錄
# 2. 安裝所有依賴套件（包括開發依賴）
npm install

# 3. 複製並設定環境變數
cp .env.example .env
# 請使用文字編輯器打開 .env，並填入 JWT_SECRET (例如: JWT_SECRET=your_jwt_secret_key_here)

# 4. 編譯 CSS 並啟動伺服器
npm run start
# 伺服器啟動成功後，預設在 http://localhost:3001
```

### 預設測試管理員帳號

在資料庫首次初始化時（`src/database.js` 載入時），系統會自動建立一組管理員帳號：
- **Email**：`admin@hexschool.com`
- **密碼**：`12345678`
*(可於 `.env` 中透過 `ADMIN_EMAIL` 與 `ADMIN_PASSWORD` 自訂預設管理員欄位)*

---

## 常用指令表

| 指令 | 內部執行腳本 | 說明與作用 |
| :--- | :--- | :--- |
| `npm run start` | `npm run css:build && node server.js` | **正式啟動**。先將 Tailwind CSS 編譯並壓縮至 `public/css/output.css`，然後啟動 Express 伺服器。 |
| `npm run dev:server` | `node server.js` | **僅啟動伺服器**。適用於後端 JS 程式碼變更時，不重新編譯 CSS。 |
| `npm run dev:css` | `npx @tailwindcss/cli -i public/css/input.css -o public/css/output.css --watch` | **Tailwind 監聽模式**。實時監控模板或 JS 檔案中 CSS 類別的變更並自動編譯 CSS。 |
| `npm run css:build` | `npx @tailwindcss/cli -i public/css/input.css -o public/css/output.css --minify` | **編譯並壓縮 CSS**。生成最小化的樣式檔案以利生產環境部署。 |
| `npm run test` | `vitest run` | **執行測試**。使用 Vitest 循序跑完所有套件測試。 |
| `npm run openapi` | `node generate-openapi.js` | **生成 API 文件**。解析 `src/routes/` 檔案內之 JSDoc 註解，輸出 `openapi.json` 檔案。 |

---

## 文件索引表

本專案之詳細開發、架構及測試文件索引如下，供開發者參閱：

| 文件路徑 | 說明 | 關鍵內容 |
| :--- | :--- | :--- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | **系統架構與資料流** | 目錄結構、啟動流程、API 路由表、統一回應格式、認證授權、資料庫 Schema 及綠界金流串接流程。 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | **開發規範與指南** | 命名規則、CommonJS 模組說明、新增端點/Middleware/資料表的詳細步驟、環境變數表、JSDoc 格式與計畫歸檔流程。 |
| [FEATURES.md](./FEATURES.md) | **功能清單與行為描述** | 功能完成狀態、各端點的詳細行為描述、必填與選填欄位、業務邏輯（購物車累加、訂單 Transaction）及錯誤碼。 |
| [TESTING.md](./TESTING.md) | **測試規範與指南** | 測試框架、測試檔案表、執行順序與依賴關係、測試 setup 輔助函式、撰寫測試範例及 6 個常見陷阱。 |
| [CHANGELOG.md](./CHANGELOG.md) | **版本更新日誌** | 紀錄各版本的 Added, Changed, Deprecated 等異動（遵循 Keep a Changelog 格式）。 |
| [plans/](./plans/) | **開發計畫目錄** | 存放 YYYY-MM-DD 格式之功能開發計畫書。 |
| [plans/archive/](./plans/archive/) | **已歸檔開發計畫** | 已完成功能開發計畫之歸檔目錄。 |
