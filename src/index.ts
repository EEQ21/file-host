import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { initDb, purgeExpiredFiles } from "./db.js";
import { createStorage } from "./storage/index.js";
import { registerApiRoutes } from "./routes/api.js";
import { registerDownloadRoutes } from "./routes/download.js";
import { registerPreviewRoutes } from "./routes/preview.js";
import { registerPageRoutes } from "./routes/pages.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

const storage = createStorage();

async function runExpirationSweep(): Promise<void> {
  const ids = purgeExpiredFiles();
  for (const id of ids) {
    await storage.delete(id).catch(() => {});
  }
}

const app = Fastify({
  logger: true,
  bodyLimit: config.maxFileSize + 1024 * 64,
  trustProxy: true,
});

await app.register(fastifyHelmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'"],
      mediaSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

await app.register(fastifyRateLimit, {
  global: true,
  max: 300,
  timeWindow: "1 minute",
});

await app.register(fastifyMultipart, {
  limits: {
    files: 1,
    fileSize: config.maxFileSize,
  },
});

await app.register(fastifyStatic, {
  root: publicDir,
  prefix: "/",
  decorateReply: false,
  index: false,
});

initDb();
await runExpirationSweep();
setInterval(() => {
  runExpirationSweep().catch((err) => app.log.error(err));
}, 60 * 60 * 1000);

await registerApiRoutes(app, storage);
await registerDownloadRoutes(app, storage);
await registerPreviewRoutes(app, storage);
await registerPageRoutes(app);

app.setNotFoundHandler((_req, reply) => {
  return reply.status(404).type("text/html").send(`<!DOCTYPE html><html><body><h1>Not found</h1><a href="/">Home</a></body></html>`);
});

app.setErrorHandler((err, request, reply) => {
  request.log.error(err);
  if (!reply.sent) {
    reply.status(500).send({
      error: "server_error",
      message: "Something went wrong.",
    });
  }
});

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`Fike listening on ${config.appUrl} (port ${config.port})`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
