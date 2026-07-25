const API_VERSION = "2024-10";

async function shopifyGraphQL(shop, token, query, variables = {}) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

async function getOnlineStorePublication(shop, token) {
  const query = `
    query {
      publications(first: 10) {
        edges { node { id name } }
      }
    }
  `;
  const data = await shopifyGraphQL(shop, token, query);
  const known = ["Online Store", "Boutique en ligne"];
  const pubs = data.publications.edges.map((e) => e.node);
  const match =
    pubs.find((p) => known.includes(p.name)) ||
    pubs.find((p) => !/point de vente|pos|shop$/i.test(p.name));
  if (!match) {
    throw new Error('Canal "Online Store" introuvable sur cette boutique.');
  }
  return match;
}

async function scanResourceType(shop, token, resourceType, publicationId) {
  const query = `
    query FindUnpublished($first: Int!, $after: String) {
      ${resourceType}(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            title
            resourcePublications(first: 10) {
              edges { node { isPublished publication { id } } }
            }
          }
        }
      }
    }
  `;

  const unpublished = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyGraphQL(shop, token, query, { first: 50, after });
    const conn = data[resourceType];
    for (const edge of conn.edges) {
      const node = edge.node;
      const pubs = node.resourcePublications.edges.map((e) => e.node);
      const isOnOnlineStore = pubs.some((p) => p.publication.id === publicationId && p.isPublished);
      if (!isOnOnlineStore) {
        unpublished.push({ id: node.id, title: node.title });
      }
    }
    hasNextPage = conn.pageInfo.hasNextPage;
    after = conn.pageInfo.endCursor;
  }

  return unpublished;
}

async function getThemeStatus(shop, token) {
  const query = `
    query { themes(first: 20) { edges { node { id name role } } } }
  `;
  const data = await shopifyGraphQL(shop, token, query);
  const themes = data.themes.edges.map((e) => e.node);
  return {
    live: themes.find((t) => t.role === "MAIN") || null,
    drafts: themes.filter((t) => t.role === "UNPUBLISHED"),
  };
}

async function scanStore(shop, token) {
  const publication = await getOnlineStorePublication(shop, token);
  const [products, collections] = await Promise.all([
    scanResourceType(shop, token, "products", publication.id),
    scanResourceType(shop, token, "collections", publication.id),
  ]);
  const theme = await getThemeStatus(shop, token);
  return { publication, products, collections, theme };
}

async function publishResource(shop, token, resourceId, publicationId) {
  const mutation = `
    mutation PublishResource($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyGraphQL(shop, token, mutation, {
    id: resourceId,
    input: [{ publicationId }],
  });
  const errors = data.publishablePublish.userErrors;
  if (errors.length) {
    throw new Error(`Erreur publication ${resourceId}: ${JSON.stringify(errors)}`);
  }
}

async function publishTheme(shop, token, themeId) {
  const mutation = `
    mutation PublishTheme($id: ID!) {
      themePublish(id: $id) {
        theme { id name role }
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyGraphQL(shop, token, mutation, { id: themeId });
  const errors = data.themePublish.userErrors;
  if (errors.length) {
    throw new Error(`Erreur publication thème: ${JSON.stringify(errors)}`);
  }
  return data.themePublish.theme;
}

module.exports = { scanStore, publishResource, publishTheme };
