# 系統架構與資料流文件

本文件詳細說明花卉電商網站（backend-project）之系統架構、目錄結構、啟動程序、API 設計、認證授權、資料庫 Schema 以及第三方綠界金流整合細節。

---

## 目錄結構與檔案用途

本專案之完整目錄結構及各檔案用途說明如下：

```
├── app.js                          # Express 應用主程式。設定模板引擎、全域 Middleware、靜態檔案路徑、API 與網頁路由、以及全域 404 與錯誤處理器
├── server.js                       # 系統啟動入口檔案。引入 app.js，並於環境變數指定之 PORT（預設 3001）監聽 HTTP 請求，並提供 JWT_SECRET 檢查
├── package.json                    # 專案定義檔。記錄專案依賴套件與 npm scripts（啟動、開發、測試、編譯 CSS 等指令）
├── package-lock.json               # 鎖定專案依賴套件版本之檔案
├── database.sqlite                 # SQLite3 實體資料庫檔案。首次執行時由 better-sqlite3 自動建立並運行建表與種子資料寫入
├── database.sqlite-shm             # SQLite3 WAL 模式下共用記憶體檔案，用以提高並行存取效能
├── database.sqlite-wal             # SQLite3 預寫日誌檔案（Write-Ahead Log），紀錄尚未提交至實體資料庫的交易
├── vitest.config.js                # Vitest 測試框架設定檔。主要停用檔案平行執行並指定測試檔案順序以防資料競態
├── swagger-config.js               # Swagger/OpenAPI 定義設定檔。描述 API 文件基本資訊、伺服器 URL，並註冊 BearerAuth 與 X-Session-Id 安全機制
├── generate-openapi.js             # 從後端路由之 JSDoc 註解自動生成 `openapi.json` 規格描述檔之指令碼
├── .env                            # 環境變數設定檔（機密資料，不納入版本控制）
├── .env.example                    # 環境變數設定檔範本，列出專案運行所需之變數名稱
├── .gitignore                      # Git 版本控制排除名單
├── CLAUDE.md                       # 專案概要、常用指令、關鍵規則與詳細文件索引
│
├── docs/                           # 專案文件目錄
│   ├── README.md                   # 項目介紹、快速開始與技術棧
│   ├── ARCHITECTURE.md             # 本文件（系統架構、目錄結構與資料流）
│   ├── DEVELOPMENT.md              # 開發規範、命名規則與計畫歸檔流程
│   ├── FEATURES.md                 # 各功能區塊詳細行為與 API 行為描述
│   ├── TESTING.md                  # 測試規範、檔案依賴與撰寫指南
│   ├── CHANGELOG.md                # 版本更新日誌（遵循 Keep a Changelog）
│   └── plans/                      # 開發計畫書目錄
│       └── archive/                # 已完成計畫歸檔目錄（內含 ecpay-integration.md）
│
├── src/                            # 後端核心程式碼目錄
│   ├── database.js                 # 資料庫連線初始化模組。建立五張資料表、啟用 WAL 模式與 Foreign Key、並實作種子資料寫入（管理員與商品）
│   ├── middleware/                 # 中介軟體目錄
│   │   ├── authMiddleware.js       # JWT 會員認證中介軟體。解析 Authorization Bearer 標頭、解密 Token、確認使用者是否存在並注入 req.user
│   │   ├── adminMiddleware.js      # 管理員授權中介軟體。檢查 req.user.role 是否為 admin，否則回應 403 Forbidden
│   │   ├── sessionMiddleware.js    # 訪客 Session ID 中介軟體。從請求標頭提取 `X-Session-Id` 並注入 req.sessionId
│   │   └── errorHandler.js         # 全域錯誤處理器。攔截 operational 錯誤並過濾內部敏感錯誤訊息，確保 500 錯誤不外洩系統實作細節
│   ├── utils/                      # 工具類別目錄
│   │   └── ecpay.js                # 綠界金流處理工具。實作 ECPay URL 編碼、SHA256 CheckMacValue 簽章生成與比對、AIO 表單 HTML 生成與 QueryTradeInfo
│   └── routes/                     # API 與網頁路由目錄
│       ├── authRoutes.js           # 會員認證相關 API。包含註冊（立即登入）、登入（發放 Token）與個人資料查詢
│       ├── productRoutes.js        # 公開商品相關 API。包含分頁瀏覽商品列表與取得單一商品詳情
│       ├── cartRoutes.js           # 購物車相關 API。實作 dualAuth 雙模式認證，提供購物車內容查詢、加入、修改數量與刪除項目
│       ├── orderRoutes.js          # 會員訂單相關 API。提供建立訂單（Transaction 原子操作）、查詢訂單、模擬付款以及綠界主動查詢付款狀態
│       ├── adminProductRoutes.js   # 後台商品管理 API。提供管理員新增、修改、刪除（受限於 pending 訂單限制）與查詢商品
│       ├── adminOrderRoutes.js     # 後台訂單管理 API。提供管理員查詢所有使用者訂單（含分頁與狀態篩選）與詳情
│       └── pageRoutes.js           # 網頁視圖路由。渲染前台與後台的 EJS 模板頁面，並提供自動送出的綠界付款 EJS 表單中繼頁
│
├── views/                          # 前後端視圖（EJS）目錄
│   ├── layouts/                    # 頁面佈局框架
│   │   ├── front.ejs               # 前台通用佈局頁面。包裹 head、前台導覽列、內容主體（body）、頁尾與頁面腳本
│   │   └── admin.ejs               # 後台通用佈局頁面。包裹 head、後台導覽列、側邊選單與管理主體內容
│   ├── pages/                      # 各功能網頁主體 EJS
│   │   ├── index.ejs               # 前台首頁（商品列表展示）
│   │   ├── product-detail.ejs      # 前台商品詳情頁
│   │   ├── cart.ejs                # 前台購物車列表頁
│   │   ├── checkout.ejs            # 前台填寫收件資訊結帳頁
│   │   ├── login.ejs               # 前台登入頁（支援登入後跳轉）
│   │   ├── orders.ejs              # 會員訂單列表頁
│   │   ├── order-detail.ejs        # 會員訂單詳情頁（包含自動與手動查詢付款狀態）
│   │   ├── 404.ejs                 # 找不到路徑之錯誤提示頁面
│   │   └── admin/                  # 後台管理網頁 EJS
│   │       ├── products.ejs        # 後台商品管理主頁面
│   │       └── orders.ejs          # 後台訂單管理主頁面
│   └── partials/                   # 共用視圖元件
│       ├── head.ejs                # HTML Head 區塊（設定 meta、引入 Tailwind CSS 與基礎樣式）
│       ├── header.ejs              # 前台導覽列（包含購物車數量監聽與登入狀態判定）
│       ├── admin-header.ejs        # 後台頂部導覽列
│       ├── admin-sidebar.ejs       # 後台側邊選單（商品管理與訂單管理切換）
│       ├── footer.ejs              # 前台頁尾
│       └── notification.ejs        # 網頁彈出式訊息通知元件
│
└── public/                         # 靜態資源目錄
    ├── stylesheets/                # 自訂樣式目錄
    │   └── style.css               # 自訂全域與微調 CSS 樣式
    ├── css/                        # Tailwind CSS 編譯產出目錄
    │   ├── input.css               # Tailwind CSS 原始指令檔
    │   └── output.css              # 由 Tailwind CLI 編譯並壓縮（minify）之輸出樣式檔
    └── js/                         # 前端 JavaScript 邏輯目錄
        ├── api.js                  # 封裝 fetch API 之 HTTP 用戶端。處理標頭注入（Authorization 與 X-Session-Id）、統一回應解析與錯誤攔截
        ├── auth.js                 # 前端 Token 本地儲存（localStorage）與狀態獲取工具
        ├── header-init.js          # 導覽列與購物車狀態初始化與監聽器
        ├── notification.js         # 前端訊息彈窗通知觸發器
        └── pages/                  # 各 HTML 頁面對應之前端腳本邏輯
            ├── index.js            # 首頁商品加載與加入購物車邏輯
            ├── product-detail.js   # 商品詳情展示與自訂數量加入購物車邏輯
            ├── cart.js             # 購物車列表渲染、數量修改、移除品項與金額加總邏輯
            ├── checkout.js         # 結帳表單提交與導向綠界付款頁邏輯
            ├── login.js            # 會員註冊與登入表單發送與轉址邏輯
            ├── orders.js           # 我的訂單列表加載邏輯
            ├── order-detail.js     # 訂單明細展示、呼叫 check-payment 查詢與前往付款轉址邏輯
            ├── admin-products.js   # 管理端商品 CRUD 表單操作與 API 串接邏輯
            └── admin-orders.js     # 管理端訂單列表分頁、狀態篩選與訂單詳情 Modal 載入邏輯
```

---

## 系統啟動流程

本專案從伺服器啟動至處理客戶端請求之完整程序如下：

```
1. 執行 node server.js 啟動程序
   │
   ├── 檢查環境變數：若 process.env.JWT_SECRET 未設定，拋出 Fatal 錯誤並強制退出 (process.exit(1))
   │
   └── 載入 app.js (Express 實例)
        │
        ├── [環境設定] 載入 dotenv 並從 .env 讀取環境變數
        │
        ├── [資料庫連線] 載入 src/database.js 模組
        │    ├── better-sqlite3 開啟 database.sqlite 連線
        │    ├── 設定 PRAGMA journal_mode = WAL (開啟預寫日誌模式)
        │    ├── 設定 PRAGMA foreign_keys = ON (強制啟用外鍵約束)
        │    ├── 執行 CREATE TABLE 建立 users, products, cart_items, orders, order_items
        │    ├── 執行 Migration：嘗試為 orders 資料表加入 merchant_trade_no 欄位（防重複執行）
        │    ├── seedAdminUser()：確認 admin@hexschool.com 是否存在，若無則 bcrypt.hashSync 寫入預設帳號
        │    └── seedProducts()：若 products 資料表為空，執行 db.transaction 寫入 8 筆預設花卉商品
        │
        ├── [視圖引擎] 設定 EJS 為 view engine，指定 views 目錄路徑
        │
        ├── [靜態檔案] 掛載 Express 靜態資源中介軟體，指向 public/ 目錄
        │
        ├── [全域中介軟體]
        │    ├── 掛載 cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3001' })
        │    ├── 掛載 express.json() 解析 JSON Body
        │    ├── 掛載 express.urlencoded({ extended: false }) 解析 URL-encoded 表單
        │    └── 掛載 sessionMiddleware，解析 header 的 X-Session-Id 並寫入 req.sessionId
        │
        ├── [載入 API 路由]
        │    ├── /api/auth         => src/routes/authRoutes.js
        │    ├── /api/admin/products => src/routes/adminProductRoutes.js (保護：authMiddleware + adminMiddleware)
        │    ├── /api/admin/orders   => src/routes/adminOrderRoutes.js   (保護：authMiddleware + adminMiddleware)
        │    ├── /api/products     => src/routes/productRoutes.js      (公開)
        │    ├── /api/cart         => src/routes/cartRoutes.js          (保護：dualAuth 雙模式認證)
        │    └── /api/orders       => src/routes/orderRoutes.js         (保護：authMiddleware)
        │
        ├── [載入頁面路由]
        │    └── /                 => src/routes/pageRoutes.js (渲染 EJS 頁面與綠界付款 HTML)
        │
        ├── [載入 404 路由] 判斷若為 /api 開頭回應 JSON { data: null, error: 'NOT_FOUND', ... }，否則渲染 views/pages/404.ejs
        │
        └── [掛載全域錯誤處理器] errorHandler (位於 src/middleware/errorHandler.js)
```

---

## API 路由總覽表

| 模組分組 | 請求方法 | 路由路徑 | 認證類型 | 說明 | 處理器檔案路徑 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **會員認證** | POST | `/api/auth/register` | 公開 | 註冊新帳號，成功後立即核發 Token 處於登入狀態 | [authRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/authRoutes.js) |
| **會員認證** | POST | `/api/auth/login` | 公開 | 驗證帳號密碼，成功後發放 JWT Token | [authRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/authRoutes.js) |
| **會員認證** | GET | `/api/auth/profile` | Bearer JWT | 獲取當前登入使用者之基本資料 | [authRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/authRoutes.js) |
| **商品瀏覽** | GET | `/api/products` | 公開 | 取得前台分頁商品列表（依時間降序排列） | [productRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/productRoutes.js) |
| **商品瀏覽** | GET | `/api/products/:id` | 公開 | 取得指定商品之詳細資訊 | [productRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/productRoutes.js) |
| **購物車** | GET | `/api/cart` | dualAuth | 查看當前登入者或訪客之購物車品項及總金額 | [cartRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/cartRoutes.js) |
| **購物車** | POST | `/api/cart` | dualAuth | 將商品加入購物車（存在則累加，不存在則新增） | [cartRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/cartRoutes.js) |
| **購物車** | PATCH | `/api/cart/:itemId` | dualAuth | 直接修改購物車中指定項目之數量（非累加） | [cartRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/cartRoutes.js) |
| **購物車** | DELETE | `/api/cart/:itemId` | dualAuth | 從購物車中移除指定商品項目 | [cartRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/cartRoutes.js) |
| **訂單管理** | POST | `/api/orders` | Bearer JWT | 將當前會員購物車品項轉換建立為訂單（不含訪客） | [orderRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/orderRoutes.js) |
| **訂單管理** | GET | `/api/orders` | Bearer JWT | 獲取當前登入會員之所有訂單列表 | [orderRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/orderRoutes.js) |
| **訂單管理** | GET | `/api/orders/:id` | Bearer JWT | 取得會員自身指定訂單之詳細資料與商品快照 | [orderRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/orderRoutes.js) |
| **訂單管理** | PATCH | `/api/orders/:id/pay` | Bearer JWT | 模擬付款（更新訂單狀態為 paid 或 failed，除錯用） | [orderRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/orderRoutes.js) |
| **訂單管理** | POST | `/api/orders/:id/check-payment` | Bearer JWT | 呼叫綠界 API 查詢付款狀態並更新訂單狀態 | [orderRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/orderRoutes.js) |
| **後台管理** | GET | `/api/admin/products` | JWT + Admin | 後台商品分頁列表 | [adminProductRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/adminProductRoutes.js) |
| **後台管理** | POST | `/api/admin/products` | JWT + Admin | 新增商品項目 | [adminProductRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/adminProductRoutes.js) |
| **後台管理** | PUT | `/api/admin/products/:id` | JWT + Admin | 編輯修改現有商品項目（部分更新） | [adminProductRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/adminProductRoutes.js) |
| **後台管理** | DELETE | `/api/admin/products/:id` | JWT + Admin | 刪除指定商品（限制無 pending 狀態訂單關聯） | [adminProductRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/adminProductRoutes.js) |
| **後台管理** | GET | `/api/admin/orders` | JWT + Admin | 後台所有會員之訂單分頁列表（支援狀態篩選） | [adminOrderRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/adminOrderRoutes.js) |
| **後台管理** | GET | `/api/admin/orders/:id` | JWT + Admin | 後台訂單明細查詢（額外回傳下單會員聯絡資料） | [adminOrderRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/adminOrderRoutes.js) |
 
 ---
 
## 頁面路由總覽表

| 頁面分組 | 請求方法 | 路由路徑 | 認證與限制 | 說明 | 處理器檔案路徑 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **前台首頁** | GET | `/` | 公開 | 渲染首頁，展示商品列表 | [pageRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/pageRoutes.js) |
| **商品瀏覽** | GET | `/products/:id` | 公開 | 渲染商品詳情頁，查看商品資訊與庫存 | [pageRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/pageRoutes.js) |
| **購物車管理** | GET | `/cart` | 公開 | 渲染購物車頁面，顯示商品項目與合計金額 | [pageRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/pageRoutes.js) |
| **結帳流程** | GET | `/checkout` | 公開 (前端驗證 JWT) | 渲染結帳頁面，填寫收件資訊 | [pageRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/pageRoutes.js) |
| **會員認證** | GET | `/login` | 公開 | 渲染註冊與登入頁面 | [pageRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/pageRoutes.js) |
| **訂單管理** | GET | `/orders` | 公開 (前端驗證 JWT) | 渲染當前會員之歷史訂單列表 | [pageRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/pageRoutes.js) |
| **訂單管理** | GET | `/orders/:id` | 公開 (前端驗證 JWT) | 渲染指定訂單之詳情，支援綠界回導及手動狀態更新 | [pageRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/pageRoutes.js) |
| **綠界金流串接** | GET | `/ecpay/payment/:orderId` | 公開 | 綠界 AIO 付款中繼網頁，自動以 POST 方式將表單導向綠界測試閘道 | [pageRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/pageRoutes.js) |
| **後台管理** | GET | `/admin/products` | JWT + Admin (前端驗證) | 渲染管理端之商品管理主頁面 | [pageRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/pageRoutes.js) |
| **後台管理** | GET | `/admin/orders` | JWT + Admin (前端驗證) | 渲染管理端之訂單管理主頁面 | [pageRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/pageRoutes.js) |

---

## 統一回應格式

為了確保前後端串接的穩定性，所有 API 皆採用統一 JSON 包裝回應：

### 成功回應範例 (HTTP 200 / 201)

```json
{
  "data": {
    "id": "e0a6d0ef-ec35-4d32-9cb7-64df7515d97f",
    "name": "粉色玫瑰花束",
    "price": 1680,
    "stock": 30
  },
  "error": null,
  "message": "商品更新成功"
}
```

### 分頁列表回應範例 (HTTP 200)

```json
{
  "data": {
    "products": [
      {
        "id": "e0a6d0ef-ec35-4d32-9cb7-64df7515d97f",
        "name": "粉色玫瑰花束",
        "price": 1680,
        "stock": 30
      }
    ],
    "pagination": {
      "total": 8,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "error": null,
  "message": "成功"
}
```

### 錯誤回應範例 (HTTP 4xx / 5xx)

```json
{
  "data": null,
  "error": "STOCK_INSUFFICIENT",
  "message": "以下商品庫存不足：粉色玫瑰花束"
}
```

### 錯誤碼對照表

| 錯誤代碼 (error) | HTTP 狀態碼 | 觸發情境與業務邏輯 |
| :--- | :---: | :--- |
| `VALIDATION_ERROR` | 400 | 欄位缺失、格式不合正則（如 Email）、數值不合法（數量不是正整數、名稱為空） |
| `STOCK_INSUFFICIENT`| 400 | 購物車加入或結帳扣庫存時，數量超出商品之現有庫存 |
| `CART_EMPTY` | 400 | 購物車查無任何品項，無法進行訂單建立 |
| `INVALID_STATUS` | 400 | 訂單已付款或已失敗，重覆發送模擬付款要求時觸發 |
| `ECPAY_VERIFY_ERROR`| 400 | 綠界金流主動查詢時，回應的數位簽章（CheckMacValue）驗證失敗，回應資料可能已被竄改 |
| `UNAUTHORIZED` | 401 | 缺少 Bearer Token、JWT 驗證解密失敗、Token 過期或所屬 User ID 於 DB 中不存在 |
| `FORBIDDEN` | 403 | 使用者已通過 JWT 驗證，但角色 role 不為 `admin`，存取後台 API 時觸發 |
| `NOT_FOUND` | 404 | 查詢的商品 ID、訂單 ID、或購物車項目 ID 不存在，或是操作非本人的訂單 |
| `CONFLICT` | 409 | 註冊時 Email 已存在，或刪除商品時商品存在於未完成（pending）訂單中 |
| `INTERNAL_ERROR` | 500 | 伺服器內部非預期錯誤，一律由 errorHandler 攔截並回傳中文「伺服器內部錯誤」 |

---

## 認證與授權機制

### JWT 會員認證機制（[authMiddleware.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/middleware/authMiddleware.js)）
- **加密演算法**：HMAC-SHA256 (HS256)
- **有效期限**：7 天（`expiresIn: '7d'`）
- **JWT Payload**：`{ userId: user.id, email: user.email, role: user.role }`
- **中介軟體邏輯**：
  1. 讀取請求的 `req.headers.authorization`。
  2. 若無標頭或未以 `Bearer ` 開頭，回傳 `401 UNAUTHORIZED`「請先登入」。
  3. 提取 Token，調用 `jwt.verify(token, process.env.JWT_SECRET)`。若拋出異常則回傳 `401 UNAUTHORIZED`「Token 無效或已過期」。
  4. 從解密得到的 `decoded.userId` 查詢資料庫 `users` 表。若查無此人，回傳 `401 UNAUTHORIZED`「使用者不存在，請重新登入」。
  5. 驗證通過，將使用者資訊注入 `req.user` 物件，並調用 `next()` 進入後續路由。

### 後台管理員授權機制（[adminMiddleware.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/middleware/adminMiddleware.js)）
- **限制條件**：必須先掛載 `authMiddleware` 取得驗證後之 `req.user`。
- **中介軟體邏輯**：
  1. 檢查 `req.user` 物件是否存在，且其 `req.user.role` 是否等於 `'admin'`。
  2. 若角色不符合，回傳 `403 FORBIDDEN`，帶有 JSON 訊息「權限不足」。
  3. 若符合則調用 `next()` 放行。

### 雙模式認證機制（dualAuth - 位於 [cartRoutes.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/routes/cartRoutes.js)）
- **設計目的**：允許「已登入會員」與「未登入訪客」皆能正常使用購物車。
- **處理流程**：
  1. 優先偵測是否存在 `Authorization` 標頭：
     - 若有且符合 `Bearer ` 格式，直接走 JWT 驗證邏輯。
     - 若 JWT 驗證出錯（過期或偽造），**直接回傳 401 錯誤**，不向下 fallback。
  2. 若完全無 `Authorization` 標頭，則偵測是否存在 `req.sessionId`（由全域 [sessionMiddleware.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/middleware/sessionMiddleware.js) 從請求標頭 `x-session-id` 提取）。
     - 若有 `req.sessionId`，則認定為「未登入訪客模式」，驗證放行。
  3. 若兩者皆查無，回應 `401 UNAUTHORIZED`「請提供有效的登入 Token 或 X-Session-Id」。
- **歸屬判定**：後續業務邏輯中，調用 `getOwnerCondition(req)` 動態取得條件：
  - 會員模式：回傳 `{ field: 'user_id', value: req.user.userId }`
  - 訪客模式：回傳 `{ field: 'session_id', value: req.sessionId }`

---

## 資料庫 Schema 設計

專案使用 SQLite 資料庫（`database.sqlite`），由 [database.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/database.js) 負責載入與初始化。

### 1. 使用者資料表 (`users`)
記錄會員帳號資料。
*   `id` (TEXT, PRIMARY KEY): 使用者唯一 UUID v4。
*   `email` (TEXT, UNIQUE, NOT NULL): 電子信箱，用作登入帳號。
*   `password_hash` (TEXT, NOT NULL): 加密後的密碼雜湊值。
*   `name` (TEXT, NOT NULL): 使用者顯示名稱。
*   `role` (TEXT, NOT NULL, DEFAULT 'user'): 角色，限 `'user'` 或 `'admin'`。
*   `created_at` (TEXT, NOT NULL, DEFAULT (datetime('now'))): 建立時間。

### 2. 商品資料表 (`products`)
記錄上架之花卉商品。
*   `id` (TEXT, PRIMARY KEY): 商品唯一 UUID v4。
*   `name` (TEXT, NOT NULL): 商品名稱。
*   `description` (TEXT): 詳細介紹描述。
*   `price` (INTEGER, NOT NULL): 售價，必須大於 0。
*   `stock` (INTEGER, NOT NULL, DEFAULT 0): 庫存量，必須大於等於 0。
*   `image_url` (TEXT): 商品縮圖 URL。
*   `created_at` (TEXT, NOT NULL, DEFAULT (datetime('now'))): 建立時間。
*   `updated_at` (TEXT, NOT NULL, DEFAULT (datetime('now'))): 上次更新時間。

### 3. 購物車品項表 (`cart_items`)
同時支援訪客（`session_id`）與會員（`user_id`）之購物車暫存。
*   `id` (TEXT, PRIMARY KEY): 項目唯一 UUID v4。
*   `session_id` (TEXT): 訪客唯一識別碼。可為 NULL。
*   `user_id` (TEXT): 會員 ID，外鍵關聯 `users(id)`。可為 NULL。
*   `product_id` (TEXT, NOT NULL): 商品 ID，外鍵關聯 `products(id)`。
*   `quantity` (INTEGER, NOT NULL, DEFAULT 1): 購買數量，必須大於 0。

### 4. 訂單主表 (`orders`)
*   `id` (TEXT, PRIMARY KEY): 訂單唯一 UUID v4。
*   `order_no` (TEXT, UNIQUE, NOT NULL): 訂單編號，格式如 `ORD-YYYYMMDD-XXXXX`（5碼大寫UUID）。
*   `merchant_trade_no` (TEXT): 綠界交易編號，格式為 order_no 去除連字號（例如 `ORDYYYYMMDDXXXXX`）。
*   `user_id` (TEXT, NOT NULL): 下單會員 ID，外鍵關聯 `users(id)`。
*   `recipient_name` (TEXT, NOT NULL): 收件人姓名。
*   `recipient_email` (TEXT, NOT NULL): 收件人 Email。
*   `recipient_address` (TEXT, NOT NULL): 收件地址。
*   `total_amount` (INTEGER, NOT NULL): 訂單結帳總金額。
*   `status` (TEXT, NOT NULL, DEFAULT 'pending'): 狀態，限 `'pending'`、`'paid'`、`'failed'`。
*   `created_at` (TEXT, NOT NULL, DEFAULT (datetime('now'))): 建立時間。

### 5. 訂單明細表 (`order_items`)
記錄下單當時之商品價格與名稱快照，防商品日後變更。
*   `id` (TEXT, PRIMARY KEY): 明細唯一 UUID v4。
*   `order_id` (TEXT, NOT NULL): 訂單 ID，外鍵關聯 `orders(id)`。
*   `product_id` (TEXT, NOT NULL): 商品原始 ID（因商品日後可能被刪除，此僅作關聯參考）。
*   `product_name` (TEXT, NOT NULL): 商品名稱快照。
*   `product_price` (INTEGER, NOT NULL): 商品售價快照。
*   `quantity` (INTEGER, NOT NULL): 購買數量。

---

## 綠界金流串接架構與流程

由於本機端開發無法直接接收綠界伺服器送出之非同步付款通知（`ReturnURL`），本專案設計以「主動查詢」與「付款模擬」為核心架構。

### 完整金流串接流程

```
會員在網頁送出訂單
   │
   ├── [1. 建立訂單] 會員點選「提交訂單」 => POST /api/orders
   │    ├── 產生 order_no（例: ORD-20260412-ABCDE）
   │    ├── 產生 merchant_trade_no（例: ORD20260412ABCDE）
   │    └── 資料庫寫入 pending 訂單、清空購物車與扣減庫存
   │
   ├── [2. 載入付款頁] 前端網頁接收 201 建立成功後，重導至 GET /ecpay/payment/:orderId
   │    ├── 讀取訂單與明細
   │    ├── 呼叫 buildAioFormHtml() 產生綠界規格參數：
   │    │    ├── MerchantID: 3002607 (預設測試商店)
   │    │    ├── MerchantTradeNo: 訂單之 merchant_trade_no
   │    │    ├── MerchantTradeDate: 台灣時區 YYYY/MM/DD HH:mm:ss
   │    │    ├── TotalAmount: 訂單金額整數值
   │    │    ├── ItemName: 多品項名稱以 "#" 連接，最大限制為 400 bytes
   │    │    ├── ReturnURL: `${BASE_URL}/ecpay/notify`（必填，本地端僅作預留）
   │    │    ├── ClientBackURL: `${BASE_URL}/orders/${order.id}?payment=pending`（綠界回導網頁）
   │    │    └── EncryptType: 1 (SHA256)
   │    ├── 呼叫 generateCheckMacValue() 生成大寫 CheckMacValue
   │    └── 回傳帶有隱藏 input 表單的 HTML 頁面，並透過 JavaScript 載入後自動 submit() 到綠界測試閘道
   │
   ├── [3. 付款操作] 會員導向綠界 staging 付款頁面，填寫測試信用卡資訊並付款
   │
   ├── [4. 會員返回] 付款完成後，綠界呈現綠界成功畫面，會員點選「返回商店」
   │    └── 瀏覽器被綠界重新導向至前台訂單詳情頁：/orders/:orderId?payment=pending
   │
   └── [5. 狀態更新與查詢] 前台訂單詳情頁偵測到 `payment=pending` 參數或使用者點選「更新付款狀態」
        └── 發送 POST /api/orders/:id/check-payment (需 JWT)
             ├── 檢查訂單狀態若已是 paid / failed，直接回傳結果
             ├── 讀取 merchant_trade_no，呼叫 queryTradeInfo()
             │    ├── 封裝參數（MerchantID, MerchantTradeNo, TimeStamp）並生成 CheckMacValue
             │    └── 向綠界 QueryTradeInfo V5 API 發送 x-www-form-urlencoded POST 請求
             ├── 接收綠界回應，解析 URL-encoded Response
             ├── 使用 `verifyCheckMacValue` 驗證回傳之 CheckMacValue。若驗證失敗，回傳 `400 ECPAY_VERIFY_ERROR`，拒絕更新狀態，確保資料安全性
             ├── 判定 TradeStatus === '1' (代表付款成功)
             │    ├── 將訂單狀態更新為 'paid' 寫入資料庫
             │    └── 回傳 200 { data: order, message: '付款成功' }
             └── 若非 '1'，則回傳「尚未完成付款，請稍後再查詢」
```

### ECPay 工具模組（[ecpay.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/utils/ecpay.js)）核心設計
- **`ecpayUrlEncode(str)`**：綠界特有的 URL 編碼實作。將 `encodeURIComponent` 的產出中 `%20` 改為 `+`、`~` 改為 `%7e`、`'` 改為 `%27` 並轉為小寫，同時將 `-`, `_`, `.`, `!`, `*`, `(`, `)` 字元替換回原形（符合 .NET `HttpUtility.UrlEncode` 規範）。
- **`generateCheckMacValue(params, hashKey, hashIV)`**：
  1. 過濾掉 `CheckMacValue` 欄位。
  2. 將欄位名稱進行不區分大小寫之字母排序，以 `key=value` 並使用 `&` 連接。
  3. 頭尾分別加上 `HashKey` 與 `HashIV`。
  4. 調用 `ecpayUrlEncode` 編碼，以 `crypto.createHash('sha256')` 生成大寫 SHA256 雜湊簽章。
- **`verifyCheckMacValue(params, hashKey, hashIV)`**：提取回應的 `CheckMacValue`，以時序安全比對機制 `crypto.timingSafeEqual` 與本地端計算之簽章進行比對，防範計時攻擊。
