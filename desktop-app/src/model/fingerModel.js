const mongoose = require("mongoose");

const fingerSchema = new mongoose.Schema({
    fingerprintId: String
});

const fingerModel = mongoose.model("finger", fingerSchema);

module.exports = fingerModel;