"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login, register, isLoggedIn } from "@/lib/auth";
import { LucideLoader2, LucideZap, LucideEye, LucideEyeOff } from "lucide-react";

function LoginPageInner() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (isLoggedIn()) router.replace(redirectTo);
  }, [router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        if (!name.trim()) { setError("Please enter your name"); setLoading(false); return; }
        await register(name.trim(), email, password);
      } else {
        await login(email, password);
      }
      router.replace(redirectTo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#080810",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif", position: "relative", overflow: "hidden",
    }}>
      {/* Ambient orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", top: "-20%", left: "-15%", width: "55%", height: "65%",
          background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-20%", right: "-15%", width: "50%", height: "60%",
          background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />
      </div>

      <div style={{ width: "100%", maxWidth: "420px", padding: "24px", position: "relative", zIndex: 10 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{
            width: "48px", height: "48px", margin: "0 auto 16px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 30px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
            fontSize: "18px", fontWeight: "900", color: "white",
          }}>SF</div>
          <h1 style={{ color: "white", fontSize: "26px", fontWeight: "800", letterSpacing: "-0.8px", margin: "0 0 6px" }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "14px", margin: 0 }}>
            {mode === "login" ? "Sign in to SyncFlow to continue" : "Start collaborating in seconds"}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "20px", padding: "32px",
          backdropFilter: "blur(20px)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        }}>
          {/* Mode tabs */}
          <div style={{
            display: "flex", background: "rgba(255,255,255,0.05)",
            borderRadius: "10px", padding: "4px", marginBottom: "24px",
          }}>
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
                flex: 1, padding: "8px", borderRadius: "7px", border: "none",
                background: mode === m ? "rgba(99,102,241,0.25)" : "transparent",
                color: mode === m ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
                fontWeight: mode === m ? "600" : "400", fontSize: "13px",
                cursor: "pointer", outline: "none",
                boxShadow: mode === m ? "0 0 0 1px rgba(99,102,241,0.4)" : "none",
                transition: "all 0.2s ease",
              }}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: "6px", fontWeight: "500" }}>
                  Full Name
                </label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Alex Johnson" required
                  style={inputStyle}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = "rgba(99,102,241,0.6)"}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>
            )}

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: "6px", fontWeight: "500" }}>
                Email Address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                style={inputStyle}
                onFocus={e => (e.target as HTMLElement).style.borderColor = "rgba(99,102,241,0.6)"}
                onBlur={e => (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: "6px", fontWeight: "500" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "At least 8 characters" : "••••••••"} required
                  style={{ ...inputStyle, paddingRight: "44px" }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = "rgba(99,102,241,0.6)"}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.3)", padding: "4px",
                }}>
                  {showPw ? <LucideEyeOff style={{ width: "15px", height: "15px" }} /> : <LucideEye style={{ width: "15px", height: "15px" }} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: "10px 14px", marginBottom: "16px", borderRadius: "8px",
                background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)",
                fontSize: "13px", color: "rgba(244,63,94,0.9)",
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "12px", borderRadius: "10px", border: "none",
              background: loading ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white", fontSize: "14px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 0 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
              transition: "all 0.2s ease",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              {loading ? (
                <LucideLoader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
              ) : (
                <LucideZap style={{ width: "16px", height: "16px" }} />
              )}
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>
          By continuing, you agree to SyncFlow's Terms of Service.
        </p>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "9px",
  padding: "10px 14px", color: "rgba(255,255,255,0.85)",
  fontSize: "14px", outline: "none",
  transition: "border-color 0.2s ease",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
