import app from "./app";
import { logger } from "./lib/logger";

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn('DATABASE_URL not set — skipping Stripe init');
    return;
  }

  try {
    const { runMigrations } = await import('stripe-replit-sync');
    logger.info('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    logger.info('Stripe schema ready');

    const { getStripeSync } = await import('./stripeClient');
    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info('Stripe webhook configured');

    stripeSync.syncBackfill()
      .then(() => logger.info('Stripe data synced'))
      .catch((err: any) => logger.error({ err }, 'Error syncing Stripe data'));
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to initialize Stripe (non-fatal)');
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
