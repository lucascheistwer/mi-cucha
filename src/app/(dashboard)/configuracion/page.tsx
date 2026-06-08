import { ConfigScreen } from "@/components/expenses/ConfigScreen";

export default function ConfigurationPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.18),_transparent_35%),linear-gradient(180deg,_#fffaf3_0%,_#f4ecdf_100%)] px-4 py-5 text-stone-900">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-8">
        <ConfigScreen />
      </div>
    </main>
  );
}