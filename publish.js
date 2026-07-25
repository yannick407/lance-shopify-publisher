const { publishResource } = require("./lib/shopify");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée." }) };
  }
  try {
    const { shop, clientId, clientSecret, resourceIds, publicationId } = JSON.parse(event.body || "{}");
    if (!shop || !clientId || !clientSecret || !Array.isArray(resourceIds) || !publicationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "shop, clientId, clientSecret, publicationId et resourceIds[] sont requis." }),
      };
    }
    const results = [];
    for (const id of resourceIds) {
      try {
        await publishResource(shop, clientId, clientSecret, id, publicationId);
        results.push({ id, ok: true });
      } catch (err) {
        results.push({ id, ok: false, error: err.message });
      }
    }
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ results }) };
  } catch (err) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message }) };
  }
};
