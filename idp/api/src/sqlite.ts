import * as path from 'path'
import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'

const sqliteFilePath = process.env.SQLITE_FILE_PATH || '';

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.resolve(sqliteFilePath)
})

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare id: CreationOptional<number>
    declare username: string
    declare password: string
}

User.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    }
},{
    sequelize,
    timestamps: false
});

export {
    sequelize,
    User
}