import { prisma } from '../lib/prisma';

async function checkUsers() {
  try {
    const users = await prisma.user.findMany();
    console.log('Total users in database:', users.length);
    
    if (users.length === 0) {
      console.log('No users found in database');
    } else {
      console.log('\nUsers:');
      users.forEach(user => {
        console.log(`- ${user.email} (ID: ${user.id})`);
      });
    }
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();