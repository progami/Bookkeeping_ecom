import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function updatePassword() {
  const email = 'ajarrar@trademanenterprise.com';
  const password = 'gW2r4*8&wFM.#fZ';
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword }
  });
  
  console.log(`Password updated for ${email}`);
}

updatePassword()
  .catch(console.error)
  .finally(() => prisma.$disconnect());