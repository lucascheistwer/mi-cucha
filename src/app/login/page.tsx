import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.16),_transparent_35%),linear-gradient(180deg,_#fffaf2_0%,_#f8efe4_100%)] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-center">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(28,25,23,0.14)] backdrop-blur">
          <div className="mb-6 space-y-3">
            <span className="inline-flex rounded-full bg-teal-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-stone-50">
              Mi Cucha
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-stone-950">
              Entrá o creá tu cuenta
            </h1>
          </div>

          <Suspense fallback={<div className="h-48 animate-pulse rounded-3xl bg-stone-100" />}>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}