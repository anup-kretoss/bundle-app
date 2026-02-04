# Create Automatic Discount - GraphQL Mutation
# 
# Run this in GraphiQL (http://localhost:3457/graphiql)
# or in Shopify Admin GraphiQL explorer

# STEP 1: First, get your function ID
# Copy the console and run this query:

query GetFunctions {
  shopifyFunctions(first: 25) {
    nodes {
      id
      apiType
      title
      apiVersion
    }
  }
}

# Look for the function with apiType: "cart_lines_discounts_generate_run"
# Copy its ID (it will look like: gid://shopify/ShopifyFunction/...)


# STEP 2: Create the automatic discount
# Replace YOUR_FUNCTION_ID_HERE with the ID from step 1

mutation CreateBundleDiscount {
  discountAutomaticAppCreate(
    automaticAppDiscount: {
      title: "Bundle Discount"
      functionId: "YOUR_FUNCTION_ID_HERE"
      startsAt: "2026-01-28T00:00:00Z"
      combinesWith: {
        orderDiscounts: true
        productDiscounts: true
        shippingDiscounts: false
      }
    }
  ) {
    automaticAppDiscount {
      discountId
      title
      startsAt
      endsAt
      status
      discountClass
      appDiscountType {
        functionId
      }
      combinesWith {
        orderDiscounts
        productDiscounts
        shippingDiscounts
      }
    }
    userErrors {
      field
      message
    }
  }
}

# STEP 3: Initialize the metafield (optional, will be set when you create bundles)
# Replace YOUR_DISCOUNT_ID_HERE with the discountId from step 2

mutation SetDiscountMetafield {
  metafieldsSet(
    metafields: [
      {
        namespace: "bundle_app"
        key: "rules"
        type: "json"
        value: "[]"
        ownerId: "YOUR_DISCOUNT_ID_HERE"
      }
    ]
  ) {
    metafields {
      id
      key
      value
      namespace
    }
    userErrors {
      field
      message
    }
  }
}
