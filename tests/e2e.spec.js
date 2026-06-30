const { test, expect } = require('@playwright/test');
const path = require('path');

test('E2E flower shop checkout with ECPay ATM flow', async ({ page }) => {
  // 自動處理綠界可能跳出的任何瀏覽器對話框（如 alert 或 confirm）
  page.on('dialog', async dialog => {
    console.log('偵測到對話框:', dialog.type(), dialog.message());
    await dialog.accept();
    console.log('對話框已確認。');
  });

  // 1. 進入登入頁面
  console.log('1. 正在導向至登入頁面...');
  await page.goto('/login');

  // 2. 輸入帳號密碼進行登入
  console.log('2. 正在登入管理員帳號 (admin@hexschool.com)...');
  await page.locator('input[type="email"]').fill('admin@hexschool.com');
  await page.locator('input[type="password"]').fill('12345678');
  
  const loginBtn = page.locator('form button[type="submit"]').first();
  await expect(loginBtn).toHaveText('登入');
  await loginBtn.click();

  // 等待登入成功並跳轉回首頁
  console.log('正在等待跳轉回首頁...');
  await page.waitForURL('http://localhost:3001/');
  console.log('登入成功！已成功抵達首頁。');

  // 3. 加入一品項到購物車
  console.log('3. 正在將商品加入購物車...');
  const addToCartBtn = page.locator('#products .af-card button.btn-primary').first();
  await addToCartBtn.scrollIntoViewIfNeeded();
  await expect(addToCartBtn).toHaveText('加入購物車');
  await addToCartBtn.click();

  // 等待加入購物車成功的提示訊息
  console.log('正在等待加入購物車成功通知...');
  await page.waitForSelector('#notification-toast', { state: 'visible' });

  // 4. 前往購物車頁面進行結帳
  console.log('4. 進入購物車頁面並點擊結帳...');
  await page.goto('/cart');
  await page.locator('button:has-text("前往結帳")').click();

  // 填寫收件資訊
  await page.waitForURL('**/checkout');
  console.log('正在填寫收件人資訊...');
  await page.locator('input[placeholder="請輸入收件人姓名"]').fill('測試收件人');
  await page.locator('input[placeholder="請輸入 Email"]').fill('admin@hexschool.com');
  await page.locator('input[placeholder="請輸入收件地址"]').fill('台北市信義區信義路五段7號');

  // 送出訂單
  console.log('正在送出訂單...');
  await page.locator('button:has-text("確認送出訂單")').click();

  // 5. 送出訂單後自動進入綠界金流
  console.log('5. 正在導向至綠界金流測試環境...');
  await page.waitForURL(/.*ecpay\.com\.tw.*/, { timeout: 30000 });
  console.log('已抵達綠界測試付款頁面，當前網址:', page.url());
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // (a) 選擇 ATM 虛擬帳號 (ATM 網路交易)
  console.log('   (a) 正在選擇付款方式：ATM虛擬帳號...');
  await page.locator('text=ATM虛擬帳號').first().click();
  await page.waitForTimeout(1000);

  // (b) 選擇【臺灣土地銀行】
  console.log('   (b) 正在選擇付款銀行：台灣土地銀行...');
  const bankSelect = page.locator('select:visible').filter({ hasText: '台灣土地銀行' });
  await bankSelect.selectOption({ label: '台灣土地銀行' });
  await page.waitForTimeout(500);

  // 點擊「取得繳費帳號」
  console.log('正在點擊「取得繳費帳號」按鈕...');
  await page.locator('#ATMPaySubmit').click();

  // 等待綠界顯示繳費資訊頁面
  console.log('正在等待虛擬帳號產出頁面...');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000); // 等待頁面穩定渲染

  // 儲存綠界繳費資訊頁面的截圖以作存證
  const resultScreenshotPath = path.join(__dirname, 'atm_result.png');
  await page.screenshot({ path: resultScreenshotPath, fullPage: true });
  console.log(`繳費帳號產出成功！已儲存截圖至 ${resultScreenshotPath}`);

  // 點擊「返回商店」回到花藝電商網站
  console.log('正在尋找「返回商店」按鈕...');
  const returnBtnText = page.locator('button:has-text("返回商店"), button:has-text("回商店"), a:has-text("返回商店"), a:has-text("回商店"), input[value="返回商店"], input[value="回商店"], #btnBack, .btn-back, input[value="返回"]').first();
  
  if (await returnBtnText.isVisible()) {
    console.log('點擊「返回商店」按鈕...');
    await returnBtnText.click();
  } else {
    const backBtn = page.locator('button:has-text("返回"), a:has-text("返回"), button:has-text("商店"), a:has-text("商店")').first();
    if (await backBtn.isVisible()) {
      console.log('點擊返回按鈕...');
      await backBtn.click();
    } else {
      console.log('未偵測到返回按鈕，嘗試等待自動導回...');
    }
  }

  // 6. 確認成功被導回本站的訂單頁面
  console.log('6. 正在等待導回花卉電商網站...');
  await page.waitForURL(/.*localhost:3001\/orders.*/, { timeout: 25000 });
  console.log('已成功回到電商網站！網址為:', page.url());

  // 等待訂單詳細資訊加載完畢並儲存截圖
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  const finalScreenshotPath = path.join(__dirname, 'order_complete.png');
  await page.screenshot({ path: finalScreenshotPath, fullPage: true });
  console.log(`已儲存最終訂單詳情截圖至 ${finalScreenshotPath}`);

  // 驗證訂單詳情頁內容以確保測試通過
  const finalBodyText = await page.innerText('body');
  expect(finalBodyText).toContain('訂單編號');
  expect(finalBodyText).toContain('待付款');
  expect(page.url()).toContain('/orders/');
  console.log('測試全部通過！');
});
