import mongoose, {
    Schema
} from "mongoose";

class cashToGoodBalanceModel {
    initSchema() {
        const schema = new Schema({
            msisdn: {
                type: String,
                required: true
            },
            category_id: {
                type: Number,
                required: true
            },
            category: {
                type: String,
                required: false
            },
            balance: {
                type: Number,
                required: true
            },
            receivings: {
                type: Number,
                default: 0,
                required: true
            },
            consumptions: {
                type: Number,
                default: 0,
                required: false,
            },
            status: {
                type: Number,
                required: true,
            }
        },
            {
                timestamps: true
            });
        mongoose.model("cashToGoodBalance", schema);
    }

    getInstance() {
        this.initSchema();
        return mongoose.model("cashToGoodBalance");
    }
}

export default new cashToGoodBalanceModel().getInstance()