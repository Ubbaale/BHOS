import { getUncachableStripeClient } from './stripeClient';

const BHOS_PLANS = [
  {
    name: 'BHOS Starter',
    description: 'Essential behavioral health home management. Medication safety, eMAR, patient management, and compliance tools.',
    metadata: { tier: 'starter', homes: 'unlimited', features: 'core' },
    monthlyPrice: 19900,
    yearlyPrice: 199000,
  },
  {
    name: 'BHOS Professional',
    description: 'Advanced clinical tools with treatment plans, progress notes, admissions CRM, census & bed board, and billing.',
    metadata: { tier: 'professional', homes: 'unlimited', features: 'advanced' },
    monthlyPrice: 29900,
    yearlyPrice: 299000,
  },
  {
    name: 'BHOS Enterprise',
    description: 'Full suite with workforce management, family portal, predictive analytics, transportation, and priority support.',
    metadata: { tier: 'enterprise', homes: 'unlimited', features: 'full' },
    monthlyPrice: 39900,
    yearlyPrice: 399000,
  },
  {
    name: 'BHOS Unlimited',
    description: 'Everything in Enterprise plus dedicated account manager, custom integrations, on-site training, and SLA guarantees.',
    metadata: { tier: 'unlimited', homes: 'unlimited', features: 'all' },
    monthlyPrice: 49900,
    yearlyPrice: 499000,
  },
];

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log('Creating BHOS subscription products in Stripe...\n');

    for (const plan of BHOS_PLANS) {
      const existing = await stripe.products.search({
        query: `name:'${plan.name}' AND active:'true'`
      });

      if (existing.data.length > 0) {
        console.log(`${plan.name} already exists (${existing.data[0].id}). Skipping.`);
        continue;
      }

      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: plan.metadata,
      });
      console.log(`Created product: ${product.name} (${product.id})`);

      const monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthlyPrice,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { tier: plan.metadata.tier, interval: 'monthly' },
      });
      console.log(`  Monthly: $${(plan.monthlyPrice / 100).toFixed(2)}/mo (${monthlyPrice.id})`);

      const yearlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.yearlyPrice,
        currency: 'usd',
        recurring: { interval: 'year' },
        metadata: { tier: plan.metadata.tier, interval: 'yearly' },
      });
      console.log(`  Yearly: $${(plan.yearlyPrice / 100).toFixed(2)}/yr (${yearlyPrice.id})`);
    }

    console.log('\nAll BHOS products created successfully!');
    console.log('Webhooks will sync this data to your database automatically.');
  } catch (error: any) {
    console.error('Error creating products:', error.message);
    process.exit(1);
  }
}

createProducts();
