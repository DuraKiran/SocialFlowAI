'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Zap, AlertCircle } from 'lucide-react';
import { createUser, signIn } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';

export default function AuthPage() {
  const router = useRouter();
  const { signIn: setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doSignUp() {
    setError(null);
    if (!email.includes('@')) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (!name.trim()) return setError('Enter your name.');
    setBusy(true);
    try {
      await createUser(email.trim(), name.trim(), password);
      const session = await signIn(email.trim(), password);
      setSession(session);
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed.');
    } finally {
      setBusy(false);
    }
  }

  async function doSignIn() {
    setError(null);
    setBusy(true);
    try {
      const session = await signIn(email.trim(), password);
      setSession(session);
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/80 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <Zap className="h-6 w-6 text-cyan-400" />
          </div>
          <CardTitle className="text-2xl text-white">SocialFlow AI</CardTitle>
          <CardDescription>
            Publish once. Reach every platform. Track everything.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="si-email">Email</Label>
                <Input id="si-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="si-password">Password</Label>
                <Input id="si-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSignIn()} />
              </div>
              <Button className="w-full" onClick={doSignIn} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign In
              </Button>
            </TabsContent>
            <TabsContent value="signup" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="su-name">Name</Label>
                <Input id="su-name" placeholder="Alex Rivera" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-email">Email</Label>
                <Input id="su-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-password">Password</Label>
                <Input id="su-password" type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSignUp()} />
              </div>
              <Button className="w-full" onClick={doSignUp} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Account
              </Button>
            </TabsContent>
          </Tabs>
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
