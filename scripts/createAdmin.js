require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sample_management';

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password: { type: String, select: false },
  role: { type: String, enum: ['ADMIN', 'FIELD_AGENT', 'ANALYST'], default: 'FIELD_AGENT' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin exists
    const existingAdmin = await User.findOne({ email: 'admin@example.com' });

    if (existingAdmin) {
      console.log('\nAdmin user already exists:');
      console.log('  ID:', existingAdmin._id);
      console.log('  Email:', existingAdmin.email);
      console.log('  Role:', existingAdmin.role);
      console.log('  Active:', existingAdmin.isActive);

      // Update password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('admin123', salt);

      await User.updateOne(
        { email: 'admin@example.com' },
        { $set: { password: hashedPassword, isActive: true } }
      );

      console.log('\nPassword has been reset to: admin123');
    } else {
      // Create new admin
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('admin123', salt);

      const admin = await User.create({
        name: 'Admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true
      });

      console.log('\nNew admin user created:');
      console.log('  ID:', admin._id);
      console.log('  Email: admin@example.com');
      console.log('  Password: admin123');
    }

    console.log('\n--- Login Details ---');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
    console.log('---------------------\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createAdmin();
