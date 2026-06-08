"use client";
import { useEffect } from "react";
import type { Serwist } from "@serwist/window";

declare global {
  interface Window {
    serwist: Serwist;
  }
}

export default function RegisterPWA() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.serwist !== undefined) {
      window.serwist.register();
    }
  }, []);

  return null;
}
