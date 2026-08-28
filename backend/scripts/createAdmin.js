// scripts/createAdmin.js
//
// One-time (or re-runnable) script to create the FIRST administrator
// account. This is deliberately NOT exposed as a public API route —
// running it requires shell/environment access to the server, which
// keeps admin creation out of reach of the public internet.
//
// Usage (non-interactive, e.g. CI/deployment):
//
//   ADMIN_NAME="Jane Doe" ADMIN_EMAIL="jane@amberandash.com" \
//   ADMIN_PASSWORD="a-strong-password" node scripts/createAdmin.js
//
// Usage (interactive):
//
//   node scripts/createAdmin.js
//   (you will be prompted for name, email, and password)
//
// The password is read from an environment variable or typed at the
// terminal at run time — it is never hard-coded into source code,
// and is never logged or printed back out.
const dns = require("dns");
dns.setServers(["1.1.1.1","8.8.8.8"]);
const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDatabase = require('../src/config/db');
const Admin = require('../src/models/Admin');

function prompt(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (value) => {
      rl.close();
      resolve(value);
    });
  });
}

async function getAdminDetails() {
  // Prefer environment variables (useful for scripted/non-interactive
  // setup) and fall back to interactive prompts for anything missing.
  let name = process.env.ADMIN_NAME;
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  if (!name) name = await prompt('Admin name: ');
  if (!email) email = await prompt('Admin email: ');
  if (!password) password = await prompt('Admin password: ');

  return {
    name: (name || '').trim(),
    email: (email || '').trim().toLowerCase(),
    password: password || '',
  };
}

async function createAdmin() {
  const { name, email, password } = await getAdminDetails();

  if (!name || !email || !password) {
    console.error('❌ Name, email, and password are all required. Aborting.');
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters. Aborting.');
    process.exitCode = 1;
    return;
  }

  await connectDatabase();

  try {
    const existing = await Admin.findOne({ email });

    if (existing) {
      console.error(`❌ An admin with email "${email}" already exists. Aborting — no duplicate created.`);
      process.exitCode = 1;
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
    });

    console.log('✅ Admin created successfully.');
    console.log(`   id:    ${admin._id}`);
    console.log(`   name:  ${admin.name}`);
    console.log(`   email: ${admin.email}`);
    // Password / hash is intentionally never logged.
  } catch (error) {
    console.error('❌ Failed to create admin:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

createAdmin();
