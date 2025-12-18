/**
 * Supabase Edge Function: polymarket-up-down-15-markets-limit-order-bot
 * 
 * Automated limit order bot for Polymarket 15-minute up/down markets.
 * Places straddle orders on the closest upcoming market.
 */

import { PolymarketClient, createClientFromEnv } from "../_shared/polymarket/client.ts";
import {
  buildMarketSlug,
  formatTimeShort,
  createLogEntry,
} from "../_shared/polymarket/utils.ts";
import type { SupportedAsset, BotLogEntry } from "../_shared/polymarket/types.ts";
import type {
  LimitOrderBotRequest,
  LimitOrderBotResponse,
  MarketOrderResult,
} from "./types.ts";

// Trading configuration defaults
const DEFAULT_ORDER_PRICE = 0.48; // 48%
const DEFAULT_ORDER_SIZE_USD = 25; // $25 total

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Validate that the asset is supported
 */
function isValidAsset(asset: string): asset is SupportedAsset {
  return ["BTC", "SOL", "ETH", "XRP"].includes(asset.toUpperCase());
}

/**
 * Get current UTC timestamp in seconds
 */
function nowUtcSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get the closest upcoming 15-minute timestamp.
 * Rounds UP to the next 15-minute block.
 */
function getNext15MinTimestamp(): number {
  const now = nowUtcSeconds();
  return Math.ceil(now / 900) * 900;
}

Deno.serve(async (req: Request) => {
  const logs: BotLogEntry[] = [];

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      logs.push(createLogEntry("ERROR", "Invalid request method", { method: req.method }));
      return new Response(
        JSON.stringify({
          success: false,
          error: "Method not allowed. Use POST.",
          logs,
        } as LimitOrderBotResponse),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    let requestBody: LimitOrderBotRequest;
    try {
      requestBody = await req.json();
    } catch {
      logs.push(createLogEntry("ERROR", "Invalid JSON in request body"));
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
          logs,
        } as LimitOrderBotResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { asset, price, sizeUsd } = requestBody;

    // Validate asset
    if (!asset || !isValidAsset(asset)) {
      logs.push(createLogEntry("ERROR", "Invalid or missing asset", { asset }));
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid asset. Must be one of: BTC, SOL, ETH, XRP",
          logs,
        } as LimitOrderBotResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedAsset = asset.toUpperCase() as SupportedAsset;
    
    // Get order configuration from request
    const orderPrice = price ? price / 100 : DEFAULT_ORDER_PRICE;
    const orderSizeUsd = sizeUsd || DEFAULT_ORDER_SIZE_USD;

    // Get the closest upcoming 15-minute market timestamp
    const timestamp = getNext15MinTimestamp();
    const marketSlug = buildMarketSlug(normalizedAsset, timestamp);

    // Initialize the Polymarket client
    let client: PolymarketClient;
    try {
      client = createClientFromEnv();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logs.push(createLogEntry("ERROR", `Failed to initialize client: ${errorMsg}`));
      return new Response(
        JSON.stringify({
          success: false,
          error: `Client initialization failed: ${errorMsg}`,
          logs,
        } as LimitOrderBotResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process the market
    let marketResult: MarketOrderResult;

    try {
      // Fetch market data
      const market = await client.getMarketBySlug(marketSlug);
      logs.push(...client.getLogs());
      client.clearLogs();

      if (!market) {
        marketResult = {
          marketSlug,
          marketStartTime: formatTimeShort(timestamp),
          targetTimestamp: timestamp,
          error: "Market not found - may not be created yet",
        };
      } else {
        // Extract token IDs
        let tokenIds;
        try {
          tokenIds = client.extractTokenIds(market);
          logs.push(...client.getLogs());
          client.clearLogs();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logs.push(createLogEntry("ERROR", `Failed to extract token IDs: ${errorMsg}`));
          marketResult = {
            marketSlug,
            marketTitle: market.title,
            marketStartTime: formatTimeShort(timestamp),
            targetTimestamp: timestamp,
            error: `Token extraction failed: ${errorMsg}`,
          };
          
          return new Response(
            JSON.stringify({
              success: false,
              error: marketResult.error,
              data: {
                asset: normalizedAsset,
                pricePercent: orderPrice * 100,
                sizeUsd: orderSizeUsd,
                market: marketResult,
              },
              logs,
            } as LimitOrderBotResponse),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Place straddle orders
        const orderResults = await client.placeStraddleOrders(tokenIds, orderPrice, orderSizeUsd);
        logs.push(...client.getLogs());
        client.clearLogs();

        marketResult = {
          marketSlug,
          marketTitle: market.title,
          marketStartTime: formatTimeShort(timestamp),
          targetTimestamp: timestamp,
          ordersPlaced: orderResults,
        };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logs.push(createLogEntry("ERROR", `Error processing market ${marketSlug}: ${errorMsg}`));
      marketResult = {
        marketSlug,
        marketStartTime: formatTimeShort(timestamp),
        targetTimestamp: timestamp,
        error: errorMsg,
      };
    }

    const response: LimitOrderBotResponse = {
      success: !marketResult.error,
      data: {
        asset: normalizedAsset,
        pricePercent: orderPrice * 100,
        sizeUsd: orderSizeUsd,
        market: marketResult,
      },
      logs,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logs.push(createLogEntry("ERROR", `Unhandled error: ${errorMsg}`));
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
        logs,
      } as LimitOrderBotResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
