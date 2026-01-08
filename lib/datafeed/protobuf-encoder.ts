/**
 * Protobuf message encoder for Stockbit WebSocket.
 *
 * Based on analysis of Stockbit's code, they use:
 * - WebsocketRequest: For sending messages (auth, channel subscription, ping)
 * - WebsocketWrapMessageChannel: For receiving messages
 *
 * This module provides low-level protobuf encoding without the @stockbitgroup/protos dependency.
 */

// Protobuf wire types
const WIRE_LENGTH_DELIMITED = 2;

/**
 * Encode a varint (variable-length integer)
 */
function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
  return new Uint8Array(bytes);
}

/**
 * Encode a field tag (field number + wire type)
 */
function encodeTag(fieldNumber: number, wireType: number): Uint8Array {
  return encodeVarint((fieldNumber << 3) | wireType);
}

/**
 * Encode a string as length-delimited bytes
 */
function encodeString(value: string): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const length = encodeVarint(bytes.length);
  const result = new Uint8Array(length.length + bytes.length);
  result.set(length, 0);
  result.set(bytes, length.length);
  return result;
}

/**
 * Encode a nested message as length-delimited bytes
 */
function encodeMessage(bytes: Uint8Array): Uint8Array {
  const length = encodeVarint(bytes.length);
  const result = new Uint8Array(length.length + bytes.length);
  result.set(length, 0);
  result.set(bytes, length.length);
  return result;
}

/**
 * Concatenate multiple Uint8Arrays
 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Encode a WebsocketRequest message for authentication.
 *
 * Based on actual Stockbit message captured:
 * Field 1: userId as STRING (e.g., "335832")
 * Field 3: key as STRING (the wsKey from API)
 *
 * Example hex: 0a 06 33 33 35 38 33 32 1a 2c ...
 */
export function encodeAuthRequest(key: string, userId: number): ArrayBuffer {
  const parts: Uint8Array[] = [];

  // Field 1: userId as STRING (not int!)
  if (userId) {
    parts.push(encodeTag(1, WIRE_LENGTH_DELIMITED));
    parts.push(encodeString(String(userId)));
  }

  // Field 3: key (string) - note: field 3, not field 2!
  if (key) {
    parts.push(encodeTag(3, WIRE_LENGTH_DELIMITED));
    parts.push(encodeString(key));
  }

  const result = concat(...parts);
  return result.buffer.slice(
    result.byteOffset,
    result.byteOffset + result.byteLength
  ) as ArrayBuffer;
}

/**
 * Encode a ping message for heartbeat.
 *
 * Based on Stockbit's code:
 * ```
 * const buffer = new WebsocketRequest({
 *   ping: { message: 'ping' },
 * }).toBinary();
 * ```
 */
export function encodePingRequest(): ArrayBuffer {
  // Nested ping message with message field
  const pingMessageField = concat(
    encodeTag(1, WIRE_LENGTH_DELIMITED),
    encodeString('ping')
  );

  // Field 4: ping (message)
  const pingField = concat(
    encodeTag(4, WIRE_LENGTH_DELIMITED),
    encodeMessage(pingMessageField)
  );

  return pingField.buffer.slice(
    pingField.byteOffset,
    pingField.byteOffset + pingField.byteLength
  ) as ArrayBuffer;
}

/**
 * Channel subscription request.
 *
 * The channel object contains arrays of symbols to subscribe to:
 * - liveprice: string[]
 * - orderBook: string[]
 * - runningTradeBatch: string[] (symbols like 'BBCA', or '*' for all)
 * - marketMover: object[]
 */
export interface DatafeedChannel {
  liveprice?: string[];
  orderBook?: string[];
  runningTradeBatch?: string[];
  marketMover?: Array<{ moverType?: string; filterStocks?: string[] }>;
  isHotlist?: boolean;
}

/**
 * Encode a string array field
 */
function encodeStringArray(fieldNumber: number, values: string[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const value of values) {
    parts.push(encodeTag(fieldNumber, WIRE_LENGTH_DELIMITED));
    parts.push(encodeString(value));
  }
  return concat(...parts);
}

/**
 * Encode a channel subscription request.
 *
 * Based on actual Stockbit message captured:
 * Field 1: userId as STRING
 * Field 2: channel (nested message):
 *   - Field 5 (0x2a): liveprice/orderbook symbols
 *   - Field 6 (0x32): runningTrade symbols
 * Field 3: wsKey
 */
export function encodeChannelRequest(
  key: string,
  userId: number,
  channel: DatafeedChannel
): ArrayBuffer {
  const parts: Uint8Array[] = [];

  // Field 1: userId as STRING
  if (userId) {
    parts.push(encodeTag(1, WIRE_LENGTH_DELIMITED));
    parts.push(encodeString(String(userId)));
  }

  // Field 2: channel (nested message)
  const channelParts: Uint8Array[] = [];

  // Field 5 (0x2a) in channel: liveprice/orderbook symbols
  if (channel.liveprice && channel.liveprice.length > 0) {
    channelParts.push(encodeStringArray(5, channel.liveprice));
  }
  if (channel.orderBook && channel.orderBook.length > 0) {
    channelParts.push(encodeStringArray(5, channel.orderBook));
  }

  // Field 6 (0x32) in channel: runningTradeBatch symbols
  if (channel.runningTradeBatch && channel.runningTradeBatch.length > 0) {
    channelParts.push(encodeStringArray(6, channel.runningTradeBatch));
  }

  if (channelParts.length > 0) {
    const channelMessage = concat(...channelParts);
    parts.push(encodeTag(2, WIRE_LENGTH_DELIMITED));
    parts.push(encodeMessage(channelMessage));
  }

  // Field 3: key (wsKey)
  if (key) {
    parts.push(encodeTag(3, WIRE_LENGTH_DELIMITED));
    parts.push(encodeString(key));
  }

  const result = concat(...parts);
  return result.buffer.slice(
    result.byteOffset,
    result.byteOffset + result.byteLength
  ) as ArrayBuffer;
}
