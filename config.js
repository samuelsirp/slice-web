/* ============================================================
   Token site — single config file. Edit ONLY this file.
   Public values only. NEVER put private keys or seeds here.
   ============================================================ */
window.SITE_CONFIG = {
  // Brand (change here only). Rendered everywhere: title, hero, logo, copy, meta.
  NAME: "Slice",      // brand name shown in logo / titles
  TICKER: "SLICE",    // ticker WITHOUT the $ (rendered as $SLICE)

  // Token contract address (mint). Leave "" until launch -> site shows "launching soon" + example data.
  CA: "Dp83nbJ7x9WVVAuhHh6P9J29d6qC3xbKFMmLMQ9Spump",

  // Public treasury wallet address (receives the pump.fun creator fees). Public address ONLY.
  TREASURY: "78KgGmbSPagAhkFjb72UeWUvfWYThYrUSNGVvqNHFf98",

  // Socials
  X_URL: "https://x.com/slice_family",          // e.g. "https://x.com/yourtoken"
  TG_URL: "",         // e.g. "https://t.me/yourtoken"

  // Share of claimed creator fees sent to holders (%)
  FEED_SHARE_PCT: 100,

  // How many top holders get fed each round (split proportional to balance within the top N)
  TOP_N: 10,

  // Extra owner wallets to exclude from the top N (LP/pool authorities, team, CEX, etc.).
  // Program-owned accounts (pump.fun bonding curve, AMM pools) and the burn address are excluded automatically.
  EXCLUDE_WALLETS: ["HPb1yYwgnW1QQuxZGGNRysoeGsuUwHdPVN5r7ifRUjTV"],

  // Minutes between feedings (snapshot + payout, aligned to the UTC clock)
  FEED_INTERVAL_MIN: 5,

  // Solana JSON-RPC endpoint (read-only). Public default is rate-limited;
  // override with your own (Helius, QuickNode, etc.) for reliable live stats.
  // Can also be overridden from the URL: ?rpc=https://...
  RPC_URL: "https://api.mainnet-beta.solana.com",

  // Tried in order if RPC_URL fails (403/429/timeout). Public, read-only.
  RPC_FALLBACKS: ["https://solana-rpc.publicnode.com"],

  // How many recent treasury transactions to scan for feedings
  TX_SCAN_LIMIT: 25,

  // Live stats refresh (seconds)
  REFRESH_SEC: 30,

  // Ignore outgoing transfers below this (SOL) — filters dust/fees
  MIN_PAYOUT_SOL: 0.00001
};
