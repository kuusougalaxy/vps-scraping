// index.js
const puppeteer = require('puppeteer');

(async() => {
  // Puppeteerの起動オプション
  const browser = await puppeteer.launch({
    headless: false,        // false = ヘッドフル（実ブラウザ表示）
    executablePath: '/usr/bin/google-chrome', // システムにインストールされたChromeを指定
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // 必要に応じて '--display=:99' のように環境変数で指定も可
    ]
  });

  const page = await browser.newPage();
  await page.goto('https://example.com', { waitUntil: 'networkidle2' });
  console.log('Page title:', await page.title());

  // 画面キャプチャを取る例
  await page.screenshot({ path: 'example.png' });

  await browser.close();
})();

