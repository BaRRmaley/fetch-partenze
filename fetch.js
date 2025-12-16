// fetcher/fetch.js
const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const station = process.argv[2] || 'S00219';
  const today = new Date().toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
  const url = `https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/partenze/${station}/${today}`;

  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    await page.goto('https://www.viaggiatreno.it/', { waitUntil: 'networkidle2', timeout: 30000 });

    const result = await page.evaluate(async (u) => {
      try {
        const r = await fetch(u, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' }});
        const text = await r.text();
        return { status: r.status, text };
      } catch (e) {
        return { status: 0, text: '', error: e.message };
      }
    }, url);

    const out = {
      fetched_at: new Date().toISOString(),
      station,
      url,
      status: result.status,
      raw: result.text
    };

    // Try parse and extract compact next 5 departures
    try {
      const data = JSON.parse(result.text);
      // data is an array of departures; map to compact fields
      const compact = (Array.isArray(data) ? data : []).slice(0, 5).map(item => {
        return {
          train: item.numeroTreno || item.codiceTreno || null,
          destination: item.destinazione || item.destinazioneDescrizione || null,
          scheduled: item.orarioPartenza || item.orarioArrivo || item.orario || null,
          expected: item.orarioEffettivo || item.orarioPrevisto || null,
          platform: item.binario || item.binarioEffettivo || null,
          delay_minutes: item.minutiRitardo != null ? item.minutiRitardo : null,
          status: item.stato || null
        };
      });
      out.json = compact;
    } catch (e) {
      out.json = null;
    }

    fs.writeFileSync('torino-partenze.json', JSON.stringify(out, null, 2));
    console.log('Wrote torino-partenze.json');
  } finally {
    await browser.close();
  }
})();
