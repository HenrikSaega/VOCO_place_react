const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Pixel = sequelize.define(
  "Pixel",
  {
    x: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    y: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    color: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "#FFFFFF",
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ["x", "y"],
      },
    ],
  },
);

module.exports = Pixel;
