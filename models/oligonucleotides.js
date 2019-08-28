const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// Create Schema
const Schema = mongoose.Schema;
const oligonucleotidesSchema = new Schema({
	name: {
		type: String,
		required: true,
		trim: true
	},
	sequence: {
		type: String,
		unique: true,
		required: true,
		trim: true
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
		next(new Error('Error: There was a duplicate key error!'));
	} else {
		next();
	}
};

oligonucleotidesSchema.post('save', handleE11000);

oligonucleotidesSchema.plugin(mongoosePaginate);

const oligonucleotidesModel = mongoose.model('oligonucleotides', oligonucleotidesSchema);

module.exports = oligonucleotidesModel;