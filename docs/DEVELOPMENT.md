# 開發規範與指南

本文件定義專案之命名規範、模組系統使用限制、新增核心元件之步驟指引、環境變數對照表、JSDoc 格式規範，以及開發計畫之歸檔工作流程。

---

## 命名規則對照表

開發時請務必遵循以下命名規則，以維護程式碼的一致性與可讀性：

| 類別項目 | 命名規範規則 | 命名範例 | 說明 |
| :--- | :--- | :--- | :--- |
| **檔案名稱（路由）** | camelCase | `authRoutes.js`, `adminProductRoutes.js` | 路由處理檔案字尾統一加 `Routes.js`。 |
| **檔案名稱（Middleware）** | camelCase | `authMiddleware.js`, `errorHandler.js` | 中介軟體檔案字尾統一加 `Middleware.js`（全域處理器除外）。 |
| **檔案名稱（單元測試）** | camelCase + `.test.js` | `auth.test.js`, `adminOrders.test.js` | 測試模組檔案，對應路由或邏輯。 |
| **檔案名稱（前端 JS）** | kebab-case | `header-init.js`, `admin-products.js`, `api.js` | 靜態 public/js 目錄下之前端腳本。 |
| **檔案名稱（EJS 模板）** | kebab-case | `product-detail.ejs`, `order-detail.ejs` | views/ 目錄下之視圖模板。 |
| **資料庫表名** | snake_case（複數形） | `users`, `cart_items`, `order_items` | 資料庫實體表名稱。 |
| **資料庫欄位名** | snake_case | `user_id`, `created_at`, `password_hash` | 資料庫欄位與索引屬性。 |
| **API 端點路徑** | kebab-case | `/api/auth/register`, `/api/admin/products` | RESTful API 資源路徑。 |
| **Request Body 欄位** | camelCase | `productId`, `recipientName`, `recipientEmail` | JSON 請求主體之欄位格式。 |
| **Response 傳回欄位** | snake_case | `order_no`, `total_amount`, `image_url` | 統一回應之 `data` 物件內欄位（與資料庫欄位直接映射）。 |
| **JavaScript 變數** | camelCase | `cartItems`, `totalAmount`, `orderNo` | 程式碼內區域與全域變數。 |
| **JavaScript 函數** | camelCase | `dualAuth()`, `getOwnerCondition()`, `generateOrderNo()` | 程式碼內函數與方法。 |
| **環境變數** | UPPER_SNAKE_CASE | `JWT_SECRET`, `ADMIN_EMAIL`, `PORT` | 系統級或環境變數配置。 |

> [!NOTE]
> 專案採用混合模型：**Request Body 欄位使用 camelCase，但 API Response 傳回之 JSON 欄位使用 snake_case**。此設計旨在減少後端對資料庫查詢結果進行轉換的效能耗損。

---

## 模組系統說明

本專案之運行伺服器與路由均基於 **Node.js CommonJS** 模組規範（使用 `require` 與 `module.exports`），但在測試配置上有特定例外：

1.  **後端原始碼（`src/` 與根目錄 `app.js`、`server.js`）**：
    必須使用 CommonJS 載入與匯出：
    ```javascript
    // 載入外部模組與自訂模組
    const express = require('express');
    const db = require('../database');
    const authMiddleware = require('../middleware/authMiddleware');

    // 匯出模組
    module.exports = router;
    ```
2.  **前端 JS 腳本（`public/js/`）**：
    由於在瀏覽器端直接以 `<script>` 標籤載入，且不使用 Webpack 等打包工具，因此**不得使用 CommonJS `require` 或 ES6 `import`**。所有模組（如 `api.js`, `auth.js`）皆將變數與方法掛載於全域作用域（Window 物件）之下，例如 `window.API`。
3.  **Vitest 測試設定檔（`vitest.config.js`）**：
    由於 Vitest 框架限制，設定檔必須使用 **ES Modules (ESM)** 規範（`import { defineConfig } from 'vitest/config'`），但被測試的檔案與測試實體檔本身仍以 CommonJS 載入 Express app。

---

## 新增系統元件步驟

### 1. 新增 API 端點之步驟
1.  **定位或新建路由檔案**：於 `src/routes/` 選擇適合的檔案（或新建如 `discountRoutes.js`）。
2.  **實作 API 邏輯與註解**：
    ```javascript
    const express = require('express');
    const router = express.Router();
    const db = require('../database');

    /**
     * @openapi
     * /api/example:
     *   get:
     *     summary: 範例 API
     *     tags: [Example]
     *     responses:
     *       200:
     *         description: 成功
     */
    router.get('/', (req, res) => {
      res.json({
        data: { message: "Hello World" },
        error: null,
        message: '成功'
      });
    });

    module.exports = router;
    ```
3.  **掛載路由至主程式**：在根目錄 [app.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/app.js) 引入並啟用該路由：
    ```javascript
    app.use('/api/example', require('./src/routes/exampleRoutes'));
    ```
4.  **套用驗證機制**（若需要）：
    - 全域路由保護：在路由檔案頂部加入 `router.use(authMiddleware)`。
    - 單一路線保護：`router.post('/secure-action', authMiddleware, (req, res) => { ... })`。
5.  **更新測試案例**：在 `tests/` 新增對應的 `*.test.js`，並於 [vitest.config.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/vitest.config.js) 的 `sequence.files` 中加入該測試，確保測試執行順序正確。

### 2. 新增 Middleware 之步驟
1.  於 `src/middleware/` 下建立檔案（如 `logMiddleware.js`）。
2.  編寫中介軟體結構（必須接收 `req`, `res`, `next`）：
    ```javascript
    function logMiddleware(req, res, next) {
      console.log(`[Request] ${req.method} ${req.path}`);
      next(); // 放行
    }
    module.exports = logMiddleware;
    ```
3.  若要全域掛載，在 `app.js` 的 `Global middleware` 區段調用 `app.use(logMiddleware)`；若局部掛載，則在特定 Route 檔案中引入並加入路由參數中。

### 3. 新增資料表之步驟
1.  開啟 [database.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/database.js)。
2.  在 `initializeDatabase()` 的 `db.exec(\` ... \`)` 區塊中，以標準 SQL 語法編寫建表結構。
    - 使用 `TEXT` 作為 UUID 主鍵。
    - 金額欄位必須有 `CHECK (price > 0)`。
    - 數量必須有 `CHECK (quantity > 0)`。
    - 建立適當的外鍵約束（如 `FOREIGN KEY (user_id) REFERENCES users(id)`）。
3.  若需要初始資料，於檔案中新增 `seedYourData()` 函數並在建表後調用。

---

## 環境變數配置表

專案所有環境配置均讀取自 `.env` 檔案，各變數說明如下：

| 變數名稱 | 用途說明 | 必填性 | 預設值 | 影響範圍與內部行為 |
| :--- | :--- | :---: | :---: | :--- |
| `JWT_SECRET` | 用於 JWT 簽章加密與驗證的密鑰。 | **必填** | 無 | 啟動時若未設置會直接於 `server.js` 丟出錯誤並終止。 |
| `PORT` | Express 伺服器監聽之連接埠。 | 選填 | `3001` | 系統啟動連接埠。 |
| `BASE_URL` | 系統伺服器基礎網址。 | 選填 | `http://localhost:3001` | 用於綠界金流傳遞之 `ReturnURL` 與 `ClientBackURL` 前綴。 |
| `FRONTEND_URL` | CORS 跨域請求白名單來源網址。 | 選填 | `http://localhost:3001` | 控制 CORS 標頭之 Origin 存取權限。 |
| `ADMIN_EMAIL` | 自動初始化管理員之登入信箱。 | 選填 | `admin@hexschool.com` | 資料庫初始化時，若此信箱未被註冊，將自動建表寫入。 |
| `ADMIN_PASSWORD` | 自動初始化管理員之登入密碼。 | 選填 | `12345678` | 管理員初始登入密碼（寫入前經 bcrypt 雜湊加密）。 |
| `NODE_ENV` | 系統運行環境指標（如 `test`, `development`, `production`）。 | 選填 | 無 | **關鍵影響**：若值為 `test`，資料庫初始化時 bcrypt 雜湊等級降為 `1` 以加速測試執行；否則預設為 `10`。 |
| `ECPAY_MERCHANT_ID` | 綠界特店代號。 | 選填 | `3002607` | 綠界 SDK 及 API 交易必要參數（預設使用綠界提供之官方測試代號）。 |
| `ECPAY_HASH_KEY` | 綠界 HashKey，用於交易資料加密。 | 選填 | `pwFHCqoQZGmho4w6` | 用以計算 CheckMacValue 簽章。 |
| `ECPAY_HASH_IV` | 綠界 HashIV，用於交易資料向量加密。 | 選填 | `EkRm7iFT261dpevs` | 用以計算 CheckMacValue 簽章。 |
| `ECPAY_ENV` | 綠界金流所屬環境（`staging` 或 `production`）。 | 選填 | `staging` | 若為 `staging`，API 位址指向綠界測試伺服器；否則指向生產環境。 |

---

## JSDoc / OpenAPI 規格規範

本專案使用 `swagger-jsdoc` 讀取路由檔案中的 JSDoc 註解來動態產生 Swagger 規格文件。

### 撰寫規範
- **`tags`**：必須將端點分門別類，僅限於 `[Auth]`, `[Products]`, `[Cart]`, `[Orders]`, `[Admin Products]`, `[Admin Orders]`。
- **`security`**：凡需要會員登入之端點，必須加上 `- bearerAuth: []`；購物車端點需支援 X-Session-Id，需加上 `- sessionId: []`。
- **`responses`**：必須描述所有可能發生的 HTTP 狀態碼與對應的 JSON 回傳 schema（皆含有 `data`, `error`, `message` 頂層屬性）。

### JSDoc 範例
```javascript
/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     summary: 取得商品詳情
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     price:
 *                       type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       404:
 *         description: 商品不存在
 */
```

---

## 計畫歸檔流程

1. 計畫檔案命名格式：YYYY-MM-DD-<feature-name>.md
2. 計畫文件結構：User Story  Spec  Tasks
3. 功能完成後：移至 docs/plans/archive/
4. 更新 docs/FEATURES.md 和 docs/CHANGELOG.md
