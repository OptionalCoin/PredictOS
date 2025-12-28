/**
 * Type definitions for get-events edge function
 */

/** Data provider for market data */
export type DataProvider = 'dome' | 'dflow';

/** Prediction market type */
export type PmType = 'Kalshi' | 'Polymarket';

/**
 * Request body for the get-events endpoint
 */
export interface GetEventsRequest {
  /** Prediction market URL */
  url: string;
  /** Data provider for market data (dome or dflow) - defaults to dome */
  dataProvider?: DataProvider;
}

/**
 * Response from the get-events endpoint
 */
export interface GetEventsResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Event identifier (ticker for Kalshi, slug for Polymarket) */
  eventIdentifier?: string;
  /** Event ID (for Polymarket - used for OkBet links) */
  eventId?: string;
  /** Prediction market type */
  pmType?: PmType;
  /** Raw market data from the provider */
  markets?: unknown[];
  /** Number of markets found */
  marketsCount?: number;
  /** Data provider used */
  dataProvider?: DataProvider;
  /** Error message (only present on failure) */
  error?: string;
  /** Request metadata */
  metadata?: {
    requestId: string;
    timestamp: string;
    processingTimeMs: number;
  };
}

