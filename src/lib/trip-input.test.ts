import assert from "node:assert/strict";
import test from "node:test";

import { parseTripWriteInput, resolveTripCities } from "./trip-input.ts";

const validBody = {
  nombre: "  Europa  ",
  descripcion: "  con amigos  ",
  fechaInicio: "2026-05-01",
  fechaFin: "2026-05-10",
  ciudades: [" Roma ", "Roma", "París"],
};

test("parseTripWriteInput trims fields and drops duplicate cities", () => {
  const result = parseTripWriteInput(validBody);

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.nombre, "Europa");
  assert.equal(result.value.descripcion, "con amigos");
  assert.deepEqual(result.value.ciudades, ["Roma", "París"]);
  assert.equal(result.value.fechaInicio.toISOString().slice(0, 10), "2026-05-01");
  assert.equal(result.value.fechaFin.toISOString().slice(0, 10), "2026-05-10");
});

test("parseTripWriteInput rejects an end date before the start date", () => {
  const result = parseTripWriteInput({
    ...validBody,
    fechaInicio: "2026-05-10",
    fechaFin: "2026-05-01",
  });

  assert.deepEqual(result, {
    ok: false,
    error: "La fecha de inicio no puede ser posterior a la de fin.",
  });
});

test("parseTripWriteInput rejects invalid dates and empty cities", () => {
  assert.equal(parseTripWriteInput({ ...validBody, fechaFin: "2026-02-31" }).ok, false);
  assert.equal(parseTripWriteInput({ ...validBody, ciudades: [] }).ok, false);
  assert.equal(parseTripWriteInput({ ...validBody, ciudades: [" A "] }).ok, false);
  assert.equal(parseTripWriteInput({ ...validBody, nombre: " " }).ok, false);
});

test("resolveTripCities keeps a stored city label when an expense still uses it", () => {
  const result = resolveTripCities([" Roma "], ["Roma"], [" Roma "]);

  assert.deepEqual(result, { ok: true, ciudades: [" Roma "] });
});

test("resolveTripCities allows a whitespace cleanup when no expense uses the city", () => {
  const result = resolveTripCities([" Roma "], ["Roma"], []);

  assert.deepEqual(result, { ok: true, ciudades: ["Roma"] });
});

test("resolveTripCities blocks removing a city that expenses reference", () => {
  const result = resolveTripCities(["Roma", "París"], ["Roma"], ["París"]);

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error, /París/);
  assert.match(result.error, /conservan la ciudad original/);
});

test("resolveTripCities adds a city and preserves order of the ones that stay", () => {
  const result = resolveTripCities(["Roma", "París"], ["París", "Roma", "Lyon"], ["Roma"]);

  assert.deepEqual(result, { ok: true, ciudades: ["París", "Roma", "Lyon"] });
});
