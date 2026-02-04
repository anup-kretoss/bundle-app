# Shopify Bundle Discount - Complete Setup

## ✅ What's Done

Your Shopify Function has been updated with the following improvements:

### 1. **Enhanced Discount Logic** (`extensions/bundle-discount/src/cart_lines_discounts_generate_run.ts`)
   - ✅ Reads bundle rules from discount metafield
   - ✅ Matches products in cart against bundle rules
   - ✅ Checks quantity thresholds
   - ✅ Applies percentage discounts automatically
   - ✅ Comprehensive logging for debugging

### 2. **Automatic Discount Creator** (`app/routes/api.create-discount.ts`)
   - ✅ API endpoint to create automatic discount in Shopify
   - ✅ Finds your deployed function
   - ✅ Creates discount with proper configuration
   - ✅ Initializes metafield for bundle rules

### 3. **Discount Setup UI** (`app/components/DiscountSetup.tsx`)
   - ✅ User-friendly setup interface
   - ✅ Step-by-step instructions
   - ✅ Status feedback
   - ✅ Error handling

### 4. **Function Built Successfully**
   - ✅ TypeScript compiled
   - ✅ WebAssembly generated
   - ✅ Ready to deploy

---

## 🚀 Next Steps (Follow in Order)

### Step 1: Deploy Your Function to Shopify

Run this command to deploy your function:

```bash
cd "/Users/kretoss/Desktop/Custom app/bundle-app"
npm run shopify app deploy
```

**What this does:**
- Uploads your function to Shopify
- Makes it available for use in automatic discounts
- Creates a Function ID that can be referenced

**Expected output:**
```
✓ Function deployed successfully
Function ID: gid://shopify/ShopifyFunction/...
```

### Step 2: Create the Automatic Discount

After deployment, create the automatic discount using **ONE** of these methods:

#### Option A: Via API Call (Easiest)

```bash
# Replace YOUR_PORT with your app's port (usually 3000 or from npm run dev)
curl -X POST http://localhost:YOUR_PORT/api/create-discount \
  -H "Content-Type: application/json"
```

#### Option B: Via Shopify Admin (Manual)

1. Go to **Shopify Admin** → **Discounts**
2. Click **"Create discount"** → **"Automatic discount"**  
3. Under **"Method"**, select **"Bundle Discount"** (your function)
4. Set **Title** to `Bundle Discount`
5. Set **Start date** to now or your preferred date
6. Under **"Combinations"**:
   - ✅ Order discounts
   - ✅ Product discounts
   - ❌ Shipping discounts (optional)
7. Set **Discount classes**:
   - ✅ **Product** (recommended for line item discounts)
   - ✅ **Order** (optional, for order-level discounts)
8. Click **"Save"**

### Step 3: Verify the Setup

#### A. Check the discount exists:

Go to **Shopify Admin** → **Discounts**

You should see: **"Bundle Discount"** (Automatic, Active)

#### B. Check function logs (optional):

```bash
cd extensions/bundle-discount
shopify app function run --watch
```

This shows real-time logs when the function runs (when someone adds to cart).

### Step 4: Create Your First Bundle

1. Go to your app's **Bundles** page
2. Select a **Collection**
3. Add **Bundle Rules**:
   - **Discount Name**: e.g., "Silver Tier"
   - **Total Products**: Minimum quantity (e.g., 3)
   - **Discount Percentage**: Discount to apply (e.g., 20)
4. Click **"Create Bundle"**

**What happens automatically:**
- Bundle saved to database ✅
- Rules synced to Shopify metafield ✅
- Function can now read and apply these rules ✅

### Step 5: Test the Discount

#### Testing Checklist:

1. **Go to your Shopify storefront**
2. **Add a product from your bundle collection to cart**
3. **Add enough quantity to meet the threshold**
   - If rule says "3 products minimum", add 3 or more
4. **Check the cart**
   - Discount should apply automatically
   - Cart price should update
   - Discount message should show (e.g., "Summer Bundle: 20% off")

#### Example Test Scenario:

**Bundle Rule:**
- Collection: "Summer Collection"
- Product: "T-Shirt"
- Minimum Quantity: 3
- Discount: 20%

**Test:**
1. Add 1 T-Shirt → No discount (below threshold)
2. Add 2 more T-Shirts (total 3) → ✅ 20% discount applies!

---

## 🔍 How to Debug Issues

### Issue: Discount not applying

**Checklist:**

1. **Is the function deployed?**
   ```bash
   shopify app function list
   ```
   Should show: `bundle-discount` with status `deployed`

2. **Is the automatic discount active?**
   - Check Shopify Admin → Discounts
   - Status should be **"Active"**

3. **Are bundle rules synced?**
   - Create/update a bundle
   - Check console for: `✅ Discount node metafield updated`

4. **Do product IDs match?**
   - Bundle rules use product GIDs like `gid://shopify/Product/12345`
   - Cart products must match exactly

5. **Is quantity threshold met?**
   - If rule requires 3 items, cart must have 3+

### Issue: Wrong discount amount

**Check:**
- Discount percentage in bundle rule
- Multiple bundles might be conflicting
- Check function logs for which rule matched

### Issue: Function not running

**Check:**
```bash
cd extensions/bundle-discount
shopify app function run --watch
```

Then add to cart. You should see logs like:
```
=== BUNDLE DISCOUNT FUNCTION START ===
```

If no logs appear:
- Function not deployed
- Automatic discount not created
- Discount not active

---

## 📋 How the System Works

### Architecture Flow:

```
1. Admin creates bundle → Saved to database
       ↓
2. syncBundlesToMetafields() → Syncs to Shopify
       ↓
3. Customer adds to cart → Shopify triggers function
       ↓
4. Function reads metafield → Gets bundle rules
       ↓
5. Function checks cart → Matches against rules
       ↓
6. Function returns operations → Shopify applies discount
       ↓
7. Cart updates → Customer sees discounted price
```

### Key Files:

| File | Purpose |
|------|---------|
| `extensions/bundle-discount/src/cart_lines_discounts_generate_run.ts` | Main discount logic (runs on Shopify) |
| `app/routes/api.bundles.ts` | Bundle CRUD + sync to metafield |
| `app/routes/api.create-discount.ts` | Creates automatic discount |
| `app/components/DiscountSetup.tsx` | UI for one-time setup |

### Data Flow:

```typescript
// Bundle in Database
{
  id: "bundle-123",
  name: "Summer Bundle",
  collectionId: "gid://shopify/Collection/456",
  rules: [
    {
      productId: "gid://shopify/Product/789",
      quantity: 3,
      discountPercentage: 20
    }
  ]
}

// ↓ Synced to Shopify Metafield

// Function reads this from metafield
// When cart has 3+ of Product/789
// → Applies 20% discount
```

---

## 🎯 Quick Reference Commands

```bash
# Build function locally
cd extensions/bundle-discount && npm run build

# Deploy function to Shopify
npm run shopify app deploy

# Watch function logs
cd extensions/bundle-discount && shopify app function run --watch

# List deployed functions
shopify app function list

# Create automatic discount (after deploy)
curl -X POST http://localhost:YOUR_PORT/api/create-discount
```

---

## ✨ What Makes This Solution Work

### 1. **No Webhooks Needed**
   - Shopify Functions run automatically on cart changes
   - No API calls, no rate limits
   - Instant discount application

### 2. **No Manual Discount Codes**
   - Discounts apply automatically when rules match
   - Customers don't need to enter codes
   - Better user experience

### 3. **Centralized Rules**
   - Bundle rules stored in one metafield
   - Function reads rules on every cart operation
   - Easy to update: just create/edit bundles

### 4. **Real-time Updates**
   - When you create/update a bundle
   - `syncBundlesToMetafields()` runs immediately
   - Function gets new rules on next cart change

---

## 📚 Additional Resources

- [Shopify Functions Documentation](https://shopify.dev/docs/api/functions)
- [Discount Functions API](https://shopify.dev/docs/api/functions/reference/cart-discounts)
- [Function Testing](https://shopify.dev/docs/apps/functions/test-and-debug)

---

## 🆘 Need Help?

If you're stuck:

1. **Check this README** - Most common issues covered
2. **Check function logs** - `shopify app function run --watch`
3. **Verify setup** - Follow "Next Steps" in order
4. **Check Shopify Admin** - Discount should be Active

---

**Ready to go?** Start with **Step 1: Deploy Your Function** above! 🚀
