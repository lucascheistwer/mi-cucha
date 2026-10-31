import path from "node:path";
import { pathToFileURL } from "node:url";

const srcUrl = pathToFileURL(`${path.resolve(import.meta.dirname, "../src")}/`);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(new URL(`${specifier.slice(2)}.ts`, srcUrl).href, context);
  }

  return nextResolve(specifier, context);
}
