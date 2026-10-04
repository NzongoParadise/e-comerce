import { prisma } from '../src/lib/server/prisma';

type CatalogItem = {
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  imageUrl: string;
  stock: number;
  category: string;
  categorySlug: string;
  brand: string;
  brandSlug: string;
  priceAO: number;
  attributes?: Array<{ name: string; value: string }>;
};

const catalog: CatalogItem[] = [
  { name: 'MacBook Pro M3 14"', slug: 'macbook-pro-m3-14', description: 'Portátil profissional Apple com chip M3, 16GB de memória e SSD de 512GB.', basePrice: 1999, imageUrl: '/conjunto de Apple.png', stock: 12, category: 'Computadores', categorySlug: 'computadores', brand: 'Apple', brandSlug: 'apple', priceAO: 1920000 },
  { name: 'MacBook Air M3 13"', slug: 'macbook-air-m3-13', description: 'Portátil leve Apple para produtividade, mobilidade e trabalho diário.', basePrice: 1299, imageUrl: '/conjunto de Apple.png', stock: 18, category: 'Computadores', categorySlug: 'computadores', brand: 'Apple', brandSlug: 'apple', priceAO: 1250000 },
  { name: 'iPhone 16 Pro', slug: 'iphone-16-pro', description: 'Smartphone Apple Pro com câmara avançada e 256GB de armazenamento.', basePrice: 1299, imageUrl: '/Iphone_15.png', stock: 20, category: 'Smartphones', categorySlug: 'smartphones', brand: 'Apple', brandSlug: 'apple', priceAO: 1250000 },
  { name: 'iPhone 15', slug: 'iphone-15', description: 'Smartphone Apple com excelente desempenho e câmara de alta resolução.', basePrice: 899, imageUrl: '/Iphone_15.png', stock: 25, category: 'Smartphones', categorySlug: 'smartphones', brand: 'Apple', brandSlug: 'apple', priceAO: 870000 },
  { name: 'Dell Monitor 27"', slug: 'dell-monitor-27', description: 'Monitor QHD IPS de 27 polegadas com 75Hz para trabalho e criação.', basePrice: 289, imageUrl: '/monitor.png', stock: 30, category: 'Monitores', categorySlug: 'monitores', brand: 'Dell', brandSlug: 'dell', priceAO: 280000 },
  { name: 'HP LaserJet Pro 4003dw', slug: 'hp-laserjet-pro-4003dw', description: 'Impressora empresarial com Wi-Fi, impressão duplex e elevada produtividade.', basePrice: 465, imageUrl: '/HP.jpg', stock: 14, category: 'Impressão', categorySlug: 'impressao', brand: 'HP', brandSlug: 'hp', priceAO: 450000 },
  { name: 'AirPods Pro (2.ª geração)', slug: 'airpods-pro-2', description: 'Auriculares Apple com cancelamento ativo de ruído e caixa USB-C.', basePrice: 279, imageUrl: '/Acessorio.png', stock: 40, category: 'Acessórios', categorySlug: 'acessorios', brand: 'Apple', brandSlug: 'apple', priceAO: 270000 },
  { name: 'Apple Watch Series 9', slug: 'apple-watch-series-9', description: 'Smartwatch Apple para saúde, produtividade e atividade física.', basePrice: 549, imageUrl: '/Apple.jpg', stock: 16, category: 'Acessórios', categorySlug: 'acessorios', brand: 'Apple', brandSlug: 'apple', priceAO: 525000 },
  { name: 'Hub USB-C 7 em 1', slug: 'hub-usbc-7-em-1', description: 'Hub USB-C compacto com portas para escritório e mobilidade.', basePrice: 79, imageUrl: '/Componentes.png', stock: 55, category: 'Acessórios', categorySlug: 'acessorios', brand: 'TechGlobal', brandSlug: 'techglobal', priceAO: 75000 },
  { name: 'Router ASUS Wi-Fi 6', slug: 'router-asus-wifi-6', description: 'Router Wi-Fi 6 para conectividade rápida e estável em casa ou escritório.', basePrice: 159, imageUrl: '/ASUS.jpg', stock: 22, category: 'Redes', categorySlug: 'redes', brand: 'ASUS', brandSlug: 'asus', priceAO: 155000 },
  { name: 'SSD NVMe 1TB Gen4', slug: 'ssd-nvme-1tb-gen4', description: 'Unidade SSD NVMe PCIe 4.0 de 1TB para acelerar arranques, aplicações e jogos.', basePrice: 89, imageUrl: '/Componentes.png', stock: 42, category: 'Componentes', categorySlug: 'componentes', brand: 'Kingston', brandSlug: 'kingston', priceAO: 86000, attributes: [{ name: 'Armazenamento', value: '1 TB' }, { name: 'Interface', value: 'PCIe 4.0 NVMe' }, { name: 'Formato', value: 'M.2 2280' }] },
  { name: 'Memória RAM DDR4 16GB', slug: 'memoria-ram-ddr4-16gb', description: 'Módulo de memória DDR4 3200MHz de 16GB para upgrades de desktops e portáteis.', basePrice: 49, imageUrl: '/Componentes.png', stock: 58, category: 'Componentes', categorySlug: 'componentes', brand: 'Kingston', brandSlug: 'kingston', priceAO: 47000, attributes: [{ name: 'Memória RAM', value: '16 GB' }, { name: 'Tipo', value: 'DDR4' }, { name: 'Velocidade', value: '3200 MHz' }] },
  { name: 'Placa Gráfica RTX 4060 8GB', slug: 'placa-grafica-rtx-4060-8gb', description: 'Placa gráfica NVIDIA GeForce RTX 4060 com 8GB GDDR6 para gaming e criação.', basePrice: 349, imageUrl: '/Componentes.png', stock: 15, category: 'Componentes', categorySlug: 'componentes', brand: 'ASUS', brandSlug: 'asus', priceAO: 338000, attributes: [{ name: 'Memória', value: '8 GB GDDR6' }, { name: 'Interface', value: 'PCI Express 4.0' }, { name: 'Resolução máxima', value: '7680 x 4320' }] },
  { name: 'Fonte de Alimentação 650W 80 Plus', slug: 'fonte-alimentacao-650w-80-plus', description: 'Fonte ATX de 650W com certificação 80 Plus Bronze para sistemas gaming e profissionais.', basePrice: 79, imageUrl: '/Componentes.png', stock: 26, category: 'Componentes', categorySlug: 'componentes', brand: 'Corsair', brandSlug: 'corsair', priceAO: 76000, attributes: [{ name: 'Potência', value: '650 W' }, { name: 'Certificação', value: '80 Plus Bronze' }, { name: 'Formato', value: 'ATX' }] },
  { name: 'Componentes PC Pro', slug: 'componentes-pc-pro', description: 'Seleção de componentes para montagem e atualização de computadores.', basePrice: 199, imageUrl: '/Componentes.png', stock: 35, category: 'Componentes', categorySlug: 'componentes', brand: 'TechGlobal', brandSlug: 'techglobal', priceAO: 190000 },
  { name: 'Acessórios TechGlobal', slug: 'acessorios-techglobal', description: 'Acessórios tecnológicos para completar o seu equipamento.', basePrice: 49, imageUrl: '/Acessorio.png', stock: 80, category: 'Acessórios', categorySlug: 'acessorios', brand: 'TechGlobal', brandSlug: 'techglobal', priceAO: 47000 },
];

const testimonials = [
  { name: 'João Silva', location: 'Luanda, Angola', text: 'Excelente atendimento e entrega rápida em Luanda. O meu MacBook chegou em perfeito estado.', stars: 5, displayOrder: 1 },
  { name: 'Ana Costa', location: 'Lisboa, Portugal', text: 'Comprei o iPhone e a experiência foi incrível. Site confiável e suporte muito atencioso.', stars: 5, displayOrder: 2 },
  { name: 'Carlos Mendes', location: 'Benguela, Angola', text: 'Sou revendedor e os preços grossistas são muito competitivos. Recomendo.', stars: 5, displayOrder: 3 },
];

const coupons = [
  { code: 'BEMVINDO10', description: '10% de desconto na sua primeira compra.', discountType: 'PERCENTAGE', discountValue: 10, minimumOrderKZ: 50000, active: true },
  { code: 'TECH5000', description: 'Kz 5.000 de desconto em compras elegíveis.', discountType: 'FIXED', discountValue: 5000, minimumOrderKZ: 100000, active: true },
];

async function main() {
  const legacySlugs = ['smartphone-x', 'camiseta-casual', 'livro-programacao-moderna'];
  const legacyProducts = await prisma.product.findMany({ where: { slug: { in: legacySlugs } }, select: { id: true } });
  if (legacyProducts.length) {
    const legacyIds = legacyProducts.map((product) => product.id);
    await prisma.price.deleteMany({ where: { productId: { in: legacyIds } } });
    await prisma.product.deleteMany({ where: { id: { in: legacyIds } } });
  }

  for (const item of catalog) {
    const category = await prisma.category.upsert({ where: { slug: item.categorySlug }, update: { name: item.category }, create: { name: item.category, slug: item.categorySlug } });
    const brand = await prisma.brand.upsert({ where: { slug: item.brandSlug }, update: { name: item.brand }, create: { name: item.brand, slug: item.brandSlug } });
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: { name: item.name, description: item.description, basePrice: item.basePrice, imageUrl: item.imageUrl, stock: item.stock, categoryId: category.id, brandId: brand.id },
      create: { name: item.name, slug: item.slug, description: item.description, basePrice: item.basePrice, imageUrl: item.imageUrl, stock: item.stock, categoryId: category.id, brandId: brand.id },
    });
    await prisma.price.deleteMany({ where: { productId: product.id } });
    await prisma.price.createMany({ data: [{ productId: product.id, market: 'PT', currency: 'EUR', amount: item.basePrice }, { productId: product.id, market: 'AO', currency: 'AOA', amount: item.priceAO }] });
    await prisma.productAttribute.deleteMany({ where: { productId: product.id } });
    if (item.attributes?.length) await prisma.productAttribute.createMany({ data: item.attributes.map((attribute) => ({ ...attribute, productId: product.id })) });
  }
  await prisma.category.deleteMany({ where: { slug: { in: ['eletronicos', 'roupas', 'livros'] }, products: { none: {} } } });
  await prisma.brand.deleteMany({ where: { slug: { in: ['techbrand', 'fashionco', 'bookhouse'] }, products: { none: {} } } });
  for (const testimonial of testimonials) {
    await prisma.testimonial.upsert({
      where: { id: testimonial.displayOrder },
      update: testimonial,
      create: testimonial,
    });
  }
  for (const coupon of coupons) {
    await prisma.coupon.upsert({ where: { code: coupon.code }, update: coupon, create: coupon });
  }
  const now = new Date();
  const promotionEnd = new Date(now);
  promotionEnd.setDate(promotionEnd.getDate() + 30);
  const firstOrderPromotion = await prisma.promotion.upsert({
    where: { slug: 'primeira-compra-10' },
    update: { status: 'ACTIVE', active: true, startAt: now, endAt: promotionEnd },
    create: {
      name: 'Primeira compra · 10% OFF',
      slug: 'primeira-compra-10',
      description: '10% de desconto para novos clientes.',
      code: 'PRIMEIRA10',
      status: 'ACTIVE',
      startAt: now,
      endAt: promotionEnd,
      priority: 200,
      stackable: false,
      exclusive: true,
      perCustomerLimit: 1,
      actions: { create: [{ type: 'PERCENTAGE', value: 10 }] },
      rules: { create: [{ kind: 'FIRST_ORDER', operator: 'EQ', value: 'true' }] },
    },
  });
  const freeShippingPromotion = await prisma.promotion.upsert({
    where: { slug: 'frete-gratis-100k' },
    update: { status: 'ACTIVE', active: true, startAt: now, endAt: promotionEnd },
    create: {
      name: 'Frete grátis · compras elegíveis',
      slug: 'frete-gratis-100k',
      description: 'Frete grátis para compras acima do mínimo configurado.',
      status: 'ACTIVE',
      startAt: now,
      endAt: promotionEnd,
      priority: 50,
      stackable: true,
      minOrderAOA: 100000,
      minOrderEUR: 100,
      actions: { create: [{ type: 'FREE_SHIPPING' }] },
    },
  });
  void firstOrderPromotion;
  void freeShippingPromotion;
  console.log(`TechGlobal catalog seeded: ${catalog.length} products`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
