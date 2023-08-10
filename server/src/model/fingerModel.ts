import mongoose from "mongoose";

const fingerSchema = new mongoose.Schema({
    fingerprintId: String
});

const fingerModel = mongoose.model("finger", fingerSchema);

export default fingerModel;