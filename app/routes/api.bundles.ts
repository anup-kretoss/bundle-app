import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import type { Bundle, BundleRule } from "../../types/Bundle";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);

    const bundles = await prisma.bundle.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Handle empty bundles gracefully
    const formattedBundles: Bundle[] = bundles.map((bundle: any) => ({
      id: bundle.id,
      name: bundle.name,
      collectionId: bundle.collectionId,
      collectionTitle: bundle.collectionTitle,
      createdAt: bundle.createdAt.toISOString(),
      updatedAt: bundle.updatedAt.toISOString(),
      rules: bundle.rules ? (JSON.parse(bundle.rules) as BundleRule[]) : [],
    }));

    return new Response(JSON.stringify(formattedBundles), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("api.bundles loader error:", err);
    
    // If authentication fails, return empty array instead of error
    if (err instanceof Response && (err.status === 410 || err.status === 401)) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    throw new Response(JSON.stringify({ error: "Failed to load bundles", details: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    await authenticate.admin(request);

    // Support both `multipart/form-data` (formData) and `application/json` payloads.
    const contentType = request.headers.get("content-type") || "";
    let intent: string | null = null;
    let bodyName: string | null = null;
    let bodyCollectionId: string | null = null;
    let bodyCollectionTitle: string | null = null;
    let bodyRules: any = null;

    // Parse body once and reuse parsedJson / parsedForm below to avoid "Body has already been read"
    let parsedJson: any = null;
    let parsedForm: FormData | null = null;
    if (contentType.includes("application/json")) {
      parsedJson = await request.json();
      intent = parsedJson.intent ?? null;
      bodyName = parsedJson.name ?? null;
      bodyCollectionId = parsedJson.collectionId ?? null;
      bodyCollectionTitle = parsedJson.collectionTitle ?? null;
      bodyRules = parsedJson.rules ?? null;
    } else {
      parsedForm = await request.formData();
      intent = (parsedForm.get("intent") as string) ?? null;
      bodyName = (parsedForm.get("name") as string) ?? null;
      bodyCollectionId = (parsedForm.get("collectionId") as string) ?? null;
      bodyCollectionTitle = (parsedForm.get("collectionTitle") as string) ?? null;
      bodyRules = parsedForm.get("rules") ?? null;
    }

    if (intent === "create") {
      const name = bodyName;
      const collectionId = bodyCollectionId;
      const collectionTitle = bodyCollectionTitle;
      const rules = bodyRules;

      if (!name) {
        throw new Response(JSON.stringify({ error: "Missing required field: name" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!collectionId) {
        throw new Response(JSON.stringify({ error: "Missing required field: collectionId" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!collectionTitle) {
        throw new Response(JSON.stringify({ error: "Missing required field: collectionTitle" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!rules) {
        throw new Response(JSON.stringify({ error: "Missing required field: rules" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      let parsedRules;
      try {
        parsedRules = typeof rules === "string" ? JSON.parse(rules) : rules;
      } catch (error) {
        throw new Response(JSON.stringify({ error: "Invalid rules format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const discountCodes = parsedRules.map((rule: any) => ({
        code: rule.discountCode,
        used: false,
      }));

      const bundle = await prisma.bundle.create({
        data: {
          name,
          collectionId,
          collectionTitle,
          rules: JSON.stringify(parsedRules),
          discountCodes,
        },
      });

      return new Response(JSON.stringify({ id: bundle.id }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (intent === "update-rules") {
      // Derive bundleId and rules from previously extracted values or request body
      let bundleIdField: string | null = null;
      let rulesField: any = null;
      if (parsedJson) {
        bundleIdField = parsedJson.bundleId ?? parsedJson.id ?? null;
        rulesField = parsedJson.rules ?? null;
      } else if (parsedForm) {
        bundleIdField = (parsedForm.get("bundleId") as string) ?? (parsedForm.get("id") as string) ?? null;
        rulesField = bodyRules ?? (parsedForm.get("rules") as any) ?? null;
      }

      if (!bundleIdField || !rulesField) {
        throw new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      let parsedRules = typeof rulesField === "string" ? JSON.parse(rulesField) : rulesField;
      const discountCodes = parsedRules.map((rule: any) => ({
        code: rule.discountCode,
        used: false,
      }));

      await prisma.bundle.update({
        where: { id: bundleIdField },
        data: { rules: JSON.stringify(parsedRules), discountCodes },
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (intent === "update-bundle") {
      // Update only the bundle name (and optionally collection fields in future)
      let bundleIdField: string | null = null;
      let nameField: string | null = null;
      if (parsedJson) {
        bundleIdField = parsedJson.bundleId ?? parsedJson.id ?? null;
        nameField = parsedJson.name ?? null;
      } else if (parsedForm) {
        bundleIdField = (parsedForm.get("bundleId") as string) ?? (parsedForm.get("id") as string) ?? null;
        nameField = (parsedForm.get("name") as string) ?? null;
      }

      if (!bundleIdField || !nameField) {
        throw new Response(JSON.stringify({ error: "Missing required fields for update-bundle" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await prisma.bundle.update({ where: { id: bundleIdField }, data: { name: nameField } });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (intent === "delete-bundle") {
      let bundleIdField: string | null = null;
      if (parsedJson) {
        bundleIdField = parsedJson.bundleId ?? parsedJson.id ?? null;
      } else if (parsedForm) {
        bundleIdField = (parsedForm.get("bundleId") as string) ?? (parsedForm.get("id") as string) ?? null;
      }

      if (!bundleIdField) {
        throw new Response(JSON.stringify({ error: "Missing bundle id for delete-bundle" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await prisma.bundle.delete({ where: { id: bundleIdField } });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Response(JSON.stringify({ error: "Invalid intent" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("api.bundles action error:", err);
    if (err instanceof Response) {
      throw err;
    }
    throw new Response(JSON.stringify({ error: "Failed to process request", details: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
