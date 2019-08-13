const mongoose = require('mongoose');

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
	]
});

module.exports = mongoose.model('primers', primersSchema);