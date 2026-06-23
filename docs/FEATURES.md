# 功能清單與行為描述文件

本文件詳細列出花卉電商系統之所有功能模組、端點規格、請求與回應細節、詳細業務邏輯流程、以及非標準機制設計。

---

## 會員認證功能模組

### 1. 註冊新帳號 (`POST /api/auth/register`)
- **行為描述**：建立全新使用者帳號，註冊成功後系統自動為其生成 JWT Token，讓使用者無須二次登入即可直接處於登入狀態。
- **認證要求**：公開端點（無須認證）。
- **請求參數 (Request Body)**：
  - `email` (string, **必填**)：必須符合電子信箱正則表示式 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`，且在資料庫中不可重覆。
  - `password` (string, **必填**)：密碼字串，最小長度限制為 6 個字元。
  - `name` (string, **必填**)：使用者顯示名稱，不得為空字串或僅含空白。
- **詳細業務邏輯**：
  1. 檢查 `email`, `password`, `name` 欄位是否皆存在，若缺失任何一欄回傳 `400 VALIDATION_ERROR`。
  2. 驗證 `email` 格式，如果不合正則回傳 `400 VALIDATION_ERROR`。
  3. 驗證 `password` 長度，若小於 6 個字元回傳 `400 VALIDATION_ERROR`。
  4. 查詢資料庫 `users` 資料表確認該信箱是否已被註冊。若已被佔用，回傳 `409 CONFLICT`。
  5. 生成新使用者 UUID v4。
  6. 對使用者密碼進行 bcrypt 雜湊加密：若在測試環境（`NODE_ENV=test`）下 rounds 使用 1，非測試環境下 rounds 使用 10。
  7. 將使用者寫入 `users` 資料表，預設角色角色固定為 `'user'`（API 拒絕在此階段建立 admin 帳號）。
  8. 使用 `jsonwebtoken` 簽章核發 Token，有效期限 7 天。
  9. 回傳 `201 Created` 及會員物件與 Token。
- **錯誤情境與狀態碼**：
  - `400 Bad Request` (`VALIDATION_ERROR`)：欄位缺失、Email 格式不正確、或密碼長度不足。
  - `409 Conflict` (`CONFLICT`)：Email 帳號已重複註冊。

### 2. 會員登入驗證 (`POST /api/auth/login`)
- **行為描述**：驗證使用者輸入之帳號密碼，正確無誤則簽發並回傳 JWT Token。登入失敗時採用安全防範機制，不向前端透露具體是帳號不存在或是密碼錯誤，防止惡意枚舉帳號攻擊。
- **認證要求**：公開端點（無須認證）。
- **請求參數 (Request Body)**：
  - `email` (string, **必填**)：會員登入信箱。
  - `password` (string, **必填**)：會員密碼。
- **詳細業務邏輯**：
  1. 檢查 `email` 與 `password` 是否缺失，若缺失任一回傳 `400 VALIDATION_ERROR`。
  2. 使用 `email` 查詢 `users` 資料表取得該用戶。
  3. 若查無此使用者，回傳 `401 UNAUTHORIZED`「Email 或密碼錯誤」。
  4. 調用 `bcrypt.compareSync()` 比對輸入之密碼與資料庫之 `password_hash`。
  5. 若密碼不相符，回傳 `401 UNAUTHORIZED`「Email 或密碼錯誤」。
  6. 驗證成功，簽發 JWT Token（有效期限 7 天，Payload 包含 `{ userId, email, role }`）。
  7. 回傳 `200 OK` 及 Token、會員資料。
- **錯誤情境與狀態碼**：
  - `400 Bad Request` (`VALIDATION_ERROR`)：密碼或帳號未填。
  - `401 Unauthorized` (`UNAUTHORIZED`)：帳密不正確（統一回覆「Email 或密碼錯誤」）。

### 3. 取得會員個人資料 (`GET /api/auth/profile`)
- **行為描述**：獲取當前登入會員之最新帳戶資訊。
- **認證要求**：`Bearer JWT` 驗證（`authMiddleware`）。
- **詳細業務邏輯**：
  1. 從驗證通過之 `req.user.userId` 查詢資料庫 `users` 表。
  2. 若查無此人（可能於登入後被後台刪除），回傳 `404 NOT_FOUND`。
  3. 回傳 `200 OK`，附帶該用戶之 id, email, name, role 與 created_at。
- **錯誤情境與狀態碼**：
  - `401 Unauthorized` (`UNAUTHORIZED`)：未提供 Token、Token 格式錯誤、過期或簽章無效。
  - `404 Not Found` (`NOT_FOUND`)：登入憑證有效但在資料庫中找不到對應的使用者實體。

---

## 商品瀏覽功能模組

### 1. 取得公開商品列表 (`GET /api/products`)
- **行為描述**：獲取目前架上所有花卉商品的分頁清單，預設以商品建立時間由新到舊（降序）排列。
- **認證要求**：公開端點。
- **查詢參數 (Query Parameters)**：
  - `page` (integer, **選填**)：頁碼，預設為 `1`。不可小於 1，若輸入無效字串自動解析為 1。
  - `limit` (integer, **選填**)：每頁顯示筆數，預設為 `10`。範圍限制在 `1 ~ 100` 之間，超出範圍或無效字串會自動修正。
- **詳細業務邏輯**：
  1. 讀取並轉換 `req.query.page` 與 `req.query.limit`。
  2. 以 `Math.max(1, page)` 與 `Math.max(1, Math.min(100, limit))` 進行安全邊界過濾。
  3. 計算資料庫查詢位移量 `offset = (page - 1) * limit`。
  4. 查詢 `products` 表總筆數以計算總頁數：`totalPages = Math.ceil(total / limit)`。
  5. 執行 `SELECT * FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?`。
  6. 回傳 `200 OK`，內含商品陣列與分頁指標物件（`total`, `page`, `limit`, `totalPages`）。

### 2. 取得單一商品詳情 (`GET /api/products/:id`)
- **行為描述**：取得指定商品之完整介紹、售價與庫存數量。
- **認證要求**：公開端點。
- **詳細業務邏輯**：
  1. 讀取路徑參數 `id`。
  2. 查詢 `products` 資料表該商品資料。
  3. 若商品不存在，回傳 `404 NOT_FOUND`。
  4. 回傳 `200 OK` 與該商品實體。
- **錯誤情境與狀態碼**：
  - `404 Not Found` (`NOT_FOUND`)：查無此商品 ID。

---

## 購物車管理功能模組

> [!IMPORTANT]
> **雙模式認證流程 (dualAuth)**：
> 所有購物車 API 均套用 `dualAuth`。優先檢查 `Authorization: Bearer <token>`：若存在且驗證成功，則購物車歸屬於該會員帳號 (`user_id`)；若 Token 驗證失敗直接拋出 401 錯誤；若完全未提供 Bearer 標頭，則轉而偵測 `X-Session-Id` 標頭並將購物車歸屬於訪客 Session 識別碼 (`session_id`)。

### 1. 查看購物車內容 (`GET /api/cart`)
- **行為描述**：列出當前使用者（會員或訪客）購物車內之所有商品，並提供即時商品資訊（防止加入購物車後商品售價或庫存變更）與購物車總計金額。
- **詳細業務邏輯**：
  1. 經過 `dualAuth` 解析，調用 `getOwnerCondition(req)` 決定購物車所有權欄位與值。
  2. 執行 SQL 查詢 `cart_items` JOIN `products`，條件為 `user_id = ?` 或 `session_id = ?`。
  3. 實時計算總金額：遍歷所有品項，加總 `product_price * quantity`。
  4. 回傳 `200 OK`，其 `data` 格式包裝商品詳情與計算後之總額 `total`。

### 2. 加入商品到購物車 (`POST /api/cart`)
- **行為描述**：新增商品至購物車。若該商品已存在於購物車，則進行數量**累加**，並於寫入前即時檢驗總數量是否超出商品庫存。
- **請求參數 (Request Body)**：
  - `productId` (string, **必填**)：商品 ID。
  - `quantity` (integer, **選填**)：欲加入數量，預設為 `1`。必須為正整數。
- **詳細業務邏輯**：
  1. 檢查 `productId` 是否缺失，若無回傳 `400 VALIDATION_ERROR`。
  2. 驗證 `quantity` 是否為正整數，若非正整數回傳 `400 VALIDATION_ERROR`。
  3. 查詢 `products` 資料表確認該商品是否存在。若商品查無，回傳 `404 NOT_FOUND`。
  4. 根據認證模式取得 `user_id` 或 `session_id`。
  5. 查詢購物車中是否已有該商品：
     - **若已有**：計算累加後之新數量 `newQty = existingQty + qty`。若 `newQty > product.stock`，回傳 `400 STOCK_INSUFFICIENT`；驗證通過則更新 `cart_items` 數量。
     - **若沒有**：檢查 `qty > product.stock`。若超出庫存，回傳 `400 STOCK_INSUFFICIENT`；驗證通過則生成新項目 UUID v4 並插入新項目至 `cart_items`。
  6. 回傳 `200 OK` 與更新後之項目資料。
- **錯誤情境與狀態碼**：
  - `400 Bad Request` (`VALIDATION_ERROR`)：缺少 productId 或數量格式不正確。
  - `400 Bad Request` (`STOCK_INSUFFICIENT`)：加總數量超出商品實體現有庫存。
  - `404 Not Found` (`NOT_FOUND`)：加入的商品 ID 不存在。

### 3. 修改項目數量 (`PATCH /api/cart/:itemId`)
- **行為描述**：直接將購物車指定項目之數量重設為指定值（非累加），並檢驗是否超出庫存。
- **請求參數 (Request Body)**：
  - `quantity` (integer, **必填**)：新設定之數量，必須為正整數。
- **詳細業務邏輯**：
  1. 驗證 `quantity` 是否為正整數，若否回傳 `400 VALIDATION_ERROR`。
  2. 根據認證模式及 `itemId` 查詢 `cart_items`，確保該項目存在且**為當前使用者所有**（防止越權竄改他人購物車）。若查無回傳 `404 NOT_FOUND`。
  3. 查詢該項目關聯商品之最新庫存，若 `quantity > product.stock`，回傳 `400 STOCK_INSUFFICIENT`。
  4. 執行 `UPDATE cart_items SET quantity = ? WHERE id = ?`。
  5. 回傳 `200 OK` 與更新結果。
- **錯誤情境與狀態碼**：
  - `400 Bad Request` (`STOCK_INSUFFICIENT` / `VALIDATION_ERROR`)：超出庫存或格式不符。
  - `404 Not Found` (`NOT_FOUND`)：購物車項目 ID 不存在或不屬於該操作帳戶/Session。

### 4. 移除購物車品項 (`DELETE /api/cart/:itemId`)
- **行為描述**：將指定商品項目自購物車中移除。
- **詳細業務邏輯**：
  1. 檢驗 `itemId` 是否屬於當前操作之會員或訪客。若不符合，回傳 `404 NOT_FOUND`。
  2. 執行 `DELETE FROM cart_items WHERE id = ?`。
  3. 回傳 `200 OK`。

---

## 訂單管理功能模組

> [!NOTE]
> 訂單管理功能**不支援訪客下單**，所有 API 均需 `Bearer JWT` 會員認證。

### 1. 建立訂單 (`POST /api/orders`)
- **行為描述**：將該登入會員購物車內之所有商品轉換建立為訂單，並清空其購物車、扣減庫存。本端點使用資料庫 **Transaction 交易控制**以防出現庫存扣減不一致或超賣現象。
- **請求參數 (Request Body)**：
  - `recipientName` (string, **必填**)：收件人姓名，不得為空。
  - `recipientEmail` (string, **必填**)：收件人信箱，需符合 email 格式正則。
  - `recipientAddress` (string, **必填**)：收件人地址，不得為空。
- **詳細業務邏輯（Transaction 原子操作 8 步驟）**：
  1.  **驗證收件資訊**：檢查 `recipientName`, `recipientEmail`, `recipientAddress` 是否填寫。若無回傳 `400 VALIDATION_ERROR`。
  2.  **驗證 Email 格式**：使用正則驗證，不符回傳 `400 VALIDATION_ERROR`。
  3.  **讀取購物車**：從資料庫讀取該 `userId` 購物車內所有項目（JOIN 商品資料取得名稱、價格與庫存）。
  4.  **購物車判空**：若購物車為空，回傳 `400 CART_EMPTY`。
  5.  **檢驗庫存**：檢查每一筆項目數量是否大於該商品之庫存量。若有不足者，收集所有不足商品之名稱，回傳 `400 STOCK_INSUFFICIENT` 並列出具體商品名稱。
  6.  **計算總額與生成編號**：
      - 計算 `totalAmount = Σ(price × quantity)`。
      - 生成 order_id (UUID v4)。
      - 生成 order_no，格式為 `ORD-YYYYMMDD-{5碼大寫UUID}`。
      - 生成 merchant_trade_no，格式為 `ORDYYYYMMDD{5碼大寫UUID}`（由 order_no 去除 `-` 連字號）。
  7.  **🔒 啟動資料庫 Transaction 交易**：
      - **A. 寫入訂單**：將訂單寫入 `orders` 表，預設狀態 status 為 `'pending'`。
      - **B. 寫入明細與扣庫存**：針對每項商品：
        - 寫入 `order_items` 表，並將商品名稱、價格快照存檔。
        - 扣減該商品在 `products` 表之庫存：`stock = stock - quantity`。
      - **C. 清除購物車**：執行 `DELETE FROM cart_items WHERE user_id = ?`。
      - **D. 提交 Transaction 交易**。
  8.  回傳 `201 Created` 及訂單明細。

### 2. 模擬付款機制 (`PATCH /api/orders/:id/pay`)
- **行為描述**：提供開發與測試時快速更新訂單付款狀態之端點（模擬完成付款或付款失敗），無須經過真實綠界付款頁面。
- **請求參數 (Request Body)**：
  - `action` (string, **必填**)：限傳入 `"success"`（付款成功）或 `"fail"`（付款失敗）。
- **詳細業務邏輯**：
  1. 檢查 `action` 參數是否合法。不合法回傳 `400 VALIDATION_ERROR`。
  2. 根據 `id` 與當前會員 `userId` 查詢訂單。若不存在回傳 `404 NOT_FOUND`。
  3. 檢查訂單 status 是否為 `'pending'`。若非 pending 狀態（已付款或已失敗），回傳 `400 INVALID_STATUS`。
  4. 依 action 更新資料：
     - `"success"` => 訂單狀態更新為 `'paid'`。
     - `"fail"` => 訂單狀態更新為 `'failed'`。
  5. 回傳 `200 OK`。

---

## 綠界金流串接功能模組

### 1. 產生自動提交付款表單頁面 (`GET /ecpay/payment/:orderId`)
- **行為描述**：產生一個包含綠界 AIO 參數的 HTML 網頁。該網頁在客戶端瀏覽器載入後，會利用 JavaScript 自動觸發 `submit()`，將使用者導向綠界 staging 付款畫面。
- **認證要求**：公開端點。
- **詳細業務邏輯**：
  1. 根據 `orderId` 查詢訂單。若訂單不存在回應 `404 Not Found`。
  2. 若訂單 status 已非 `'pending'`，則直接重導向至 `/orders/:orderId` 訂單明細網頁。
  3. 查詢該訂單之所有 `order_items` 明細。
  4. 準備綠界 AIO 表單參數，並以專屬的 `ecpayUrlEncode` 加密產生 `CheckMacValue`。
  5. 回傳 `text/html` 表單網頁。

### 2. 查詢綠界付款狀態 (`POST /api/orders/:id/check-payment`)
- **行為描述**：為了解決本機端無法被綠界呼叫 `ReturnURL` 的限制，提供此端點由網頁載入時主動發送 API 請求給綠界進行查詢，以更新本機端資料庫之訂單狀態。
- **認證要求**：`Bearer JWT` 會員認證。
- **詳細業務邏輯**：
  1. 根據訂單 ID 與會員 `userId` 查詢訂單。若查無回傳 `404 NOT_FOUND`。
  2. 若訂單 status 已經是 `'paid'` 或 `'failed'`，則無須重複向綠界查詢，直接回傳最新資料。
  3. 若訂單沒有 `merchant_trade_no`，回傳 `400 NO_TRADE_NO`。
  4. 調用 [ecpay.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/src/utils/ecpay.js) 之 `queryTradeInfo(merchantTradeNo)`：
     - 組裝請求參數，產生 CheckMacValue。
     - 向綠界 `/Cashier/QueryTradeInfo/V5` 測試端點發送 POST 請求。
     - 解析綠界傳回之 URL-encoded 格式字串，進行 `verifyCheckMacValue` 安全簽章比對。
     - 判定 `TradeStatus === '1'` (代表交易成功)。
  5. 若綠界交易成功，執行資料庫 `UPDATE orders SET status = 'paid' WHERE id = ?`。
  6. 回傳查詢結果與最新訂單狀態。
- **錯誤情境與狀態碼**：
  - `400 Bad Request` (`NO_TRADE_NO`)：訂單查無交易號。
  - `404 Not Found` (`NOT_FOUND`)：訂單不存在。
  - `500 Internal Server Error` (`ECPAY_QUERY_ERROR`)：串接綠界 API 失敗或簽章錯誤。

---

## 後台管理功能模組

> [!NOTE]
> 所有後台端點必須套用 `Bearer JWT` 會員認證，且使用者角色必須為 `admin`，否則一律阻擋並回應 `403 FORBIDDEN`。

### 1. 後台新增商品 (`POST /api/admin/products`)
- **請求參數 (Request Body)**：
  - `name` (string, **必填**)：商品名稱，不得為空。
  - `price` (integer, **必填**)：價格，必須為正整數 (> 0)。
  - `stock` (integer, **必填**)：庫存量，必須為大於等於 0 的整數。
  - `description` (string, **選填**)：商品描述。
  - `image_url` (string, **選填**)：商品圖連結。
- **詳細業務邏輯**：
  1. 檢查 `name` 是否缺失，若無回傳 `400 VALIDATION_ERROR`。
  2. 檢查 `price` 是否存在且為正整數，若無回傳 `400 VALIDATION_ERROR`。
  3. 檢查 `stock` 是否存在且為非負整數，若無回傳 `400 VALIDATION_ERROR`。
  4. 生成新商品 UUID v4，寫入 `products` 資料表。
  5. 回傳 `201 Created` 及新增商品實體。

### 2. 後台編輯商品 (`PUT /api/admin/products/:id`)
- **請求參數 (Request Body)**：所有欄位均為**選填**，提供則更新，未提供則保留原值。
  - `name` (string)：不可傳送空字串。
  - `price` (integer)：必須為正整數。
  - `stock` (integer)：必須為非負整數。
- **詳細業務邏輯**：
  1. 根據路徑參數 ID 查詢商品，若查無回傳 `404 NOT_FOUND`。
  2. 若有傳入 `name`，驗證去除空白後不得為空，否則回傳 `400 VALIDATION_ERROR`。
  3. 若有傳入 `price`，驗證必須是正整數，否則回傳 `400 VALIDATION_ERROR`。
  4. 若有傳入 `stock`，驗證必須是非負整數，否則回傳 `400 VALIDATION_ERROR`。
  5. 合併新舊資料，執行 `UPDATE products SET ..., updated_at = datetime('now') WHERE id = ?`。
  6. 回傳 `200 OK` 及更新後商品。

### 3. 後台刪除商品 (`DELETE /api/admin/products/:id`)
- **行為描述**：將指定商品從系統中刪除。為保護歷史資料與進行中訂單完整性，若該商品目前存在於任何**未完成（status = 'pending'）**的訂單中，則系統拒絕刪除。
- **詳細業務邏輯**：
  1. 查詢商品是否存在。若不存在回傳 `404 NOT_FOUND`。
  2. 查詢 `order_items` JOIN `orders`：
     ```sql
     SELECT COUNT(*) as count FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE oi.product_id = ? AND o.status = 'pending'
     ```
  3. 若 `count > 0`，代表有尚未付款之訂單包含此花卉商品，拒絕刪除並回傳 `409 CONFLICT`「此商品存在未完成的訂單，無法刪除」。
  4. 若 `count === 0`（包括僅有關聯已付款 `'paid'` 或已失敗 `'failed'` 的訂單，因訂單品項已建立快照），允許執行 `DELETE FROM products WHERE id = ?`。
  5. 回傳 `200 OK`。

### 4. 後台訂單列表查詢 (`GET /api/admin/orders`)
- **行為描述**：獲取系統中所有會員的訂單列表，支援分頁與狀態篩選。
- **查詢參數 (Query Parameters)**：
  - `page` (integer, **選填**)：預設 1。
  - `limit` (integer, **選填**)：預設 10。
  - `status` (string, **選填**)：可篩選 `pending`, `paid`, `failed`。若傳入非此三者之無效狀態，系統會忽略此篩選條件，列出所有狀態之訂單。
- **詳細業務邏輯**：
  1. 轉換並驗證 page, limit 邊界。
  2. 檢查 `status` 是否在白名單 `['pending', 'paid', 'failed']` 之中。若有，在 SQL 中加入 `WHERE status = ?` 篩選條件。
  3. 查詢符合條件之訂單總數與訂單清單，排序依 `created_at DESC`。
  4. 回傳 `200 OK`。
