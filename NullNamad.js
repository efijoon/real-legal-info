const mongoose= require('mongoose');
const Schema = mongoose.Schema;

const nullNamadSchema = Schema({
    id: { type: String, default: null }
});

module.exports = mongoose.model('NullNamad' , nullNamadSchema);