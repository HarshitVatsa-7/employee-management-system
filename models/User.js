// models/User.js
const { DataTypes } = require('sequelize');
const db = require('../config/database');
const sequelize = db.sequelize;

const User = sequelize.define('users', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  // Profile Fields
  full_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mobile: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  emp_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  position: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  type_of_work: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // Upload / UI
  profile_image: {
    type: DataTypes.STRING,
    allowNull: true, // stores public path like /public/uploads/profile_images/4.jpg
  },

  // Role for future manager feature
  role: {
    type: DataTypes.ENUM('user', 'manager'),
    defaultValue: 'user',
    allowNull: false
  },

  // Profile completion flag
  profile_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }
}, {
  timestamps: false
});

module.exports = User;
