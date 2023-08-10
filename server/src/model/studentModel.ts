import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
    name: String,
    regNo: String,
    parentEmail: String,
    fingerprintId: Number
});

const model = mongoose.model("student", studentSchema);

export default model;