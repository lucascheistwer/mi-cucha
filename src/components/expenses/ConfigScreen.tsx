"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { withUpdatedDashboardSummary } from "@/lib/dashboard-summary";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_VALUES,
  type ExpenseCategoryValue,
} from "@/lib/expense-categories";
import type { ExpensesDashboardPayload, HouseholdSummary } from "@/types/expense";

type LoadState = {
  payload: ExpensesDashboardPayload | null;
  error: string;
  isLoading: boolean;
};

type SessionUser = {
  username: string;
  nombre: string;
};

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function AccountSection({
  sessionUser,
  isLoggingOut,
  logoutError,
  onLogout,
}: {
  sessionUser: SessionUser | null;
  isLoggingOut: boolean;
  logoutError: string;
  onLogout: () => void;
}) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
      <h2 className="text-xl font-semibold tracking-tight text-stone-950">
        <span aria-hidden="true">👤 </span>
        Cuenta
      </h2>

      {sessionUser ? (
        <p className="mt-3 text-sm text-stone-600">
          Sesión de{" "}
          <span className="font-semibold text-stone-950">{sessionUser.nombre}</span>
          <span className="text-stone-500"> @{sessionUser.username}</span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-stone-600">Sesión actual de esta cucha.</p>
      )}

      {logoutError ? (
        <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{logoutError}</p>
      ) : null}

      <button
        type="button"
        onClick={onLogout}
        disabled={isLoggingOut}
        className="mt-4 flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
      </button>
    </section>
  );
}

export function ConfigScreen() {
  const [state, setState] = useState<LoadState>({
    payload: null,
    error: "",
    isLoading: true,
  });
  const [householdName, setHouseholdName] = useState("");
  const [user1Percentage, setUser1Percentage] = useState(50);
  const [enabledCategories, setEnabledCategories] = useState<ExpenseCategoryValue[]>([
    ...EXPENSE_CATEGORY_VALUES,
  ]);
  const [saveError, setSaveError] = useState("");
  const [saveFeedback, setSaveFeedback] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [isSaving, startSavingTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      const response = await fetch("/api/expenses", { cache: "no-store" });
      const data = await parseJson<ExpensesDashboardPayload & { error?: string }>(response);

      if (!isMounted) {
        return;
      }

      if (!response.ok || !data) {
        setState({
          payload: null,
          error: data?.error ?? "No pudimos cargar la configuración de la cucha.",
          isLoading: false,
        });
        return;
      }

      setState({ payload: data, error: "", isLoading: false });
      setHouseholdName(data.household.nombre);
      setUser1Percentage(data.household.porcentajesDefecto.user1);
      setEnabledCategories(data.household.categoriasHabilitadas);
    }

    async function loadSession() {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await parseJson<{
        user?: { username?: string; nombre?: string } | null;
      }>(response);

      if (!isMounted || !response.ok || !data?.user?.username) {
        return;
      }

      setSessionUser({
        username: data.user.username,
        nombre: data.user.nombre?.trim() || data.user.username,
      });
    }

    void loadSettings();
    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const canConfigureSplit = (state.payload?.users.length ?? 0) === 2;
  const firstUser = state.payload?.users[0] ?? null;
  const secondUser = state.payload?.users[1] ?? null;
  const secondUserPercentage = Number((100 - user1Percentage).toFixed(2));
  const enabledCategoryCount = enabledCategories.length;
  const enabledCategorySet = useMemo(
    () => new Set<string>(enabledCategories),
    [enabledCategories]
  );

  async function handleSaveSettings() {
    if (!state.payload) {
      return;
    }

    setSaveError("");
    setSaveFeedback("");

    startSavingTransition(async () => {
      const response = await fetch("/api/household/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: householdName,
          enabledCategories,
          ...(canConfigureSplit ? { user1Percentage } : {}),
        }),
      });
      const data = await parseJson<{
        error?: string;
        household?: HouseholdSummary;
      }>(response);

      if (!response.ok || !data?.household) {
        setSaveError(data?.error ?? "No pudimos guardar la configuración.");
        return;
      }

      const updatedHousehold = data.household;

      setState((currentState) => {
        if (!currentState.payload) {
          return currentState;
        }

        return {
          ...currentState,
          payload: withUpdatedDashboardSummary({
            ...currentState.payload,
            household: updatedHousehold,
          }),
        };
      });
      setSaveFeedback("Configuración guardada.");
    });
  }

  function handleToggleCategory(value: ExpenseCategoryValue) {
    setSaveError("");
    setSaveFeedback("");

    setEnabledCategories((currentCategories) => {
      if (currentCategories.includes(value)) {
        if (currentCategories.length === 1) {
          setSaveError("Dejá al menos una categoría habilitada para cargar gastos.");
          return currentCategories;
        }

        return currentCategories.filter((category) => category !== value);
      }

      return [...currentCategories, value];
    });
  }

  function handleRestoreCategories() {
    setSaveError("");
    setSaveFeedback("");
    setEnabledCategories([...EXPENSE_CATEGORY_VALUES]);
  }

  async function handleCopyInviteCode() {
    if (!state.payload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.payload.household.inviteCode);
      setCopyFeedback("Código copiado. Ya lo podés compartir.");
    } catch {
      setCopyFeedback(
        `Copialo manualmente: ${state.payload.household.inviteCode}`
      );
    }
  }

  async function handleLogout() {
    setLogoutError("");
    setIsLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        setLogoutError("No pudimos cerrar la sesión.");
        setIsLoggingOut(false);
        return;
      }

      window.location.assign("/login");
    } catch {
      setLogoutError("No pudimos cerrar la sesión.");
      setIsLoggingOut(false);
    }
  }

  if (state.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-48 animate-pulse rounded-[2rem] bg-white/70" />
        <div className="h-64 animate-pulse rounded-[2rem] bg-white/60" />
      </div>
    );
  }

  if (state.error || !state.payload) {
    return (
      <div className="space-y-4">
        <section className="rounded-[2rem] border border-rose-200 bg-rose-50 px-5 py-6 text-rose-800">
          <h1 className="text-lg font-semibold">No pudimos abrir la configuración.</h1>
          <p className="mt-2 text-sm leading-6">{state.error || "Intentá recargar la página."}</p>
        </section>
        <AccountSection
          sessionUser={sessionUser}
          isLoggingOut={isLoggingOut}
          logoutError={logoutError}
          onLogout={() => {
            void handleLogout();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
          Configuración
        </h1>
      </section>

      <AccountSection
        sessionUser={sessionUser}
        isLoggingOut={isLoggingOut}
        logoutError={logoutError}
        onLogout={() => {
          void handleLogout();
        }}
      />

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">
            <span aria-hidden="true">🏠 </span>
            Cucha
          </h2>

          <button
            type="button"
            onClick={handleCopyInviteCode}
            className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
          >
            Copiar código
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="householdName" className="text-sm font-medium text-stone-700">
              Nombre de la cucha
            </label>
            <input
              id="householdName"
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              maxLength={80}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
              disabled={isSaving}
            />
          </div>

          <div className="rounded-[1.4rem] bg-stone-100 px-4 py-4">
            <p className="text-2xl font-semibold tracking-[0.18em] text-stone-950">
              {state.payload.household.inviteCode}
            </p>
            {copyFeedback ? (
              <p className="mt-3 text-sm text-teal-800">{copyFeedback}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <h2 className="text-xl font-semibold tracking-tight text-stone-950">
          <span aria-hidden="true">⚖️ </span>
          Split
        </h2>

        {canConfigureSplit && firstUser && secondUser ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-[1.4rem] bg-stone-100 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{firstUser.nombre}</p>
                </div>
                <strong className="text-2xl font-semibold text-stone-950">{user1Percentage}%</strong>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={user1Percentage}
                onChange={(event) => setUser1Percentage(Number(event.target.value))}
                className="mt-4 h-2 w-full accent-teal-600"
                disabled={isSaving}
              />

              <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="rounded-[1.4rem] bg-stone-100 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{secondUser.nombre}</p>
                </div>
                <strong className="text-2xl font-semibold text-stone-950">{secondUserPercentage}%</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[1.4rem] bg-stone-100 px-4 py-4 text-sm text-stone-600">
            Disponible con 2 personas.
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">
            <span aria-hidden="true">🏷️ </span>
            Categorías
          </h2>

          <button
            type="button"
            onClick={handleRestoreCategories}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
          >
            Restaurar
          </button>
        </div>

        <p className="mt-3 text-sm text-stone-600">
          {enabledCategoryCount} de {EXPENSE_CATEGORIES.length}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EXPENSE_CATEGORIES.map((category) => {
            const isEnabled = enabledCategorySet.has(category.value);

            return (
              <button
                key={category.value}
                type="button"
                onClick={() => handleToggleCategory(category.value)}
                className={`rounded-[1.2rem] border px-3 py-3 text-left text-sm font-medium transition ${
                  isEnabled
                    ? "border-teal-300 bg-teal-50 text-teal-900"
                    : "border-stone-200 bg-stone-50 text-stone-500"
                }`}
                aria-pressed={isEnabled}
                disabled={isSaving}
              >
                <span className="block">{category.icon} {category.label}</span>
                <span className="mt-1 block text-[11px] uppercase tracking-[0.16em]">
                  {isEnabled ? "activa" : "oculta"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {saveError ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</p>
      ) : null}

      {saveFeedback ? (
        <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-800">{saveFeedback}</p>
      ) : null}

      <button
        type="button"
        onClick={handleSaveSettings}
        disabled={isSaving}
        className="flex w-full items-center justify-center rounded-2xl bg-stone-950 px-4 py-3 text-base font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Guardando..." : "Guardar configuración"}
      </button>
    </div>
  );
}
