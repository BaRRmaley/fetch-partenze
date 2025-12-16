const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const station = process.argv[2] || 'S00219';
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const url = `https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/partenze/${station}/${today}`;

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-popup-blocking",
      "--disable-background-networking"
    ]
  });

  try {
    const page = await browser.newPage();
    await page.goto("about:blank");

    const result = await page.evaluate(async (u) => {
      try {
        const r = await fetch(u, {
          method: "GET",
          headers: { "X-Requested-With": "XMLHttpRequest" }
        });
        const text = await r.text();
        return { status: r.status, text };
      } catch (e) {
        return { status: 0, text: "", error: e.message };
      }
    }, url);

    const out = {
      fetched_at: new Date().toISOString(),
      station,
      url,
      status: result.status,
      raw: result.text
    };

    try { out.json = JSON.parse(result.text); }
    catch { out.json = null; }

    fs.writeFileSync('torino-partenze.json', JSON.stringify(out, null, 2));
    console.log("Wrote torino-partenze.json");
  } finally {
    await browser.close();
  }
})();
