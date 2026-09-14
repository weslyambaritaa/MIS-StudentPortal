import { app } from "./app";
import { env } from "./config/env";
import { connectRedisIfEnabled } from "./cache/redis";

async function bootstrap() {
  await connectRedisIfEnabled();
  app.listen(env.port, "0.0.0.0", () => {
    console.log(`api-gateway running on :${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
