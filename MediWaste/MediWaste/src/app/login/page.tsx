"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return <LoginInner />;
}

function LoginInner() {
  const router = useRouter();
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState("viewer");

  useEffect(() => {
    if (user && !loading) {
      router.push("/overview");
    }
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      // Persist the chosen demo role first so the session picks it up immediately.
      if (typeof window !== "undefined") {
        window.localStorage.setItem("medwasteUserRole", role);
      }
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      router.push("/overview");
    } catch (err: any) {
      setError(err?.message ?? "Authentication failed.");
    }
  }

  if (user && !loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 text-center">
            <ShieldCheck className="h-10 w-10 mx-auto text-medical-700" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">Already signed in</h2>
            <p className="mt-1 text-sm text-slate-500">{user.email}</p>
            <Button className="mt-4 w-full gap-1.5" onClick={() => router.push("/overview")}>
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-medical-50 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-medical-100 text-medical-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle className="mt-3 text-lg">MedWaste VerifyPoint</CardTitle>
            <CardDescription>Sign in to access the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.org"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  minLength={6}
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700 mb-2">Demo role (local only)</p>
                <div className="flex gap-2">
                  {(["viewer", "intake", "reviewer", "admin"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        role === r ? "bg-medical-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                      onClick={() => setRole(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  This sets the role for the current browser session only. In production, roles are managed in Firebase.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full gap-1.5" disabled={loading || !email || !password}>
                {loading ? "Signing in…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-4">
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-700"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
            </button>
          </CardFooter>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-500">
          For local development, once signed in you can change your role on the Settings page.
        </p>
      </div>
    </div>
  );
}
