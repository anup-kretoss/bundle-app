// app/services/bundles.server.ts
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function syncBundlesToMetafields(request: Request) {
  const { admin } = await authenticate.admin(request);

  const bundles = await prisma.bundle.findMany();

  if (!bundles.length) return;

  const bundleConfigs = bundles.map(bundle => ({
    bundleId: bundle.id,
    bundleName: bundle.name,
    collectionId: bundle.collectionId,
    collectionTitle: bundle.collectionTitle,
    rules: bundle.rules ? JSON.parse(bundle.rules) : [],
    createdAt: bundle.createdAt.toISOString(),
    updatedAt: bundle.updatedAt.toISOString(),
  }));

  const metafieldValue = JSON.stringify({
    bundles: bundleConfigs,
    appUrl: "https://bundle-app-c4km.onrender.com",
    syncedAt: new Date().toISOString(),
  });

  await admin.graphql(`
    mutation UpdateShopMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }
  `, {
    variables: {
      metafields: [{
        namespace: "bundle_app",
        key: "rules",
        type: "json",
        value: metafieldValue,
        ownerType: "SHOP",
      }]
    }
  });
}
