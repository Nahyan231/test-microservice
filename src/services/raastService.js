import axios from 'axios';
import moment from 'moment';
import responseCodeHandler_New from '../util/responseCodeHandler_New';
import qrPaymentService from './qrPaymentService';
import cache from '../util/cache';
import QRHelper from './helpers/qrPaymentHelper';
import MerchantDetailModel from '../model/merchantDetailModel';
import { printLog, printError } from '../util/utility';
import 'moment-timezone';
import Subscriber from './subscriberService';
import { Notification } from '../util/';

const TRX_HISTORY_APP_CONNECT_DB2 = config.externalServices.historyApi.insert
const successResponse = { success: true, data: {}, message_en: "Operation has been completed successfully" };
const failureResponse = { success: false, data: {}, message_en: "Something went wrong. Please try again later" };
class RaastService {
    constructor() {
        this.raastIncommingPayment = this.raastIncommingPayment.bind(this)
        this.merchantDetail = MerchantDetailModel;
    }

    async raastIncommingPayment(payload) {

        printLog(
            'Entered function',
            'RaastService.raastIncommingPayment',
            payload
        );

        let error = new Error();

        try {
            let clientResponse = {};

            const aksaToken = await qrPaymentService.loginAKSA();
            if (!aksaToken) {

                printLog(
                    'Authorization Failed on AKSA. Unable to Get Token.',
                    'RaastService.raastIncommingPayment'
                );

                clientResponse = await responseCodeHandler_New.getResponseCode(config.responseCode.useCases.MerchantDetails.authentication, null, null);

                error = clientResponse
                throw error;
            }

            let {
                till_id: merchantTillID,
                merchant_msisdn: merchantMSISDN,
                merchant_name: merchantName = "",
                customer_name: customerName = "",
                customer_cnic: customerCNIC,
                customer_msisdn: customerMSISDN = "",
                transaction_amount: txAmount,
                transaction_id: txID,
                transaction_dt: txDate,
                rrn,
                fee: fee = 0,
                fed: fed = 0,
                tip_amount: tipAmount = 0,
                loyalty_number: loyaltyNumber = "",
                reference_id: referenceID = "",
                purpose_of_transaction: purposeOfTransaction = "",
                bill_number: billNumber = "",
                business_name: businessName = "",
                customer_email: customerEmail = "",
                customer_label: customerLabel = "",
                store_label: storeLabel = "",
                tax_id: taxID = "",
                context_of_transaction: contextOfTransaction = "",
                customer_address: customerAddress = "",
                customer_iban: customerIBAN = "",
                merchant_city: merchantCity = "",
                bic: BIC = "",
                merchant_channel: merchantChannel = "",
                mcc: mcc = "",
                dbtr_latd: dbtrLatd = "",
                dbtr_long: dbtrLong = ""
            } = payload

            let output = {};

            if (!merchantTillID ?? true) {

                let parsedMerchantMSISDN = merchantMSISDN.startsWith("92") ? merchantMSISDN.replace("92", "0") : merchantMSISDN
                let response = await this.getMerchantDetailsFromAKSA(parsedMerchantMSISDN, aksaToken);

                printLog(
                    'Response of getMerchantDetailsFromAKSA against msisdn',
                    'raastService.raastIncommingPayment',
                    response
                );

                if (!response.success) {
                    logger.debug({ event: 'Data not found on AKSA against the merchantMSISDN', response });
                    error.message = `Something went wrong while accessing Raast raastIncommingPayment api`;
                    throw error;
                }

                else {
                    let resultItem = response?.data?.find(item => item.ISCAS === 1 && item.IsStatic === true);

                    if (!resultItem) {
                        resultItem = response?.data.find(item => item.IsStatic === true)
                    }
                    printLog(
                        'After filtering merchantDetails response against msisdn',
                        'raastService.raastIncommingPayment',
                        resultItem
                    );

                    if (resultItem) {
                        merchantTillID = resultItem ? resultItem.TillNumber : null;
                        output.success = response.success;
                        output.data = resultItem
                    }
                    else {
                        logger.debug({ event: 'Data not found on AKSA against the merchantMSISDN', resultItem });
                        error.message = `Something went wrong while accessing Raast raastIncommingPayment api`;
                        throw error;
                    }
                }
            }

            else {
                let response = await this.getMerchantDetailsFromAKSA(merchantTillID, aksaToken);
                printLog(
                    'response of merchant details against merchant till ID',
                    'raastService.raastIncommingPayment',
                    response
                );

                if (!response.success) {
                    logger.debug({ event: 'Data not found on AKSA against the merchantMSISDN', response });
                    error.message = `Something went wrong while accessing Raast raastIncommingPayment api`;
                    throw error;
                }
                else {
                    output.success = response.success;
                    output.data = response.data[0]
                }
            }

            printLog(
                'Response of getMerchantDetailsFromAKSA',
                'raastService.raastIncommingPayment',
                output
            );

            const {
                success = false,
                data: {
                    CNIC = "",
                    MerchantCategoryCode: categoryId = "",
                    MerchantMSISDN: merchCNIC = "",
                    MoblieNumber1 = "",
                    MoblieNumber2 = "",
                    MoblieNumber3 = "",
                    MoblieNumber4 = "",
                    MoblieNumber5 = "",
                    MoblieNumber6 = "",
                    TerminalNumber = "",
                    //ShopName = ""
                },
                response = {}
            } = output

            if (success) {

                const dataObj = {
                    senderName: customerName,
                    msisdn: customerMSISDN,
                    description: "Raast",
                    subCategory: "",
                    thirdParty: payload.thirdParty,
                    category: categoryId,
                    trxName: "",
                    useCase: "Incoming Raast Payment",
                    flowId: "",
                    fee: fee,
                    fed: fed,
                    rrn: rrn,
                    scheme: "Raast",
                    tipAmount: tipAmount,
                    transactionType: "QR Payment",
                    reverseTransaction: payload.reverseTransaction,
                    merchantDetails: {
                        name: merchantName || "",
                        msisdn: merchantMSISDN || merchCNIC,
                        tillNumber: merchantTillID
                    }
                }

                const notifiersData = {
                    MoblieNumber1: MoblieNumber1,
                    MoblieNumber2: MoblieNumber2,
                    MoblieNumber3: MoblieNumber3,
                    MoblieNumber4: MoblieNumber4,
                    MoblieNumber5: MoblieNumber5,
                    MoblieNumber6: MoblieNumber6 || TerminalNumber,
                }

                const dataModel = {
                    txID: txID,
                    txEndDate: txDate,
                    name: customerName,
                    msisdn: customerMSISDN,
                    customerCNIC: customerCNIC,
                    amount: txAmount,
                    loyaltyNumber: loyaltyNumber,
                    purposeOfTransaction: purposeOfTransaction,
                    referenceID: referenceID,
                    billNumber: billNumber,
                    fee: fee,
                    businessName: businessName,
                    customerEmail: customerEmail,
                    customerLabel: customerLabel,
                    storeLabel: storeLabel,
                    taxID: taxID,
                    contextOfTransaction: contextOfTransaction,
                    customerAddress: customerAddress,
                    customerIBAN: customerIBAN,
                    merchantCity: merchantCity,
                    BIC: BIC,
                    merchantChannel: merchantChannel,
                    mcc: mcc,
                    dbtrLatd: dbtrLatd,
                    dbtrLong: dbtrLong,
                    transactionScheme: "RAAST",
                    contextData: {
                        merchantDetails: {
                            notifiers: notifiersData,
                            name: merchantName,
                            msisdn: merchantMSISDN,
                            tillNumber: merchantTillID
                        }
                    }
                }

                qrPaymentService.updateNotifier(notifiersData, payload.msisdn);
                this.AddDataToTransactionHistory(dataObj, dataModel);
                QRHelper.triggerIPN(dataModel);
                QRHelper.notify(dataModel);
                QRHelper.smsNotifiers(dataModel.contextData.merchantDetails.msisdn, dataModel.txID, dataModel.amount, dataObj?.msisdn || dataModel?.customerIBAN)

                return {
                    ...successResponse,
                }

            }
            else if (response) { return response }

            error.message = `Something went wrong while accessing Raast raastIncommingPayment api`;
            throw error;

        } catch (error) {

            printError(error, 'raastService.raastIncommingPayment')

            return {
                ...failureResponse
            };
        }
    }


    /**Uses a repayment transaction returned by CVAS API and maps it to the required format 
    @param {string} key 
    @returns {object} returns the mapped data
    @example
    {
        "paidAmount": 1050,
        "paidPrincipal": 1000,
        "paidFee": 50,
        "balanceAmount" : 0,
        "balanceFee" : 0,
        "balancePrincipal": "",
        "paidDate": "2021-02-10T00:00:00.000+0500",
        "balanceType": "userpayment"
    }
    */

    async getMerchantDetailsFromAKSA(key, aksaToken) {

        let merchantResponse, merchantDetailsPayload = {}

        const cacheName = config.cacheQRPayment.cacheName;

        const expiration = config.cacheQRPayment.expiry;

        printLog(
            'Validate from cache',
            'getMerchantDetailsFromAKSA',
            { key: key, cacheName: cacheName, expiration: expiration }
        );

        let cacheResponse;
        // merchant details fetch from monog or cache according to switch
        if (process.env.FETCH_MERCHANT_DETAILS == "true") {
            logger.debug("******* fetch from details from db ******* ");
            let query = { deleteFlag: 0 };
  
            key.length==8 ? query.oldtillNumber=key : query.tillNumber=key ;
  
            cacheResponse = await this.merchantDetail.findOne(query);
        }
        else  cacheResponse = await cache.getValue(key, cacheName);
        //End /// merchant details fetch from monog or cache according to switch 

        if (cacheResponse) {

            printLog(
                'fetch merchant details from cache',
                'getMerchantDetailsFromAKSA',
                { response: cacheResponse }
            );

            merchantResponse = cacheResponse
        }
        else {

            printLog(
                'fetch merchant details from aksa',
                'getMerchantDetailsFromAKSA'
            );

            if (key.length > 9) {
                merchantDetailsPayload.MSISDN = key

            }
            else {
                merchantDetailsPayload.TillNumber = key
            }

            merchantResponse = await qrPaymentService.getMerchantDetailsFromAKSA(merchantDetailsPayload, aksaToken);

            printLog(
                'fetch merchant details from aksa',
                'getMerchantDetailsFromAKSA'
            );

            if (merchantResponse && merchantResponse.Data && merchantResponse.Data.length) {

                // merchant details fetch from monog or cache according to switch
                merchantResponse.tillNumber = merchantResponse?.Data[0]?.TillNumber;
                merchantResponse.oldtillNumber = merchantResponse?.Data[0]?.OldTillNumber;
                if(process.env.FETCH_MERCHANT_DETAILS == "true"){
                    logger.debug("******* insert details in db ******* ");
                    await this.merchantDetail.findOneAndUpdate({tillNumber : merchantResponse.tillNumber}, merchantResponse, { new: true, upsert: true, setDefaultsOnInsert: true});
                }else{
                    merchantResponse.tillNumber && cache.putValue
                    (
                        merchantResponse.tillNumber,
                        merchantResponse,
                        cacheName
                    );

                    merchantResponse.oldtillNumber && cache.putValue
                    (
                        merchantResponse.oldtillNumber,
                        merchantResponse,
                        cacheName
                    );
                }
                //End /// merchant details fetch from monog or cache according to switch
            }
            else {
                merchantResponse = responseCodeHandler_New.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);

                return {
                    success: false,
                    response: merchantResponse
                }
            }

        }

        return {
            success: true,
            data: merchantResponse.Data
        }
    }

    /**Uses a repayment transaction returned by CVAS API and maps it to the required format 
    @param {object} payload 
    @param {object} payload 
    @example Example payload of CVAS txn that goes as input
    {
        "type": "USER_REPAYMENT",
        "loanItemID": "50_10000_rng",
        "loanItemName": "50_10000_rng",
        "loanReference": "5177580141612257864967",
        "serviceID": "2",
        "borrowerID": "923079770309",
        "transactionTimestamp": "2021-02-04T01:50:08.300+0500",
        "channel": "N/A",
        "endpoint": "N/A",
        "status": "Success",
        "principalAmountBefore": 101,
        "principalAmountAfter": 97,
        "principalAdjustment": -4,
        "feeAmountBefore": 6,
        "feeAmountAfter": 0,
        "feeAdjustment": -6
    }
    @example Example payload of CVAS txn that goes as input
    {
        "type": "USER_REPAYMENT",
        "loanItemID": "50_10000_rng",
        "loanItemName": "50_10000_rng",
        "loanReference": "5177580141612257864967",
        "serviceID": "2",
        "borrowerID": "923079770309",
        "transactionTimestamp": "2021-02-04T01:50:08.300+0500",
        "channel": "N/A",
        "endpoint": "N/A",
        "status": "Success",
        "principalAmountBefore": 101,
        "principalAmountAfter": 97,
        "principalAdjustment": -4,
        "feeAmountBefore": 6,
        "feeAmountAfter": 0,
        "feeAdjustment": -6
    }
    @returns {object} returns the mapped data
    @example
    {
        "paidAmount": 1050,
        "paidPrincipal": 1000,
        "paidFee": 50,
        "balanceAmount" : 0,
        "balanceFee" : 0,
        "balancePrincipal": "",
        "paidDate": "2021-02-10T00:00:00.000+0500",
        "balanceType": "userpayment"
    }
    */

    async AddDataToTransactionHistory(payload, data) {

        printLog(
            '****** Entered function ******',
            'raastService.AddDataToTransactionHistory',
            { data: data, payload: payload },
        );

        const trxHistoryPayload = {
            TRANS_ID: data.txID || "",
            TRX_DTTM: moment().tz("Asia/Karachi").format('YYYY-MM-DDTHH:mm:ss') || data.txEndDate || "",
            INITIATOR_NAME: payload?.senderName || "",
            INITIATOR_MSISDN: payload.msisdn || "",
            TRX_CHANNEL: payload.thirdParty || "",
            TRX_TYPE: payload.transactionType || "",
            AC_FROM: payload.msisdn || "",
            AC_TO: payload?.merchantDetails?.msisdn || "",
            UTILITY_COMPANY: "",
            CONSUMER_NO: payload?.merchantDetails?.tillNumber || "",
            FEE: ((parseFloat(payload?.fee || 0) || 0) + parseFloat(payload?.fed || 0) || 0).toFixed(2).toString() || "0.00",
            FED: "0.00",
            WHT: "0.00",
            GROSS_AMT: ((parseFloat(data?.amount || 0) || 0)).toString() || "0.00",
            AMOUNT_DEBITED: data?.amount || "",
            AMOUNT_CREDITED: data?.amount || "",
            BENEFICIARY_MSISDN: payload?.merchantDetails?.msisdn || "",
            DESCRIPTION: payload?.description || "",
            REASON_TYPE: payload?.trxName || "",
            CONTEXT_DATA: {

                RECEIVER_NAME: payload?.merchantDetails?.name || "",
                useCase: payload?.useCase || "",
                isRefundable: true,
                isRepeatable: false,
                trx_name: payload?.trxName || "",
                flowId: payload?.flowId || "",
                category: payload?.category || "",
                subCategory: payload?.subCategory || "",
                scheme: payload.scheme || '',
                tipAmount: payload?.tipAmount || 0.00,
                rrn: payload?.rrn || '',
                reverseTransaction: payload?.reverseTransaction || '',
                customerIBAN: data.customerIBAN || ''
            }
        }

        const trxHistoryOptions = {
            method: 'post', url: TRX_HISTORY_APP_CONNECT_DB2,
            headers: {
                "Content-Type": "application/json"
            },
            data: trxHistoryPayload
        };

        printLog(
            'transaction history options object with payload',
            'qrPaymentService.AddDataToTransactionHistory',
            { data: trxHistoryOptions }
        );

        printLog(
            '** Exited function **',
            'qrPaymentService.AddDataToTransactionHistory',
            { data: trxHistoryPayload },
        );

        let subscriber = Subscriber.getInstance();
        subscriber.event.produceMessage(trxHistoryPayload, 'TRX_HISTORY_REPORTING');
        //axios(trxHistoryOptions);
    }
}

export default new RaastService();