# Shopify Bundle Discount Function - Setup Guide

This guide explains how to properly set up automatic discounts using Shopify Functions that will apply to your cart based on bundle rules.

## Architecture Overview

The discount system consists of three main components:

1. **Shopify Function** (`extensions/bundle-discount/`) - Runs on Shopify's servers to calculate discounts
2. **Automatic Discount** - A discount configuration in Shopify Admin that triggers your function
3. **Bundle Rules API** (`app/routes/api.bundles.ts`) - Manages bundle rules and syncs them to the discount

## How It Works

```
User adds product to cart
       ↓
Shopify triggers your Function
       ↓
Function reads bundle rules from discount metafield
       ↓
Function checks if cart matches any bundle rules
       ↓
Function returns discount operations
       ↓
Shopify applies discounts to cart
       ↓
Cart prices update automatically
```

## Initial Setup Steps

### Step 1: Deploy Your Function

First, build and deploy your Shopify Function:

```bash
cd /Users/kretoss/Desktop/Custom\ app/bundle-app
npm run shopify app deploy
```

This will:
- Build the function to WebAssembly
- Upload it to Shopify
- Make it available for use in automatic discounts

### Step 2: Create the Automatic Discount

After deploying, create an automatic discount that uses your function.

**Option A: Using the API (Recommended)**

Call the API endpoint to automatically create the discount:

```bash
curl -X POST http://localhost:YOUR_PORT/api/create-discount \
  -H "Content-Type: application/json"
```

Or from your app's admin interface, add a button that calls:
```javascript
fetch('/api/create-discount', { method: 'POST' })
```

**Option B: Manual Creation in Shopify Admin**

1. Go to Shopify Admin → Discounts
2. Click "Create discount" → "Automatic discount"
3. Select your "Bundle Discount" function
4. Set title to "Bundle Discount"
5. Set start date to now
6. Enable "Combines with other discounts" as needed
7. Save

### Step 3: Create Bundle Rules

Use your existing bundle creation UI to create bundle rules. When you create or update bundles:

1. Rules are saved to your database
2. `syncBundlesToMetafields()` is called automatically
3. Bundle rules are synced to the discount's metafield
4. Function can now read these rules

## How Discounts Are Applied

### Bundle Rule Structure

```typescript
{
  bundleId: "123",
  bundleName: "Summer Bundle",
  collectionId: "gid://shopify/Collection/456",
  rules: [
    {
      id: "rule1",
      productId: "gid://shopify/Product/789",
      quantity: 3,           // Minimum quantity needed
      discountPercentage: 20  // Discount to apply
    }
  ]
}
```

### Discount Logic

The function checks each product in the cart:

1. **Match Product**: Is this product in any bundle rule?
2. **Check Quantity**: Does cart quantity meet the minimum?
3. **Apply Discount**: If yes, apply the percentage discount

Example:
- Bundle rule: Buy 3+ of Product A, get 20% off
- Cart has 5 of Product A
- ✅ Discount applies: 20% off those 5 items

## Discount Types

Your function supports two discount types:

### Product-Level Discounts (Recommended)
- Applied to specific cart line items
- Shows clearly which products are discounted
- Better UX in cart

### Order-Level Discounts
- Applied to entire order subtotal
- Single discount line in cart
- Simpler but less transparent

Set the discount class when creating the automatic discount in Shopify Admin.

## Viewing Discount Logs

To debug your function, check the Shopify Function logs:

```bash
shopify app function run --watch
```

The function logs:
- ✅ Bundle configurations found
- ✅ Products matched
- ✅ Discounts applied
- ❌ Rules not matched (with reasons)

## Testing

### Test Flow

1. **Create a bundle**:
   - Select a collection
   - Add rules (product + quantity + discount %)
   - Save

2. **Add products to cart**:
   - Go to your store
   - Add bundle products to cart
   - Meet quantity threshold

3. **Check cart**:
   - Discount should apply automatically
   - Cart prices update
   - Discount message shows

### Common Issues

**Issue**: Discount not applying

Check:
- [ ] Function is deployed (`shopify app deploy`)
- [ ] Automatic discount exists and is active
- [ ] Bundle rules are synced (check metafield)
- [ ] Product IDs match exactly (use GIDs)
- [ ] Quantity threshold is met
- [ ] Discount is not expired

**Issue**: Wrong discount amount

Check:
- [ ] Discount percentage in bundle rule
- [ ] Multiple bundles conflicting
- [ ] Discount combining settings

## API Reference

### Create/Update Bundle

```typescript
POST /api/bundles
{
  "intent": "create",
  "name": "Summer Sale Bundle",
  "collectionId": "gid://shopify/Collection/123",
  "collectionTitle": "Summer Collection",
  "rules": [
    {
      "id": "rule1",
      "productId": "gid://shopify/Product/456",
      "quantity": 3,
      "discountPercentage": 20,
      "discountCode": "SUMMER20"
    }
  ]
}
```

This automatically:
1. Saves to database
2. Syncs to Shopify metafield
3. Function can immediately use new rules

### Update Rules Only

```typescript
POST /api/bundles
{
  "intent": "update-rules",
  "bundleId": "bundle-123",
  "rules": [...]
}
```

### Delete Bundle

```typescript
POST /api/bundles
{
  "intent": "delete-bundle",
  "bundleId": "bundle-123"
}
```

## File Structure

```
extensions/bundle-discount/
├── src/
│   ├── cart_lines_discounts_generate_run.ts  # Main function logic
│   ├── cart_lines_discounts_generate_run.graphql  # Input query
│   └── index.ts
├── shopify.extension.toml  # Function configuration
└── package.json

app/routes/
├── api.bundles.ts  # Bundle CRUD + sync
├── api.create-discount.ts  # Create automatic discount
└── bundles.tsx  # UI for managing bundles
```

## Important Notes

### Shopify Function Limitations

1. **No External API Calls**: Functions run in isolation
2. **No Database Access**: Must use metafields for data
3. **Read-Only Input**: Cannot modify cart directly
4. **Return Operations**: Tell Shopify what discounts to apply

### Metafield Size Limit

- Metafields have a size limit (~65KB)
- Keep bundle rules concise
- Consider pagination for many bundles

### Performance

- Functions must execute quickly (<5ms recommended)
- Optimize rule matching logic
- Avoid complex calculations

## Production Checklist

Before going live:

- [ ] Deploy function to production
- [ ] Create automatic discount in production Shopify
- [ ] Test with real products
- [ ] Verify discount combinations
- [ ] Check mobile cart display
- [ ] Monitor function execution time
- [ ] Set up error alerting

## Support

For issues:
1. Check function logs
2. Verify metafield data
3. Test with simple bundle first
4. Check Shopify Function documentation

## Next Steps

- Add support for fixed amount discounts
- Implement tiered discounts (e.g., 3 items = 10%, 5 items = 20%)
- Add date-based discount activation
- Support BOGO (Buy One Get One) rules
