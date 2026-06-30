---
name: playwright-e2e-ecpay
description: Guide for running and writing Playwright E2E tests for the flower shop website, including green world ECPay integration testing.
---

# Playwright E2E 測試與綠界 ECPay 金流測試指南

本 Skill 指南提供關於如何在此花卉電商專案中使用 Playwright 執行端對端（E2E）測試的詳細流程，特別是針對**前台會員購買與綠界金流（ECPay）ATM 模擬付款**的整合測試步驟。

---

## 1. 測試指令與設定

### 執行 E2E 測試
在專案根目錄中，輸入以下指令以執行測試：
```bash
npm run test:e2e
```
這會使用 Playwright Test 啟動測試。在 `playwright.config.js` 的設定下，如果本機的 Express 伺服器沒有啟動，Playwright 的 `webServer` 會在背景自動使用 `npm run dev:server` 將伺服器啟動於 `http://localhost:3001`。

### 設定檔：[playwright.config.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/playwright.config.js)
主要設定超時時間為 60 秒，限制並行度為 1（避免 SQLite 資料庫同時寫入衝突），並且配置了自動啟動伺服器的 `webServer` 選項。

---

## 2. 測試流程回顧與步驟

測試腳本位於 [tests/e2e.spec.js](file:///C:/Users/chris/Downloads/2026-ai-adv-homework-course02-main/tests/e2e.spec.js)。其完整的自動化測試流程如下：

### 步驟 1：對話框自動處理 (Dialog Handler)
在進入頁面之前，先註冊對話框接聽器以防綠界金流頁面彈出警告、確認框等干擾測試：
```javascript
page.on('dialog', async dialog => {
  console.log('偵測到對話框:', dialog.type(), dialog.message());
  await dialog.accept(); // 自動確認對話框
});
```

### 步驟 2：會員登入
1. 導向登入頁面：`await page.goto('/login');`
2. 填寫會員帳密：
   * Email：`admin@hexschool.com`
   * 密碼：`12345678`
3. 點擊 **登入** 按鈕，並等待 URL 跳轉回首頁。
> **[!TIP]**
> 因為按鈕文字是 Vue 範本插值，為防渲染時間差，請先使用 `await expect(loginBtn).toHaveText('登入');` 確認 Vue 已完成掛載再點擊。

### 步驟 3：加入購物車
1. 滾動到商品區塊，點擊第一個商品卡片的「**加入購物車**」按鈕：
   * 元素定位：`#products .af-card button.btn-primary`
2. 等待畫面上方顯示 `已加入購物車` 的成功通知（檢查 `#notification-toast`）。

### 步驟 4：填寫結帳資料
1. 導向購物車頁面 `/cart` 並點擊「**前往結帳**」按鈕。
2. 在結帳頁面填寫收件資訊：
   * 收件人姓名：`測試收件人`
   * Email 信箱：`admin@hexschool.com`
   * 收件地址：`台北市信義區信義路五段7號`
3. 點擊「**確認送出訂單**」按鈕。

### 步驟 5：綠界 ECPay 付款操作 (ATM虛擬帳號)
1. 等待網頁自動導向至綠界測試環境（網址匹配 `*ecpay.com.tw*`）。
2. 在綠界付款頁面中：
   * **選擇付款方式**：點擊文字包含 `ATM虛擬帳號` 的選項。
   * **選擇付款銀行**：定位 `select` 下拉選單並選擇 `台灣土地銀行`（銀行代碼 `005`，對應的 `value` 通常為 `LAND`）。
   * **取得虛擬帳號**：點擊 ID 為 `#ATMPaySubmit` 的 `<a>` 標籤以生成繳費帳號。
3. **返回商店**：生成帳號成功後，尋找並點擊文字為 `返回商店`（或 ID 為 `#btnBack`）的按鈕。
> **[!IMPORTANT]**
> ECPay 頁面有許多第三方追蹤腳本，會導致 Playwright 的 `networkidle` 加載狀態無限掛起。因此等待綠界頁面載入時，建議使用 `await page.waitForLoadState('domcontentloaded');` 以避免測試超時卡死。

### 步驟 6：驗證訂單詳情
1. 等待網頁成功導回電商網站的訂單詳情頁（網址匹配 `/orders/:id?payment=pending`）。
2. 驗證頁面中是否包含 `訂單編號`、收件資訊是否正確，以及訂單付款狀態是否顯示 `待付款`（表示已成功完成虛擬帳號產出流程）。

---

## 3. 常見問題與除錯 (Troubleshooting)

1. **測試時點擊「取得繳費帳號」沒反應？**
   * **原因**：綠界上的按鈕並非 `<button>` 或 `<input>`，而是具有 `id="ATMPaySubmit"` 的 `<a>` 元素。如果使用一般 text 匹配可能會定位錯誤。請確認使用 `#ATMPaySubmit` 定位器。
2. **測試執行在綠界付款頁面超時 (Timeout)？**
   * **原因**：如果使用 `page.waitForLoadState('networkidle')`，Playwright 會等待所有追蹤腳本和網絡請求結束。綠界有很多常態性連線會導致超時。
   * **解決方案**：一律改用 `page.waitForLoadState('domcontentloaded')` 並搭配固定的延遲時間 `page.waitForTimeout(ms)`。
3. **SQLite 資料庫寫入鎖定 (Database is locked)？**
   * **原因**：SQLite 不支援多執行緒併行寫入。如果設定多工併行執行多個測試，容易產生衝突。
   * **解決方案**：在 config 中將 `workers: 1` 限制為單線程執行。
