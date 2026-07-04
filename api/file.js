const https = require("https");

const API_KEY = "p4jq";
const OWNER = "anointedthedeveloper";
const REPO = "Q2";
const BRANCH = "main";
const GITHUB_PASSWORD = "jamb2027";

function fetchRaw(url, token) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const reqOpts = {
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      headers: {
        "User-Agent": "CbtProxy",
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3.raw",
      },
    };
    https.get(reqOpts, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchRaw(res.headers.location, token).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
        resolve(data);
      });
    }).on("error", reject);
  });
}

module.exports = async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: "Missing path query parameter" });
  }

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath)}?ref=${BRANCH}`;

  try {
    const raw = await fetchRaw(url, GITHUB_PASSWORD);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(raw);
  } catch (e) {
    res.status(502).json({ error: "Failed to fetch file", detail: e.message });
  }
};
