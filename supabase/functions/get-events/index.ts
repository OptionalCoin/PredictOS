/**
 * Supabase Edge Function: get-events
 * 
 * Extracts event data from prediction market URLs.
 * Supports Kalshi and Polymarket via Dome and DFlow APIs.
 */

import { 
  getKalshiMarketsByEvent as getDomeKalshiMarketsByEvent,
  getPolymarketMarkets,
} from "../_shared/dome/endpoints.ts";
import {
  getKalshiMarketsByEvent as getDFlowKalshiMarketsByEvent,
} from "../_shared/dflow/endpoints.ts";
import type {
  GetEventsRequest,
  GetEventsResponse,
  PmType,
} from "./types.ts";

/**
 * Extracts event slug from a Polymarket URL
 */
function extractPolymarketEventSlug(url: string): string | null {
  const urlWithoutParams = url.split('?')[0];
  const parts = urlWithoutParams.split('/');
  return parts[parts.length - 1] || null;
}

/**
 * Detect prediction market type from URL
 */
function detectPmType(url: string): PmType | null {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('kalshi')) return 'Kalshi';
  if (lowerUrl.includes('polymarket')) return 'Polymarket';
  return null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Received request:", req.method, req.url);

  try {
    // Validate request method
    if (req.method !== "POST") {
      console.log("Invalid method:", req.method);
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    let requestBody: GetEventsRequest;
    try {
      requestBody = await req.json();
      console.log("Request body:", JSON.stringify(requestBody));
    } catch {
      console.error("Failed to parse request body");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { url, dataProvider = 'dome' } = requestBody;

    // Validate URL
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required parameter: 'url'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect market type
    const pmType = detectPmType(url);
    if (!pmType) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not detect prediction market type from URL. Use Kalshi or Polymarket URLs." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let eventIdentifier: string;
    let markets: unknown[];

    if (pmType === "Kalshi") {
      // Extract event ticker from Kalshi URL
      const urlParts = url.split('/');
      const eventTicker = urlParts[urlParts.length - 1]?.toUpperCase();

      if (!eventTicker) {
        return new Response(
          JSON.stringify({ success: false, error: "Could not extract event ticker from URL" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      eventIdentifier = eventTicker;
      const providerName = dataProvider === 'dflow' ? 'DFlow' : 'Dome';
      console.log(`Fetching Kalshi markets via ${providerName}:`, { eventTicker, dataProvider });

      try {
        if (dataProvider === 'dflow') {
          markets = await getDFlowKalshiMarketsByEvent(eventTicker);
        } else {
          markets = await getDomeKalshiMarketsByEvent(eventTicker);
        }
        console.log(`Found ${markets.length} markets for Kalshi event via ${providerName}`);
      } catch (error) {
        console.error(`Failed to fetch Kalshi markets via ${providerName}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const isNotFound = errorMessage.includes("404") || errorMessage.toLowerCase().includes("not found");
        return new Response(
          JSON.stringify({
            success: false,
            error: isNotFound
              ? `Event '${eventTicker}' not found on Kalshi (via ${providerName}).`
              : `Failed to fetch markets: ${errorMessage}`,
            metadata: {
              requestId: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              processingTimeMs: Date.now() - startTime,
            },
          }),
          { status: isNotFound ? 404 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Polymarket via Dome API
      const eventSlug = extractPolymarketEventSlug(url);

      if (!eventSlug) {
        return new Response(
          JSON.stringify({ success: false, error: "Could not extract event slug from URL" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      eventIdentifier = eventSlug;
      console.log("Fetching Polymarket markets via Dome:", { eventSlug });

      try {
        const response = await getPolymarketMarkets({ slug: eventSlug });
        markets = response.markets;
        console.log(`Found ${markets.length} markets for Polymarket event`);
      } catch (error) {
        console.error("Failed to fetch Polymarket markets:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const isNotFound = errorMessage.includes("404") || errorMessage.toLowerCase().includes("not found");
        return new Response(
          JSON.stringify({
            success: false,
            error: isNotFound
              ? `Event '${eventSlug}' not found on Polymarket.`
              : `Failed to fetch markets: ${errorMessage}`,
            metadata: {
              requestId: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              processingTimeMs: Date.now() - startTime,
            },
          }),
          { status: isNotFound ? 404 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if any markets were found
    if (markets.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `No markets found for '${eventIdentifier}' on ${pmType}.`,
          metadata: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
          },
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processingTimeMs = Date.now() - startTime;
    console.log("Request completed in", processingTimeMs, "ms");

    const response: GetEventsResponse = {
      success: true,
      eventIdentifier,
      pmType,
      markets,
      marketsCount: markets.length,
      dataProvider,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        processingTimeMs,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

