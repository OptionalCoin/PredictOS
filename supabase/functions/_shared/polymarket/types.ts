/**
 * Polymarket Types for Trading Bot
 */

/**
 * Supported assets for 15-minute up/down markets
 */
export type SupportedAsset = "BTC" | "SOL" | "ETH" | "XRP";

/**
 * Market data from Gamma API
 */
export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  title: string;
  description: string;
  outcomes: string;
  outcomePrices: string;
  volume: string;
  volume24hr: number;
  clobTokenIds: string;
  acceptingOrders: boolean;
  active: boolean;
  closed: boolean;
  endDate: string;
  startDate: string;
}

/**
 * Parsed token IDs for Up and Down outcomes
 */
export interface TokenIds {
  up: string;
  down: string;
}

/**
 * Order side type
 */
export type OrderSideType = "BUY" | "SELL";

/**
 * Order arguments for creating a new order
 */
export interface OrderArgs {
  tokenId: string;
  price: number;
  size: number;
  side: OrderSideType;
}

/**
 * Order response from the CLOB API
 */
export interface OrderResponse {
  success: boolean;
  orderId?: string;
  errorMsg?: string;
  transactionHash?: string;
  status?: string;
}

/**
 * Log entry for bot execution
 */
export interface BotLogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Polymarket client configuration
 */
export interface PolymarketClientConfig {
  /** Private key for signing orders */
  privateKey: string;
  /** Proxy/funder address (shown under profile pic on Polymarket) */
  proxyAddress: string;
  /** Signature type: 0 = EOA, 1 = Magic/Email, 2 = Browser Wallet */
  signatureType?: number;
}
