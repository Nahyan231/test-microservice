import { printLog, printError } from '../util/utility';
class trxHistoryUtil {

    constructor() {
        this.mapTrxHistory = this.mapTrxHistory.bind(this);
    }

    async mapTrxHistory(payload) {

        printLog(
            'Entered function',
            'trxHistoryUtil.mapTrxHistory',
            payload
        );

        let error = new Error();

        try {
            if (payload && payload?.txType === 'payment-qrpayment-confirm') {

                printLog(
                    `Transaction type is ${payload?.txType}`,
                    'trxHistoryUtil.mapTrxHistory'
                );


                // RECEIVER_NAME: payload?.merchantDetails?.name || "",
                // customerCNIC : payload?.customerCNIC || "",
                // qrCode : payload?.qrCode || "",
                // paidVia: payload?.paidVia || "",
                // useCase:  payload?.useCase || "",
                // isRefundable : payload?.isRefundable || true,
                // isRepeatable: !(payload?.thirdParty.includes('merchant')),
                // trx_name: payload?.trxName || "",
                // flowId: payload?.flowId || "",
                // category: payload?.category || "",
                // subCategory: payload?.subCategory || "",
                
                return  [

                    { key: 'DESCRIPTION', value: payload?.description || "QR Payment"},
                    { key: 'REASON_TYPE', value: payload?.trxName || ""},
                    { key: 'INITIATOR_MSISDN', value: payload?.msisdn || ""},
                    { key: 'BENEFICIARY_MSISDN', value: payload?.merchantDetails?.msisdn || ""},
                    { key: 'CONSUMER_NO', value: payload?.merchantDetails?.tillNumber || ""},
                    { key: 'RECEIVER_NAME', value: payload?.merchantDetails?.name || ""},
                    { key: 'TRX_TYPE', value: payload?.transactionType || ""},

                    { key: 'PUBLIC_IP', value: payload?.publicIP ?? "" },
                    { key: 'PUBLIC_PORT', value: payload?.publicPort ?? "" },
                    { key: 'customerCNIC', value: payload?.customerCNIC ?? "" },
                    { key: 'qrCode', value: payload?.qrCode ?? "" },
                    { key: 'paidVia', value: payload?.paidVia ?? "" },
                    { key: 'useCase', value:  payload?.useCase ?? "" },
                    { key: 'isRefundable', value: payload?.isRefundable ?? true },
                    { key: 'isRepeatable', value: !(payload?.channel.includes('merchant')) ?? "" },
                    { key: 'trx_name', value: payload.trxName ?? "" },
                    { key: 'flowId', value: payload?.flowId ?? "" },
                    { key: 'category', value: payload?.category ?? "" },
                    { key: 'subCategory', value: payload?.subCategory ?? "" },
                    { key: 'identifierType', value: payload?.identifierType ?? "" }
                ]

            } else if (payload && payload?.txType === 'qr-payment-refund') {
                
                printLog(
                    `Transaction type is ${payload?.txType}`,
                    'trxHistoryUtil.mapTrxHistory'
                );


                // RECEIVER_NAME: payload?.merchantDetails?.name || "",
                // customerCNIC : payload?.customerCNIC || "",
                // qrCode : payload?.qrCode || "",
                // paidVia: payload?.paidVia || "",
                // useCase:  payload?.useCase || "",
                // isRefundable : payload?.isRefundable || true,
                // isRepeatable: !(payload?.thirdParty.includes('merchant')),
                // trx_name: payload?.trxName || "",
                // flowId: payload?.flowId || "",
                // category: payload?.category || "",
                // subCategory: payload?.subCategory || "",
                
                return  [

                    { key: 'DESCRIPTION', value: "QR Refund"},
                    { key: 'REASON_TYPE', value: payload?.trxName || ""},
                    { key: 'INITIATOR_MSISDN', value: payload?.msisdn || ""},
                    { key: 'BENEFICIARY_MSISDN', value: payload?.merchantDetails?.msisdn || ""},
                    { key: 'CONSUMER_NO', value: payload?.merchantDetails?.tillNumber || ""},
                    { key: 'RECEIVER_NAME', value: payload?.merchantDetails?.name || ""},
                    { key: 'TRX_TYPE', value: payload?.transactionType || ""},

                    { key: 'PUBLIC_IP', value: payload?.publicIP ?? "" },
                    { key: 'PUBLIC_PORT', value: payload?.publicPort ?? "" },
                    { key: 'customerCNIC', value: payload?.customerCNIC ?? "" },
                    { key: 'qrCode', value: payload?.qrCode ?? "" },
                    { key: 'paidVia', value: payload?.paidVia ?? "" },
                    { key: 'useCase', value:  payload?.useCase ?? "" },
                    { key: 'isRefundable', value: payload?.isRefundable ?? true },
                    { key: 'isRepeatable', value: !(payload?.channel.includes('merchant')) ?? "" },
                    { key: 'trx_name', value: payload.trxName ?? "" },
                    { key: 'flowId', value: payload?.flowId ?? "" },
                    { key: 'category', value: payload?.category ?? "" },
                    { key: 'subCategory', value: payload?.subCategory ?? "" },
                ]

            } else {

                error.message = "No use case matched";

                throw error;

            }

        } catch (error) {

            printError(error, 'trxHistoryUtil.mapTrxHistory')

            return null;
        }
    }

}

export default new trxHistoryUtil();
