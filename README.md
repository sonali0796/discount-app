# Discount App

Shopify discount function with Admin UI for configurable discounts.

## Quick Start

```bash
# Install dependencies
npm install

# Start development
shopify app dev
```

## Project Structure

- **Discount Function**: `extensions/cart-line-discount-function/`
  - Applies discounts when product quantity ≥ 2
  - Reads configuration from metafield
  
- **Admin UI Extension**: `extensions/discount-ui-ext/`
  - Configuration interface in Shopify Admin
  - Saves settings to metafield

## Configuration

### Access Scopes
Required scopes in `shopify.app.toml`:
```
scopes = "write_products,write_discounts"
```

### Metafield
- Namespace: `$app:example-discounts--ui-extension`
- Key: `function-configuration`
- Stores: `cartLinePercentage`, `orderPercentage`, `deliveryPercentage`, `collectionIds`

## How It Works

1. Merchant configures discount percentages in Admin UI
2. Configuration saved to metafield
3. At checkout, function checks:
   - Cart line quantity ≥ 2
   - Applies configured discount percentage

## Key Files

- `extensions/cart-line-discount-function/src/cart_lines_discounts_generate_run.js` - Discount logic
- `extensions/cart-line-discount-function/src/cart_lines_discounts_generate_run.graphql` - Input query
- `extensions/discount-ui-ext/src/DiscountFunctionSettings.jsx` - Admin UI

## Troubleshooting

- **Discount not applying**: Check quantity is ≥ 2
- **UI not showing**: Verify `extensions.ui.handle` matches in both extension configs
- **TypeScript errors**: Check `shopify.d.ts` and `tsconfig.json` in UI extension
