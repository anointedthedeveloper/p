const https = require("https");

const API_KEY = process.env.API_KEY || "p4jq";
const OWNER = "anointedthedeveloper";
const REPO = "Q2";
const BRANCH = "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    https.get(
      {
        hostname: opts.hostname,
        path: opts.pathname + opts.search,
        headers: {
          "User-Agent": "CbtProxy",
          Accept: "application/vnd.github.v3.raw",
          ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
        },
      },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return fetchRaw(res.headers.location).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
          resolve(data);
        });
      }
    ).on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.headers["x-api-key"] !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: "Missing path query parameter" });
  }

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath)}?ref=${BRANCH}`;

  try {
    const raw = await fetchRaw(url);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(raw);
  } catch (e) {
    res.status(502).json({ error: "Failed to fetch file", detail: e.message });
  }
};
