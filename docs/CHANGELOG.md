# 更新日誌 (Changelog)

本專案之所有重大更動與優化皆記錄於此文件。版本控制遵循 [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) 規範，日誌撰寫遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

---

## [Unreleased]

### 綠界金流串接 (ECPay Integration)

#### Added (新增)
- **金流處理工具模組**：新增 `src/utils/ecpay.js`。
  - 實作符合綠界特定規格的 .NET `HttpUtility.UrlEncode` 相容編碼函數 `ecpayUrlEncode`。
  - 實作 `generateCheckMacValue` 產生 SHA256 大寫簽章，包含欄位排序與 HashKey/HashIV 拼接。
  - 實作時序安全（Timing-Safe）驗證機制 `verifyCheckMacValue`。
  - 實作 ECPay 格式時間生成、自動送出 AIO 付款 HTML 表單，以及主動發送 POST 請求至綠界 QueryTradeInfo V5 API。
- **金流串接端點**：
  - 新增 `GET /ecpay/payment/:orderId` 路由，用作自動 POST 送出至綠界付款畫面之中繼網頁。
  - 新增 `POST /api/orders/:id/check-payment`，供前台頁面載入或手動查詢時主動跟綠界核對付款狀態。
- **資料庫 Schema 遷移**：為 `orders` 表新增 `merchant_trade_no` 欄位（order_no 去除 `-` 連字號），以滿足綠界最大長度 20 字元之規範限制。
- **安全性驗證與測試**：
  - 於 `tests/orders.test.js` 新增模擬綠界回應簽章驗證成功與失敗的測試案例，驗證 `POST /api/orders/:id/check-payment` 在不同簽章狀況下的反應，確保金流查詢邏輯的完整性與安全性。

#### Changed (調整)
- **前台結帳邏輯**：更新 [checkout.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/public/js/pages/checkout.js)，送出結帳訂單後立即將瀏覽器導向 `/ecpay/payment/:orderId`，藉由綠界付款中繼頁導引至綠界完成付款。
- **前台訂單詳情頁面**：
  - 移除先前的「模擬付款成功/失敗」按鈕。
  - 新增「前往綠界付款」與「更新付款狀態」按鈕（供待付款訂單使用）。
  - 當使用者從綠界完成付款導回 `payment=pending` 時，自動背景觸發 `check-payment` 以無感更新付款狀態。
- **金流狀態查詢安全性增強**：於 `POST /api/orders/:id/check-payment` 中引入 `verifyCheckMacValue` 校驗綠界回應之數位簽章（CheckMacValue）。若驗證失敗，回傳 `400 ECPAY_VERIFY_ERROR`，拒絕更改訂單狀態，以防止交易資料被惡意竄改。

---

## [1.0.0] - 2026-04-12

本專案初始發行版本。提供基於 Node.js + Express + SQLite 的全端花卉電商基本架構。

### Added (新增)
- **會員認證系統**：
  - 會員註冊、登入與個人資料 API。
  - JWT 會員認證與管理端授權（`authMiddleware`, `adminMiddleware`）。
  - 自動寫入預設管理員之資料庫初始化機制。
- **商品模組**：
  - 公開商品分頁列表與商品明細。
  - 後台商品管理 CRUD 功能與關聯 pending 訂單之安全刪除檢查。
- **購物車模組**：
  - dualAuth 雙模式驗證（會員 JWT / 訪客 Session ID）。
  - 購物車內容查詢、加入累加、數量修改與移除。
- **訂單模組**：
  - 建立訂單 Transaction 原子交易控制（防超賣、清空購物車與扣減庫存）。
  - 會員訂單列表與訂單詳情快照查詢。
  - 後台所有會員之訂單列表與依狀態篩選。
- **測試與文件套件**：
  - 基於 Vitest 與 Supertest 的 6 個循序整合測試檔案。
  - JSDoc 配合 Swagger-jsdoc 的 OpenAPI 3.0.3 規格描述檔自動生成機制。
  - Tailwind CSS 靜態編譯壓縮系統。
