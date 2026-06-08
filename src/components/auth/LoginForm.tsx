"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type AuthMode = "login" | "register";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, inviteCode }),
    });

    const data = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      setError(data?.error ?? "No pudimos iniciar sesion. Probá de nuevo.");
      return;
    }

    startTransition(() => {
      const nextPath = searchParams.get("next") || "/dashboard";
      router.replace(nextPath);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 rounded-2xl bg-stone-100 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError("");
            setInviteCode("");
          }}
          className={`rounded-[1rem] px-4 py-2 text-sm font-medium transition ${
            mode === "login"
              ? "bg-white text-stone-950 shadow-sm"
              : "text-stone-500 hover:text-stone-900"
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setError("");
          }}
          className={`rounded-[1rem] px-4 py-2 text-sm font-medium transition ${
            mode === "register"
              ? "bg-white text-stone-950 shadow-sm"
              : "text-stone-500 hover:text-stone-900"
          }`}
        >
          Crear cuenta
        </button>
      </div>

      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium text-stone-700">
          Usuario
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="ej: lucas"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
          disabled={isPending}
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-stone-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="mínimo 8 caracteres"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
          disabled={isPending}
          required
          minLength={8}
        />
      </div>

      {mode === "register" ? (
        <div className="space-y-2">
          <label htmlFor="inviteCode" className="text-sm font-medium text-stone-700">
            Código de invitación
          </label>
          <input
            id="inviteCode"
            name="inviteCode"
            autoCapitalize="characters"
            autoCorrect="off"
            placeholder="ABC123"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base uppercase tracking-[0.18em] text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
            disabled={isPending}
            maxLength={12}
          />
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? mode === "login"
            ? "Entrando..."
            : "Creando cuenta..."
          : mode === "login"
            ? "Entrar a mi cucha"
            : "Crear mi cuenta"}
      </button>
    </form>
  );
}