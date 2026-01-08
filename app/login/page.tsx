'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, player_id: playerId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store in Zustand Store
      if (data.data?.login?.token_data?.access?.token) {
        useAuthStore
          .getState()
          .setAuth(
            data.data.login.token_data.access.token,
            data.data.login.user
          );

        // Use replace instead of push to prevent back-button returning to login
        // Small delay to ensure Zustand state is committed before navigation
        await new Promise((resolve) => setTimeout(resolve, 100));
        router.replace('/whalemology');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="border-border bg-card text-card-foreground w-full max-w-md">
        <CardHeader>
          <CardTitle className="bg-linear-to-r from-green-400 to-blue-500 bg-clip-text text-2xl font-bold text-transparent">
            Stockbit Login
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your username and password to access the Whalemology
            Dashboard.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border p-3 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username / Email</Label>
              <Input
                id="username"
                type="text"
                placeholder="Stockbit username"
                className="border-input bg-background/50 text-foreground placeholder:text-muted-foreground focus:border-primary"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="playerId">Player ID</Label>
              <Input
                id="playerId"
                type="text"
                placeholder="Enter player ID"
                className="border-input bg-background/50 text-foreground placeholder:text-muted-foreground focus:border-primary"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="border-input bg-background/50 text-foreground placeholder:text-muted-foreground focus:border-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full font-bold"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Login'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
