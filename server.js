const express = require("express");
const path = require("path");
const { scanStore, publishResource, publishTheme } = require("./lib/shopify");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Le token n'est jamais stocké côté serveur : il transite pour chaque requête
// et n'est conservé nulle part (pas de DB, pas de logs du token).

app.post("/api/scan", async (req, res) => {
  const { shop, token } = req.body || {};
  if (!shop || !token) {
    return res.status(400).json({ error: "shop et token sont requis." });
  }
  try {
    const result = await scanStore(shop, token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/publish", async (req, res) => {
  const { shop, token, resourceIds, publicationId } = req.body || {};
  if (!shop || !token || !Array.isArray(resourceIds) || !publicationId) {
    return res.status(400).json({ error: "shop, token, publicationId et resourceIds[] sont requis." });
  }
  const results = [];
  for (const id of resourceIds) {
    try {
      await publishResource(shop, token, id, publicationId);
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err.message });
    }
  }
  res.json({ results });
});

app.post("/api/publish-theme", async (req, res) => {
  const { shop, token, themeId } = req.body || {};
  if (!shop || !token || !themeId) {
    return res.status(400).json({ error: "shop, token et themeId sont requis." });
  }
  try {
    const theme = await publishTheme(shop, token, themeId);
    res.json({ theme });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lancé écoute sur http://localhost:${PORT}`);
});
