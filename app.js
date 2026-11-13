/* Token site — read-only live stats. Never holds keys, never signs, never sends. */
(() => {
  "use strict";
  const C = Object.assign({ NAME:"Slice", TICKER:"SLICE", CA:"", TREASURY:"", X_URL:"", TG_URL:"", FEED_SHARE_PCT:100, TOP_N:10, EXCLUDE_WALLETS:[],
    FEED_INTERVAL_MIN:5, RPC_URL:"https://api.mainnet-beta.solana.com", RPC_FALLBACKS:[], TX_SCAN_LIMIT:25,
    REFRESH_SEC:60, MIN_PAYOUT_SOL:0.00001 }, window.SITE_CONFIG || {});
  const qs = new URLSearchParams(location.search);
  const rpcOverride = qs.get("rpc");
  if (rpcOverride && /^https:\/\//i.test(rpcOverride)) C.RPC_URL = rpcOverride;

  const NAME = String(C.NAME || "Slice").trim(), TICK = "$" + String(C.TICKER || NAME).trim().replace(/^\$/, "").toUpperCase();
  const CA = (C.CA || "").trim(), TREASURY = (C.TREASURY || "").trim();
  const INTERVAL = Math.max(1, Number(C.FEED_INTERVAL_MIN) || 5) * 60;
  const TOP_N = Math.max(1, Math.floor(Number(C.TOP_N) || 10));
  const SHARE = Math.min(100, Math.max(0, Number(C.FEED_SHARE_PCT) || 100));
  const FEEDS_PER_DAY = Math.floor(86400 / INTERVAL);
  const LAMPORTS = 1e9;
  const SYSTEM_PROGRAM = "11111111111111111111111111111111";
  const BURN = "1nc1nerator11111111111111111111111111111111";
  const EXCLUDE = new Set([BURN, TREASURY, ...(Array.isArray(C.EXCLUDE_WALLETS) ? C.EXCLUDE_WALLETS : [])].filter(Boolean));

  const isAddr = s => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
  const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
  const short = a => a ? a.slice(0,4) + "…" + a.slice(-4) : "";
  const fmt = (n, d=2) => Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
  const big = n => n >= 1e9 ? fmt(n/1e9, 2) + "B" : n >= 1e6 ? fmt(n/1e6, n >= 1e8 ? 0 : 1) + "M" : n >= 1e3 ? fmt(n/1e3, 1) + "K" : fmt(n, 0);
  const ago = t => { const s = Math.max(0, Math.floor(Date.now()/1000 - t));
    if (s < 60) return s + "s ago"; if (s < 3600) return Math.floor(s/60) + "m ago";
    if (s < 86400) return Math.floor(s/3600) + "h ago"; return Math.floor(s/86400) + "d ago"; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const BADGE_EX = `<span class="badge badge-warn">Example data</span>`;
  const BADGE_LIVE = `<span class="badge badge-ok">Live</span>`;
  const BADGE_ERR = `<span class="badge badge-err">RPC unavailable</span>`;

  /* ---------- static bits: links, CA, treasury ---------- */
  const caOk = isAddr(CA), tOk = isAddr(TREASURY);
  const links = {
    pump: caOk ? `https://pump.fun/coin/${CA}` : "",
    jup:  caOk ? `https://jup.ag/swap/SOL-${CA}` : "",
    dex:  caOk ? `https://dexscreener.com/solana/${CA}` : "",
    x: C.X_URL || "", tg: C.TG_URL || ""
  };
  $$("[data-link]").forEach(a => {
    const url = links[a.dataset.link];
    if (url) a.href = url;
    else { a.removeAttribute("href"); a.classList.add("disabled"); a.title = "Coming soon"; }
  });
  // Brand from config: title, meta, logo, copy
  $$(".js-name").forEach(e => e.textContent = NAME);
  $$(".js-ticker-full").forEach(e => e.textContent = TICK);
  const TAG = "Hold the bag, get a slice";
  document.title = `${TICK} — ${TAG}`;
  const setMeta = (sel, v) => { const m = document.querySelector(sel); if (m) m.setAttribute("content", v); };
  const DESC = `${TICK}: 100% of claimed pump.fun creator fees get baked into a fresh pie every ${Number(C.FEED_INTERVAL_MIN)||5} minutes and sliced among the top ${Math.floor(Number(C.TOP_N)||10)} holders. Bigger bag, bigger slice.`;
  setMeta('meta[name="description"]', DESC); setMeta('meta[property="og:title"]', document.title); setMeta('meta[property="og:description"]', DESC);
  $$(".js-interval").forEach(e => e.textContent = INTERVAL/60);
  $$(".js-topn").forEach(e => e.textContent = TOP_N);
  $$(".js-share").forEach(e => e.textContent = SHARE);
  $(".js-ca").textContent = caOk ? CA : "Launching soon — CA drops here";

  const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 1800); };
  async function copy(text, el) {
    try { await navigator.clipboard.writeText(text); }
    catch { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand("copy"); s.removeAllRanges(); }
  }
  $("#copyCa").addEventListener("click", async () => { if (!caOk) return toast("CA not live yet — launching soon"); await copy(CA, $(".js-ca")); toast("CA copied ✓"); });
  $(".js-tres").textContent = tOk ? TREASURY : "Coming soon";
  const ts = $(".js-tres-scan");
  if (tOk) ts.href = `https://solscan.io/account/${TREASURY}`; else { ts.removeAttribute("href"); ts.classList.add("off"); }
  $("#copyTres").addEventListener("click", async () => { if (!tOk) return toast("Treasury not set yet"); await copy(TREASURY, $(".js-tres")); toast("Treasury address copied ✓"); });

  /* ---------- example data (clearly labeled) ---------- */
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const abc = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const fakeAddr = () => Array.from({length:44}, () => abc[Math.floor(rnd()*abc.length)]).join("");
  const EX_TOP = (() => { let b = 41e6; return Array.from({length:TOP_N}, () => { const r = { owner: fakeAddr(), bal: Math.round(b) }; b *= 0.78 + rnd()*0.12; return r; }); })();
  const EX_FEEDS = (() => { const last = Math.floor(Date.now()/1000 / INTERVAL) * INTERVAL;
    return Array.from({length:8}, (_, i) => ({ sig: fakeAddr()+fakeAddr(), time: last - i*INTERVAL, total: +(0.12 + rnd()*0.55).toFixed(3), n: TOP_N })); })();

  /* ---------- state + render ---------- */
  const state = {
    top: { rows: EX_TOP, mode: "example", note: caOk ? "Loading holders…" : "CA not live yet. Rows above are example data; the real top " + TOP_N + " shows up here at launch." },
    feeds: { list: EX_FEEDS, balance: null, mode: "example", note: "Example data. Real pies with Solscan links show up here once fees start flowing.", scanned: 0 }
  };

  function renderMode() {
    const m = $(".js-mode"), f = state.feeds;
    if (f.mode === "live" || f.mode === "live-empty") m.innerHTML = `<span class="badge badge-ok">Live · on-chain</span> Read straight from Solana. Treasury <a href="https://solscan.io/account/${esc(TREASURY)}" target="_blank" rel="noopener">${esc(short(TREASURY))}</a>`;
    else if (f.mode === "error") m.innerHTML = `${BADGE_ERR} Couldn't reach the Solana RPC. Retrying automatically…`;
    else if (f.mode === "loading") m.innerHTML = `<span class="badge badge-ok">Live · on-chain</span> Loading treasury data…`;
    else m.innerHTML = `${BADGE_EX} Treasury not connected yet. Numbers below are a demo.`;
  }

  function renderStats() {
    const f = state.feeds, live = f.mode === "live" || f.mode === "live-empty", err = f.mode === "error";
    const list = f.mode === "live" ? f.list : live ? [] : f.list;
    const total = list.reduce((a, x) => a + x.total, 0);
    $(".js-total").textContent = err || f.mode === "loading" ? "—" : fmt(total, 3);
    $(".js-feedings").textContent = err || f.mode === "loading" ? "—" : list.length.toLocaleString("en-US");
    $(".js-balance").textContent = f.balance == null ? "—" : fmt(f.balance, 3);
    const rows = state.top.rows;
    $(".js-entry").textContent = rows.length >= TOP_N ? big(rows[TOP_N-1].bal + 1) : rows.length ? "Any" : "—";
    $(".js-entry-ex").textContent = state.top.mode === "live" ? "" : " · example";
  }

  function renderTop() {
    const t = state.top, rows = t.rows.slice(0, TOP_N), sum = rows.reduce((a, r) => a + r.bal, 0) || 1, ex = t.mode !== "live";
    $(".js-top-badge").innerHTML = t.mode === "live" ? BADGE_LIVE : t.mode === "error" ? BADGE_ERR : BADGE_EX;
    $(".js-top").innerHTML = rows.length ? rows.map((r, i) => `<tr class="${ex ? "example" : ""}">
        <td class="rk">${i+1}</td>
        <td class="w">${ex ? esc(short(r.owner)) : `<a href="https://solscan.io/account/${esc(r.owner)}" target="_blank" rel="noopener">${esc(short(r.owner))} ↗</a>`}</td>
        <td class="r">${big(r.bal)}</td>
        <td class="r pc">${fmt(100 * r.bal / sum, 1)}%</td></tr>`).join("")
      : `<tr><td colspan="4" class="empty">No eligible holders found yet.</td></tr>`;
    $(".js-top-note").textContent = t.note || "";
    renderChart(rows, sum, ex);
  }

  const SLICE_COLORS = ["#f6a5c0","#9fe3c4","#c3b1f0","#ffe08a","#a7d3f7","#ffc09f","#e7b5f5","#c8e6a0","#ff9fa0","#9ee7ec"];
  function renderChart(rows, sum, ex) {
    const svg = $(".js-chart"); if (!svg) return;
    const cx = 120, cy = 120, R0 = 104;
    if (!rows.length) { svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${R0}" fill="#efe6f5"/>`; return; }
    let a0 = -Math.PI / 2, out = "";
    rows.forEach((r, i) => {
      const frac = r.bal / sum, a1 = a0 + frac * Math.PI * 2, mid = (a0 + a1) / 2;
      const off = i === 0 ? 8 : 0, ox = Math.cos(mid) * off, oy = Math.sin(mid) * off;
      const p = a => [cx + ox + R0 * Math.cos(a), cy + oy + R0 * Math.sin(a)];
      const [x0, y0] = p(a0), [x1, y1] = p(a1), large = frac > 0.5 ? 1 : 0;
      const d = rows.length === 1 ? `M${cx-R0} ${cy}a${R0} ${R0} 0 1 0 ${2*R0} 0a${R0} ${R0} 0 1 0 ${-2*R0} 0`
        : `M${cx+ox} ${cy+oy}L${x0.toFixed(2)} ${y0.toFixed(2)}A${R0} ${R0} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
      out += `<path d="${d}" fill="${SLICE_COLORS[i % SLICE_COLORS.length]}" stroke="#fffaf2" stroke-width="3" stroke-linejoin="round"><title>#${i+1} ${short(r.owner)} · ${fmt(frac*100,1)}%</title></path>`;
      if (frac > 0.045) {
        const lr = R0 * 0.7, lx = cx + ox + lr * Math.cos(mid), ly = cy + oy + lr * Math.sin(mid);
        out += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central" class="sl-lbl">${i+1}</text>`;
      }
      a0 = a1;
    });
    out += `<circle cx="${cx}" cy="${cy}" r="24" fill="#fffaf2"/><text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" class="sl-mid">${ex ? "EX" : "TOP " + TOP_N}</text>`;
    svg.innerHTML = out;
    $$(".js-top tr").forEach((tr, i) => { const sw = tr.querySelector(".rk"); if (sw) sw.style.setProperty("--sw", SLICE_COLORS[i % SLICE_COLORS.length]); });
  }

  function renderFeeds() {
    const f = state.feeds, ol = $(".js-winners");
    const showEx = f.mode === "example" || f.mode === "live-empty" || f.mode === "error";
    const list = showEx ? EX_FEEDS.slice(0, 5) : f.list.slice(0, 6);
    $(".js-feed-badge").innerHTML = showEx ? BADGE_EX : f.mode === "loading" ? "" : BADGE_LIVE;
    if (f.mode === "loading") { ol.innerHTML = `<li class="ticket"><span class="no">—</span><span class="who">Loading on-chain data…</span><span class="when"></span><span class="txw"></span><span class="amt"></span></li>`; }
    else ol.innerHTML = list.map((x, i) => `<li class="ticket${showEx ? " example" : ""}" style="animation-delay:${i*40}ms">
        <span class="no">${showEx ? "EX" : "#" + String(f.list.length - i).padStart(2, "0")}</span>
        <span class="who">Sliced for ${x.n} wallet${x.n === 1 ? "" : "s"}</span>
        <span class="when">${ago(x.time)}</span>
        <span class="txw">${showEx ? `<span class="tx">example tx</span>` : `<a class="tx" href="https://solscan.io/tx/${esc(x.sig)}" target="_blank" rel="noopener">${esc(short(x.sig))} ↗</a>`}</span>
        <span class="amt">${fmt(x.total, 3)} <small>SOL</small></span></li>`).join("");
    $(".js-note").textContent = f.note || "";
  }

  function renderMarquee() {
    const rows = state.top.rows.slice(0, 3).map((r, i) => `<span>#${i+1} ${esc(short(r.owner))} · ${big(r.bal)}</span>`);
    const items = [`<span>${esc(TICK)}</span>`, `<span>${SHARE}% of claimed fees</span>`, `<span>Fresh pie every ${INTERVAL/60} min</span>`, `<span>Top ${TOP_N} get a slice</span>`, "<span>Hold the bag, get a slice</span>"]
      .concat(state.top.mode === "live" ? rows : []);
    const row = items.join(""); $(".js-marquee").innerHTML = row + row;
  }

  /* ---------- "What would I get?" calculator ---------- */
  const inp = $("#oddsIn");
  function calc() {
    const n = Math.max(0, Number(inp.value.replace(/[^\d.]/g, "")) || 0);
    const rows = state.top.rows.slice(0, TOP_N), exTop = state.top.mode !== "live";
    const f = state.feeds, liveFeeds = f.mode === "live" && f.list.length;
    const feeds = liveFeeds ? f.list : EX_FEEDS;
    const avg = feeds.reduce((a, x) => a + x.total, 0) / (feeds.length || 1);
    const tenth = rows.length >= TOP_N ? rows[TOP_N-1].bal : 0;
    const src = (exTop || !liveFeeds) ? " Based on example data until launch." : " Based on live top " + TOP_N + " and recent pies.";
    const main = $(".js-calc-main"), note = $(".js-calc-note");
    if (!n) { main.innerHTML = "Enter your bag to see your slice."; note.textContent = `Entry to the top ${TOP_N}: ${tenth ? big(tenth + 1) : "any"} ${TICK}.` + src; return; }
    if (n > tenth) {
      const others = rows.filter(r => r.bal >= n);
      const rank = others.length + 1;
      const pool = rows.slice(0, TOP_N - 1).reduce((a, r) => a + r.bal, 0) + n;
      const share = n / pool, per = share * avg;
      main.innerHTML = `You'd sit at <span>#${rank}</span> with a <span>${fmt(share*100, 1)}%</span> slice ≈ <span>${fmt(per, 4)} SOL</span> per pie`;
      note.textContent = `≈ ${fmt(per * FEEDS_PER_DAY, 2)} SOL/day if fees keep this pace (${FEEDS_PER_DAY} pies a day).` + src;
    } else {
      main.innerHTML = `No seat yet. Stack <span>${big(tenth + 1 - n)}</span> more ${esc(TICK)} to crack the top ${TOP_N} and get a slice.`;
      note.textContent = `Entry to the top ${TOP_N}: ${big(tenth + 1)} ${TICK}. Hold the bag, get a slice.` + src;
    }
  }
  inp.addEventListener("input", calc);
  inp.addEventListener("blur", () => { const n = Number(inp.value.replace(/[^\d.]/g, "")) || 0; inp.value = n.toLocaleString("en-US"); calc(); });

  function renderAll() { renderMode(); renderStats(); renderTop(); renderFeeds(); renderMarquee(); calc(); }

  /* ---------- countdown: aligned to the UTC clock ---------- */
  function tick() {
    const now = Date.now()/1000, next = Math.ceil(now / INTERVAL) * INTERVAL, left = Math.max(0, Math.round(next - now));
    const mm = `${String(Math.floor(left/60)).padStart(2,"0")}:${String(left%60).padStart(2,"0")}`;
    $(".js-clock").textContent = mm; const mini = $(".js-clock-mini"); if (mini) mini.textContent = mm;
    $(".js-bar").style.width = (100 * (1 - left / INTERVAL)).toFixed(2) + "%";
  }
  setInterval(tick, 1000);

  /* ---------- JSON-RPC (read-only) ---------- */
  let rpcId = 0;
  const ENDPOINTS = [C.RPC_URL, ...(Array.isArray(C.RPC_FALLBACKS) ? C.RPC_FALLBACKS : [])].filter((u, i, a) => u && a.indexOf(u) === i);
  let epIdx = 0;
  async function rpc(method, params, tries = 2) {
    let lastErr;
    for (let k = 0; k < ENDPOINTS.length; k++) {
      const i = (epIdx + k) % ENDPOINTS.length;
      try { const r = await rpcOne(ENDPOINTS[i], method, params, tries); epIdx = i; return r; } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }
  async function rpcOne(url, method, params, tries) {
    for (let a = 0; a < tries; a++) {
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 12000);
        const r = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, signal: ctrl.signal,
          body: JSON.stringify({ jsonrpc:"2.0", id: ++rpcId, method, params }) });
        clearTimeout(to);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        if (j.error) throw new Error(j.error.message || "RPC error");
        return j.result;
      } catch (e) { if (a === tries - 1) throw e; await new Promise(s => setTimeout(s, 800 * (a + 1))); }
    }
  }

  /* Live top N: largest token accounts -> owners -> drop program-owned (curve/pools), burn, treasury, EXCLUDE_WALLETS */
  async function loadTop() {
    const largest = (await rpc("getTokenLargestAccounts", [CA, { commitment: "confirmed" }]))?.value || [];
    if (!largest.length) return { rows: [], mode: "live", note: "No holders yet." };
    const accs = (await rpc("getMultipleAccounts", [largest.map(x => x.address), { encoding: "jsonParsed", commitment: "confirmed" }]))?.value || [];
    const byOwner = new Map();
    largest.forEach((x, i) => {
      const owner = accs[i]?.data?.parsed?.info?.owner; if (!owner) return;
      const bal = Number(x.uiAmount ?? (Number(x.amount) / Math.pow(10, x.decimals || 0))) || 0;
      if (bal > 0) byOwner.set(owner, (byOwner.get(owner) || 0) + bal);
    });
    const owners = [...byOwner.keys()];
    const ownerInfo = (await rpc("getMultipleAccounts", [owners, { encoding: "base64", dataSlice: { offset: 0, length: 0 }, commitment: "confirmed" }]))?.value || [];
    let excluded = 0;
    const rows = owners.map((o, i) => ({ owner: o, bal: byOwner.get(o), prog: ownerInfo[i] ? ownerInfo[i].owner : SYSTEM_PROGRAM }))
      .filter(r => { const bad = EXCLUDE.has(r.owner) || r.prog !== SYSTEM_PROGRAM; if (bad) excluded++; return !bad; })
      .sort((a, b) => b.bal - a.bal).slice(0, TOP_N);
    return { rows, mode: "live", note: `Live from Solana. ${excluded} curve/pool/burn/excluded account${excluded === 1 ? "" : "s"} skipped. % of round = share of the top-${TOP_N} total. Snapshot at payout time is what counts.` };
  }

  /* Pies served: outgoing SOL from the treasury, grouped by tx (one tx paying many wallets = one pie) */
  const txCache = new Map();
  function feedingFrom(tx, sig, blockTime) {
    if (!tx || !tx.meta || tx.meta.err) return null;
    const ix = [...(tx.transaction?.message?.instructions || []), ...((tx.meta.innerInstructions || []).flatMap(x => x.instructions || []))];
    const to = new Map();
    for (const i of ix) {
      const p = i.parsed;
      if (i.program !== "system" || !p || !/^transfer(WithSeed)?$/.test(p.type)) continue;
      const inf = p.info || {};
      if (inf.source !== TREASURY || !inf.destination || inf.destination === TREASURY) continue;
      const sol = Number(inf.lamports || 0) / LAMPORTS;
      if (sol >= Number(C.MIN_PAYOUT_SOL || 0)) to.set(inf.destination, (to.get(inf.destination) || 0) + sol);
    }
    if (!to.size) return null;
    return { sig, time: tx.blockTime || blockTime || 0, n: to.size, total: [...to.values()].reduce((a, b) => a + b, 0) };
  }
  async function loadFeeds() {
    const bal = await rpc("getBalance", [TREASURY, { commitment: "confirmed" }]);
    const sigs = await rpc("getSignaturesForAddress", [TREASURY, { limit: Math.min(100, Number(C.TX_SCAN_LIMIT) || 25) }]) || [];
    const list = []; let failed = 0;
    for (const s of sigs) {
      if (s.err) continue;
      let tx = txCache.get(s.signature);
      if (tx === undefined) {
        try { tx = await rpc("getTransaction", [s.signature, { encoding:"jsonParsed", maxSupportedTransactionVersion:0, commitment:"confirmed" }], 1); txCache.set(s.signature, tx); }
        catch { failed++; continue; }
        await new Promise(r => setTimeout(r, 120));
      }
      const f = feedingFrom(tx, s.signature, s.blockTime); if (f) list.push(f);
    }
    list.sort((a, b) => b.time - a.time);
    let note;
    if (!sigs.length) note = "Treasury is connected and the oven is preheating. Rows above are example data until the first pie.";
    else if (!list.length) note = `No pies served in the treasury's last ${sigs.length} transactions yet. Rows above are example data.`;
    else note = `Totals cover the treasury's last ${sigs.length} transactions.`;
    if (failed) note += ` ${failed} tx couldn't be loaded (RPC limit), retrying next refresh.`;
    return { list, balance: (bal?.value ?? 0) / LAMPORTS, mode: list.length ? "live" : "live-empty", note, scanned: sigs.length };
  }

  async function refresh() {
    const jobs = [];
    if (tOk) jobs.push(loadFeeds().then(r => state.feeds = r).catch(e => { console.warn("[site] treasury RPC:", e);
      state.feeds = { list: [], balance: null, mode: "error", note: "Public RPCs rate-limit browsers. Set your own RPC_URL in config.js (or ?rpc=https://…) for reliable stats. Rows above are example data." }; }));
    if (caOk) jobs.push(loadTop().then(r => state.top = r).catch(e => { console.warn("[site] holders RPC:", e);
      state.top = { rows: EX_TOP, mode: "error", note: "Couldn't load holders from the RPC. Showing example data; retrying." }; }));
    await Promise.all(jobs); renderAll();
  }

  if (tOk) state.feeds = { list: [], balance: null, mode: "loading", note: "" };
  renderAll(); tick();
  if (tOk || caOk) { refresh(); setInterval(refresh, Math.max(20, Number(C.REFRESH_SEC) || 60) * 1000); }
})();
