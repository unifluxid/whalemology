import { NextRequest, NextResponse } from 'next/server';

const STOCKBIT_API_BASE = 'https://exodus.stockbit.com';

export async function fetchStockbitProxy(
  endpoint: string,
  request: NextRequest,
  defaultParams?: Record<string, string>
) {
  // 1. Construct Target URL with merged params
  const searchParams = request.nextUrl.searchParams;

  // Apply defaults if not present
  if (defaultParams) {
    Object.entries(defaultParams).forEach(([key, value]) => {
      if (!searchParams.has(key)) {
        searchParams.set(key, value);
      }
    });
  }

  const queryString = searchParams.toString();
  const targetUrl = `${STOCKBIT_API_BASE}/${endpoint}${queryString ? `?${queryString}` : ''}`;

  try {
    // 2. Extract Token
    const authHeader = request.headers.get('Authorization');
    const token =
      authHeader?.replace('Bearer ', '') ||
      request.cookies.get('stockbit_token')?.value;

    // 3. Construct Headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15',
      'X-Platform': 'desktop',
      Origin: 'tauri://localhost',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 4. Forward Request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' ? request.body : undefined,
      // @ts-expect-error - duplex needed for streaming
      duplex: 'half',
    });

    // 5. Handle Errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Stockbit Proxy Failed [${targetUrl}]: ${response.status} - ${errorText}`
      );
      return NextResponse.json(
        { error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error(`Stockbit Proxy Error [${endpoint}]:`, error);
    return NextResponse.json(
      { error: 'Internal Proxy Error' },
      { status: 500 }
    );
  }
}
