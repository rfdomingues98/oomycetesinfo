const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// Create Schema
const Schema = mongoose.Schema;
const regionsSchema = new Schema({
	region: {
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
	unite: String,
	bold: String,
	phyto: String,
	notes: [
		{
			note: String
		}
	],
	primers: [
		{
			primer: String,
			sequence: String,
			blast: String,
			notes: String
		}
	],
	amp_sequences: [
		{
			name: String,
			sequence: String,
			blast: String,
			unite: String,
			boldsystems: String,
			phytophthoradb: String,
			notes: String
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

regionsSchema.post('save', handleE11000);

regionsSchema.plugin(mongoosePaginate);

const regionsModel = mongoose.model('regions', regionsSchema);

module.exports = regionsModel;