import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { payload, session, topic, shop } = await authenticate.webhook(request);

    console.log(`\n--- Cart Update Webhook Received ---`);
    console.log(`Shop: ${shop}`);
    console.log(`Topic: ${topic}`);

    // Log cart contents for debugging
    if (payload.line_items) {
        console.log("Cart Contents:");
        payload.line_items.forEach((item: any) => {
            console.log(`  - ${item.title} x ${item.quantity} = ${item.price * item.quantity}`);
        });
    }

    // Here you can trigger additional logic when cart updates
    // For example, you could update your database or trigger notifications

    return new Response(null, { status: 200 });
};
