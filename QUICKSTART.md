# 🎯 QUICKSTART: Get Your Bundle Discount Function Working

Your function is **deployed and ready**! Just need to create the automatic discount.

---

## ✅ Status Check

| Item | Status |
|------|--------|
| Function built | ✅ Done |
| Function deployed | ✅ Done (bundle-app-2) |
| Bundle rules | ✅ Have 3 bundles |
| Automatic discount | ⬜ **DO THIS NOW** |

---

## 🚀 Create the Automatic Discount (GraphiQL Method)

###Step 1: Open GraphiQL

**URL:** http://localhost:3457/graphiql

(Your dev server must be running: `npm run dev`)

### Step 2: Get Your Function ID

Paste and run this query:

```graphql
query GetFunctions {
  shopifyFunctions(first: 25) {
    nodes {
      id
      apiType
      title
    }
  }
}
```

**Look for:** `apiType: "cart_lines_discounts_generate_run"`

**Copy the `id`** (looks like: `gid://shopify/ShopifyFunction/123...`)

### Step 3: Create the Discount

Paste this mutation and **replace `YOUR_FUNCTION_ID` with the ID from step 2**:

```graphql
mutation CreateBundleDiscount {
  discountAutomaticAppCreate(
    automaticAppDiscount: {
      title: "Bundle Discount"
      functionId: "YOUR_FUNCTION_ID"
      startsAt: "2026-01-28T00:00:00Z"
      combinesWith: {
        orderDiscounts: true
        productDiscounts: true
      }
    }
  ) {
    automaticAppDiscount {
      discountId
      title
      status
    }
    userErrors {
      field
      message
    }
  }
}
```

**Run it!**

### Step 4: Verify

If successful, you'll see:

```json
{
  "data": {
    "discountAutomaticAppCreate": {
      "automaticAppDiscount": {
        "discountId": "gid://shopify/DiscountAutomaticNode/...",
        "title": "Bundle Discount",
        "status": "ACTIVE"
      },
      "userErrors": []
    }
  }
}
```

---

## ✨ That's It!

Your discount is now **ACTIVE**!

### What Happens Now:

1. ✅ Your 3 existing bundles are already configured
2. ✅ The function will read these bundle rules automatically  
3. ✅ When customers add products to cart → discount applies!

### Test It:

1. Go to your store: `https://kretosstechnology.myshopify.com`
2. Add products from one of your bundles to cart
3. Meet the quantity threshold (e.g., add 3+ items for "Necklace bundle")
4. **Watch the discount apply automatically!** 🎉

---

## 🔍 Your Current Bundles (From Logs):

| Bundle Name | Minimum Items | Discount |
|-------------|---------------|----------|
| Gold test | 5+ items | 26% off |
| Necklace bundle | 3+ items | ? % |
| new bundle | 4+ items | ? % |

---

## 📋 Troubleshooting

**If discount doesn't apply:**

1. **Check function logs:**
   ```bash
   cd extensions/bundle-discount
   npx shopify app function run
   ```

2. **Add products to cart** and watch the logs

3. **You should see:**
   ```
   === BUNDLE DISCOUNT FUNCTION START ===
   ✅ Found 3 bundle configuration(s)
   ✅ Rule matched!
   ```

**If no logs appear:**
- Discount not created
- Function not connected to discount
- Try creating the discount again

---

## 🎊 Summary

**What you did:**
1. ✅ Built the function
2. ✅ Deployed the function  
3. ⬜ Create automatic discount (in GraphiQL - do this now!)
4. ✅ Bundles already configured

**What happens:**
- Customer adds products → Function runs → Checks bundles → Applies discount!
- No manual codes needed
- Cart updates automatically
- Works in real-time

---

## 📞 Quick Commands

```bash
# Run dev server
npm run dev

# Open GraphiQL
# http://localhost:3457/graphiql

# Check function logs
cd extensions/bundle-discount && npx shopify app function run
```

---

**Ready?** Open GraphiQL and run the mutations above! 🚀
