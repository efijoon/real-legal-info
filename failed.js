const mongoose= require('mongoose');
const Schema = mongoose.Schema;

const failedSchema = Schema({
    id: { type: String, default: null }
});

module.exports = mongoose.model('Failed' , failedSchema);