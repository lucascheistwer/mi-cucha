/// <reference lib="webworker" />
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import { defaultCache } from "@serwist/next/worker";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

declare const _self: SerwistGlobalConfig;

const API_RESPONSE_CACHE = "apis";

function cachesSameOriginApiGets(entry: RuntimeCaching) {
  if (entry.method !== "GET") {
    return false;
  }

  const handler = entry.handler;

  return (
    typeof handler === "object" &&
    handler !== null &&
    "cacheName" in handler &&
    handler.cacheName === API_RESPONSE_CACHE
  );
}

// defaultCache stores same-origin GET /api/* for up to 24h. Auth stays
// NetworkOnly; this replaces only the "apis" NetworkFirst rule.
const runtimeCaching: RuntimeCaching[] = defaultCache.map((entry) => {
  if (!cachesSameOriginApiGets(entry)) {
    return entry;
  }

  return {
    ...entry,
    handler: new NetworkOnly(),
  };
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();
