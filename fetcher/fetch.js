const fs = require("fs");
const puppeteer = require("puppeteer");

// Compute YYYYMMDD in Italy timezone
function italyDate(offsetDays = 0) {
  const now = new Date();
  const italy = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  italy.setDate(italy.getDate() + offsetDays);

  const y = italy.getFullYear();
  const m = String(italy.getMonth() + 1).padStart(2, "0");
  const d = String(italy.getDate()).padStart(2, "0");

  return `${y}${m}${d}`;
}

// Fetch departures for a given station + date
async function fetchDepartures(page, station, date) {
  const url = `https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/partenze/${station}/${date}`;

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

  return { url, ...result };
}

(async () => {
  const station = process.argv[2] || "S00219"; // default: Torino Lingotto

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

  const page = await browser.newPage();
  await page.goto("about:blank");

  // Try today → tomorrow → yesterday
  const today = italyDate(0);
  const tomorrow = italyDate(1);
  const yesterday = italyDate(-1);

  let attempts = [
    { label: "today", date: today },
    { label: "tomorrow", date: tomorrow },
    { label: "yesterday", date: yesterday }
  ];

  let final = null;

  for (const attempt of attempts) {
    const res = await fetchDepartures(page, station, attempt.date);

    // ViaggiaTreno returns "Error" or empty string when no data
    const isEmpty =
      !res.text ||
      res.text.trim() === "" ||
      res.text.trim().toLowerCase() === "error";

    if (!isEmpty) {
      final = { ...res, used: attempt.label };
      break;
    }
  }

  if (!final) {
    final = {
      used: "none",
      url: "",
      status: 0,
      text: "",
      json: null
    };
  } else {
    try {
      final.json = JSON.parse(final.text);
    } catch {
      final.json = null;
    }
  }

  const output = {
    fetched_at: new Date().toISOString(),
    station,
    used_date: final.used,
    url: final.url,
    status: final.status,
    raw: final.text,
    json: final.json
  };

  fs.writeFileSync("torino-partenze.json", JSON.stringify(output, null, 2));
  console.log("Wrote torino-partenze.json");

  await browser.close();
})();
