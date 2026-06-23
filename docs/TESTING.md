# 測試規範與指南

本文件說明專案之測試架構、執行指令、測試檔案之依賴順序規則、測試輔助工具、撰寫新測試案例之標準步驟以及常見的六大踩坑點。

---

## 測試框架與執行指令

### 1. 測試框架技術
- **測試執行器**：[Vitest](https://vitest.dev/)（高度相容 Jest 語法，執行效率極佳）。
- **HTTP 模擬工具**：[Supertest](https://github.com/ladjs/supertest)（允許直接傳入 Express App 進行路由級別測試，無須佔用與監聽實體埠號）。

### 2. 測試執行指令
```bash
# 執行全部測試（一次性執行完畢後退出）
npm run test

# 或直接調用
npx vitest run
```

---

## 測試設定檔規格（`vitest.config.js`）

為保證資料庫狀態之一致性與避免平行寫入 SQLite 所造成之鎖定衝突，測試執行必須採**單執行緒序列化執行**。

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,          // 開啟全域變數，describe / it / expect 可直接使用無須 import
    fileParallelism: false, // 關鍵設定：關閉檔案級別平行執行，強制依序執行
    sequence: {
      files: [              // 定義嚴格的測試檔案執行順序
        'tests/auth.test.js',
        'tests/products.test.js',
        'tests/cart.test.js',
        'tests/orders.test.js',
        'tests/adminProducts.test.js',
        'tests/adminOrders.test.js',
      ],
    },
    hookTimeout: 10000,     // beforeAll / afterAll 等 Hook 之最大超時上限（10秒）
  },
});
```

---

## 測試檔案表與依賴關係

測試檔案之間存在資料流之隱式依賴。例如，必須先跑 Auth 註冊會員才能在 Cart 中放入商品，而在 Cart 放入商品後，才能於 Orders 中進行結帳。

| 測試檔案名稱 | 測試涵蓋範圍 | 前置執行依賴說明 |
| :--- | :--- | :--- |
| [auth.test.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/tests/auth.test.js) | 會員註冊、登入、重複 Email 拒絕、個人資料保護與 API 獲取。 | **第 1 順位**。負責驗證底層密碼雜湊與 Token 發放。無任何前置依賴。 |
| [products.test.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/tests/products.test.js) | 商品列表分頁、商品詳情取得、404 商品不存在處理。 | **第 2 順位**。依賴資料庫初始化所建立之 8 筆預設種子商品。 |
| [cart.test.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/tests/cart.test.js) | 購物車加入、商品數量直接修改、累加、移除、訪客 Session 與會員 JWT 雙模式測試。 | **第 3 順位**。需要 [auth.test.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/tests/auth.test.js) 中正常生成的 Token 以及商品存在。 |
| [orders.test.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/tests/orders.test.js) | 會員結帳（扣庫存原子操作）、空購物車建立防護、訂單詳情、模擬付款。 | **第 4 順位**。依賴購物車內存有品項（由 [cart.test.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/tests/cart.test.js) 執行後寫入）。 |
| [adminProducts.test.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/tests/adminProducts.test.js) | 管理端商品 CRUD、權限不足 403 阻擋、商品遭 pending 訂單佔用無法刪除測試。 | **第 5 順位**。依賴 admin 權限，且必須在有 pending 訂單的環境下測試防刪邏輯。 |
| [adminOrders.test.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/tests/adminOrders.test.js) | 管理端所有訂單查詢、分頁與狀態篩選。 | **第 6 順位**。需要系統中已有產生之訂單與 admin Token。 |

---

## 測試輔助模組（`tests/setup.js`）說明

為減少測試檔案冗餘配置，[setup.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/tests/setup.js) 提供以下輔助函式：

### 1. `getAdminToken()`
- **功能**：自動登入預設的管理員帳號，並獲取其 JWT 憑證。
- **回傳值**：`Promise<string>`（JWT Token）。
- **用法範例**：
  ```javascript
  const adminToken = await getAdminToken();
  ```

### 2. `registerUser(overrides = {})`
- **功能**：動態註冊一個全新會員，其 Email 自動使用時間戳記與亂數生成，確保唯一性。
- **參數**：
  - `overrides.email` (string)：自訂登入信箱。
  - `overrides.password` (string)：自訂登入密碼（預設 `password123`）。
  - `overrides.name` (string)：自訂會員名稱（預設 `測試使用者`）。
- **回傳值**：`Promise<{ token: string, user: Object }>`。
- **用法範例**：
  ```javascript
  const { token, user } = await registerUser({ name: '張小明' });
  ```

---

## 撰寫新測試之步驟與範例

當開發新功能（例如新增優惠券 `/api/coupons`）時，請依循以下開發流程：

### 步驟 1：建立測試檔案
於 `tests/` 下建立 `coupons.test.js`，並套用標準架構：

```javascript
const { app, request, registerUser, getAdminToken } = require('./setup');

describe('Coupons API', () => {
  let userToken;
  let adminToken;

  beforeAll(async () => {
    // 初始化所需之 Token
    const userRes = await registerUser();
    userToken = userRes.token;
    adminToken = await getAdminToken();
  });

  describe('GET /api/coupons', () => {
    it('會員應能正常獲取優惠券列表', async () => {
      const res = await request(app)
        .get('/api/coupons')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.error).toBeNull();
    });

    it('未攜帶 Token 存取應被拒絕並回傳 401', async () => {
      const res = await request(app).get('/api/coupons');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });
  });
});
```

### 步驟 2：註冊測試順序
在 [vitest.config.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/vitest.config.js) 的 `sequence.files` 中，於適當的依賴後方補上檔案路徑：
```javascript
sequence: {
  files: [
    // ... 前置測試
    'tests/adminOrders.test.js',
    'tests/coupons.test.js' // 加在尾端確保前置依賴就緒
  ]
}
```

---

## 測試常見六大踩坑點

### 1. 忽略測試順序依賴性
- **問題**：測試檔案非平行獨立，如果將 `vitest.config.js` 的 `sequence.files` 順序對調（例如先執行 `orders.test.js` 再跑 `cart.test.js`），會因購物車無前置資料導致訂單建立失敗。
- **防範**：務必確認有依賴關係之檔案在設定檔中維持正確先後順序。

### 2. 測試資料庫共用污染
- **問題**：所有測試皆共用同一個 `database.sqlite` 實體檔案且測試完畢後**無 teardown 自動還原資料庫機制**。若某測試註冊了寫死 Email 的帳號，二次跑測試將會因 UNIQUE 限制報錯。
- **防範**：測試帳號生成務必調用 `registerUser()` 產出隨機唯一的 Email 帳號。

### 3. bcrypt 加密拖慢測試速度
- **問題**：在無優化下跑 32 筆測試可能需要數十秒，主因為密碼 bcrypt 加密非常消耗 CPU。
- **解法**：專案已實作 bcrypt round 判定：首次啟動資料庫時若偵測到 `NODE_ENV=test`，會將 admin 的雜湊等級降為 1 級以光速完成比對。若本地執行測試速度緩慢，請檢查環境變數 `NODE_ENV` 是否正確帶入 `test`。

### 4. Hook 10秒超時上限 (hookTimeout)
- **問題**：`beforeAll` 內若要一口氣進行「註冊 -> 登入 -> 加入商品 -> 清空購物車」等複合式 HTTP 模擬動作，在硬體等級較低的機器上容易超出 Vitest 預設超時。
- **防範**：配置中已將 `hookTimeout` 拉高至 `10000ms`（10秒）。如遇超時，應簡化 beforeAll 之邏輯或調用 SQLite 直連寫入資料，免去走 HTTP 連線。

### 5. 誤以為 Supertest 啟動了實體 Port
- **問題**：在測試程式中試圖用瀏覽器或 Axios 透過 `http://localhost:3001` 與 API 通訊。
- **防範**：Supertest `request(app)` 是直接調用 Express 之內建監聽，實際上並沒有綁定與開啟任何實體通訊埠。

### 6. 清理測試垃圾資料
- **問題**：重複運行多次 `npm run test` 會在 `database.sqlite` 中留下大量 `test-xxx@example.com` 用戶與訂單。
- **防範**：雖然主鍵唯一不影響測試通過，但若硬碟空間敏感，可手動將 `database.sqlite` 刪除，再次啟動時系統將自動重新建立一個乾淨無污染的資料庫。
