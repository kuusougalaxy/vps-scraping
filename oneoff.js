const puppeteer       = require('puppeteer-extra');
const StealthPlugin   = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: true,                       // 必要なら false にして挙動を確認
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://example.com', {
      waitUntil: 'networkidle2',
      timeout  : 60000
    });

    // === ここを document.evaluate ではなくクエリで取得 ===
    const h1Text = await page.evaluate(() =>
      document.querySelector('h1')?.textContent.trim() || null
    );

    console.log('\n結果 =>', h1Text);
  } catch (err) {
    console.error('エラー:', err);
  } finally {
    await browser.close();
  }
})();
