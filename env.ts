export const env = {
  port: Number.parseInt(process.env.PORT ?? "4000", 10),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  initialChips: Number.parseInt(process.env.INITIAL_CHIPS ?? "10000", 10)
};
