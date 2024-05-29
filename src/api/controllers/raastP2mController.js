import validations from './validators/validatorEnhanced';
import raastP2mService from '../../services/raastP2mService';
import Subscriber from '../../services/subscriberService';
import Notification from '../../util/notification';

import { HTTP_STATUS } from '../../util/constants';
import { successResponse, errorResponse, printLog, printError } from '../../util/utility';
import moment from 'moment';
import 'moment-timezone';
class raastP2mController {
    constructor(service) {

        this.raastP2mService = service;
        this.merchantDetails = this.merchantDetails.bind(this);

    }

    async merchantDetails(req, res) {

        printLog(
            'Entered function',
            'raastP2mController.merchantDetails',
            { body: req.body, headers: req.headers }
        );

        try {

            const payload = req.body;

            payload.msisdn = req.get('X-MSISDN');
            payload.thirdParty = req.get('X-CHANNEL');

            printLog(
                'Schema validation',
                'raastP2mController.merchantDetails',
                payload
            );

            const validationResponse = validations.verifySchema(
                "MERCHANT_DETAILS",
                payload
            );

            printLog(
                'Schema validation response',
                'raastP2mController.merchantDetails',
                validationResponse
            );

            if (!validationResponse.success) {
                return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send(validationResponse);
            }

            const response = await raastP2mService.merchantDetails(payload);

            printLog(
                'Exited function',
                'raastP2mController.merchantDetails',
                response
            );

            const { success = false } = response;

            if (success) {

                return successResponse(
                    res,
                    response
                );

            } else {

                return errorResponse(
                    res,
                    response
                );

            }

        } catch (error) {

            printError(error, 'raastP2mController.merchantDetails');

            return errorResponse(
                res
            );
        }
    }

    async p2mHistory(req, res) {

        printLog(
            'Entered function',
            'raastController.p2mHistory',
            { body: req.body, headers: req.headers },
        );

        try {

            const payload = req.body;

            payload.msisdn = req.get('X-MSISDN');
            payload.thirdParty = req.get('X-CHANNEL');
            payload.publicIP = req.get('x-forwarded-for') || req.get('x-x-forwarded-for') || payload.publicIP;
            payload.publicPort = req.get('client-ip') || payload.publicPort;

            printLog(
                'Schema validation',
                'raastController.p2mHistory',
                payload,
            );
              if(!payload.transactionID)
                return  errorResponse(
                    res,
                    { message_en: "transactionID is required" }
                 );
            let trxPaylaod = {
                TRANS_ID: payload.transactionID || "",
                TRX_DTTM: payload.timestamp || moment().tz("Asia/Karachi").format('YYYY-MM-DDTHH:mm:ss') || "",
                INITIATOR_NAME: payload.senderName || "",
                INITIATOR_MSISDN: payload.senderNumber || "",
                TRX_CHANNEL: payload.thirdParty || "",
                TRX_TYPE: payload.trxType || "RAAST P2M",
                AC_FROM: payload.senderNumber || "",
                AC_TO: payload.receiver_msisdn || "",
                UTILITY_COMPANY: "",
                CONSUMER_NO: "",
                FEE: payload.fee || "0.00",
                FED: payload.fed || "0.00",
                WHT: payload.wht || "0.00",
                GROSS_AMT: (payload.amount).toString(),
                AMOUNT_DEBITED: payload.amount || "",
                AMOUNT_CREDITED: payload.amount || "",
                BENEFICIARY_MSISDN: payload.receiver_msisdn || "",
                DESCRIPTION: "Amount Transferred",
                REASON_TYPE: "Money Transfer - P2M",
                PUBLIC_IP: payload.publicIP,
                PUBLIC_PORT: payload.publicPort,
                CONTEXT_DATA: {
                    TRANSACTION_AMOUNT: payload.amount || "",
                    BENEFICIARY_NAME: payload.receiver_name || "",
                    BENEFICIARY_TILL_NO: payload.sender_tillno|| "",
                    RRN_NO: payload.rrn_no || "",
                    originalTxnId: payload.originalTxnId || "",
                    originalInstrId: payload.originalInstrId || "",
                    TIP: payload.tip || "",
                    RECIEVER_MSISDN: payload.receiver_msisdn || "",
                    useCase: "p2m",
                    isRepeatable: true,
                    isRefundable: false,
                    trx_name: "Money Transfer - p2m",
                    flowId: "",
                    category: "",
                    subCategory: ""
                }
            }

            let subscriber = Subscriber.getInstance();
            subscriber.event.produceMessage(trxPaylaod, 'TRX_HISTORY_REPORTING');

            let msisdn = payload.msisdn;
            let maskedMsisdn = `${msisdn.substring(0, 4)}****${msisdn.slice(-3)}`;
            let transTime = payload.timestamp ? moment(payload.timestamp).format('DD/MM/YYYY HH:mm:ss') : moment().tz("Asia/Karachi").format('DD/MM/YYYY HH:mm:ss');
            
            const dataForNotification = [
                {
                key: 'senderName',
                value: trxPaylaod.INITIATOR_NAME || ""
                },
                {
                key: 'amount',
                value: trxPaylaod.AMOUNT_CREDITED || ""
                },
                {
                key: "senderMsisdn",
                value: maskedMsisdn || ""
                },
                {
                key: 'TID',
                value: trxPaylaod.TRANS_ID || ""
                },
                {
                key: 'balnace',
                value: trxPaylaod.AMOUNT_CREDITED || ""
                },
                {
                key: "timeStamp",
                value: transTime || moment().tz("Asia/Karachi").format('DD/MM/YYYY HH:mm:ss') || ""
                },
                {
                key: 'originalTID',
                value: trxPaylaod.CONTEXT_DATA?.originalTxnId || ""
                }
            ];
            Notification.sendSMS(payload.msisdn, 'consumer', "REFUND_MONEY_P2M_ADD_SMS", dataForNotification);
            return successResponse(
                res,
                {}
            );


        } catch (error) {

            printError(error, 'raastController.p2mHistory');

            return errorResponse(
                res
            );
        }
    }

    async p2mConfirm(req, res) {

        printLog(
            'Entered function',
            'RaastController.p2mConfirm',
            { body: req.body, headers: req.headers },
        );

        try {

            const payload = {
            ...req.body,
            msisdn: req.get('X-MSISDN'),
            thirdParty: req.get('X-CHANNEL'),
            mpin: req.get('X-MPIN'),
            appType: req.get('X-APP-TYPE'),
            appVersion: req.get('X-APP-VERSION'),
            deviceID: req.get('X-DEVICE-ID'),
            ipAddress: req.get('X-IP-ADDRESS')
           }
            const validationResponse = validations.verifySchema("P2M_CONFIRM_PAYLOAD", payload)

            printLog(
                'payload validation response',
                'RaastController.p2mConfirm',
                validationResponse
            );

            if (!validationResponse.success) {
                return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send(validationResponse);
            }

            let response = await raastP2mService.p2mConfirm(payload);

            printLog(
                'Exited function',
                'RaastController.p2mConfirm',
                response
            );

            const { success = false } = response;

            if (success) {                
                let msisdn = payload.msisdn;
                let maskedMsisdn = msisdn.substring(0, 4) + '****' + msisdn.slice(-3);
                let maskediban = payload.iban?.substring(0,2) + '*'.repeat(payload.iban?.length -4) + payload.iban?.substring(payload.iban?.length, payload.iban?.length-4);let transTime = payload.timestamp ? moment(payload.timestamp).format('DD/MM/YYYY HH:mm:ss') : moment().tz("Asia/Karachi").format('DD/MM/YYYY HH:mm:ss');
                
                const dataForNotification = [
                    {
                        key: 'amount',
                        value: payload.amount || ""
                    },
                    {
                        key: "senderMsisdn",
                        value: maskedMsisdn || ""
                    },
                    {
                        key: 'TID',
                        value: response?.data?.jazzTransactionId ?? payload?.transactionID ?? ""
                    },
                    {
                        key: 'balance',
                        value: response?.data?.balance ?? payload?.balance ?? ""
                    },
                    {
                        key: "timeStamp",
                        value: transTime
                    },
                    {
                        key: 'fee',
                        value: payload.fee || "0.0"
                    },
                    {
                        key: 'iBan',
                        value: maskediban || ""
                    }
                ];
                
                Notification.sendSMS(payload.msisdn, 'consumer', "ADDMONEY_P2M_ADD_SMS", dataForNotification);
                
                return successResponse(
                    res,
                    response
                );

            } else {

                return errorResponse(
                    res,
                    response
                );

            }
        } catch (error) {
            printError(error, 'RaastController.p2mConfirm');
            return errorResponse(
                res
            );
        }

    }
}

export default new raastP2mController(raastP2mService);