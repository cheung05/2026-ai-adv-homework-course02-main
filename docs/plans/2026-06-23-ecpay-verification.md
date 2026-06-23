# 2026-06-23 綠界金流主動查詢安全驗證

## User Story
作為電商系統管理員與顧客，我希望在本地端主動查詢付款狀態時，系統能對綠界回應的數位簽章進行驗證，以防止付款狀態被惡意偽造或竄改，保障交易安全。

## Spec
### API 規格
- `POST /api/orders/:id/check-payment`
  - 驗證：Bearer JWT
  - 行為：呼叫 QueryTradeInfo V5 API，解析回應參數後使用 `verifyCheckMacValue` 進行 CheckMacValue 驗證。若驗證失敗，回傳 400 ECPAY_VERIFY_ERROR。

### 資料庫變更
- 無

### 業務規則
- 呼叫綠界 API 成功後，必須對回傳的所有參數（排除 CheckMacValue）以 `verifyCheckMacValue` 校驗數位簽章，比對成功方可判定 TradeStatus。

## Tasks
- [x] 於 `src/routes/orderRoutes.js` 引入與套用 `verifyCheckMacValue`
- [x] 於 `tests/orders.test.js` 撰寫模擬綠界簽章回傳之成功與失敗測試案例
- [x] 執行測試套件確保無迴歸問題
