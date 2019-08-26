const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// Create Schema
const Schema = mongoose.Schema;
const clustalSchema = new Schema({
	file: {
		name: String,
		link: String
	},
	note: String,
	date: {
		type: Date,
		default: Date.now
	}
});

clustalSchema.plugin(mongoosePaginate);

const clustalModel = mongoose.model('clustal', clustalSchema);

module.exports = clustalModel;