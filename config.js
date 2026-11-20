require('dotenv').config();

const list = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean);
module.exports = {
  name: process.env.BOT_NAME || 'SPARTA',
  prefix: process.env.PREFIX || '!',
  owner: (process.env.OWNER_NUMBER || '').replace(/\D/g, ''),
  admins: list(process.env.ADMIN_NUMBERS).map(x => x.replace(/\D/g, '')),
  currency: process.env.CURRENCY || 'MT',
  payments: {
    mpesa: { number: process.env.MPESA_NUMBER || 'CONFIGURAR', name: process.env.MPESA_NAME || 'CONFIGURAR' },
    emola: { number: process.env.EMOLA_NUMBER || 'CONFIGURAR', name: process.env.EMOLA_NAME || 'CONFIGURAR' }
  },
  packages: [
    { name: '500MB', price: 25 }, { name: '1GB', price: 45 },
    { name: '2GB', price: 85 }, { name: '3GB', price: 120 },
    { name: '5GB', price: 190 }, { name: '10GB', price: 350 }
  ],
  rentals: [
    { name: 'BASICO', days: 7, price: 100 },
    { name: 'PRO', days: 30, price: 300 },
    { name: 'PREMIUM', days: 90, price: 750 }
  ]
};
