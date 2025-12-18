/**
 * Polymarket CLOB Client for Deno/Supabase Edge Functions
 * 
 * This client provides functionality to:
 * - Fetch market data from Gamma API
 * - Place orders on Polymarket CLOB using the official @polymarket/clob-client
 */

// @ts-ignore - Deno npm imports
import { ClobClient, Side, OrderType } from "npm:@polymarket/clob-client@5.1.1";
// @ts-ignore - Deno npm imports  
import { Wallet } from "npm:ethers@5.7.2";

import type {
  PolymarketMarket,
  PolymarketClientConfig,
  OrderArgs,
  OrderResponse,
  TokenIds,
  BotLogEntry,
} from "./types.ts";
import { parseTokenIds, createLogEntry } from "./utils.ts";

// API endpoints
const GAMMA_API_URL = "https://gamma-api.polymarket.com";
const CLOB_HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137; // Polygon

// Default tick size for 15-min up/down markets
const DEFAULT_TICK_SIZE = "0.01";
const DEFAULT_NEG_RISK = false;

/**
 * Polymarket Client Class
 */
export class PolymarketClient {
  private config: PolymarketClientConfig;
  private logs: BotLogEntry[] = [];
  private clobClient: typeof ClobClient | null = null;

  constructor(config: PolymarketClientConfig) {
    this.config = {
      ...config,
      signatureType: config.signatureType ?? 1, // Default to Magic/Email login
    };
  }

  /**
   * Get collected logs
   */
  getLogs(): BotLogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Add a log entry
   */
  private log(level: BotLogEntry["level"], message: string, details?: Record<string, unknown>): void {
    this.logs.push(createLogEntry(level, message, details));
    console.log(`[${level}] ${message}`, details || "");
  }

  /**
   * Initialize the CLOB client with API credentials
   */
  private async initClobClient(): Promise<typeof ClobClient> {
    if (this.clobClient) {
      return this.clobClient;
    }

    const { privateKey, proxyAddress, signatureType } = this.config;

    this.log("INFO", "Initializing Polymarket CLOB client...");

    try {
      // Create wallet signer from private key
      const signer = new Wallet(privateKey);
      
      // Create initial client to derive API credentials
      const tempClient = new ClobClient(CLOB_HOST, CHAIN_ID, signer);
      
      // Derive or create API credentials
      const creds = await tempClient.createOrDeriveApiKey();
      this.log("INFO", "API credentials derived successfully");

      // Create the full client with credentials and funder
      this.clobClient = new ClobClient(
        CLOB_HOST,
        CHAIN_ID,
        signer,
        creds,
        signatureType,
        proxyAddress
      );

      this.log("SUCCESS", "CLOB client initialized", {
        funder: `${proxyAddress.slice(0, 10)}...${proxyAddress.slice(-8)}`,
        signatureType,
      });

      return this.clobClient;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log("ERROR", `Failed to initialize CLOB client: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Fetch market data from Gamma API by slug
   */
  async getMarketBySlug(slug: string): Promise<PolymarketMarket | null> {
    const url = `${GAMMA_API_URL}/markets/slug/${slug}`;
    this.log("INFO", `Fetching market data for slug: ${slug}`);
    
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.log("WARN", `Market not found: ${slug}`);
          return null;
        }
        throw new Error(`Gamma API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.log("SUCCESS", `Found market: ${data.title || slug}`);
      return data as PolymarketMarket;
    } catch (error) {
      this.log("ERROR", `Failed to fetch market: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Extract Up and Down token IDs from market data
   */
  extractTokenIds(market: PolymarketMarket): TokenIds {
    const clobTokenIdsStr = market.clobTokenIds;
    
    if (!clobTokenIdsStr) {
      throw new Error("No clobTokenIds found in market data");
    }

    const [up, down] = parseTokenIds(clobTokenIdsStr);
    this.log("INFO", "Extracted token IDs", { 
      up: `${up.slice(0, 16)}...${up.slice(-8)}`,
      down: `${down.slice(0, 16)}...${down.slice(-8)}`
    });
    
    return { up, down };
  }

  /**
   * Place a limit buy order on Polymarket CLOB
   */
  async placeOrder(order: OrderArgs): Promise<OrderResponse> {
    const { privateKey, proxyAddress } = this.config;
    
    if (!privateKey) {
      this.log("ERROR", "Missing private key for order placement");
      return {
        success: false,
        errorMsg: "Missing private key. Please set POLYMARKET_WALLET_PRIVATE_KEY.",
      };
    }

    if (!proxyAddress) {
      this.log("ERROR", "Missing proxy address for order placement");
      return {
        success: false,
        errorMsg: "Missing proxy address. Please set POLYMARKET_PROXY_WALLET_ADDRESS.",
      };
    }

    this.log("INFO", `Placing ${order.side} order`, {
      tokenId: `${order.tokenId.slice(0, 16)}...`,
      price: order.price,
      size: Math.floor(order.size),
    });

    try {
      // Initialize the CLOB client if not already done
      const client = await this.initClobClient();

      // Create and post the order using the official client
      const orderResponse = await client.createAndPostOrder(
        {
          tokenID: order.tokenId,
          price: order.price,
          side: order.side === "BUY" ? Side.BUY : Side.SELL,
          size: Math.floor(order.size),
          feeRateBps: 0,
        },
        {
          tickSize: DEFAULT_TICK_SIZE,
          negRisk: DEFAULT_NEG_RISK,
        },
        OrderType.GTC // Good Till Cancelled
      );

      this.log("SUCCESS", `Order placed successfully`, {
        orderId: orderResponse?.orderID || orderResponse?.id,
        status: orderResponse?.status,
      });

      return {
        success: true,
        orderId: orderResponse?.orderID || orderResponse?.id,
        status: orderResponse?.status || "submitted",
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log("ERROR", `Failed to place order: ${errorMsg}`);
      return {
        success: false,
        errorMsg,
      };
    }
  }

  /**
   * Place straddle orders (buy both Up and Down) at a given price
   */
  async placeStraddleOrders(
    tokenIds: TokenIds,
    price: number,
    sizeUsd: number
  ): Promise<{ up: OrderResponse; down: OrderResponse }> {
    const size = sizeUsd / price;
    
    this.log("INFO", `Placing straddle orders`, {
      price: `${(price * 100).toFixed(1)}%`,
      sizeUsd: `$${sizeUsd}`,
      shares: Math.floor(size),
    });

    // Place Up order
    const upResult = await this.placeOrder({
      tokenId: tokenIds.up,
      price,
      size,
      side: "BUY",
    });

    // Place Down order
    const downResult = await this.placeOrder({
      tokenId: tokenIds.down,
      price,
      size,
      side: "BUY",
    });

    return { up: upResult, down: downResult };
  }
}

/**
 * Create a Polymarket client from environment variables
 */
export function createClientFromEnv(): PolymarketClient {
  // @ts-ignore - Deno global
  const privateKey = Deno.env.get("POLYMARKET_WALLET_PRIVATE_KEY");
  // @ts-ignore - Deno global
  const proxyAddress = Deno.env.get("POLYMARKET_PROXY_WALLET_ADDRESS");
  // @ts-ignore - Deno global
  const signatureType = parseInt(Deno.env.get("POLYMARKET_SIGNATURE_TYPE") || "1", 10);

  if (!privateKey) {
    throw new Error("POLYMARKET_WALLET_PRIVATE_KEY environment variable is required");
  }

  if (!proxyAddress) {
    throw new Error("POLYMARKET_PROXY_WALLET_ADDRESS environment variable is required");
  }

  return new PolymarketClient({
    privateKey,
    proxyAddress,
    signatureType,
  });
}
