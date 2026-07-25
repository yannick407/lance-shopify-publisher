#!/usr/bin/env node
/**
 * Shopify Auto-Publisher
 * ------------------------------------------------------------
 * Scanne une boutique Shopify et publie automatiquement sur le
 * canal "Online Store" toutes les ressources créées via l'API
 * (produits, collections, pages) qui ne le sont pas encore, puis
 * publie le thème actif s'il ne l'est pas déjà.
 *
 * Usage:
 *   node index.js --shop ma-boutique.myshopify.com --token shpat_xxx
 *   node index.js --shop ma-boutique.myshopify.com --token shpat_xxx --dry-run
 *
 * Le token doit être un Admin API access token avec les scopes:
 *   read_products, write_products,
 *   read_publications, write_publications,
 *   read_themes, write_themes
 * ------------------------------------------------------------
 */

const API_VERSION = "2024-10";

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--shop") args.shop = argv[++i];
    else if (a === "--token") args.token = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

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
    throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

async function getOnlineStorePublicationId(shop, token) {
  const query = `
    query {
      publications(first: 10) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;
  const data = await shopifyGraphQL(shop, token, query);
  const onlineStore = data.publications.edges.find(
    (e) => e.node.name === "Online Store"
  );
  if (!onlineStore) {
    throw new Error('Canal "Online Store" introuvable sur cette boutique.');
  }
  return onlineStore.node.id;
}

async function findUnpublishedResources(shop, token, resourceType, publicationId) {
  // resourceType: "products" | "collections" | "pages"
  const query = `
    query FindUnpublished($first: Int!, $after: String) {
      ${resourceType}(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            title
            resourcePublicationOnCurrentPublication {
              publication { id }
              isPublished
            }
            resourcePublications(first: 10) {
              edges {
                node {
                  isPublished
                  publication { id }
                }
              }
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
      const isOnOnlineStore = pubs.some(
        (p) => p.publication.id === publicationId && p.isPublished
      );
      if (!isOnOnlineStore) {
        unpublished.push(node);
      }
    }
    hasNextPage = conn.pageInfo.hasNextPage;
    after = conn.pageInfo.endCursor;
  }

  return unpublished;
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

async function findAndPublishTheme(shop, token, dryRun) {
  const query = `
    query {
      themes(first: 20) {
        edges { node { id name role } }
      }
    }
  `;
  const data = await shopifyGraphQL(shop, token, query);
  const themes = data.themes.edges.map((e) => e.node);
  const main = themes.find((t) => t.role === "MAIN");
  const unpublished = themes.filter((t) => t.role === "UNPUBLISHED");

  if (main) {
    console.log(`  ✓ Thème déjà publié : "${main.name}"`);
    return;
  }
  if (!unpublished.length) {
    console.log("  – Aucun thème non publié trouvé.");
    return;
  }

  const target = unpublished[0];
  console.log(`  → Thème à publier : "${target.name}"`);
  if (dryRun) {
    console.log("    (dry-run: aucune action effectuée)");
    return;
  }

  const mutation = `
    mutation PublishTheme($id: ID!) {
      themePublish(id: $id) {
        theme { id name role }
        userErrors { field message }
      }
    }
  `;
  const result = await shopifyGraphQL(shop, token, mutation, { id: target.id });
  const errors = result.themePublish.userErrors;
  if (errors.length) {
    throw new Error(`Erreur publication thème: ${JSON.stringify(errors)}`);
  }
  console.log(`  ✓ Thème "${target.name}" publié.`);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.shop || !args.token) {
    console.error(
      "Usage: node index.js --shop <boutique.myshopify.com> --token <token> [--dry-run]"
    );
    process.exit(1);
  }

  console.log(`\nAuto-Publisher — scan de ${args.shop}${args.dryRun ? " (dry-run)" : ""}\n`);

  const publicationId = await getOnlineStorePublicationId(args.shop, args.token);

  const resourceTypes = [
    { key: "products", label: "produits" },
    { key: "collections", label: "collections" },
    { key: "pages", label: "pages" },
  ];

  let totalPublished = 0;

  for (const { key, label } of resourceTypes) {
    console.log(`Recherche des ${label} non publiés...`);
    const unpublished = await findUnpublishedResources(args.shop, args.token, key, publicationId);

    if (!unpublished.length) {
      console.log(`  ✓ Rien à publier (${label}).\n`);
      continue;
    }

    console.log(`  → ${unpublished.length} ${label} à publier :`);
    for (const resource of unpublished) {
      console.log(`    - ${resource.title}`);
      if (!args.dryRun) {
        await publishResource(args.shop, args.token, resource.id, publicationId);
        totalPublished++;
      }
    }
    console.log("");
  }

  console.log("Vérification du thème...");
  await findAndPublishTheme(args.shop, args.token, args.dryRun);

  console.log(
    `\nTerminé. ${args.dryRun ? "Simulation — rien n'a été modifié." : `${totalPublished} ressource(s) publiée(s).`}\n`
  );
  console.log(
    "Note : la suppression de la protection par mot de passe de la boutique n'est pas accessible via l'API Admin — elle doit être désactivée manuellement dans Boutique en ligne > Préférences.\n"
  );
}

run().catch((err) => {
  console.error("\n❌ Erreur:", err.message);
  process.exit(1);
});
