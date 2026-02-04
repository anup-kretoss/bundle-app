import { type ActionFunctionArgs } from "react-router";
import prisma from "../db.server";

/* ================= CORS ================= */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

/* ================= HELPERS ================= */

function normalizeCollectionGid(collectionId: string): string {
  if (!collectionId) return collectionId;
  if (collectionId.startsWith("gid://shopify/Collection/")) return collectionId;
  return `gid://shopify/Collection/${collectionId}`;
}

async function verifyAccessToken(shopDomain: string, accessToken: string) {
  const res = await fetch(
    `https://${shopDomain}/admin/api/2024-10/shop.json`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) throw new Error("Invalid Shopify access token");
  return res.json();
}

async function deleteShopifyDiscount(
  shopDomain: string,
  accessToken: string,
  discountNodeId: string
) {
  if (!discountNodeId) return;

  await fetch(`https://${shopDomain}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        mutation discountCodeBasicDelete($id: ID!) {
          discountCodeBasicDelete(id: $id) {
            deletedDiscountCodeBasicId
          }
        }
      `,
      variables: { id: discountNodeId },
    }),
  });
}

async function createShopifyDiscount(
  shopDomain: string,
  accessToken: string,
  discountData: any
) {
  const res = await fetch(
    `https://${shopDomain}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
            discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
              codeDiscountNode { id }
              userErrors { message }
            }
          }
        `,
        variables: { basicCodeDiscount: discountData },
      }),
    }
  );

  const json = await res.json();

  if (
    json.errors ||
    json.data.discountCodeBasicCreate.userErrors.length
  ) {
    throw new Error(
      JSON.stringify(json.data.discountCodeBasicCreate.userErrors)
    );
  }

  return json.data.discountCodeBasicCreate.codeDiscountNode;
}

/* ================= LOADER ================= */

export const loader = async () =>
  new Response(
    JSON.stringify({ success: true, message: "POST only endpoint" }),
    { status: 200, headers: CORS_HEADERS }
  );

/* ================= ACTION ================= */

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  try {
    const body = await request.json();
    const { bundleId, ruleIndex, shopDomain, accessToken } = body;

    if (!bundleId || ruleIndex === null) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "bundleId & ruleIndex required",
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!shopDomain || !accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Shop auth missing",
        }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await verifyAccessToken(shopDomain, accessToken);

    /* ===== LOAD BUNDLE ===== */

    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId },
    });

    if (!bundle) {
      return new Response(
        JSON.stringify({ success: false, error: "Bundle not found" }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const rules = JSON.parse(bundle.rules);
    const rule = rules[ruleIndex];

    if (!rule) {
      return new Response(
        JSON.stringify({ success: false, error: "Rule not found" }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    /* ===== COLLECTION LOCK ===== */

    const collectionId = normalizeCollectionGid(
      String(bundle.collectionId)
    );

    /* ===== REMOVE LOWER TIERS ===== */

    for (let i = 0; i < rules.length; i++) {
      if (
        i < ruleIndex &&
        rules[i].isActive &&
        rules[i].shopifyPriceRuleId
      ) {
        await deleteShopifyDiscount(
          shopDomain,
          accessToken,
          rules[i].shopifyPriceRuleId
        );

        rules[i] = {
          ...rules[i],
          discountCode: null,
          shopifyPriceRuleId: null,
          isActive: false,
        };
      }
    }

    /* ===== CREATE DISCOUNT ===== */

    const discountCode = `${rule.tier
      .toUpperCase()
      .replace(/\s+/g, "_")}_${Date.now()
      .toString()
      .slice(-6)}`;

    const discountData = {
      title: `${rule.tier} Bundle Discount`,
      code: discountCode,
      startsAt: new Date().toISOString(),
      usageLimit: 1,
      customerSelection: { all: true },
      customerGets: {
        value: {
          percentage: rule.discountPercentage / 100,
        },
        items: {
          collections: {
            add: [collectionId], // 🔒 locked
          },
        },
      },
      minimumRequirement: {
        quantity: {
          greaterThanOrEqualToQuantity:
            rule.totalProducts.toString(),
        },
      },
    };

    const discountNode = await createShopifyDiscount(
      shopDomain,
      accessToken,
      discountData
    );

    /* ===== SAVE ===== */

    rules[ruleIndex] = {
      ...rule,
      discountCode,
      shopifyPriceRuleId: discountNode.id,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    await prisma.bundle.update({
      where: { id: bundleId },
      data: {
        rules: JSON.stringify(rules),
        discountCodes: [
          ...(bundle.discountCodes || []),
          {
            code: discountCode,
            ruleIndex,
            discountNodeId: discountNode.id,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        discountCode,
        collectionId,
        message:
          "Discount created and locked to bundle collection",
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error(err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Internal server error",
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
