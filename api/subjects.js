const https = require("https");

const API_KEY = process.env.API_KEY || "p4jq";
const OWNER = "anointedthedeveloper";
const REPO = "Q2";
const BRANCH = "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

// Cache subjects list for 5 minutes to avoid hammering GitHub API
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

const KNOWN_NAMES = {
  civiledu: "Civic Education",
  crk: "Christian Religious Knowledge",
  irk: "Islamic Religious Knowledge",
  englishlit: "Literature In English",
  currentaffairs: "Current Affairs",
  english: "English Language",
};

function toTitleCase(s) {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const reqOpts = {
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      headers: {
        "User-Agent": "CbtProxy",
        ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
      },
    };
    https.get(reqOpts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

module.exports = async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  // Return cached result if still fresh
  if (_cache && Date.now() - _cacheTime < CACHE_TTL_MS) {
    return res.status(200).json(_cache);
  }

  const treeUrl = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;
  let tree;
  try {
    tree = await fetchJson(treeUrl);
  } catch (e) {
    // Return stale cache on GitHub error rather than failing entirely
    if (_cache) return res.status(200).json(_cache);
    return res.status(502).json({ error: "Failed to fetch repo tree", detail: e.message });
  }

  if (tree.message) {
    if (_cache) return res.status(200).json(_cache);
    return res.status(502).json({ error: tree.message });
  }

  const files = (tree.tree || []).filter(
    (f) => f.type === "blob" && f.path.endsWith(".json")
  );

  const subjects = files.map((f) => {
    const base = f.path.split("/").pop().replace(/\.json$/i, "").toLowerCase();
    const name = KNOWN_NAMES[base] || toTitleCase(f.path.split("/").pop().replace(/\.json$/i, ""));
    return { path: f.path, name, count: 0 };
  });

  // Update cache
  _cache = subjects;
  _cacheTime = Date.now();

  res.status(200).json(subjects);
};
