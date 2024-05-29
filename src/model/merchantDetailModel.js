import mongoose, { Schema } from "mongoose";

class merchantDetail {
    initSchema() {
        const schema = new Schema({
            tillNumber: { type: String, required: true},
            oldtillNumber: { type: String, default:''},
            deleteFlag: { type: Number, default:0},
            Data:[
               
            ],
            Success:{
                type: Boolean, required: false, default:true
            },
            Code:{
                type: String, required: false, default:"00"
            },
            Message:{
                type: String, required: false, default:""
            },
            Status:{
                type: Boolean, required: false, default:0
            },
            DataLast50CreatedAccounts: { type: String, required: false, default:null },
            UserId: { type: String, required: false, default:null},
            MerchantId: { type: String, required: false, default:null },
            PTSOutLetId: { type: String, required: false, default:null },
            PTSMerchantId: { type: String, required: false, default:null },
            OutletId: { type: Number, required: false, default:0 },
            PTSMerchantOutlet: { type: String, required: false, default:null },
            OldMerchantId: { type: String, required: false, default:null  },
            MerchantCateoryCode: { type: String, required: false, default:null },
            T_amount: { type: String, required: false, default:null },
            UserMercantId: { type: String, required: false, default:null },
            OutletUserId: { type: Number, required: false, default:0 },
            IsActive:  { type: Boolean, required: false, default:true }
        },
        {
            timestamps: true
        });
        mongoose.model("merchant_detail", schema);
    }
    getInstance() {
        this.initSchema();
        return mongoose.model("merchant_detail");
      }
}
export default new merchantDetail().getInstance();