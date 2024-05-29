var _ = require('lodash');
import FormData from 'form-data'
import axios from 'axios';
import Notification from '../../util/notification';
import logger from '../../util/logger';
import QRPaymentModel from '../../model/qrPayments';
import IPNFailureModel from '../../model/ipnFailureModel';
import msisdnConverter from '../../util/msisdnTransformer'
import moment from 'moment';
import Subscriber from '../subscriberService';
//const REFRESH_NOTIFICATION_TEMPLATE = 'REFRESH_BALANCE';

const AKSA_CONFIG = config.aksa;
const AKSA_URL = process.env.AKSA_URL || AKSA_CONFIG.BASE_URL;
const AKSA_USERNAME = process.env.AKSA_USERNAME || AKSA_CONFIG.USERNAME;
const AKSA_PASSWORD = process.env.AKSA_PASSWORD || AKSA_CONFIG.PASSWORD;
const AKSA_AXIOS_TIMEOUT = process.env.AKSA_AXIOS_TIMEOUT || AKSA_CONFIG.TIMEOUT;
const AKSA_IPN_PATH = process.env.AKSA_IPN_PATH || AKSA_CONFIG.IPN;

const CONFIG_QR_RATING_MIN_AMOUNT = process.env.MERCHANT_RATING_CONFIG_MASTER_DATA || config.externalServices.masterDataAPI.qrRatingMinAmount;
const MERCHANT_QR_RATING_MIN_AMOUNT = process.env.MERCHANT_RATING_CONFIG_ACC_MNG || config.externalServices.accountManagementAPI.merchantRatingMinAmount;
const SMS_NOTIFIERS = process.env.SMS_NOTIFIERS || config.externalServices.accountManagementAPI.smsNotifiers;
const AXIOS_TIMEOUT = config.esb.axiosOptions.timeout;

const NOTIFY_CONSUMER = 'consumer';
const NOTIFY_MERCHANT = 'merchant';
// const SENDER_NOTIFICATION_TEMPLATE = "QR_SENDER_PAYMENT";
const RECEIVER_NOTIFICATION_TEMPLATE = "QR_RECEIVER_PAYMENT";
const REFRESH_NOTIFICATION_TEMPLATE = 'REFRESH_BALANCE';

const AKSA_IPN_V2 = process.env.AKSA_IPN_PATH_V2 || AKSA_CONFIG.IPNV_2;


class QRPaymentHelper {
    constructor(model) {
        this.IPNFailureModel = model;
        this.APIConfig = {
            baseURL: AKSA_URL,
            timeout: AKSA_AXIOS_TIMEOUT
        }
        this.subscriber = Subscriber.getInstance();
    }

    async initQRResponse(servResp) {
        let initData = {};
        try {
            logger.debug({ event: 'Entered function', functionName: 'initQRResponse in class QRPaymentHelper', servResp });
            logger.debug({ event: "debugging", resResultParams: servResp.Result.ResultParameters.ResultParameter })
            if (servResp && servResp.Response && servResp.Result && servResp.Result.ResultCode === "0") {
                initData.originatorConversationID = servResp.Result.OriginatorConversationID;
                initData.transactionID = servResp.Result.TransactionID;
                initData.conversationID = servResp.Result.ConversationID;
                initData.txEndDate = servResp.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndDate'; })?.Value;
                initData.txEndTime = servResp.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndTime'; })?.Value;
                initData.amount = servResp.Result.ResultParameters.ResultParameter?.find((param) => { return param.Key == 'Amount'; })?.Value;
                initData.fee = servResp.Result.ResultParameters.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || "0.00";
            }
            logger.debug({ event: 'Exited function', functionName: 'initQRResponse in class QRPaymentHelper', initData });
            return initData;
        }
        catch (error) {
            logger.error({ event: "Error thrown", functionName: "initQRResponse in class QRPaymentHelper", error: { message: error.message, stack: error.stack } });
            return false;
        }
    }

    async confirmQRResponse(servResp, payload, isFonepay) {
        let confirmData = {}, contextData = {}, merchantDetails = {};
        try {
            logger.debug({ event: 'Entered function', functionName: 'confirmQRResponse in class QRPaymentHelper', servResp, payload, isFonepay });
            confirmData.txID = servResp.Result.TransactionID;
            confirmData.txStatus = "Completed";
            confirmData.txType = payload.transactionType;
            if (payload.txType != undefined) {
                confirmData.txType = `${confirmData.txType} ${payload.txType}`;
            }
            confirmData.txType.trim();
            confirmData.paidVia = payload.paidVia;
            confirmData.qrCode = payload.qrCode;
            confirmData.msisdn = payload.msisdn;
            confirmData.name = payload.name;
            confirmData.refundedTxID = payload.originalTxID || '';
            confirmData.txEndDate = servResp.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndDate'; })?.Value;
            confirmData.txEndTime = servResp.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndTime'; })?.Value;
            confirmData.amount = servResp.Result.ResultParameters.ResultParameter?.find((param) => { return param.Key == 'Amount'; })?.Value;
            confirmData.fee = servResp.Result.ResultParameters.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || "0.00";

            contextData.ocvID = servResp.Result.OriginatorConversationID;
            contextData.cvID = servResp.Result.ConversationID;

            merchantDetails.msisdn = payload.merchantDetails.msisdn;
            if (payload.merchantDetails.msisdn) {
                merchantDetails.localMsisdn = await msisdnConverter.formatNumberSingle(payload.merchantDetails.msisdn,'local');
            }
            merchantDetails.name = payload.merchantDetails.name;
            merchantDetails.tillNumber = payload.merchantDetails.tillNumber || payload.merchantDetails.merchantId;
            merchantDetails.isFonepay = isFonepay;
            if (isFonepay) {
                confirmData.isTipRequired = payload.isTipRequired;
                confirmData.tipAmount = payload.tipAmount;
                confirmData.convenienceFee = payload.convenienceFee;
                confirmData.conveniencePercentage = payload.conveniencePercentage;
                confirmData.isDynamicQr = payload.isDynamicQr;
                confirmData.qrString = payload.qrString;
            }

            confirmData.contextData = contextData;
            confirmData.contextData.merchantDetails = merchantDetails;

            logger.debug({ event: 'Exited function', functionName: 'confirmQRResponse in class QRPaymentHelper', confirmData });
            return confirmData;
        } catch (error) {
            logger.error({ event: "Error thrown", functionName: "confirmQRResponse in class QRPaymentHelper", error: { message: error.message, stack: error.stack } })
            return false;
        }
    }
    async confirmMerchantResponse(servResp, payload) {
        let confirmData = {};
        try {
            logger.debug({ event: 'Entered function', functionName: 'confirmMRResponse in class MRPaymentHelper', servResp, payload });
            confirmData.txID = servResp?.Result?.TransactionID || '';
            confirmData.txEndDate = servResp.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndDate'; })?.Value|| '';
            confirmData.txEndTime = servResp.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndTime'; })?.Value|| '';
            confirmData.amount = servResp.Result.ResultParameters.ResultParameter?.find((param) => { return param.Key == 'Amount'; })?.Value|| '0';
            confirmData.beneficiaryName = servResp.Result.ResultParameters.ResultParameter?.find((param) => { return param.Key == 'BeneficiaryName'; })?.Value|| '';
            confirmData.balance = servResp.Result.ResultParameters.ResultParameter?.find((param) => { return param.Key == 'Balance'; })?.Value|| '0';
            confirmData.fee = servResp.Result.ResultParameters.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || "0.00";
            confirmData.originatorConversationID =servResp?.Result?.OriginatorConversationID || '';
            confirmData.conversationID = servResp?.Result?.ConversationID || '';

            // merchantDetails.msisdn = payload.merchantDetails.msisdn;
            // merchantDetails.name = payload.merchantDetails.name;
            // merchantDetails.tillNumber = payload.merchantDetails.tillNumber || payload.merchantDetails.merchantId;
           

            //confirmData.contextData = contextData;
            //confirmData.contextData.merchantDetails = merchantDetails;

            logger.debug({ event: 'Exited function', functionName: 'confirmMRResponse in class MRPaymentHelper', confirmData });
            return confirmData;
        } catch (error) {
            logger.error({ event: "Error thrown", functionName: "confirmMRResponse in class MRPaymentHelper", error: { message: error.message, stack: error.stack } })
            return false;
        }
    }

    async mastercardPaymentReponse(payload, esbResponse, retrievalRefNumber, traceAuditNumber) {
        let confirmData = {}, contextData = {}, merchantDetails = {};
        try {
            logger.debug({ event: 'Entered function', functionName: 'confirmMRResponse in class MRPaymentHelper', esbResponse, payload });
            confirmData.txID = esbResponse.Result.TransactionResult.TransactionID
            contextData.originatorConversationID = esbResponse?.Result?.OriginatorConversationID || '';
            contextData.conversationID = esbResponse?.Result?.ConversationID || '';
            confirmData.txEndDate = esbResponse.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndDate'; })?.Value || moment(moment().utc().utcOffset("+0500")).format('YYYYMMDD');
            confirmData.txEndTime = esbResponse.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndTime'; })?.Value || moment(moment().utc().utcOffset("+0500")).format('HHmmss');
            confirmData.fee = esbResponse.Result.ResultParameters.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || "0.00";

            confirmData.txStatus = "Completed";
            confirmData.txType = payload.transactionType;
            if (payload.txType != undefined) {
                confirmData.txType = `${confirmData.txType} ${payload.txType}`;
            }
            confirmData.txType.trim();
            confirmData.paidVia = payload.paidVia;
            confirmData.qrCode = payload.qrCode;
            confirmData.msisdn = payload.msisdn;
            confirmData.name = payload.name;   
            confirmData.amount = payload.totalAmount;

            merchantDetails.msisdn = payload.merchantDetails.msisdn;
            merchantDetails.name = payload.merchantDetails.name;
            merchantDetails.tillNumber = payload.merchantDetails.tillNumber || payload.merchantDetails.merchantId;
            merchantDetails.traceAuditNumber = traceAuditNumber;
            merchantDetails.retrievalRefNumber = retrievalRefNumber;
            if (payload.merchantDetails.msisdn) {
                merchantDetails.localMsisdn = await msisdnConverter.formatNumberSingle(payload.merchantDetails.msisdn,'local');
            }
            merchantDetails.isMastercard = true;
            confirmData.isTipRequired = payload.isTipRequired;
            confirmData.tipAmount = payload.tipAmount;
            confirmData.convenienceFee = payload.convenienceFee;
            confirmData.conveniencePercentage = payload.conveniencePercentage;
            confirmData.isDynamicQr = payload.isDynamicQr;
            confirmData.qrString = payload.qrString;

            confirmData.contextData = contextData;
            confirmData.contextData.merchantDetails = merchantDetails;

            logger.debug({ event: 'Exited function', functionName: 'confirmMRResponse in class MRPaymentHelper', confirmData });
            return confirmData;
        } catch (error) {
            logger.error({ event: "Error thrown", functionName: "confirmMRResponse in class MRPaymentHelper", error: { message: error.message, stack: error.stack } })
            return false;
        }
    }

    async triggerIPN(payload) {
        try {
            logger.debug({ event: 'Entered function', functionName: 'triggerIPN in class QRPaymentHelper', payload });
            const AKSA_IPN_API = _.cloneDeep(this.APIConfig);
            let form = new FormData();
            form.append('jqr_user_name', AKSA_USERNAME);
            form.append('Jqr_pass', AKSA_PASSWORD);
            form.append('merchant_name', payload.contextData.merchantDetails.name);
            form.append('customer_msisdn', payload.msisdn);
            if(payload.transactionScheme)
            form.append('transactionScheme', payload.transactionScheme);
            if(payload.tip)
                form.append('tip', payload.tip);
            let customerMSISDN = (payload?.msisdn && payload.msisdn.startsWith("92")) ? payload.msisdn.replace("92", "0") : payload.msisdn || ''
            form.append('customer_msisdn', customerMSISDN);
            if (payload.customerCNIC)
                form.append('customer_cnic', payload.customerCNIC);
            if (payload.totalAmount) {
                form.append('transaction_amount', payload.totalAmount);
            } else {
                form.append('transaction_amount', payload.amount);
            }
            form.append('transaction_status', 'true');
            form.append('transaction_id', payload?.txID);
            form.append('transaction_dt', payload.txEndDate);
            form.append('till_id', payload.contextData.merchantDetails.tillNumber);
            if (payload.contextData.merchantDetails.msisdn) {
                let merchant_msisdn = payload.contextData.merchantDetails.msisdn.startsWith("92") ? payload.contextData.merchantDetails.msisdn.replace("92", "0") : payload.contextData.merchantDetails.msisdn
                form.append('merchant_msisdn', merchant_msisdn);
            }
            if (payload.contextData.merchantDetails?.notifiers?.MoblieNumber1)
                form.append('notifier_1', payload.contextData.merchantDetails.notifiers.MoblieNumber1);
            form.append('reference_id', payload?.referenceID || '');
            form.append('customer_name', payload?.name || '');
            form.append('store_id', payload?.storeLabel || '');
            form.append('store_id', payload?.storeLabel || '');
            form.append('customer_lat', payload?.dbtrLatd || '');
            form.append('customer_log', payload?.dbtrLong || '');
            form.append('bill_number', payload?.billNumber || '');
            form.append('loyalty_number', payload?.loyaltyNumber || '');
            form.append('customer_email', payload?.customerEmail || '');
            form.append('transactionScheme', payload?.transactionScheme || '');
            form.append('purpose_of_transactions', payload?.purposeOfTransaction || '');
            form.append('additional_parameter_1', payload?.customerIBAN || '');
            form.append('additional_parameter_2', payload?.customerLabel || '');
            form.append('additional_parameter_3', payload?.merchantChannel || '');
            form.append('additional_parameter_4', payload?.BIC || '');
            form.append('additional_parameter_5', payload?.contextOfTransaction || '');

            AKSA_IPN_API.headers = form.getHeaders();
            let ipnResponse = await axios.post(AKSA_IPN_V2, form, AKSA_IPN_API);
            logger.debug({ event: 'Exited function', functionName: 'triggerIPN in class QRPaymentHelper', IPNResponse: ipnResponse.data });
            logger.info({
                event: '***** IPN status code *****',
                functionName: 'QRPaymentHelper.triggerIPN',
                data: ipnResponse?.status
            });

            logger.info({
                event: '***** IPN headers *****',
                functionName: 'QRPaymentHelper.triggerIPN',
                data: ipnResponse?.headers
            });

            if (ipnResponse && payload.attempts >= 0) {
                //! Mark Successful IPN as completed if it was requested via Scheduler
                let query = { msisdn_trxId: `${payload.msisdn}_${payload.txID}` };
                await this.IPNFailureModel.findOneAndUpdate(query, { status: 'completed' });
            }
        } catch (error) {
            logger.error({ event: "Error thrown", functionName: "triggerIPN in class QRPaymentHelper", error: { message: error.message, stack: error.stack } })

            //! Mongo Entry for Retry, UPSERT The Record
            payload.attempts >= 0 ? payload.attempts += 1 : payload.attempts = 0
            payload.maxAttempts = payload.maxAttempts || 10;
            let query = { msisdn_trxId: `${payload.msisdn}_${payload.txID}` };

            await this.IPNFailureModel.findOneAndUpdate(query, { payload, attempts: payload.attempts, status: payload.attempts <= payload.maxAttempts ? 'pending' : 'failed' }, { new: true, upsert: true });
        }
    }

    async triggerIPNConsumer(payload) {
        try {
            logger.debug({ event: 'Entered function', functionName: 'triggerIPN in class QRPaymentHelper', payload });
            logger.debug({ event: 'merchant details', functionName: 'triggerIPN in class QRPaymentHelper', data : payload?.contextData?.merchantDetails });

           const AKSA_IPN_API = _.cloneDeep(this.APIConfig);
           let data = payload?.contextData?.merchantDetails
            let form = new FormData();
            form.append('jqr_user_name', AKSA_USERNAME);
            form.append('Jqr_pass', AKSA_PASSWORD);
            form.append('merchant_name', data?.name || "None");
            form.append('customer_msisdn', payload?.msisdn);
            if(payload.transactionScheme)
            form.append('transactionScheme', payload.transactionScheme);
            if(payload.tip)
                form.append('tip', payload.tip);
            if(payload.customerCNIC)
                form.append('customer_cnic', payload.customerCNIC);
            if (payload.totalAmount) {
                form.append('transaction_amount', payload.totalAmount);
            } else {
                form.append('transaction_amount', payload.amount);
            }
            let formattedDate =  payload.txEndDate +  payload.txEndTime
             formattedDate = moment(formattedDate, 'YYYYMMDDHHmmss').format('YYYY-MM-DD HH:mm:ss');                        
            form.append('transaction_status', 'true');
            form.append('transaction_id', payload?.txID);
            form.append('transaction_dt', formattedDate);
            form.append('till_id', data?.tillNumber);

            // new fields
            form.append('store_id', payload?.contextData?.merchantDetails?.store_id || payload?.merchantStoreLable || "")
            if(data.loyalty_number)
            form.append('loyalty_number', data?.loyalty_number)
            form.append('bill_number', payload?.contextData?.merchantDetails?.bill_number || "")
            if(data.reference_id)
            form.append('reference_id', data?.reference_id)
            //form.append('customer_label', payload?.contextData?.customer_label || "")
            form.append('additional_parameter_1', payload?.contextData?.customer_label || payload?.customerLabel   || "")
            form.append('purpose_of_transactions', data?.contextData?.purposeOfPayment || payload?.purposeOfPayment ||  "")
            form.append('customer_name', payload?.contextData?.senderName || payload?.senderName  ||  "")

            if(data.msisdn)
                form.append('merchant_msisdn', data?.msisdn);
            if(payload.contextData.merchantDetails?.notifiers?.MoblieNumber1)
                form.append('notifier_1', payload.contextData.merchantDetails.notifiers.MoblieNumber1);
            AKSA_IPN_API.headers = form.getHeaders();

            logger.debug({ event: 'Before Trigger IPN function', functionName: 'triggerIPN in class QRPaymentHelper', form });
            
            let ipnResponse = await axios.post(AKSA_IPN_PATH, form, AKSA_IPN_API);
            logger.info({ event: 'Exited function', functionName: 'triggerIPN in class QRPaymentHelper', IPNResponse: ipnResponse.data });
            
            logger.info({
                event: '***** IPN status code *****',
                functionName: 'QRPaymentHelper.triggerIPN',
                data: ipnResponse?.status
              });

              logger.info({
                event: '***** IPN headers *****',
                functionName: 'QRPaymentHelper.triggerIPN',
                data: ipnResponse?.headers
              });
                    
            if(ipnResponse && payload.attempts >= 0){
                //! Mark Successful IPN as completed if it was requested via Scheduler
                let query = {msisdn_trxId: `${payload.msisdn}_${payload.txID}`};
                await this.IPNFailureModel.findOneAndUpdate(query, {status: 'completed' });
            }
        } catch (error) {
            logger.error({ event: "Error thrown", functionName: "triggerIPN in class QRPaymentHelper", error: { message: error.message, stack: error.stack } })
            
            //! Mongo Entry for Retry, UPSERT The Record
            payload.attempts >= 0 ? payload.attempts += 1 : payload.attempts = 0
            payload.maxAttempts = payload.maxAttempts || 10;
            let query = {msisdn_trxId: `${payload.msisdn}_${payload.txID}`};
            
            await this.IPNFailureModel.findOneAndUpdate(query, {payload, attempts: payload.attempts, status: payload.attempts <= payload.maxAttempts ? 'pending' : 'failed' }, {new: true, upsert: true});
        }
    }

    async notify(payload) {
        try {
            logger.debug({ event: 'Entered function', functionName: 'notify in class QRPaymentHelper', payload });
            let notificationData = [
                { key: 'transID', 'value': payload.txID },
                { key: 'senderMsisdn', 'value': this.maskPhoneNo(payload.msisdn)},
                { key: 'senderName', 'value': payload.name },
                { key: 'receiverMsisdn', 'value': payload.contextData.merchantDetails.msisdn },
                { key: 'receiverName', 'value': payload.contextData.merchantDetails.name },
                { key: 'receiverTillNumber', 'value': payload.contextData.merchantDetails.tillNumber },
                // { key: 'amount', 'value': payload.amount },
                { key: 'fee', 'value': payload.fee },
                { key: 'transDate', value: payload.txEndDate }
            ]
            let amountObj = {};
            if (payload.totalAmount) {
                amountObj = { key: 'amount', 'value': payload.totalAmount }
            } else {
                amountObj = { key: 'amount', 'value': payload.amount }
            }
            notificationData.push(amountObj);

            Notification.sendPushNotificationByMSISDN(payload.contextData.merchantDetails.msisdn, NOTIFY_MERCHANT, RECEIVER_NOTIFICATION_TEMPLATE, notificationData, null);
          
            Notification.sendPushNotificationByMSISDN(payload.contextData.merchantDetails.msisdn, NOTIFY_MERCHANT, REFRESH_NOTIFICATION_TEMPLATE, [], null);
            Notification.sendPushNotificationByMSISDN(payload.msisdn, NOTIFY_CONSUMER, REFRESH_NOTIFICATION_TEMPLATE, [], null);
        
            logger.debug({ event: 'Exited function', functionName: 'notify in class QRPaymentHelper' });
        } catch (error) {
            logger.error({ event: "Error thrown", functionName: "notify in class QRPaymentHelper", error: { message: error.message, stack: error.stack } })
        }
    }

    maskPhoneNo(phoneNo){
        return phoneNo.replace(/\d(?=\d{3})/g, "*")
    }

    async smsNotifiersDirect(merchantMsisdn, txID, amount, senderMsisdn) {
        try {
            logger.debug({ event: 'Entered function', functionName: 'smsNotifiers in class QRPaymentHelper', merchantMsisdn, txID, amount });
            let reqPayload = {
                "amount": amount,
                "txID": txID,
                "msisdn": merchantMsisdn,
                "senderMsisdn": senderMsisdn
            }
            let smsResponse = await axios.post('', reqPayload, { baseURL: SMS_NOTIFIERS, timeout: AXIOS_TIMEOUT });
            logger.debug({ event: 'Exited function', functionName: 'smsNotifiers in class QRPaymentHelper', smsResponse});
        } catch (error) {
            logger.error({ event: "Error thrown", functionName: "smsNotifiers in class QRPaymentHelper", error: { message: error.message, stack: error.stack } })
        }
    }

    async smsNotifiers(merchantMsisdn, txID, amount, senderMsisdn) {
        try {
            logger.debug({ event: 'Entered function', functionName: 'smsNotifiers in class QRPaymentHelper', merchantMsisdn, txID, amount });
            let reqPayload = {
                "amount": amount,
                "txID": txID,
                "msisdn": merchantMsisdn,
                "senderMsisdn": senderMsisdn
            }
            let smsResponse = await axios.post('', reqPayload, { baseURL: SMS_NOTIFIERS, timeout: AXIOS_TIMEOUT });
            // this.subscriber.event.produceMessage(reqPayload, config.kafkaBroker.topics.Notification_Sms);
            logger.debug({ event: 'Exited function', functionName: 'smsNotifiers in class QRPaymentHelper', smsResponse});
        } catch (error) {
            logger.error({ event: "Error thrown", functionName: "smsNotifiers in class QRPaymentHelper", error: { message: error.message, stack: error.stack } })
        }
    }

    async notifyRefreshBalance(msisdn) {
        try {
            logger.debug({ event: 'Entered function', functionName: 'notifyRefreshBalance in class QRPaymentHelper', msisdn });
            Notification.sendPushNotificationByMSISDN(msisdn, NOTIFY_MERCHANT, REFRESH_NOTIFICATION_TEMPLATE, [], null);
            
            logger.debug({ event: 'Exited function', functionName: 'notify in class QRPaymentHelper' });
        } catch (error) {
            logger.error({ event: "Error thrown", functionName: "notify in class QRPaymentHelper", error: { message: error.message, stack: error.stack } })
        }
    }

    async checkIfRatable(sender, merchantMsisdn, amount, isOtherMerchant) {
        try {
            logger.debug({ event: 'Entered function', functionName: 'checkIfRatable in class QRPaymentHelper', sender, merchantMsisdn, amount });
            let configVals = await this.getMinRatingAmountFromConfig();
            let limit = 0;
            if (!configVals) {
                return false;
            }
            let dailyTxCount = await this.getDailyTxCount(sender, merchantMsisdn, amount, isOtherMerchant);
            let merchantMinAmount;
            if (!isOtherMerchant) {
                merchantMinAmount = await this.getMinRatingAmountMerchant(merchantMsisdn);
            }

            if (configVals.dailyMaxLimit < dailyTxCount) {
                logger.debug({ event: "debugging", msg: "Daily Max Limit for Rating Reached. Transaction Not to be Rated." });
                return false;
            }

            if (merchantMinAmount || merchantMinAmount != undefined) {
                logger.debug({ event: "debugging", msg: "Merchant Min Amount Found" });
                if (merchantMinAmount > configVals.amountLimit) {
                    limit = merchantMinAmount;
                    logger.debug({ event: "debugging", msg: "Amount Limit Overriden by Merchant Amount Limit: " + limit });
                }
            } else {
                limit = configVals.amountLimit;
                logger.debug({ event: "debugginh", msg: "Global Amount Limit Enforced: " + limit });
            }
            if (amount < limit) {
                logger.debug({ event: "debugging", msg: "Amount Less than Minimum Rateable Amount. Transaction Not to be Rated" });
                logger.debug({ event: 'Exited function', functionName: 'checkIfRatable in class QRPaymentHelper', isRatable: false });
                return false;
            }
            logger.debug({ event: 'Exited function', functionName: 'checkIfRatable in class QRPaymentHelper', isRatable: true });
            return true;
        } catch (error) {
            logger.error({ event: "Error thrown", functionName: "checkIfRatable in class QRPaymentHelper", error: { message: error.message, stack: error.stack } })
            return false
        }
    }

    async getMinRatingAmountFromConfig() {
        logger.debug({ event: 'Entered function', functionName: 'getMinRatingAmountFromConfig in class QRPaymentHelper' });
        try {
            let configData = await axios.get('', { baseURL: CONFIG_QR_RATING_MIN_AMOUNT, timeout: AXIOS_TIMEOUT });
            logger.debug({ event: 'Exited function', functionName: 'getMinRatingAmountFromConfig in class QRPaymentHelper', configVals: configData.data.data[0].value });
            return configData.data.data[0].value;
        }
        catch (error) {
            logger.error({ event: "Error thrown", functionName: "getMinRatingAmountFromConfig in class QRPaymentHelper", error: { message: error.message, stack: error.stack } })
            return false;
        }
    }

    async getMinRatingAmountMerchant(merchantMsisdn) {
        logger.debug({ event: 'Entered function', functionName: 'getMinRatingAmountMerchant in class QRPaymentHelper', merchantMsisdn });
        const API_END_POINT = MERCHANT_QR_RATING_MIN_AMOUNT + merchantMsisdn;
        try {
            let merchantMinAmount = await axios.get('', { baseURL: API_END_POINT, timeout: AXIOS_TIMEOUT });
            logger.debug({ event: 'Exited function', functionName: 'getMinRatingAmountMerchant in class QRPaymentHelper', minRatingAmount: merchantMinAmount.data.data.minRatingAmount });
            return merchantMinAmount.data.data.minRatingAmount;
        }
        catch (error) {
            logger.error({ event: "Error thrown", functionName: "getMinRatingAmountMerchant in class QRPaymentHelper", error: { message: error.message, stack: error.stack } })
            return false;
        }
    }

    async getDailyTxCount(sender, merchantMsisdn, amount, isOtherMerchant) {
        logger.debug({ event: 'Entered function', functionName: 'getDailyTxCount in class QRPaymentHelper', sender, merchantMsisdn, amount });
        try {
            const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()
            const endOfDay = new Date(new Date().setUTCHours(23, 59, 59, 999)).toISOString()
            const query = {
                "msisdn": sender,
                "amount": amount,
                "createdAt": {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            }
            if (isOtherMerchant) {
                query['contextData.merchantDetails.tillNumber'] = merchantMsisdn;
            }else {

                query['contextData.merchantDetails.msisdn'] = merchantMsisdn;
            }
            const txCount = await QRPaymentModel.countDocuments(query);
            logger.debug({ event: "Debugging", txCount });
            logger.debug({ event: 'Exited function', functionName: 'getDailyTxCount in class QRPaymentHelper', txCount });
            return txCount;
        }
        catch (error) {
            logger.error({ event: "Error thrown", functionName: "getDailyTxCount in class QRPaymentHelper", error: { message: error.message, stack: error.stack } })
            return 0;
        }
    }
}

export default new QRPaymentHelper(IPNFailureModel);