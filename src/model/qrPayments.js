import mongoose, { Schema } from "mongoose";


class QRPaymentModel {

  initSchema() {
    const schema = new Schema({
      txID: { type: String, required: true, index:true},
      txType: { type: String, required: true},
      paidVia: { type: String, required: true},
      qrCode: { type: String, required: true},
      name: { type: String, required: true},
      msisdn: { type: String, required: true, index:true},
      amount: { type: String, required: true},
      fee: { type: String, required: true},
      refundedTxID: { type: String, required: false},
      isRefundable: {type: String, required: true, default: 'false'},
      txStatus: {type: String, required: false},
      txEndDate: { type: String, required: true},
      txEndTime: { type: String, required: true},
      rating: { type: Number, required: false},
      isTipRequired: { type: String, required: false},
      tipAmount: {type: Number, required: false},
      convenienceFee: {type: Number, required: false},
      conveniencePercentage: {type: Number, required: false},
      isDynamicQr: {type: String, required: false},
      qrString: {type: String, required: false},
      contextData: { type: Object,required: true,
        ocvID: { type: String,required: true,},
        cvID: { type: String,required: true,},
        merchantDetails:{type: Object, required: true,
            msisdn: { type: String, required: true},
            localMsisdn: { type: String, required: false},
            name: { type: String, required: true},
            tillNumber: { type: String, required: true, index: true},
            isFonepay: { type: Boolean, required: true, default: false},
            isMastercard: { type: Boolean, required: true, default: false},
            cardAccepTermID: { type: String, required: false},
            cardAccepIDCode: { type: String, required: false},
            traceAuditNumber: { type: String, required: false},
            retrievalRefNumber: { type: String, required: false}
        },
      }
    },
    {
      timestamps: true
    });
    
    mongoose.model("qr_payment", schema);
  }

  getInstance() {
    this.initSchema();
    return mongoose.model("qr_payment");
  }
}
export default new QRPaymentModel().getInstance();