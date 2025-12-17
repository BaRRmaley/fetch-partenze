const fs = require("fs");

// Compute YYYYMMDD in Italy timezone
function italyDate(offsetDays = 0) {
  const now = new Date();
  const italy = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Rome" })
  );
  italy.setDate(italy.getDate() + offsetDays);

  const y = italy.getFullYear();
  const m = String(italy.getMonth() + 1).padStart(2, "0");
  const d = String(italy.getDate()).padStart(2, "0");

  return `${y}${m}${d}`;
}

// Fetch departures for a given station + date, using Node 18+ global fetch
async function fetchDepartures(station, date) {
  const url = `https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/partenze/${station}/${date}`;

  try {
    const r = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });

    const text = await r.text();

    return {
      url,
      status: r.status,
      text
    };
  } catch (e) {
    return {
      url,
      status: 0,
      text: "",
      error: e.message
    };
  }
}

// Detect if ViaggiaTreno returned no usable data
function isEmptyResponse(res) {
  if (!res.text) return true;

  const t = res.text.trim().toLowerCase();

  if (t === "" || t === "error") return true;

  try {
    const parsed = JSON.parse(res.text);
    if (!parsed || parsed.length === 0) return true;
  } catch {
    // if it’s not valid JSON, treat as empty/useless
    return true;
  }

  return false;
}

async function main() {
  const station = process.argv[2] || "S00219"; // default: Torino Lingotto

  const today = italyDate(0);
  const tomorrow = italyDate(1);
  const yesterday = italyDate(-1);

  const attempts = [
    { label: "today", date: today },
    { label: "tomorrow", date: tomorrow },
    { label: "yesterday", date: yesterday }
  ];

  let final = null;

  for (const attempt of attempts) {
    console.log("TRYING:", attempt.label, attempt.date);

    const res = await fetchDepartures(station, attempt.date);

    console.log("FETCHING:", res.url);
    console.log("STATUS:", res.status);
    console.log("RAW SAMPLE:", res.text ? res.text.slice(0, 200) : "<empty>");
    if (res.error) console.log("ERROR:", res.error);

    if (!isEmptyResponse(res)) {
        try {
            res.json = JSON.parse(res.text);
        } catch {
            res.json = null;
        }

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
}

main();
