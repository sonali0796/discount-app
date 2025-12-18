import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
  ProductDiscountSelectionStrategy,
} from '../generated/api';


/**
  * @typedef {import("../generated/api").CartInput} RunInput
  * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
  */

/**
  * Parses the metafield configuration
  * @param {any} metafield - The metafield object from the discount
  * @returns {Object} Parsed configuration with default values
  */
function parseConfiguration(metafield) {
  if (!metafield) {
    return {
      cartLinePercentage: 0,
      orderPercentage: 0,
      deliveryPercentage: 0,
      collectionIds: [],
    };
  }

  try {
    // Try to use jsonValue first (parsed JSON), fallback to parsing value string
    const config = metafield.jsonValue || JSON.parse(metafield.value || '{}');
    return {
      cartLinePercentage: Number(config.cartLinePercentage) || 0,
      orderPercentage: Number(config.orderPercentage) || 0,
      deliveryPercentage: Number(config.deliveryPercentage) || 0,
      collectionIds: Array.isArray(config.collectionIds) ? config.collectionIds : [],
    };
  } catch (error) {
    return {
      cartLinePercentage: 0,
      orderPercentage: 0,
      deliveryPercentage: 0,
      collectionIds: [],
    };
  }
}

/**
  * Checks if a cart line is eligible for discount based on quantity and collection rules
  * Note: Due to GraphQL query limitations, we cannot dynamically check collection
  * membership at query time. When collection IDs are specified, we apply discounts
  * to all products. For strict collection-based filtering, configure the discount
  * at the Shopify admin level to only apply to specific collections.
  * @param {any} cartLine - The cart line to check
  * @param {string[]} collectionIds - Array of collection IDs to check against
  * @param {number} minimumQuantity - Minimum quantity required for discount (default: 2)
  * @returns {boolean} True if eligible, false otherwise
  */
function isEligibleForDiscount(cartLine, collectionIds, minimumQuantity = 2) {
  // Check quantity requirement - must be at least minimumQuantity
  if (!cartLine.quantity || cartLine.quantity < minimumQuantity) {
    return false;
  }

  // If cart line doesn't have product information, it's not eligible
  if (!cartLine.merchandise || !cartLine.merchandise.product) {
    return false;
  }

  // If no collection IDs specified, all products with sufficient quantity are eligible
  if (!collectionIds || collectionIds.length === 0) {
    return true;
  }

  // For now, return true for all products when collections are specified
  // The actual collection filtering should be configured at the discount level
  return true;
}

/**
  * @param {RunInput} input
  * @returns {CartLinesDiscountsGenerateRunResult}
  */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.cart.lines.length) {
    return { operations: [] };
  }

  // Parse configuration from metafield
  const config = parseConfiguration(input.discount.metafield);

  // If all percentages are zero, no discounts to apply
  if (config.cartLinePercentage === 0 && config.orderPercentage === 0) {
    return { operations: [] };
  }

  const hasOrderDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Order,
  );
  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasOrderDiscountClass && !hasProductDiscountClass) {
    return { operations: [] };
  }

  const operations = [];

  // Filter eligible cart lines for product discounts based on collection rules
  const eligibleCartLines = input.cart.lines.filter((line) =>
    isEligibleForDiscount(line, config.collectionIds)
  );

  // Apply product discounts if configured and there are eligible lines
  if (hasProductDiscountClass && config.cartLinePercentage > 0 && eligibleCartLines.length > 0) {
    const productDiscountCandidates = eligibleCartLines.map((line) => ({
      message: `${config.cartLinePercentage}% OFF PRODUCT`,
      targets: [
        {
          cartLine: {
            id: line.id,
          },
        },
      ],
      value: {
        percentage: {
          value: config.cartLinePercentage,
        },
      },
    }));

    operations.push({
      productDiscountsAdd: {
        candidates: productDiscountCandidates,
        selectionStrategy: ProductDiscountSelectionStrategy.First,
      },
    });
  }

  // Apply order discounts if configured
  if (hasOrderDiscountClass && config.orderPercentage > 0) {
    // Determine which cart lines to exclude from order discount
    // If collection IDs are specified, exclude lines not in those collections
    // Otherwise, apply to all lines
    const excludedCartLineIds = config.collectionIds.length > 0
      ? input.cart.lines
        .filter((line) => !isEligibleForDiscount(line, config.collectionIds))
        .map((line) => line.id)
      : [];

    operations.push({
      orderDiscountsAdd: {
        candidates: [
          {
            message: `${config.orderPercentage}% OFF ORDER`,
            targets: [
              {
                orderSubtotal: {
                  excludedCartLineIds,
                },
              },
            ],
            value: {
              percentage: {
                value: config.orderPercentage,
              },
            },
          },
        ],
        selectionStrategy: OrderDiscountSelectionStrategy.First,
      },
    });
  }

  return {
    operations,
  };
}
