const mongoose = require("mongoose");

const schema = new mongoose.Schema({
    name: String,
    students: [
        new mongoose.Schema({
            name: String,
            regNo: String,
            parentEmail: String,
            fingerprintId: Number
        })
    ],
    attendance: [
        new mongoose.Schema({
            open: Boolean,
            studentIds: [mongoose.Schema.Types.ObjectId]
        })
    ]
});

const model = mongoose.model("class", schema);

module.exports = model;