import axios from 'axios';
import { printLog, printError } from '../util/utility';
import responseCodeHandler_New from '../util/responseCodeHandler_New';
import emvqr from 'emvqr-latest';
import cache from '../util/cache';
import qrPaymentService from './qrPaymentService';
import ESBRFiveService from '../util/esbRFiveService';
import QRPaymentModel from '../model/qrPayments';
import QRHelper from './helpers/qrPaymentHelper';
import MerchantDetailModel from '../model/merchantDetailModel';
import moment from 'moment';
import 'moment-timezone';
import Subscriber from '../services/subscriberService'

const TRANSACTION_MAP = config.responseCode.useCases['raastP2M'];
const failureResponse = { success: false, data: {}, message_en: "Something went wrong. Please try again later" };
const GET_RAAST_SCHEMES = process.env.RAAST_SCHEMES || config.externalServices.masterDataAPI.raastSchemes;
const CONFIRM_URL  = process.env.CONFIRM_URL || config.externalServices.p2m.CONFIRM_URL;
const WSO2_P2M  = process.env.WSO2_P2M || config.externalServices.p2m.WSO2_P2M;
const MPIN_ENCRYPTION_KEY = process.env.MPIN_ENCRYPTION_KEY || config.mpinKey.value;
const PRINT_BIT = 0;
class raastP2mService {
    constructor(qrModel, merchantModel) {
        
        this.QRPaymentModel = qrModel;
        this.merchantDetail = merchantModel;
        this.merchantDetails = this.merchantDetails.bind(this);
        this.dynamicQR = this.dynamicQR.bind(this);
        this.checkQRcode = this.checkQRcode.bind(this);
        this.checkTillNumber = this.checkTillNumber.bind(this);
        this.p2mConfirm = this.p2mConfirm.bind(this);
        this.checkDefaultAccountByAlias = this.checkDefaultAccountByAlias.bind(this);
    }

    async merchantDetails(payload) {

        printLog(
            'Entered function',
            'raastP2mService.merchantDetails',
            payload
        );

        let error = new Error();

        // iban of customer from front end required in ws02 wrapper 
        // account title of customer from front end required in ws02 wrapper 
        // email id of customer from front end required in ws02 wrapper
        // mpin of customer required in ws02 wrapper 
        // tip or total amount required in ws02 wrapper

        try {

            let decodedQR = {};
            let response = {
                        identifierType: '',
                        qrString: '',
                        txType: '',
                        notifiers: {},

                        cnic: '',
                        address: '',
                        mcc : '',
                        transactionCurrency : '',
                        schemes : [],
                        tip : [],
                        countryCode : '',
                        businessName : '',
                        accountTitle : '',
                        merchantCity : '',
                        postalCode : '',
                        billNumber : '',
                        mobileNumber : '',
                        storeLabel : '',
                        loyaltyNumber : '',
                        referenceLabel : '',
                        customerLabel : '',
                        alac : '', // tillNumber
                        purposeOfTransaction : '',
                        additionalConsumerData : '',
                        bic: '',
                        iban: '',
                        taxId : '',
                        contextOfTransaction : '',
                        type: 'static',
                        isJazzcashMerchant: false
            }

            if (payload?.type && payload?.type?.toLowerCase() === 'qrcode') {

                printLog(
                    'Qrcode flow initiated',
                    'raastP2mService.merchantDetails'
                );

                decodedQR = emvqr.decode(payload.payload);

                printLog(
                    'Decoded QR value',
                    'raastP2mService.merchantDetails',
                    decodedQR
                );

                // Tag 04 | 05 : Mastercard
                // Tag 26 : Jazzcash
                // Tag 28 : Raast

                if ( 
                     !decodedQR['04'] &&
                     !decodedQR['05'] &&
                     !decodedQR['26'] &&
                     !decodedQR['28']
                   ) {

                    // Generic error to shown, flow will be terminated
                    return await responseCodeHandler_New.getResponseCode(TRANSACTION_MAP.error);

                }

                // Tag 01 , value 11 : Static QR
                // Tag 02 , value 12 : Dynamic QR

                if (decodedQR['01'] && decodedQR['01'].data && decodedQR['01'].data === '11') {

                    printLog(
                        'Static flow triggered',
                        'raastP2mService.merchantDetails'
                    );

                    // checkQRcode : login aksa, merchant details, notifers
                    const checkQRcodeRes = await this.checkQRcode(decodedQR, response);

                    printLog(
                        'Response from check qr code function',
                        'raastP2mService.checkQRcodeRes',
                        checkQRcodeRes
                    );

                    if(checkQRcodeRes && !checkQRcodeRes.success) {

                        error.message = 'Something went wrong while getting login aksa api and checking merchant details from aksa';
                        throw error;

                    } else {

                        response = checkQRcodeRes

                        printLog(
                            'Exiting function',
                            'raastP2mService.merchantDetails',
                            response
                        );
        
                        return response;
                    }


                } else if (decodedQR['01'] && decodedQR['01'].data && decodedQR['01'].data === '12') {

                    printLog(
                        'Dynamic flow triggered',
                        'raastP2mService.merchantDetails'
                    );

                    return this.dynamicQR(payload,decodedQR,response)

                } else {

                    printLog(
                        'Neither static nor dynamic flow triggered',
                        'raastP2mService.merchantDetails'
                    );

                    return await responseCodeHandler_New.getResponseCode(TRANSACTION_MAP.error);

                }
                
            }  else if (payload?.type && payload?.type?.toLowerCase() === 'tillnumber' || payload?.type && payload?.type === 'mid' || payload?.type && payload?.type === 'vpa') {

                if (payload?.payload?.length > 8 && payload?.payload?.length != 8 && payload?.payload?.substring(0,2) != "98") {

                    printLog(
                        'Till number flow initiated',
                        'raastP2mService.checkDefaultAccountByAlias',
                        payload
                    );

                    return await this.checkDefaultAccountByAlias(payload, response); // thirdparty till number mid or vpa,

                } else {

                    printLog(
                        'Till number flow initiated',
                        'raastP2mService.checkTillNumber',
                        payload
                    );

                    return this.checkTillNumber(payload, response)
                }


            } else {

                error.message = 'type QR code not found in type of request';
                throw error;

            }

        } catch (error) {

            printError(error, 'raastP2mService.merchantDetails')

            return {
                ...failureResponse
            };
        }
    }

    async checkQRcode(decodedQR,response) {

        printLog(
            'Entered function',
            'raastP2mService.checkQRcode',
            {decodedQR,response}
        );
        let query = {};
        let tillNumber = ""
        let merchantDetails = {};
        let notifierData = {};
        let schemes = [];
        let tip = {};
        let schemesPriority = [];
        let priority = '';
        let merchantMsisdn = ""
        let error = new Error();
        try {

             // Tag 28 contains sub tag 02 and it contain 'JCMA' value in it or Tag 26 has sub-tag 00 with 05 value in it
             if(decodedQR['26'] && decodedQR['26'].data && decodedQR['26'].data['00'] && decodedQR['26'].data['00'].data && decodedQR['26'].data['00'].data === '05' || 
                decodedQR['28'] && decodedQR['28'].data && decodedQR['28'].data['02'] && decodedQR['28'].data['02'].data && typeof decodedQR['28'].data['02'].data === 'string' && decodedQR['28'].data['02'].data.toLowerCase().includes('jcma')) {

                response.isJazzcashMerchant = true; // in payment flow, it is required in order to send notifiers and call ipn of aksa api, instead of adding this check there, we are applying the check and setting the bit here so that we dont have to add this check again in payment flow

                // Fetch merchant details

                if(
                    decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['07'] &&
                    decodedQR['62'].data['07'].name && decodedQR['62'].data['07'].name.toLowerCase() === 'terminal label' && 
                    decodedQR['62'].data['07'].data && decodedQR['62'].data['07'].data !== '' ) {

                        tillNumber = decodedQR['62'].data['07'].data;

                        // Optimization

                        merchantDetails = await cache.getValue(tillNumber, config.cacheQRPayment.cacheName);

                        if(!merchantDetails) {
                            
                            // get token

                            let aksaToken = await qrPaymentService.loginAKSA();

                            printLog(
                                'Response from qrpaymentservice login aksa api',
                                'raastP2mService.checkQRcode',
                                aksaToken
                            );

                            if (!aksaToken) {

                                return await responseCodeHandler_New.getResponseCode(config.responseCode.useCases.MerchantDetails.authentication, null, null);

                            }

                            // check qrcode api
                            
                            merchantDetails = await qrPaymentService.getMerchantDetailsFromAKSA({TillNumber: tillNumber, PrintBit: PRINT_BIT},aksaToken)

                            if (!merchantDetails || merchantDetails.success === false || merchantDetails.Data.length === 0) {
                                error.message = 'Something went wrong from merchant details from aksa';
                                throw error;
                            }
                            
                            printLog(
                                'Response from qrpaymentservice getMerchantDetailsFromAKSA api',
                                'raastP2mService.checkQRcode'
                            );
                            
                            merchantDetails.tillNumber = merchantDetails?.Data[0]?.TillNumber;
                            merchantDetails.oldtillNumber = merchantDetails?.Data[0]?.OldTillNumber;


                
                                merchantDetails.tillNumber && cache.putValue
                                (
                                  merchantDetails.tillNumber,
                                  merchantDetails,
                                  config.cacheQRPayment.cacheName
                                );

                                merchantDetails.oldtillNumber && cache.putValue
                                (
                                  merchantDetails.oldtillNumber,
                                  merchantDetails,
                                  config.cacheQRPayment.cacheName
                                );

                                printLog(
                                    'saving merchant details in cache',
                                    'raastP2mService.checkQRcode'
                                );
                            

                            printLog(
                                'flag value for saving merchantDetails',
                                'raastP2mService.checkQRcode'
                            );
                            
                        }

                        // Update Notifiers

                        if (merchantDetails && merchantDetails.Success && merchantDetails.Data && merchantDetails.Data.length > 0) {

                            merchantMsisdn = merchantDetails.Data[0].MerchantMSISDN
                            notifierData = {
                                            MoblieNumber1: merchantDetails.Data[0].MoblieNumber1,
                                            MoblieNumber2: merchantDetails.Data[0].MoblieNumber2,
                                            MoblieNumber3: merchantDetails.Data[0].MoblieNumber3,
                                            MoblieNumber4: merchantDetails.Data[0].MoblieNumber4,
                                            MoblieNumber5: merchantDetails.Data[0].MoblieNumber5,
                                            MoblieNumber6: merchantDetails.Data[0].TerminalNumber && merchantDetails.Data[0].TerminalNumber != 'null' ? merchantDetails.Data[0].TerminalNumber : "",
                                            ShopName: merchantDetails.Data[0].ShopName
                                        }

                            // response.merchantMsisdn = merchantDetails.Data[0].MerchantMSISDN;
                            // response.merchantName = merchantDetails.Data[0].ShopName;
                            // response.tillNumber = merchantDetails.Data[0].TillNumber; // from decoded qr these values will be returned
                            response.identifierType = "1";
                            response.qrString = merchantDetails.Data[0].QRPayload || '';
                            response.txType = merchantDetails.Data[0].MechantLoop === 1 ? "QR Payment Closed Loop" : "QR Payment Open Loop";
                            response.notifiers = notifierData;
                            response.cnic = merchantDetails.Data[0].CNIC || '';
                            response.address = merchantDetails.Data[0].BrandAddress || '';

                            const updateNotifersRes = qrPaymentService.updateNotifier(notifierData, merchantMsisdn);

                            printLog(
                                'Response from qrpaymentservice updatenotifiers',
                                'raastP2mService.checkQRcode',
                                updateNotifersRes
                            );

                        } else {

                            printLog(
                                'Could not update notifiers due to absence of data in merchantdetails',
                                'raastP2mService.checkQRcode'
                            );

                        }
                    }

            } 

                // Extract schemes, TIP & other merchant details from QR string

                // if Tag is 04 or 05
                // Scheme will be "Mastercard"

                if(decodedQR['04'] || decodedQR['05']) {

                    printLog(
                        'Scheme is mastercard',
                        'raastP2mService.checkQRcode'
                    );

                    schemes.push('mastercard')
                }

                // if Tag 28 contains sub tag 02 and it contain 'JCMA' value in it or Tag is 26 and has sub tag 00 and it contains value "05"
                // Scheme will be "Jazzcash"

                if( 
                    decodedQR['26'] && decodedQR['26'].data && decodedQR['26'].data['00'] && decodedQR['26'].data['00'].data && decodedQR['26'].data['00'].data === '05' ||
                    decodedQR['28'] && decodedQR['28'].data && decodedQR['28'].data['02'] && decodedQR['28'].data['02'].data && typeof decodedQR['28'].data['02'].data === 'string' && decodedQR['28'].data['02'].data.toLowerCase().includes('jcma')
                  ) {

                    printLog(
                        'Scheme is jazzcash',
                        'raastP2mService.checkQRcode'
                    );

                    schemes.push('jazzcash')
                }

                // if Tag is 28 and it has sub tag 00 or 01 or 02
                // Scheme will be "Raast"

                if(decodedQR['28'] && decodedQR['28'].data && (decodedQR['28'].data['00'] || decodedQR['28'].data['01'] || decodedQR['28'].data['02'] )) {
                    
                    printLog(
                        'Scheme is raast',
                        'raastP2mService.checkQRcode'
                    );

                    schemes.push('raast')
                }

                // if Tag is 55 and it contains value 01
                // Tell front end to take TIP value from user

                if(decodedQR['55'] && decodedQR['55'].data && decodedQR['55'].data === '01') {

                    printLog(
                        'Tip is prompt',
                        'raastP2mService.checkQRcode'
                    );
                    
                    tip = {
                            name : 'prompt',
                            value : '0'
                         }

                } else if(decodedQR['55'] && decodedQR['55'].data && decodedQR['55'].data === '02') {

                // if Tag is 55 and it contains value 02, check in Tag 56 and return the fixed value

                    printLog(
                        'Tip is fixed',
                        'raastP2mService.checkQRcode'
                    );

                    tip = {
                            name : 'fixed',
                            value : decodedQR['56'] && decodedQR['56'].data
                         }

                } else if(decodedQR['55'] && decodedQR['55'].data && decodedQR['55'].data === '03') {

                // if Tag is 55 and it contains value 03, check in Tag 57 and return the percentage value

                    printLog(
                        'Tip is percentage',
                        'raastP2mService.checkQRcode'
                    );

                    tip = {
                            name : 'percentage',
                            value : decodedQR['57'] && decodedQR['57'].data
                        }
                }

                response.mcc = decodedQR['52'] && decodedQR['52'].data.match(/\d+/) && decodedQR['52'].data.match(/\d+/)[0] || ''; // merchantCategoryCode
                response.transactionCurrency = decodedQR['53'] && decodedQR['53'].data || '';
                response.countryCode = decodedQR['58'] && decodedQR['58'].data || '';
                
                response.businessName = decodedQR['59'] && decodedQR['59'].data || ''; // merchant Name
                response.accountTitle = decodedQR['59'] && decodedQR['59'].data || '';
                
                response.merchantCity = decodedQR['60'] && decodedQR['60'].data || '';
                response.postalCode = decodedQR['61'] && decodedQR['61'].data || '';

                response.billNumber = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['01'] && decodedQR['62'].data['01'].data || '';
                response.mobileNumber = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['02'] && decodedQR['62'].data['02'].data || ''; // merchantMsisdn

                response.storeLabel = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['03'] && decodedQR['62'].data['03'].data || '';
                //response.branch = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['03'] && decodedQR['62'].data['03'].data || '';

                response.loyaltyNumber = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['04'] && decodedQR['62'].data['04'].data || '';
                response.referenceLabel = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['05'] && decodedQR['62'].data['05'].data || '';
                response.customerLabel = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['06'] && decodedQR['62'].data['06'].data || '';
                response.alac = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['07'] && decodedQR['62'].data['07'].data || ''; // terminalLabel
                response.purposeOfTransaction = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['08'] && decodedQR['62'].data['08'].data;
                response.contextOfTransaction = decodedQR['80'] && decodedQR['80'].data  || ''; //  tag 80 Context of transaction 
                response.additionalConsumerData = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['09'] || '';
                response.taxId = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['10'] || '';
                response.merchantChannel = decodedQR['62'] && decodedQR['62'].data && decodedQR['62'].data['11'] || '';
                
                response.bic = decodedQR['28'] && decodedQR['28'].data && decodedQR['28'].data['01'] && decodedQR['28'].data['01'].data || ''; // BIC, bank identification code
                response.iban = decodedQR['28'] && decodedQR['28'].data && decodedQR['28'].data['02'] && decodedQR['28'].data['02'].data || ''; // merchant iban

                response.amount = decodedQR['54'] && decodedQR['54'].data || ''; // transaction amount for dynamic qr

                response.tip = tip;
                response.schemes = schemes;

            printLog(
                'Exiting function',
                'raastP2mService.checkQRcode',
                response
            );

              // static QR priority fetched

              let raastPriorityRes={};
              
              raastPriorityRes.data = await cache.getValue(
                config.cacheFetchPriority.consumerKey,
                config.cacheFetchPriority.cacheName
              );
              
              if(!raastPriorityRes?.data){
                raastPriorityRes = await axios.get(GET_RAAST_SCHEMES);
              }
            
              printLog(
                  'Response of raast schemes api from masterdata',
                  'raastP2mService.checkQRcode',
                  { data: raastPriorityRes?.data }
              );

              raastPriorityRes = raastPriorityRes?.data instanceof Array && raastPriorityRes?.data?.length ? raastPriorityRes.data[0] : (raastPriorityRes?.data?.data ? raastPriorityRes?.data?.data[0] : null) ;
              
              if(!raastPriorityRes?.static || !raastPriorityRes?.dynamic) {

                return {
                    success : false
                 };

              }

              if(response.type === 'static') {

                printLog(
                    'Qr type is static',
                    'raastP2mService.checkQRcode'
                );

                schemesPriority = raastPriorityRes.static

              } else if(response.type === 'dynamic') { 

                printLog(
                    'Qr type is dynamic',
                    'raastP2mService.checkQRcode'
                );

                schemesPriority = raastPriorityRes.dynamic

              }
    
              for(let i = 0; i < schemesPriority.length; i++) {

                const normalizedPriority = schemesPriority[i].toLowerCase()
                  
                  schemes.find(element => {

                      if(element.toLowerCase() == normalizedPriority) return priority = normalizedPriority

                  })
          
                  if(priority && priority !== '') break; // only one elemet has to return
          
              }
          
            return {
                data : {
                     ...response,
                    staticPriority: raastPriorityRes.static, // front end will not use this, its just for debugging purpose
                    dynamicPriority: raastPriorityRes.dynamic,
                    priority: priority, // priority front end will use
                },
                success: true
            }

         }  catch (error) {

            printError(error, 'raastP2mService.checkQRcode')

            return {
               success : false,
               data: {}
            };
        }

    }

    async dynamicQR(payload,decodedQR,res) {

        try {

            printLog(
                'Entered function',
                'raastP2mService.dynamicQR',
                { payload,decodedQR }
            );

            let error = new Error();
            let response = {
                    ...res,
                    amount : '',
                    type: 'dynamic'
             }

            // Tag 04,05,26,28 are not present or Tag 01 has 12 value and Tag 28 is present ( preventing dynamic qr flow condition)
            if ( 
                !decodedQR['04'] && 
                !decodedQR['05'] && 
                !decodedQR['26'] && 
                !decodedQR['28'] && ( decodedQR['01'] && decodedQR['01'].data && decodedQR['01'].data === '12' && decodedQR['28'] )
                ) {

               // Generic error to shown, flow will be terminated
               return await responseCodeHandler_New.getResponseCode(TRANSACTION_MAP.error);

           }

            // checkQRcode : login aksa, merchant details, notifers
            const checkQRcodeRes = await this.checkQRcode(decodedQR, response);

            printLog(
                'Response from check qr code function',
                'raastP2mService.dynamicQR',
                checkQRcodeRes
            );

            if(checkQRcodeRes && !checkQRcodeRes.success) {

                error.message = 'Something went wrong while getting login aksa api and checking merchant details from aksa';
                throw error;

            } else {

                response = checkQRcodeRes
            }

            // return error in case raast scheme is set as priority, dynamic qr is only for existing jazzcash and mastercard, although it would not first from BO

            if(checkQRcodeRes && checkQRcodeRes.success && checkQRcodeRes.data && checkQRcodeRes.data.priority === 'raast') {

                printLog(
                    'Condition where raast scheme is set as priority',
                    'raastP2mService.dynamicQR'
                );

                   // Generic error to shown, flow will be terminated, Something went wrong while trying to scan the QR Code.
                   return await responseCodeHandler_New.getResponseCode(TRANSACTION_MAP.error);

            }

            printLog(
                'Exiting function',
                'raastP2mService.dynamicQR',
                response
            );

            return response;
    

        } catch(error) {

            printError(error, 'raastP2mService.dynamicQR')

            return {
                ...failureResponse
            };

        }
    }

    async checkTillNumber(payload,decodedQR,res) {

        try {
            let query = {};
            let merchantDetails = {};
            let notifierData = {};
            let merchantMsisdn = "";
            let error = new Error();
            printLog(
                'Entered function',
                'raastP2mService.checkTillNumber',
                { payload,decodedQR }
            );

            let response = {
                    ...res,
                    type: 'tillnumber'
             }

             // Optimization

             merchantDetails = await cache.getValue(payload.payload, config.cacheQRPayment.cacheName);
             
             if(!merchantDetails) {

                // get token

                let aksaToken = await qrPaymentService.loginAKSA();

                printLog(
                    'Response from qrpaymentservice login aksa api',
                    'raastP2mService.checkTillNumber',
                    aksaToken
                );

                if (!aksaToken) {

                    return await responseCodeHandler_New.getResponseCode(config.responseCode.useCases.MerchantDetails.authentication, null, null);
                }

                merchantDetails = await qrPaymentService.getMerchantDetailsFromAKSA({TillNumber: payload.payload, PrintBit: PRINT_BIT},aksaToken)

                if (!merchantDetails || merchantDetails.success === false || merchantDetails.Data.length === 0) {
                    error.message = 'Something went wrong from merchant details from aksa';
                    throw error;
                }

                printLog(
                    'Response from qrpaymentservice getMerchantDetailsFromAKSA api',
                    'raastP2mService.checkTillNumber'
                );
                
                merchantDetails.tillNumber = merchantDetails?.Data[0]?.TillNumber;
                merchantDetails.oldtillNumber = merchantDetails?.Data[0]?.OldTillNumber;

         
                    merchantDetails.tillNumber && cache.putValue
                    (
                      merchantDetails.tillNumber,
                      merchantDetails,
                      config.cacheQRPayment.cacheName
                    );

                    merchantDetails.oldtillNumber && cache.putValue
                    (
                      merchantDetails.oldtillNumber,
                      merchantDetails,
                      config.cacheQRPayment.cacheName
                    );
                    printLog(
                        'saving merchant details in cache',
                        'raastP2mService.checkQRcode'
                    );
                

                printLog(
                    'flag value for saving merchantDetails',
                    'raastP2mService.checkTillNumber'
                );

            }


              // Update Notifiers

              if (merchantDetails && merchantDetails.Success && merchantDetails.Data && merchantDetails.Data.length > 0) {

                 merchantMsisdn = merchantDetails.Data[0].MerchantMSISDN
                  notifierData = {
                                  MoblieNumber1: merchantDetails.Data[0].MoblieNumber1,
                                  MoblieNumber2: merchantDetails.Data[0].MoblieNumber2,
                                  MoblieNumber3: merchantDetails.Data[0].MoblieNumber3,
                                  MoblieNumber4: merchantDetails.Data[0].MoblieNumber4,
                                  MoblieNumber5: merchantDetails.Data[0].MoblieNumber5,
                                  MoblieNumber6: merchantDetails.Data[0].TerminalNumber && merchantDetails.Data[0].TerminalNumber != 'null' ? merchantDetails.Data[0].TerminalNumber : "",
                                  ShopName: merchantDetails.Data[0].ShopName
                              }

                  response.mobileNumber = merchantDetails.Data[0].MerchantMSISDN || '';
                  response.businessName = merchantDetails.Data[0].ShopName || '';
                  response.alac = payload.payload || '' //merchantDetails.Data[0].TillNumber || ''; in case front end sends 8 digits and aksa send 9 digit tillcode in response, end user will confuse, so only send till code which we receive from front end
                  response.identifierType = "1" || '';
                  response.qrString = merchantDetails.Data[0].QRPayload || '';
                  response.txType = merchantDetails.Data[0].MechantLoop === 1 ? "QR Payment Closed Loop" : "QR Payment Open Loop";
                  response.notifiers = notifierData;
                  response.cnic = merchantDetails.Data[0].CNIC || '';
                  response.address = merchantDetails.Data[0].BrandAddress || '';


                  const updateNotifersRes = qrPaymentService.updateNotifier(notifierData, merchantMsisdn);

                  printLog(
                      'Response from qrpaymentservice updatenotifiers',
                      'raastP2mService.checkTillNumber',
                      updateNotifersRes
                  );

                  printLog(
                    'Exiting function',
                    'raastP2mService.checkTillNumber',
                    response
                );
    
                return {
                    data : { ...response },
                    success: true
                }
    

              } else {

                  printLog(
                      'Could not update notifiers due to absence of data in merchantdetails',
                      'raastP2mService.checkQRcode'
                  );

                  return {
                    data : {},
                    success: false
                }

              }
           
        } catch(error) {

            printError(error, 'raastP2mService.checkTillNumber')

            return {
                ...failureResponse
            };

        }
    }

    async p2mConfirm(payload) {

        try {

            printLog(
                'Entered function',
                'raastP2mService.p2mConfirm',
                 payload
            );

            let esbRFiveService = new ESBRFiveService();
            payload.mpin =  await esbRFiveService.mpinDecryptionTo3DES(payload.mpin, MPIN_ENCRYPTION_KEY); 
            
            let data = this.payloadMapping(payload)
            let url = WSO2_P2M + CONFIRM_URL
            let servResp_Confirm = await axios.post(url, data);

            printLog(
                'Response from wso2',
                'raastP2mService.p2mConfirm',
                servResp_Confirm && servResp_Confirm.data
                
            );
            
            if (servResp_Confirm && servResp_Confirm?.data?.responseCode == "00") {

                printLog(
                    'Response from wso2 - success condition',
                    'raastP2mService.p2mConfirm'
                );

                // add in mongo for recent scans

                servResp_Confirm = servResp_Confirm.data;
               if(payload.isJazzcashMerchant == true)
               {
                const dataModel = {
                    ...payload,
                    txID: servResp_Confirm.jazzTransactionId || 'None',
                    txType: 'qr payment raast',
                    paidVia: payload.paidVia || 'None',
                    qrCode: payload.qrCode || 'None',
                    name: payload.customerAccountTitle || 'None',
                    msisdn: payload.msisdn || 'None',
                    amount: payload.amount || '0',
                    customerCNIC: payload.customerCNIC,
                    fee: '0',
                    txStatus: 'Completed',
                    txEndDate: servResp_Confirm.transEndDate || '0',
                    txEndTime: servResp_Confirm.transEndTime || '0',
                    transactionScheme: payload.transactionScheme || '',
                    tip : payload.tip || '',
                    contextData: {
                      ocvID: servResp_Confirm.orignatorConversationId || '0',
                      cvID: servResp_Confirm.conversationId || '0',
                      merchantDetails: {
                          msisdn: payload.merchantMobileNumber || '0',
                          name: payload.merchantAccountTitle || 'None',
                          tillNumber: payload.merchantAlac || 'None'
                      },
                    }
                }
                 QRHelper.triggerIPNConsumer(dataModel);
               }
                this.historyP2MConfirm(payload,servResp_Confirm)
                
                return {
                    data: servResp_Confirm,
                    success: true
                }

            } else {

                printLog(
                    'Response from wso2 - failure condition',
                    'raastP2mService.p2mConfirm'
                );
                
                return {
                    success: false,
                    data: {message : servResp_Confirm?.data?.responseDescription}
                };
            }
           

        } catch (error) {
            
            printError(error, 'raastP2mController.p2mConfirm');
            
            // Generic error to shown, flow will be terminated
            return {
                success: false,
                data: {}
            };

        }
    }

    historyP2MConfirm(payload ,data) {
        let maskediban =""
        if(payload.iban) {
            maskediban = payload.iban?.substring(0,2) + '*'.repeat(payload.iban?.length -4)+ payload.iban?.substring(payload.iban?.length, payload.iban?.length-4);
        }
        let maskeddata = payload.receiver_msisdn || payload.merchantAccountTitle + " " + maskediban
        
        let trxPaylaod = {
            TRANS_ID: data.jazzTransactionId || "",
            TRX_DTTM: moment().tz("Asia/Karachi").format('YYYY-MM-DDTHH:mm:ss') || "",
            INITIATOR_NAME: payload.senderName || "",
            INITIATOR_MSISDN: payload.msisdn || "",
            TRX_CHANNEL: payload.thirdParty || "",
            TRX_TYPE: payload.trxType || "RAAST P2M",
            AC_FROM: payload.msisdn || "",
            // AC_TO: payload.receiver_msisdn  || payload.merchantAccountTitle + " " + payload.iban || "",
            AC_TO: maskeddata || "",
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
                iban: payload.senderNumber || payload.alac,
                TRANSACTION_AMOUNT: payload.amount || "",
                BENEFICIARY_NAME: payload.receiver_name || "",
                BENEFICIARY_TILL_NO: payload.sender_tillno|| "",
                qrCode: payload.qrCode || "",
                RRN_NO: data.rrn_no || "",
                originalTxnId: payload.originalTxnId || "",
                originalInstrId: payload.originalInstrId || "",
                TIP: payload.tip || "",
                RECIEVER_MSISDN: payload.receiver_msisdn || "",
                useCase: "p2m",
                isRepeatable: true,
                isRefundable: false,
                trx_name: "Money Transfer - p2m",
                receiver_name : payload.businessName,
                flowId: "",
                category: "",
                subCategory: ""
            }
        }

        let subscriber = Subscriber.getInstance();
        subscriber.event.produceMessage(trxPaylaod, 'TRX_HISTORY_REPORTING');

    }
    payloadMapping(payload) {

        return {
            instructionId: Math.random().toString().slice(2, 25), 
            transactionId: Math.random().toString().slice(2, 25), 
            initiatorCredentials: payload.mpin, 
            transactionDateTime: payload.transactionDateTime,
            channelCode: payload.isJazzcashMerchant ? 1031 : 1016, //env
            purposeOfPayment: payload.purposeOfPayment || "Payment2Merchant", 
            customerInfo: {
                iban: payload.customerIban, 
                accountTitle: payload.customerAccountTitle || "", 
                loyaltyNumber: payload.customerLoyaltyNumber || "",  
                mobileNumber: payload.msisdn, // x-msisdn
                customerLabel: payload.customerLabel || "", 
                email: payload.customerEmail || "", 
            },
            paymentInfo: {
                amount: payload.tip ? (parseFloat(payload.amount) - parseFloat(payload.tip)).toString() : payload.amount,
                tip: payload.tip || "0",
                totalAmount: payload.amount
            },
            merchantInfo: {
                accountTitle: payload.merchantAccountTitle, 
                bussinessName: payload.merchantBussinessName, 
                alac: payload.merchantAlac || "", 
                tillNumber: payload.merchantAlac || "", 
                mcc: payload.merchantMcc, 
                bic: payload.merchantBic,
                iban: payload.iban, 
                taxId: payload.merchantTaxId || "", 
                storeLabel: payload.merchantStoreLable || "", 
                referenceLabel: payload.referenceLabel || "",
                mobileNumber: payload.merchantMobileNumber || "", 
                billNumber: payload.merchantBillNumber || "", 
                branch: payload.merchantBranch || "", 
                countryCode: "PK",
                merchantChannel : payload.merchantChannel || "",
                city: payload.merchantCity || "",
                contextOfTransaction:  payload.contextOfTransaction || "Payment2Merchant"
            },
            reserveFields: {
                r1: "",
                r2: "",
                r3: "",
                r4: "",
                r5: ""
            }

        }

    }

    async checkDefaultAccountByAlias(payload, res) {

        try {
            let merchantDetails = {};
            let error = new Error();
            printLog(
                'Entered function',
                'raastP2mService.checkDefaultAccountByAlias',
                { payload }
            );

            let response = {
                ...res,
                type: payload?.type
            }

            merchantDetails = await qrPaymentService.getMerchantDetailsByRaast({ aliasValue: payload?.payload, aliasType: payload?.type.toLowerCase() == "tillnumber" ? "TILL_CODE" : payload?.type.toUpperCase() })

            if (!merchantDetails?.Success) {
                throw new error("Something went wrong from merchant details from raast");
            }

            printLog(
                'Response from qrpaymentservice getMerchantDetailsByRaast api',
                'raastP2mService.checkDefaultAccountByAlias',
                merchantDetails
            );

            if (merchantDetails && merchantDetails?.Success) {

                response.transactionCurrency = merchantDetails?.currency || '';
                response.businessName = merchantDetails?.additionalDetails?.dba || '';
                response.accountTitle = merchantDetails?.name || '';
                response.storeLabel = merchantDetails?.additionalDetails?.dba || '';
                response.bic = merchantDetails?.servicer?.memberId || '';
                response.iban = merchantDetails?.id?.iban || '';
                response.priority = "raast";
                response.mcc = merchantDetails?.additionalDetails?.mcc || '';
                response.tip = {};

                printLog(
                    'Exiting function',
                    'raastP2mService.checkDefaultAccountByAlias',
                    response
                );

                return {
                    data: { ...response },
                    success: true
                }


            } else {
                return {
                    data: {},
                    success: false
                }

            }

        } catch (error) {

            printError(error, 'raastP2mService.checkDefaultAccountByAlias')

            return {
                ...failureResponse
            };

        }
    }

}

export default new raastP2mService(QRPaymentModel,MerchantDetailModel);