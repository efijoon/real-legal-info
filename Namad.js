const mongoose= require('mongoose');
const Schema = mongoose.Schema;

const namadSchema = Schema({
    id: { type: String, default: null },
    dataToRespond: { type: Object, default: null },
});

module.exports = mongoose.model('Namad' , namadSchema);