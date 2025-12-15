import { NextRequest, NextResponse } from 'next/server';

const TARGET_URL = 'https://exodus.stockbit.com/login/v5/username';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Construct exact payload expected by Stockbit
    const payload = {
      user: body.username, // Map 'username' from frontend to 'user' for API
      password: body.password,
      player_id: body.player_id, // Use player_id from request body
    };

    const response = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        Host: 'exodus.stockbit.com',
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15',
        'X-Platform': 'desktop',
        Origin: 'tauri://localhost',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    const responseData = NextResponse.json(data);

    // Set cookie for Proxy/Middleware access
    if (data.data?.login?.token_data?.access?.token) {
      responseData.cookies.set({
        name: 'stockbit_token',
        value: data.data.login.token_data.access.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
    }

    return responseData;
  } catch (error) {
    console.error('Login Proxy Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
