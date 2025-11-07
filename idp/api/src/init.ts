import { sequelize, User } from './sqlite';

async function initDB() {
    await sequelize.sync({ force: true }); // This creates the tables

    // Create a default user
    await User.create({
        username: 'admin',
        password: 'admin123' // WARNING: Use proper hashing in production!
    });

    console.log('Database initialized with default user');
    process.exit(0);
}

  initDB();