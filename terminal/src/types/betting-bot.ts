/**
 * Types for the Limit Order Bot API
 */

/**
 * Supported assets for 15-minute up/down markets
 */
export type SupportedAsset = "BTC" | "SOL" | "ETH" | "XRP";

/**
 * Log entry from the bot
 */
export interface BotLogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Order response from Polymarket
 */
export interface OrderResponse {
  success: boolean;
  orderId?: string;
  errorMsg?: string;
  transactionHash?: string;
  status?: string;
}

/**
 * Market order result from the limit order bot
 */
export interface MarketOrderResult {
  marketSlug: string;
  marketTitle?: string;
  marketStartTime: string;
  targetTimestamp: number;
  ordersPlaced?: {
    up?: OrderResponse;
    down?: OrderResponse;
  };
  error?: string;
}

/**
 * Request body for the limit-order-bot endpoint
 */
export interface LimitOrderBotRequest {
  asset: SupportedAsset;
  /** Order price as a percentage (e.g., 48 for 48%). Optional, defaults to 48% */
  price?: number;
  /** Order size in USD total. Optional, defaults to $25 */
  sizeUsd?: number;
}

/**
 * Response from the limit-order-bot endpoint
 */
export interface LimitOrderBotResponse {
  success: boolean;
  data?: {
    asset: SupportedAsset;
    pricePercent: number;
    sizeUsd: number;
    market: MarketOrderResult;
  };
  logs: BotLogEntry[];
  error?: string;
}
