#!/bin/bash

# Shopify Bundle Discount - Setup Verification Script
# This script helps verify that your discount function is properly set up

echo "🔍 Shopify Bundle Discount - Setup Verification"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Function build
echo "1️⃣  Checking if function is built..."
if [ -f "extensions/bundle-discount/dist/function.wasm" ]; then
    echo -e "${GREEN}✅ Function WASM file exists${NC}"
else
    echo -e "${RED}❌ Function not built. Run: cd extensions/bundle-discount && npm run build${NC}"
    exit 1
fi

# Check 2: Deployment status
echo ""
echo "2️⃣  Checking deployment status..."
echo -e "${YELLOW}ℹ️  Run 'shopify app function list' to verify deployment${NC}"
echo "   Expected: You should see 'bundle-discount' in the list"

# Check 3: Database schema
echo ""
echo "3️⃣  Checking database..."
if [ -f "prisma/schema.prisma" ]; then
    if grep -q "model Bundle" prisma/schema.prisma; then
        echo -e "${GREEN}✅ Bundle model exists in schema${NC}"
    else
        echo -e "${RED}❌ Bundle model not found in schema${NC}"
    fi
else
    echo -e "${RED}❌ Prisma schema not found${NC}"
fi

# Check 4: API routes
echo ""
echo "4️⃣  Checking API routes..."
if [ -f "app/routes/api.bundles.ts" ]; then
    echo -e "${GREEN}✅ Bundle API route exists${NC}"
else
    echo -e "${RED}❌ Bundle API route missing${NC}"
fi

if [ -f "app/routes/api.create-discount.ts" ]; then
    echo -e "${GREEN}✅ Create discount API route exists${NC}"
else
    echo -e "${RED}❌ Create discount API route missing${NC}"
fi

# Check 5: Function logic
echo ""
echo "5️⃣  Checking function implementation..."
if [ -f "extensions/bundle-discount/src/cart_lines_discounts_generate_run.ts" ]; then
    if grep -q "bundleConfigs" extensions/bundle-discount/src/cart_lines_discounts_generate_run.ts; then
        echo -e "${GREEN}✅ Function contains bundle logic${NC}"
    else
        echo -e "${YELLOW}⚠️  Function might need updating${NC}"
    fi
else
    echo -e "${RED}❌ Function source file missing${NC}"
fi

# Summary
echo ""
echo "================================================"
echo "📋 NEXT STEPS:"
echo "================================================"
echo ""
echo "If all checks passed, follow these steps:"
echo ""
echo "1. Deploy function:"
echo "   ${YELLOW}npm run shopify app deploy${NC}"
echo ""
echo "2. Create automatic discount:"
echo "   ${YELLOW}curl -X POST http://localhost:YOUR_PORT/api/create-discount${NC}"
echo ""
echo "3. Create your first bundle in the app UI"
echo ""
echo "4. Test by adding products to cart"
echo ""
echo "For detailed instructions, see: ${YELLOW}SETUP_README.md${NC}"
echo ""
