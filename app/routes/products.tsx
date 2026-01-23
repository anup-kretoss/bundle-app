import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import type { Product } from "../../types/Product";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);

    const origin = new URL(request.url).origin;
    const apiUrl = new URL("/api/products", origin).toString();

    const response = await fetch(apiUrl, { method: "GET" });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Response(JSON.stringify({ error: "Failed to load products from API", details: text }), {
        status: response.status || 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const products = (await response.json()) as Product[];

    return products;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Products loader error:", err);

    const message = err instanceof Response ? await (err.text().catch(() => Promise.resolve(String(err)))) : String(err?.message ?? err);

    throw new Response(JSON.stringify({ error: "Failed to load products", details: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export default function ProductsRoute() {
  const products = useLoaderData() as Product[];
  const formatValue = (v: any) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Products</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
        {products.map((product) => (
          <div key={product.id} style={{ border: "1px solid #ddd", padding: "10px" }}>
            {typeof product.image === "string" && product.image ? (
              <img
                src={product.image}
                alt={product.title}
                style={{ width: "100%", height: "150px", objectFit: "cover" }}
              />
            ) : null}
            <h3>{formatValue(product.title)}</h3>
            <p>Status: {formatValue(product.status)}</p>
            <p>Inventory: {formatValue(product.inventory)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useRouteError } from "react-router";

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
