import mongoose, { Schema } from "mongoose";

let instance = null;
class transactionHistoryModel {
  constructor() {
    this.initSchema();
   }

  initSchema() {
    const schema = new Schema({
      msisdn_txID:{ type: String, required: false},
      txID: { type: String, required: true , index: true},
      txType: { type: String, required: true},
      txStatus: { type: String, required: true,index:true},
      msisdn: { type: String, required: true, index: true},
      amount: { type: Number, required: false},
      txEndDate: { type: String, required: false,index:true},
      txEndTime: { type: String, required: false},
      chCode: { type: String, required: false,index:true},
      senderMsisdn: { type: String, required: false},
      senderName: { type: String, required: false},
      debit: { type: String, required: false},
      isRepeatable: { type: String, required: false, default: "false"},
      isRefundable: { type: String, required: false, default: "false"},
      isReciever: { type: String, required: false, default: "false"},
      txCategory: { type: String, required: false,index:true},
      fee: { type: Number, required: false},
      commission: { type: Number, required: false},
      rating: { type: Number, required: false},
      contextData: { type: Object,required: false,
        ocvID: { type: String,required: false,},
        cvID: { type: String,required: false,},
        header:{ type: String,required: false,},
        footer:{ type: String,required: false,},
        rxDetails:{type: Object, required: false,}, // rxDetails.msisdn is indexed at MongoDB level, as this property typically exists but isn't defined inside this nested object 
      },
      txCategoryLabel: {type: String, required: false},
      txTypeLabel: {type: String, required: false}
    },
    {
      timestamps: true
    });
   // schema.index({createdAt: 1},{expireAfterSeconds: 3600});
    
    mongoose.model("transactionHistory_New", schema);
  }
  static getInstance() {
    if(!instance) {
      instance = new transactionHistoryModel();
    }
    return mongoose.model("transactionHistory_New");
  }
}
export default transactionHistoryModel;