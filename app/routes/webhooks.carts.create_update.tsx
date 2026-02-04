// In your webhook handler (app/routes/webhooks.tsx)
import { type ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload, admin } = await authenticate.webhook(request);

  if (!admin) {
    return new Response();
  }

  console.log(`\n--- [CART UPDATE WEBHOOK] Topic: ${topic} | Shop: ${shop} ---`);

  // Log cart contents
  const cartLines = payload.line_items || [];
  console.log("Cart Contents Summary:");
  cartLines.forEach((item: any) => {
    console.log(`  - [ID: ${item.variant_id}] ${item.title} (Qty: ${item.quantity}) @ ${item.price}`);
  });

  // Fetch bundles and match rules
  const bundles = await prisma.bundle.findMany();
  console.log(`System: Found ${bundles.length} active bundle configurations in database.`);

  let bestMatch: {
    bundleName: string;
    tier: string;
    qtyMatch: number;
    discount: number;
    code: string;
  } | null = null;

  for (const bundle of bundles) {
    const rules = JSON.parse(bundle.rules);
    
    // Calculate total eligible quantity
    const eligibleQty = cartLines.reduce((sum: number, item: any) => sum + item.quantity, 0);
    
    const sortedRules = rules.sort((a: any, b: any) => b.totalProducts - a.totalProducts);
    
    for (const rule of sortedRules) {
      if (eligibleQty >= rule.totalProducts) {
        console.log(`  - Match Found in bundle '${bundle.name}': Discount Name '${rule.tier}' (${rule.totalProducts}+ items)`);
        
        if (!bestMatch || rule.totalProducts > bestMatch.qtyMatch) {
          bestMatch = {
            bundleName: bundle.name,
            tier: rule.tier,
            qtyMatch: rule.totalProducts,
            discount: rule.discountPercentage,
            code: rule.discountCode
          };
          console.log(`  - STATUS: This is currently the HIGHEST MATCH.`);
        }
        break;
      }
    }
  }

  if (bestMatch) {
    console.log(`\n🎯 Highest Matching Bundle: ${bestMatch.bundleName}`);
    console.log(`📊 Tier: ${bestMatch.tier}`);
    console.log(`💰 Discount: ${bestMatch.discount}%`);
    console.log(`🎟️  Code: ${bestMatch.code}`);
    console.log("\nℹ️  Note: The Shopify Function will automatically apply this discount at checkout.");
    console.log("    The discount appears in the cart when the function runs.");
  } else {
    console.log("\n❌ No bundle rules matched the current cart quantity.");
  }

  console.log(`--- [WEBHOOK END] ---\n`);

  return new Response();
};