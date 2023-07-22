const mongoose = require("mongoose");

const schema = new mongoose.Schema({
    email: String,
    password: String
});

const model = mongoose.model("admin", schema);

module.exports = model;