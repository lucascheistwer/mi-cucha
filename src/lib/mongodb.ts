// Ubicacion legacy: src/lib/mongodb.ts
// Mantiene compatibilidad con imports previos mientras la app migra a dbConnect.ts.
export { dbConnect as connectDB, dbConnect as default } from "./dbConnect";
