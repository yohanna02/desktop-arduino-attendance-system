const mongoose = require("mongoose");

const schema = new mongoose.Schema({
    name: String,
    studentsIds: [mongoose.Schema.Types.ObjectId],
    attendance: [
        new mongoose.Schema({
            open: Boolean,
            studentIds: [mongoose.Schema.Types.ObjectId],
            date: {
                type: Date,
                default: new Date()
            }
        })
    ]
});

const model = mongoose.model("class", schema);

module.exports = model;