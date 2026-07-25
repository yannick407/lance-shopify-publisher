const { scanStore } = require("./lib/shopify");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée." }) };
  }
  try {
    const { shop, clientId, clientSecret } = JSON.parse(event.body || "{}");
    if (!shop || !clientId || !clientSecret) {
      return { statusCode: 400, body: JSON.stringify({ error: "shop, clientId et clientSecret sont requis." }) };
    }
    const result = await scanStore(shop, clientId, clientSecret);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message }) };
  }
};
