const { publishTheme } = require("./lib/shopify");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée." }) };
  }
  try {
    const { shop, token, themeId } = JSON.parse(event.body || "{}");
    if (!shop || !token || !themeId) {
      return { statusCode: 400, body: JSON.stringify({ error: "shop, token et themeId sont requis." }) };
    }
    const theme = await publishTheme(shop, token, themeId);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme }) };
  } catch (err) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message }) };
  }
};
