import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/server/prisma';

const email = process.env.ADMIN_EMAIL || 'admin@techglobal.co.ao';
const password = process.env.ADMIN_PASSWORD || 'Admin@2026!';

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Administrador TechGlobal',
      passwordHash,
      provider: 'local',
      accessRole: 'ADMIN',
      accountType: 'B2B',
      accountName: 'Conta Administrativa',
      status: 'ACTIVE',
    },
    create: {
      externalId: `local:admin:${email}`,
      email,
      name: 'Administrador TechGlobal',
      provider: 'local',
      passwordHash,
      accessRole: 'ADMIN',
      accountType: 'B2B',
      accountName: 'Conta Administrativa',
      status: 'ACTIVE',
    },
  });

  console.log(`Admin account ready: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());