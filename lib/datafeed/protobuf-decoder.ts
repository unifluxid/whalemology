/**
 * Protobuf decoder for Stockbit WebSocket messages.
 *
 * This uses raw protobuf wire format decoding since we don't have the .proto schema.
 * The decoder attempts to parse the binary data and extract running trade information.
 */

// Wire types in protobuf
const WIRE_TYPE_VARINT = 0;
const WIRE_TYPE_64BIT = 1;
const WIRE_TYPE_LENGTH_DELIMITED = 2;
const WIRE_TYPE_32BIT = 5;

export interface DecodedRunningTrade {
  stock?: string;
  price?: number;
  volume?: number;
  action?: string;
  marketBoard?: string;
  tradeNumber?: string;
  time?: { seconds: number; nanos: number };
  change?: { value: number; percentage: number };
  buyer?: string;
  seller?: string;
  rawFields?: Record<number, unknown>;
}

export interface DecodedMessage {
  type?: string;
  runningTradeBatch?: {
    batch: DecodedRunningTrade[];
  };
  rawFields?: Record<number, unknown>;
}

/**
 * Simple protobuf reader class
 */
class ProtobufReader {
  private buffer: Uint8Array;
  private pos: number = 0;

  constructor(buffer: ArrayBuffer | Uint8Array) {
    this.buffer =
      buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  }

  get eof(): boolean {
    return this.pos >= this.buffer.length;
  }

  readVarint(): number {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      if (this.pos >= this.buffer.length) {
        throw new Error('Unexpected end of buffer reading varint');
      }
      byte = this.buffer[this.pos++];
      result |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);

    return result >>> 0; // Convert to unsigned
  }

  readFixed64(): bigint {
    if (this.pos + 8 > this.buffer.length) {
      throw new Error('Unexpected end of buffer reading fixed64');
    }
    const view = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset + this.pos,
      8
    );
    this.pos += 8;
    return view.getBigUint64(0, true); // Little endian
  }

  readFixed32(): number {
    if (this.pos + 4 > this.buffer.length) {
      throw new Error('Unexpected end of buffer reading fixed32');
    }
    const view = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset + this.pos,
      4
    );
    this.pos += 4;
    return view.getUint32(0, true); // Little endian
  }

  readDouble(): number {
    if (this.pos + 8 > this.buffer.length) {
      throw new Error('Unexpected end of buffer reading double');
    }
    const view = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset + this.pos,
      8
    );
    this.pos += 8;
    return view.getFloat64(0, true); // Little endian
  }

  readFloat(): number {
    if (this.pos + 4 > this.buffer.length) {
      throw new Error('Unexpected end of buffer reading float');
    }
    const view = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset + this.pos,
      4
    );
    this.pos += 4;
    return view.getFloat32(0, true); // Little endian
  }

  readBytes(length: number): Uint8Array {
    if (this.pos + length > this.buffer.length) {
      throw new Error('Unexpected end of buffer reading bytes');
    }
    const bytes = this.buffer.slice(this.pos, this.pos + length);
    this.pos += length;
    return bytes;
  }

  readString(length: number): string {
    const bytes = this.readBytes(length);
    return new TextDecoder().decode(bytes);
  }

  skip(wireType: number): void {
    switch (wireType) {
      case WIRE_TYPE_VARINT:
        this.readVarint();
        break;
      case WIRE_TYPE_64BIT:
        this.pos += 8;
        break;
      case WIRE_TYPE_LENGTH_DELIMITED:
        const length = this.readVarint();
        this.pos += length;
        break;
      case WIRE_TYPE_32BIT:
        this.pos += 4;
        break;
      default:
        throw new Error(`Unknown wire type: ${wireType}`);
    }
  }
}

/**
 * Parse protobuf fields from binary data
 */
function parseProtobufFields(buffer: Uint8Array): Record<number, unknown[]> {
  const reader = new ProtobufReader(buffer);
  const fields: Record<number, unknown[]> = {};

  while (!reader.eof) {
    try {
      const tag = reader.readVarint();
      const fieldNumber = tag >>> 3;
      const wireType = tag & 0x07;

      if (!fields[fieldNumber]) {
        fields[fieldNumber] = [];
      }

      switch (wireType) {
        case WIRE_TYPE_VARINT:
          fields[fieldNumber].push(reader.readVarint());
          break;
        case WIRE_TYPE_64BIT:
          fields[fieldNumber].push(reader.readDouble());
          break;
        case WIRE_TYPE_LENGTH_DELIMITED:
          const length = reader.readVarint();
          const bytes = reader.readBytes(length);
          // Try to decode as string, if fails keep as bytes
          try {
            const str = new TextDecoder().decode(bytes);
            // Check if it looks like a valid string (printable ASCII or UTF-8)
            if (/^[\x20-\x7E\u0080-\uFFFF]*$/.test(str)) {
              fields[fieldNumber].push(str);
            } else {
              // Try to recursively parse as nested message
              try {
                const nested = parseProtobufFields(bytes);
                fields[fieldNumber].push(nested);
              } catch {
                fields[fieldNumber].push(bytes);
              }
            }
          } catch {
            fields[fieldNumber].push(bytes);
          }
          break;
        case WIRE_TYPE_32BIT:
          fields[fieldNumber].push(reader.readFloat());
          break;
        default:
          console.warn(
            `Unknown wire type ${wireType} for field ${fieldNumber}`
          );
          return fields; // Stop parsing on unknown wire type
      }
    } catch (e) {
      console.warn('Error parsing protobuf:', e);
      break;
    }
  }

  return fields;
}

/**
 * Try to decode a running trade item from parsed protobuf fields
 *
 * Based on captured message analysis:
 * Field 1 (0x0a): stock symbol (string) e.g., "INET"
 * Field 2 (0x11): price (double/fixed64)
 * Field 3 (0x19): some double value
 * Field 4 (0x21): some double value
 * Field 5 (0x29): open price? (double)
 * Field 6 (0x31): some double
 * Field 7 (0x39): some double
 * Field 10 (0x51): close/last price? (double)
 * Field 11 (0x5a): timestamp string
 * Field 12 (0x61): some double
 * Field 13 (0x69): some double
 * Field 14 (0x71): some double
 * Field 15 (0x7a): nested change message
 * Field 16 (0x82): action/board type
 * Field 17 (0x88): some int (action?)
 * Field 19 (0x98): some int
 * Field 20 (0xa0): some int
 * Field 21 (0xa8): some int
 * Field 22 (0xb0): timestamp seconds
 * Field 23 (0xb8): boolean
 * Field 26 (0xd2): timestamp string
 */
function decodeRunningTradeItem(
  fields: Record<number, unknown[]>
): DecodedRunningTrade {
  const trade: DecodedRunningTrade = { rawFields: {} };

  for (const [fieldNum, values] of Object.entries(fields)) {
    const num = parseInt(fieldNum);
    const value = values[0];

    // Store raw fields for debugging
    if (trade.rawFields) {
      trade.rawFields[num] = value;
    }

    switch (num) {
      case 1:
        // Field 1: Nested timestamp object {1: seconds, 2: nanos}
        if (
          typeof value === 'object' &&
          value !== null &&
          !(value instanceof Uint8Array)
        ) {
          const nested = value as Record<number, unknown[]>;
          if (nested[1] && typeof nested[1][0] === 'number') {
            trade.time = {
              seconds: nested[1][0] as number,
              nanos:
                nested[2] && typeof nested[2][0] === 'number'
                  ? (nested[2][0] as number)
                  : 0,
            };
          }
        }
        break;
      case 2:
        // Field 2: Stock symbol (string)
        if (typeof value === 'string') {
          trade.stock = value;
        }
        break;
      case 3:
        // Field 3: Price (number)
        if (typeof value === 'number') {
          trade.price = value;
        }
        break;
      case 4:
        // Field 4: Volume (number)
        if (typeof value === 'number') {
          trade.volume = value;
        }
        break;
      case 5:
        // Field 5: Action (1=BUY, 2=SELL)
        if (typeof value === 'number') {
          trade.action = value === 1 ? 'BUY' : 'SELL';
        }
        break;
      case 6:
        // Field 6: Market board (1=RG)
        if (typeof value === 'number') {
          trade.marketBoard = value === 1 ? 'RG' : 'TN';
        }
        break;
      case 8:
        // Field 8: Change message {1: value, 2: percentage}
        if (
          typeof value === 'object' &&
          value !== null &&
          !(value instanceof Uint8Array)
        ) {
          const nested = value as Record<number, unknown[]>;
          if (nested[1] && typeof nested[1][0] === 'number') {
            trade.change = {
              value: nested[1][0] as number,
              percentage:
                nested[2] && typeof nested[2][0] === 'number'
                  ? (nested[2][0] as number)
                  : 0,
            };
          }
        }
        break;
      case 9:
        // Field 9: Trade number
        if (typeof value === 'number') {
          trade.tradeNumber = String(value);
        }
        break;
      case 11:
        // Timestamp string
        if (typeof value === 'string') {
          // Parse ISO timestamp
          try {
            const date = new Date(value);
            trade.time = {
              seconds: Math.floor(date.getTime() / 1000),
              nanos: 0,
            };
          } catch {
            // Ignore parse errors
          }
        }
        break;
      case 15:
        // Change message (nested)
        if (
          typeof value === 'object' &&
          value !== null &&
          !(value instanceof Uint8Array)
        ) {
          const nested = value as Record<number, unknown[]>;
          // Field 1 in change = value, Field 2 = percentage
          if (nested[1] && typeof nested[1][0] === 'number') {
            trade.change = {
              value: nested[1][0] as number,
              percentage:
                nested[2] && typeof nested[2][0] === 'number'
                  ? (nested[2][0] as number)
                  : 0,
            };
          }
        }
        break;
      case 16:
        // Market board or action (nested message with string)
        if (
          typeof value === 'object' &&
          value !== null &&
          !(value instanceof Uint8Array)
        ) {
          const nested = value as Record<number, unknown[]>;
          if (nested[1] && typeof nested[1][0] === 'string') {
            const actionStr = nested[1][0] as string;
            if (actionStr === 'B' || actionStr === 'BUY') {
              trade.action = 'BUY';
            } else if (actionStr === 'S' || actionStr === 'SELL') {
              trade.action = 'SELL';
            } else {
              trade.marketBoard = actionStr;
            }
          }
        } else if (typeof value === 'string') {
          if (value === 'B' || value === 'BUY') {
            trade.action = 'BUY';
          } else if (value === 'S' || value === 'SELL') {
            trade.action = 'SELL';
          } else {
            trade.marketBoard = value;
          }
        }
        break;
      case 17:
        // Volume (e.g., 200, 100, 1000)
        if (typeof value === 'number') {
          trade.volume = value;
        }
        break;
      case 19:
        // Trade number (e.g., 11268048)
        if (typeof value === 'number') {
          trade.tradeNumber = String(value);
        }
        break;
      case 22:
        // Timestamp seconds
        if (typeof value === 'number') {
          trade.time = { seconds: value, nanos: 0 };
        }
        break;
    }
  }

  return trade;
}

/**
 * Decode a WebSocket binary message from Stockbit
 */
export function decodeWebSocketMessage(
  data: ArrayBuffer
): DecodedMessage | null {
  try {
    const buffer = new Uint8Array(data);
    const fields = parseProtobufFields(buffer);

    // console.log(
    //   '[Protobuf] Parsed fields:',
    //   JSON.stringify(
    //     fields,
    //     (_, v) => (v instanceof Uint8Array ? `<bytes:${v.length}>` : v),
    //     2
    //   )
    // );

    const message: DecodedMessage = { rawFields: fields };

    // Running trade batch is in field 8 with nested field 1 containing trades
    // Structure: field 8 -> object with field 1 -> array of trade items
    if (fields[8]) {
      const field8Items = fields[8];
      const trades: DecodedRunningTrade[] = [];

      for (const item of field8Items) {
        if (
          typeof item === 'object' &&
          item !== null &&
          !(item instanceof Uint8Array)
        ) {
          const field8Obj = item as Record<number, unknown[]>;
          // Trade items are in nested field 1
          if (field8Obj[1] && Array.isArray(field8Obj[1])) {
            for (const tradeItem of field8Obj[1]) {
              if (
                typeof tradeItem === 'object' &&
                tradeItem !== null &&
                !(tradeItem instanceof Uint8Array)
              ) {
                const trade = decodeRunningTradeItem(
                  tradeItem as Record<number, unknown[]>
                );
                if (trade.stock || trade.price) {
                  trades.push(trade);
                }
              }
            }
          }
        }
      }

      if (trades.length > 0) {
        message.runningTradeBatch = { batch: trades };
      }
    }

    // Also check field 9 as fallback (older format)
    if (!message.runningTradeBatch && fields[9]) {
      const batchItems = fields[9];
      const trades: DecodedRunningTrade[] = [];

      for (const item of batchItems) {
        if (typeof item === 'object' && !(item instanceof Uint8Array)) {
          const trade = decodeRunningTradeItem(
            item as Record<number, unknown[]>
          );
          if (trade.stock || trade.price) {
            trades.push(trade);
          }
        }
      }

      if (trades.length > 0) {
        message.runningTradeBatch = { batch: trades };
      }
    }

    return message;
  } catch (error) {
    console.error('[Protobuf] Failed to decode message:', error);
    return null;
  }
}

/**
 * Decode base64-encoded protobuf message (for testing)
 */
export function decodeBase64Message(base64: string): DecodedMessage | null {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return decodeWebSocketMessage(bytes.buffer);
}
