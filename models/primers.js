const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// Create Schema
const Schema = mongoose.Schema;
const primersSchema = new Schema({
	primer: {
		type: String,
		required: true
	},
	sequence: {
		type: String,
		unique: true,
		required: true
	},
	articles: [
		{
			name: String,
			pdf: Boolean,
			link: String
		}
	],
	blast: String,
	notes: [
		{
			note: String
		}
	],
	date: {
		type: Date,
		default: Date.now
	}
});

var handleE11000 = function (error, res, next) {
	if (error.name === 'MongoError' && error.code === 11000) {
		next(new Error('There was a duplicate key error'));
	} else {
		next();
	}
};

primersSchema.post('save', handleE11000);

primersSchema.plugin(mongoosePaginate);

const primersModel = mongoose.model('primers', primersSchema);

module.exports = primersModel;