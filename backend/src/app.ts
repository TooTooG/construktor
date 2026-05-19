import { buildApp } from "./create-app.js";

const app = buildApp();
const appReady = app.ready();

app.server.on("request", async (_request, _response) => {
  await appReady;
});

export default app.server;
