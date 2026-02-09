import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import type { Bundle, BundleRule } from "../../types/Bundle";
import { syncBundlesToMetafields } from "../services/bundles.service";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Add CORS headers to OPTIONS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  try {
    // Allow public access to load bundles
    const bundles = await prisma.bundle.findMany({
      orderBy: { createdAt: "desc" },
    });

    const formattedBundles: Bundle[] = bundles.map((bundle: any) => ({
      id: String(bundle.id),
      name: bundle.name,
      collectionId: bundle.collectionId,
      collectionTitle: bundle.collectionTitle,
      createdAt: bundle.createdAt.toISOString(),
      updatedAt: bundle.updatedAt.toISOString(),
      rules: bundle.rules ? (JSON.parse(bundle.rules) as BundleRule[]) : [],
      discountCodes: bundle.discountCodes || []
    }));

    return new Response(JSON.stringify({
      success: true,
      count: bundles.length,
      bundles: formattedBundles,
      message: bundles.length === 0 ? "No bundles found. Create some in the app UI." : "Bundles loaded successfully",
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true"
      },
    });

  } catch (err: any) {
    console.error("❌ [BUNDLES API] Error:", err.message);

    return new Response(JSON.stringify({
      success: false,
      error: "Unable to load bundles",
      details: err.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  try {
    // Authenticate for Shopify operations
    const { admin, session } = await authenticate.admin(request);

    const contentType = request.headers.get("content-type") || "";
    let parsedJson: any = null;

    if (contentType.includes("application/json")) {
      parsedJson = await request.json();
    } else {
      throw new Error("Unsupported content type");
    }

    const intent = parsedJson.intent ?? null;
    const bundleId = parsedJson.bundleId ?? parsedJson.id ?? null;

    // Handle CREATE bundle intent
    if (intent === "create") {
      const { name, collectionId, collectionTitle, rules } = parsedJson;

      if (!name || !collectionId || !collectionTitle || !rules) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required fields: name, collectionId, collectionTitle, rules"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }

      try {
        const newBundle = await prisma.bundle.create({
          data: {
            name,
            collectionId,
            collectionTitle,
            rules: JSON.stringify(rules),
            discountCodes: []
          },
        });

        // Sync bundles to metafields after creation
        await syncBundlesToMetafields(request);

        return new Response(JSON.stringify({
          success: true,
          bundle: {
            id: newBundle.id,
            name: newBundle.name,
            collectionId: newBundle.collectionId,
            collectionTitle: newBundle.collectionTitle,
            createdAt: newBundle.createdAt.toISOString(),
            updatedAt: newBundle.updatedAt.toISOString(),
            rules: JSON.parse(newBundle.rules),
            discountCodes: newBundle.discountCodes || []
          },
          message: "Bundle created successfully"
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      } catch (error: any) {
        console.error("Error creating bundle:", error);
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to create bundle",
          details: error.message
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }
    }

    // Handle UPDATE bundle intent
    if (intent === "update") {
      const { name, rules } = parsedJson;

      if (!bundleId) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required field: bundleId"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }

      try {
        const updateData: any = {
          updatedAt: new Date()
        };

        if (name) {
          updateData.name = name;
        }

        if (rules) {
          // Parse existing bundle to preserve discount codes
          const existingBundle = await prisma.bundle.findUnique({
            where: { id: bundleId }
          });

          if (!existingBundle) {
            return new Response(JSON.stringify({
              success: false,
              error: "Bundle not found"
            }), {
              status: 404,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              },
            });
          }

          const existingRules = JSON.parse(existingBundle.rules);
          const updatedRules = rules.map((newRule: any, index: number) => {
            // Preserve existing discount codes if rule has same tier
            const existingRule = existingRules.find((r: any) => r.id === newRule.id);
            if (existingRule && existingRule.discountCode) {
              return {
                ...newRule,
                discountCode: existingRule.discountCode,
                shopifyPriceRuleId: existingRule.shopifyPriceRuleId,
                isActive: existingRule.isActive,
                createdAt: existingRule.createdAt || new Date().toISOString()
              };
            }
            return newRule;
          });

          updateData.rules = JSON.stringify(updatedRules);
        }

        const updatedBundle = await prisma.bundle.update({
          where: { id: bundleId },
          data: updateData,
        });

        // Sync bundles to metafields after update
        await syncBundlesToMetafields(request);

        return new Response(JSON.stringify({
          success: true,
          bundle: {
            id: updatedBundle.id,
            name: updatedBundle.name,
            collectionId: updatedBundle.collectionId,
            collectionTitle: updatedBundle.collectionTitle,
            createdAt: updatedBundle.createdAt.toISOString(),
            updatedAt: updatedBundle.updatedAt.toISOString(),
            rules: JSON.parse(updatedBundle.rules),
            discountCodes: updatedBundle.discountCodes || []
          },
          message: "Bundle updated successfully"
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      } catch (error: any) {
        console.error("Error updating bundle:", error);
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to update bundle",
          details: error.message
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }
    }

    // Handle DELETE bundle intent
    if (intent === "delete") {
      if (!bundleId) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required field: bundleId"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }

      try {
        // First, get the bundle to check for existing discounts
        const bundle = await prisma.bundle.findUnique({
          where: { id: bundleId }
        });

        if (!bundle) {
          return new Response(JSON.stringify({
            success: false,
            error: "Bundle not found"
          }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
          });
        }

        // If bundle has discount codes, delete them from Shopify first
        if (bundle.discountCodes && Array.isArray(bundle.discountCodes) && bundle.discountCodes.length > 0) {
          const rules = JSON.parse(bundle.rules);
          for (const rule of rules) {
            if (rule.shopifyPriceRuleId) {
              try {
                await admin.graphql(`
                  mutation discountCodeBasicDelete($id: ID!) {
                    discountCodeBasicDelete(id: $id) {
                      deletedDiscountCodeBasicId
                      userErrors {
                        field
                        message
                      }
                    }
                  }
                `, {
                  variables: {
                    id: rule.shopifyPriceRuleId
                  }
                });
                console.log(`Deleted discount ${rule.shopifyPriceRuleId} from Shopify`);
              } catch (shopifyError) {
                console.warn(`Could not delete discount ${rule.shopifyPriceRuleId} from Shopify:`, shopifyError);
              }
            }
          }
        }

        // Delete the bundle from database
        await prisma.bundle.delete({
          where: { id: bundleId }
        });

        // Sync bundles to metafields after deletion
        await syncBundlesToMetafields(request);

        return new Response(JSON.stringify({
          success: true,
          message: "Bundle deleted successfully"
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      } catch (error: any) {
        console.error("Error deleting bundle:", error);
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to delete bundle",
          details: error.message
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }
    }

    // Handle CREATE-DISCOUNT intent
    if (intent === "create-discount") {
      const ruleIndex = parsedJson.ruleIndex ?? null;

      if (!bundleId || ruleIndex === null) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required fields: bundleId and ruleIndex"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }

      // Get the bundle from database
      const bundle = await prisma.bundle.findUnique({
        where: { id: bundleId }
      });

      if (!bundle) {
        return new Response(JSON.stringify({
          success: false,
          error: "Bundle not found"
        }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }

      const rules = JSON.parse(bundle.rules);
      const rule = rules[ruleIndex];

      if (!rule) {
        return new Response(JSON.stringify({
          success: false,
          error: "Rule not found"
        }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }

      // Check if discount already exists for this rule
      if (rule.discountCode && rule.isActive) {
        return new Response(JSON.stringify({
          success: true,
          discountCode: rule.discountCode,
          message: "Discount already exists"
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }

      // Generate unique discount code using previous logic
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const discountCode = `${rule.tier.toUpperCase().replace(/\s+/g, '_')}_${randomNum}`;

      console.log(`🎯 Creating discount in Shopify:`, {
        title: rule.tier,
        code: discountCode,
        discountPercentage: rule.discountPercentage,
        totalProducts: rule.totalProducts,
        percentageValue: rule.discountPercentage / 100
      });

      try {
        // Use GraphQL to create discount code with DYNAMIC data
        const graphqlResponse = await admin.graphql(`
          mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
            discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
              codeDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: {
            basicCodeDiscount: {
              title: rule.tier,
              code: discountCode,
              startsAt: new Date().toISOString(),
              usageLimit: 1,
              customerSelection: { all: true },
              customerGets: {
                value: {
                  percentage: rule.discountPercentage / 100
                },
                items: { all: true }
              },
              minimumRequirement: {
                quantity: {
                  greaterThanOrEqualToQuantity: rule.totalProducts.toString()
                }
              }
            }
          }
        });

        const result: any = await graphqlResponse.json();

        console.log("📦 Shopify GraphQL response:", JSON.stringify(result, null, 2));

        if (result.data?.discountCodeBasicCreate?.userErrors?.length > 0) {
          const errors = result.data.discountCodeBasicCreate.userErrors;
          console.error("❌ GraphQL errors:", errors);
          return new Response(JSON.stringify({
            success: false,
            error: "Failed to create discount code in Shopify",
            details: errors.map((e: any) => `${e.field}: ${e.message}`).join(', '),
            shopifyResponse: result
          }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
          });
        }

        if (!result.data?.discountCodeBasicCreate?.codeDiscountNode?.id) {
          console.error("❌ No discount node ID returned:", result);
          return new Response(JSON.stringify({
            success: false,
            error: "Failed to create discount code - no ID returned",
            shopifyResponse: result
          }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
          });
        }

        const discountNodeId = result.data.discountCodeBasicCreate.codeDiscountNode.id;

        console.log(`✅ Discount created successfully in Shopify: ${discountCode} (ID: ${discountNodeId})`);

        // Update the rule with discount info
        rules[ruleIndex] = {
          ...rule,
          discountCode,
          shopifyPriceRuleId: discountNodeId,
          shopifyDiscountCodeId: discountNodeId,
          isActive: true,
          createdAt: new Date().toISOString()
        };

        // Update bundle in database
        const updatedBundle = await prisma.bundle.update({
          where: { id: bundleId },
          data: {
            rules: JSON.stringify(rules),
            discountCodes: [...(bundle.discountCodes || []), {
              code: discountCode,
              used: false,
              ruleIndex,
              createdAt: new Date().toISOString(),
              discountNodeId: discountNodeId
            }]
          },
        });

        // Sync bundles to metafields after creating discount
        await syncBundlesToMetafields(request);

        return new Response(JSON.stringify({
          success: true,
          discountCode,
          discountNodeId,
          message: `Discount "${discountCode}" created successfully in Shopify`,
          rule: {
            tier: rule.tier,
            discountPercentage: rule.discountPercentage,
            totalProducts: rule.totalProducts
          }
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      } catch (shopifyError: any) {
        console.error("❌ Shopify API error:", shopifyError);

        return new Response(JSON.stringify({
          success: false,
          error: "Failed to create discount in Shopify",
          details: shopifyError.message,
          stack: shopifyError.stack
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }
    }

    // Handle other intents
    return new Response(JSON.stringify({
      success: false,
      error: "Invalid intent"
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });

  } catch (err: any) {
    console.error("❌ api.bundles action error:", err);

    // Check if it's an authentication error
    if (err.message?.includes("authenticate") || err.status === 401 || err.status === 403) {
      return new Response(JSON.stringify({
        success: false,
        error: "Authentication failed",
        details: "Please ensure you're logged into the Shopify admin",
        message: err.message
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: "Failed to process request",
      details: err.message || String(err)
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }
};