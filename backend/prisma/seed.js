const { PrismaClient } = require('@prisma/client');
// slugify not needed (removed)

const prisma = new PrismaClient();

async function main() {
  // Categories
  const electronics = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {},
    create: { name: 'Electronics', slug: 'electronics' },
  });

  const accessories = await prisma.category.upsert({
    where: { slug: 'accessories' },
    update: {},
    create: { name: 'Accessories', slug: 'accessories' },
  });

  // Brands
  const brandA = await prisma.brand.upsert({
    where: { slug: 'brand-a' },
    update: {},
    create: { name: 'Brand A', slug: 'brand-a' },
  });

  const brandB = await prisma.brand.upsert({
    where: { slug: 'brand-b' },
    update: {},
    create: { name: 'Brand B', slug: 'brand-b' },
  });

  // Products
  const smartphone = await prisma.product.upsert({
    where: { slug: 'smartphone-x' },
    update: {},
    create: {
      name: 'Smartphone X',
      slug: 'smartphone-x',
      description: 'High‑end smartphone with great camera.',
      basePrice: 699.99,
      imageUrl: 'https://example.com/images/smartphone-x.png',
      stock: 120,
      categoryId: electronics.id,
      brandId: brandA.id,
    },
  });

  const mouse = await prisma.product.upsert({
    where: { slug: 'gaming-mouse' },
    update: {},
    create: {
      name: 'Gaming Mouse',
      slug: 'gaming-mouse',
      description: 'Ergonomic mouse with programmable buttons.',
      basePrice: 59.99,
      imageUrl: 'https://example.com/images/gaming-mouse.png',
      stock: 250,
      categoryId: accessories.id,
      brandId: brandB.id,
    },
  });

  // Prices per market
  await prisma.price.createMany({
    data: [
      { productId: smartphone.id, market: 'PT', currency: 'EUR', amount: 699.99 },
      { productId: smartphone.id, market: 'AO', currency: 'AOA', amount: 3500000 },
      { productId: mouse.id, market: 'PT', currency: 'EUR', amount: 59.99 },
      { productId: mouse.id, market: 'AO', currency: 'AOA', amount: 300000 },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seed data inserted');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
