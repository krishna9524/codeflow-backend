const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

const createInitialAdmin = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.log('Admin credentials not found in .env. Skipping admin creation.');
            return;
        }

        let admin = await Admin.findOne({ email: adminEmail });

        if (!admin) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(adminPassword, salt);

            admin = new Admin({
                email: adminEmail,
                password: hashedPassword,
                name: 'Default Admin',
            });

            await admin.save();
            console.log('Initial admin account created successfully.');
        } else {
            console.log('Admin account already exists.');
        }
    } catch (err) {
        console.error('Error creating initial admin:', err.message);
    }
};

module.exports = { createInitialAdmin };