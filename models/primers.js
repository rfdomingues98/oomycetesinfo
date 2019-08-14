const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// Create Schema
const Schema = mongoose.Schema;
const primersSchema = new Schema({
	primer: String,
	sequence: String,
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

primersSchema.plugin(mongoosePaginate);

const primersModel = mongoose.model('primers', primersSchema);

module.exports = primersModel;