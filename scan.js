const { scanStore } = require("./lib/shopify");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée." }) };
  }
  try {
    const { shop, token } = JSON.parse(event.body || "{}");
    if (!shop || !token) {
      return { statusCode: 400, body: JSON.stringify({ error: "shop et token sont requis." }) };
    }
    const result = await scanStore(shop, token);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message }) };
  }
};
