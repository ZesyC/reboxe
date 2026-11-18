import { ConsoleLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { AppModule } from "./app.module";

try {
  loadEnvFile(resolve(__dirname, "../../../.env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true })
  });
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" });
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("REBOXE API").setVersion("1.0").addBearerAuth().build()
  );
  SwaggerModule.setup("docs", app, document);

  await app.listen(Number(process.env.PORT ?? process.env.API_PORT ?? 3001));
}

void bootstrap();
