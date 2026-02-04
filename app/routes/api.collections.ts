import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import type { Collection } from "../../types/Bundle";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    if (!session) {
      console.error("No session found");
      return json([]);
    }

    const shop = session.shop;
    const accessToken = session.accessToken;

    if (!accessToken) {
      console.error("No access token found");
      return json([]);
    }

    const apiVersion = "2024-10";

    // Use REST API for more reliable collection fetching
    // Fetch both custom and smart collections in parallel
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    };

    const [customResponse, smartResponse] = await Promise.all([
      fetch(`https://${shop}/admin/api/${apiVersion}/custom_collections.json?limit=250`, {
        method: "GET",
        headers,
      }),
      fetch(`https://${shop}/admin/api/${apiVersion}/smart_collections.json?limit=250`, {
        method: "GET",
        headers,
      }),
    ]);

    // Combine both collection types
    const allCollections: Collection[] = [];

    // Process custom collections
    if (customResponse.ok) {
      const customData = await customResponse.json();
      if (customData.custom_collections && Array.isArray(customData.custom_collections)) {
        for (const collection of customData.custom_collections) {
          allCollections.push({
            id: String(collection.id),
            title: collection.title || "",
            handle: collection.handle || "",
          });
        }
      }
    } else {
      console.warn("Failed to fetch custom collections:", customResponse.status);
    }

    // Process smart collections
    if (smartResponse.ok) {
      const smartData = await smartResponse.json();
      if (smartData.smart_collections && Array.isArray(smartData.smart_collections)) {
        for (const collection of smartData.smart_collections) {
          allCollections.push({
            id: String(collection.id),
            title: collection.title || "",
            handle: collection.handle || "",
          });
        }
      }
    } else {
      console.warn("Failed to fetch smart collections:", smartResponse.status);
    }

    console.log(`Fetched ${allCollections.length} collections via REST API`);

    return json(allCollections);
  } catch (error: any) {
    console.error("collections.loader error:", error);
    // Return empty array on error to prevent breaking the UI
    return json([]);
  }
};

/** Small helper */
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
