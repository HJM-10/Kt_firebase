const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const adminPass = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@smartsportshub.com' },
    update: {},
    create: { name: 'Admin', email: 'admin@smartsportshub.com', password: adminPass, role: 'ADMIN' }
  });
  console.log('✅ Admin created:', admin.email);

  // Test customer
  const custPass = await bcrypt.hash('customer123', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'user@smartsportshub.com' },
    update: {},
    create: { name: 'John Doe', email: 'user@smartsportshub.com', password: custPass, role: 'CUSTOMER' }
  });
  console.log('✅ Customer created:', customer.email);

  // Sports
  const sportsData = [
    { name: 'Cricket', icon: '🏏', description: 'The gentleman\'s game' },
    { name: 'Football', icon: '⚽', description: 'The beautiful game' },
    { name: 'Basketball', icon: '🏀', description: 'Fast-paced court sport' },
    { name: 'Hockey', icon: '🏒', description: 'Fast and exciting field sport' },
    { name: 'Swimming', icon: '🏊', description: 'Pool-based aquatic sport' },
    { name: 'Padel', icon: '🎾', description: 'Racquet sport combining tennis and squash' },
    { name: 'Chess', icon: '♟️', description: 'Strategic board game' },
    { name: 'Polo', icon: '🐴', description: 'Equestrian team sport' },
  ];

  const sports = [];
  for (const s of sportsData) {
    const sport = await prisma.sport.upsert({
      where: { name: s.name },
      update: {},
      create: s
    });
    sports.push(sport);
    console.log('✅ Sport:', sport.name);
  }

  // Venues (2 per first 3 sports)
  const venuesData = [
    { name: 'Main Cricket Ground', sportId: sports[0].id, capacity: 500, pricePerSlot: 2500 },
    { name: 'Practice Cricket Nets', sportId: sports[0].id, capacity: 30, pricePerSlot: 800 },
    { name: 'Football Arena A', sportId: sports[1].id, capacity: 200, pricePerSlot: 1500 },
    { name: 'Football Arena B', sportId: sports[1].id, capacity: 100, pricePerSlot: 1000 },
    { name: 'Basketball Court 1', sportId: sports[2].id, capacity: 50, pricePerSlot: 600 },
    { name: 'Basketball Court 2', sportId: sports[2].id, capacity: 50, pricePerSlot: 600 },
  ];

  for (const v of venuesData) {
    const venue = await prisma.venue.create({ data: v });
    console.log('✅ Venue:', venue.name);
  }

  // Sample Tournament
  await prisma.tournament.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'KT SSH Cricket Cup 2024',
      description: 'Annual cricket knockout tournament',
      sportId: sports[0].id,
      format: 'KNOCKOUT',
      status: 'UPCOMING',
      startDate: new Date('2024-12-01'),
      maxTeams: 8,
      entryFee: 5000
    }
  });
  console.log('✅ Sample tournament created');

  // Sample Events
  await prisma.event.create({
    data: {
      name: 'Summer Cricket Coaching Camp',
      description: 'Professional cricket coaching for all ages',
      sportId: sports[0].id,
      type: 'TRAINING',
      startDate: new Date(Date.now() + 86400000 * 7), // 7 days from now
      endDate: new Date(Date.now() + 86400000 * 14),
      venue: 'Main Cricket Ground',
      maxParticipants: 50,
      fee: 2000,
      status: 'UPCOMING'
    }
  });
  console.log('✅ Sample event created');

  // Sample Equipment
  await prisma.equipment.create({
    data: {
      name: 'Professional Cricket Bat (Grade 1 English Willow)',
      description: 'High quality cricket bat for matches',
      sportId: sports[0].id,
      pricePerSlot: 500,
      quantity: 10,
      isActive: true
    }
  });
  await prisma.equipment.create({
    data: {
      name: 'Football (FIFA Pro Quality)',
      description: 'Match quality football',
      sportId: sports[1].id,
      pricePerSlot: 300,
      quantity: 20,
      isActive: true
    }
  });
  console.log('✅ Sample equipment created');

  // Sample Promo Code
  await prisma.promoCode.create({
    data: {
      code: 'WELCOME20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      isActive: true
    }
  });
  console.log('✅ Sample promo code created');

  console.log('\n🎉 Seeding complete!\n');
  console.log('Admin login:    admin@smartsportshub.com / admin123');
  console.log('Customer login: user@smartsportshub.com  / customer123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
