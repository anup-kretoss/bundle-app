import { type LoaderFunctionArgs } from "react-router";

export const loader = async (_args: LoaderFunctionArgs) => {
  try {
    const SHOP = "kretosstechnology.myshopify.com";
    const ACCESS_TOKEN = "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";

    const resp = await fetch(
      `https://kretosstechnology.myshopify.com/admin/api/2024-10/products.json`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": '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',
        },
      }
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Shopify REST API error: ${resp.status} ${text}`);
    }

    const body = await resp.json();

    const products = (body.products || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      status: p.status ?? null,
      inventory: Array.isArray(p.variants)
        ? p.variants.reduce((s: number, v: any) => s + (Number(v.inventory_quantity ?? 0) || 0), 0)
        : 0,
      image: p.image?.src ?? (p.images?.[0]?.src ?? null),
    }));

    return new Response(JSON.stringify(products), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("api.products loader error:", err);
    throw new Response(JSON.stringify({ error: "Failed to load products", details: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
