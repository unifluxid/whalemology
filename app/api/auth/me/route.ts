import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('stockbit_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // 1. Validate Token by fetching user registration status (reliable endpoint)
    const response = await fetch(
      'https://api-sekuritas.stockbit.com/v2/registration/check',
      {
        headers: {
          Host: 'api-sekuritas.stockbit.com',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json, text/plain, */*',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15',
          'X-Platform': 'desktop',
          Origin: 'tauri://localhost',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Auth /me failed validation: ${response.status} - ${errorText}`
      );
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const userData = await response.json();
    let username = 'Stockbit User';

    // Extract username from API response
    if (userData?.data?.user?.username) {
      username = userData.data.user.username;
    }

    // 2. Return Success
    return NextResponse.json({
      token: token,
      user: { username, email: '' }, // Minimal user object
    });
  } catch (error) {
    console.error('Auth /me Error:', error);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}
