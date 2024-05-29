import mongoose, { Schema } from "mongoose";

let instance = null;
class requestInvoiceModel {
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
            },
            txID: {
                type: String,
                rquired: false,
                unique: false
            },
            createdDate: {
                type: Date,
                required: true,
                index:true
            },
            dueDate: {
                type: Date,
                required: true
            },
            attachment: {
                type: String,
                required: false
            },
            status: {
                type: String,
                required: false,
                lowercase: true,
                default: "pending",
                index: true
            },
            reminders: {
                type: Number,
                required: false,
                default: 0
            },
            shipping: {
                type: Object,
                required: false,
                amount: {
                    type: Number,
                    required: true
                },
                category: {
                    type: String,
                    required: true
                },
                description: {
                    type: String,
                    required: true
                }
            },
            items: {
                type: Array,
                required: true,
                amount: {
                    type: Number,
                    required: true
                },
                price: {
                    type: Number,
                    required: true
                },
                description: {
                    type: String,
                    required: true
                },
                discount: {
                    type: Object,
                    required: false,
                    amount: {
                        type: Number,
                        required: true
                    },
                    category: {
                        type: String,
                        required: true
                    },
                    description: {
                        type: String,
                        required: true
                    }
                },
                tax: {
                    type: Object,
                    required: false,
                    amount: {
                        type: Number,
                        required: true
                    },
                    category: {
                        type: String,
                        required: true
                    },
                    description: {
                        type: String,
                        required: true
                    }
                },
            },
            recepientDetails: {
                type: Object,
                required: true,
                name: {
                    type: String,
                    required: true
                },
                email: {
                    type: String,
                    required: false
                },
                phoneNo: {
                    type: Number,
                    required: true,
                    index: true
                }
            },
            totalBill: {
                type: Number,
                required: true
            },
            notes: {
                type: String,
                required: false
            },
            lastReminder: {
                type: String,
                required: false
            }

        });
        mongoose.model("requestToPay_requestInvoice", schema);
    }
    static getInstance() {
        if (!instance) {
            instance = new requestInvoiceModel();
        }
        return mongoose.model("requestToPay_requestInvoice");
    }
}
export default requestInvoiceModel;