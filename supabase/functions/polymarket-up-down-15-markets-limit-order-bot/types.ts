/**
 * Type definitions for polymarket-up-down-15-markets-limit-order-bot edge function
 */

import type { SupportedAsset, BotLogEntry } from "../_shared/polymarket/types.ts";

/**
 * Request body for the limit order bot
 */
export interface LimitOrderBotRequest {
  /** Asset to trade (BTC, SOL, ETH, XRP) */
  asset: SupportedAsset;
  /** Order price as percentage (e.g., 48 for 48%). Defaults to 48% */
  price?: number;
  /** Order size in USD total per side. Defaults to $25 */
  sizeUsd?: number;
}

/**
 * Order placement result for a single side
 */
export interface OrderPlacementResult {
  success: boolean;
  orderId?: string;
  errorMsg?: string;
  status?: string;
}

/**
 * Result for a single market's order placement
 */
export interface MarketOrderResult {
  /** Market slug identifier */
  marketSlug: string;
  /** Market title/question */
  marketTitle?: string;
  /** Market start time (formatted) */
  marketStartTime: string;
  /** Unix timestamp of market start */
  targetTimestamp: number;
  /** Orders placed for Up and Down sides */
  ordersPlaced?: {
    up?: OrderPlacementResult;
    down?: OrderPlacementResult;
  };
  /** Error message if market processing failed */
  error?: string;
}

/**
 * Response from the limit order bot
 */
export interface LimitOrderBotResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Response data (only present on success) */
  data?: {
    /** Asset traded */
    asset: SupportedAsset;
    /** Order price as percentage */
    pricePercent: number;
    /** Order size in USD total */
    sizeUsd: number;
    /** Result for the market */
    market: MarketOrderResult;
  };
  /** Log entries from the bot execution */
  logs: BotLogEntry[];
  /** Error message (only present on failure) */
  error?: string;
}
