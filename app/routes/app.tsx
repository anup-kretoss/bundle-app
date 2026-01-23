import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`#graphql
    query GetRecurringApplicationCharges {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
        }
      }
    }
  `);

  const data = await response.json();
  const active = data?.data?.currentAppInstallation?.activeSubscriptions?.[0] ?? null;

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    subscription: active,
  };
};

export default function App() {
  const { apiKey, subscription } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/additional">Additional page</s-link>
        <s-link href="/products">Products</s-link>
        <s-link href="/bundles">Bundles</s-link>
      </s-app-nav>
      <div style={{ padding: 8 }}>
        <small>Subscription: {subscription ? `${subscription.name} (${subscription.status})` : "None"}</small>
      </div>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

// Route declarations are handled by Remix file-based routing; no manual <Route> needed here.
