const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
	firstName: {
		type: String,
		unique: false,
		required: true,
	},
	lastName: {
		type: String,
		unique: false,
		required: true,
	},
	email: {
		type: String,
		unique: true,
		required: true,
		trim: true
	},
	password: {
		type: String,
		required: true
	}
});

module.exports = mongoose.model('User', UserSchema);