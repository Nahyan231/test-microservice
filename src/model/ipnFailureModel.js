import mongoose, { Schema } from "mongoose";

class ipnFailureModel {
    initSchema() {
        const schema = new Schema({
            msisdn_trxId: {
                type: String,
                index: true
            },
            payload: {
                type: Object
            },
            attempts:{
                type: Number,
                default: 0
            },
            status:{
                type: String,
                default: 'pending'
            }
        },
        {
            timestamps: true
        });
        mongoose.model("ipn_failure", schema);
    }
    getInstance() {
        this.initSchema();
        return mongoose.model("ipn_failure");
      }
}
export default new ipnFailureModel().getInstance();