import mongoose, { Schema } from "mongoose";

let instance = null;
class quickPayModel {
    constructor() {
        this.initSchema();
    }

    initSchema() {
        const schema = new Schema({
            invoiceID: {
                type: String,
                required: true,
                unique: true,
                index: true
            },
            createdBy: {
                type: String,
                required: true
            },
            senderName:{
                type: String,
                required: false,
                default:""
            },
            businessName: {
                type: String,
                required: false,
                default: ""
            },
            invoiceType: {
                type: String,
                required: true,
                default: "quickPay"
            },
            txID: {
                type: String,
                rquired: false,
                unique: false
            },
            price: {
                type: Number,
                required: true,
            },
            attachment: {
                type: String,
                required: false
            },
            description: {
                type: String,
                required: false
            },
            status: {
                type: String,
                required: false,
                default: "pending",
                lowercase: true,
                index:true
            },
            reminders: {
                type: Number,
                required: false,
                default: 0
            },
            createdDate: {
                type: Date,
                required: true
            },
            recepientDetails: {
                type: Object,
                required: true,
                email: {
                    type: String,
                    required: false
                },
                phoneNo: {
                    type: Number,
                    required: false
                },
                name: {
                    type: String,
                    required: false
                }
            },
            lastReminder: {
                type: String,
                required: false
            }
        });
        // schema.index({createdAt: 1},{expireAfterSeconds: 3600});x
        mongoose.model("requestToPay_quickPay", schema);
    }
    static getInstance() {
        if (!instance) {
            instance = new quickPayModel();
        }
        return mongoose.model("requestToPay_quickPay");
    }
}
export default quickPayModel;