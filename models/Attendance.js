const { DataTypes } = require('sequelize');
const db = require('../config/database');
const sequelize = db.sequelize;
const User = require('./User');

const Attendance = sequelize.define('attendance', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  in_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  out_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

// associations
Attendance.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Attendance, { foreignKey: 'user_id' });

module.exports = Attendance;