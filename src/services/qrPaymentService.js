import logger from '../util/logger';
import ESBService from '../util/esbService';
import _ from 'lodash';
import cache from '../util/cache';
import axios from 'axios';
import emvqr from 'emvqr';
import QRHelper from './helpers/qrPaymentHelper';
import cashToGoodService from './cashToGoodService';
import QRPaymentModel from '../model/qrPayments';
import MerchantDetailModel from '../model/merchantDetailModel';
import QuickPayModel from '../model/quickPayModel';
import ResquestInvoiceModel from '../model/requestInvoiceModel';
import responseCodeHandler_new from '../util/responseCodeHandler_New';
import msisdnTransformer from '../util/msisdnTransformer';
import moment from 'moment';
import transactionHistoryModel from '../model/transactionHistoryModel';
import transactionHistoryService from './transactionHistoryService';
import ESBRFiveService from '../util/esbRFiveService';
import 'moment-timezone';

import Subscriber from './subscriberService';
import { RAAST_API } from './../util/constants';
import trxHistoryUtil from '../util/trxHistoryUtil';
import favListHandler from '../util/favListHandler';
import { Notification } from '../util/';
import qrcode from 'qrcode';
import {printLog, printError} from '../util/utility';
import cache_rest from '../util/cache_rest';



const AKSA_CONFIG = config.aksa;
const FONEPAY_CONFIG = config.fonepay;

const AKSA_URL = process.env.AKSA_URL || AKSA_CONFIG.BASE_URL;
const AKSA_LOGIN_PATH = process.env.AKSA_LOGIN_PATH || AKSA_CONFIG.LOGIN;
const AKSA_USERNAME = process.env.AKSA_USERNAME || AKSA_CONFIG.USERNAME;
const AKSA_PASSWORD = process.env.AKSA_PASSWORD || AKSA_CONFIG.PASSWORD;
const AKSA_AXIOS_TIMEOUT = process.env.AKSA_AXIOS_TIMEOUT || AKSA_CONFIG.TIMEOUT;
const AKSA_MERCHANT_PATH = process.env.AKSA_MERCHANT_PATH || AKSA_CONFIG.MERCHANT;
const QR_RATING_API = process.env.QR_RATING_API || config.externalServices.accountManagementAPI.qrRatingAPI;
const CREATE_OTHER_PROFILE = process.env.CREATE_OTHER_PROFILE || config.externalServices.accountManagementAPI.createOtherProfile;
const UPDATE_NOTIFIER = process.env.UPDATE_NOTIFIER || config.externalServices.accountManagementAPI.updateNotifier;

const FONEPAY_URL = process.env.FONEPAY_URL || FONEPAY_CONFIG.BASE_URL;
const FONEPAY_USERNAME = process.env.FONEPAY_USERNAME || FONEPAY_CONFIG.USERNAME;
const FONEPAY_PASSWORD = process.env.FONEPAY_PASSWORD || FONEPAY_CONFIG.PASSWORD;
const FONEPAY_BANK_ID = process.env.FONEPAY_BANK_ID || FONEPAY_CONFIG.BANK_ID;
const FONEPAY_AXIOS_TIMEOUT = process.env.FONEPAY_AXIOS_TIMEOUT || FONEPAY_CONFIG.TIMEOUT;
const FONEPAY_MERCHANT_INQUIRY_PATH = process.env.FONEPAY_MERCHANT_INQUIRY_PATH || FONEPAY_CONFIG.MERCHANT_INQUIRY;
const FONEPAY_MERCHANT_PAYMENT_PATH = process.env.FONEPAY_MERCHANT_PAYMENT_PATH || FONEPAY_CONFIG.MERCHANT_PAYMENT;

const MC_CONFIG = config.mastercard;
const MC_MESSAGE_TYPE = process.env.MC_MESSAGE_TYPE || MC_CONFIG.MessageType;
const MC_TRANSACTION_TYPE = process.env.MC_TRANSACTION_TYPE || MC_CONFIG.TransactionType;
const MC_POS_DATA = process.env.MC_POS_DATA || MC_CONFIG.PosData;
const MC_ACQUIRING_COUNTRY_CODE = process.env.MC_ACQUIRING_COUNTRY_CODE || MC_CONFIG.AcquiringCountryCode;
const MC_ACQUIRING_INSTITUTION_CODE = process.env.MC_ACQUIRING_INSTITUTION_CODE || MC_CONFIG.AcquiringInstitutionCode;
const MC_TERMINAL_TYPE = process.env.MC_TERMINAL_TYPE || MC_CONFIG.TerminalType;
const MC_MPIN_VERIFICATION = process.env.MC_TERMINAL_TYPE || MC_CONFIG.MPINVerification;
const MC_CHANNEL = process.env.MC_CHANNEL || MC_CONFIG.Channel;
const MC_CURRENCY = process.env.MC_CURRENCY || MC_CONFIG.Currency;
const MC_EPOCH_OFFSET = process.env.MC_EPOCH_OFFSET || MC_CONFIG.EpochOffset

const COMMANDS_MAP = process.env.COMMANDS || config.esb.commands;
const TRX_HISTORY_APP_CONNECT_DB2 = config.externalServices.historyApi.insert


const DEFAULT_ACC_BY_ALIAS_PATH = RAAST_API.DEFAULT_ACC_BY_ALIAS;

const AKSA_GETQR_V1 = process.env.AKSA_GETQR_V1 || AKSA_CONFIG.AKSA_GETQR_V1;
const P2M_REFUND_API = process.env.P2M_REFUND_API || config.WSO2_APIS.P2M_Refund;

const PRINT_BIT = 0;
class QRPaymentService {
  constructor(model) {
    this.merchantDetail = MerchantDetailModel;
    this.QRPaymentModel = model;
    this.addMongo = this.addMongo.bind(this);
    this.APIConfig = {
      baseURL: AKSA_URL,
      timeout: AKSA_AXIOS_TIMEOUT
    }
  }

  async merchantDetails(data) {
    logger.debug({ event: 'Entered function', functionName: 'merchantDetails in class QRPaymentService', data });
    try {
      let clientResponse = {};
      let merchantID;
      let amount = undefined;
      let isFonepay = false;
      let isAksa = false;
      let isMasterCardQR = false;
      let responseData = {};
      let qrDetails = {};
      let merchantDetailsPayload = {};
      let decodedQR = {};
      let returnResponse = {};
      let errorFound = false;
      let FONEPAY_ENABLED = (process.env.FONEPAY_ENABLED == 'true');
      if (data.fonepayEnabled == 'false') {
        FONEPAY_ENABLED = false;
      }
      logger.debug({ FONEPAY_ENABLED });

      // Check if the qrcode or tillnumber is either for AKSA or fonepay
      if (data.type === 'qrcode') {
        logger.debug('Decoding QR code');
        if (!data.payload.startsWith("0002")) {
          logger.info({
            event: '****** Entered function ******',
            functionName: 'qrPaymentService.merchantDetails2',
            data: data.payload
           });
          return clientResponse = responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
        }
        decodedQR = emvqr.decode(data.payload);
        if (decodedQR['26'] && decodedQR['26'].data === '000205' || decodedQR['26'] && decodedQR['26'].data && decodedQR['26'].data.toLowerCase().includes('jcma')) {
          // Do the following things if it is a AQSA QR Code
          isAksa = true;
          logger.debug("QR Code is from AKSA");
          let decodedAccountInfo = emvqr.decode(decodedQR['62'].data);
          if (decodedAccountInfo['07']) {
            merchantDetailsPayload.TillNumber = decodedAccountInfo['07'].data;
          } else if (decodedAccountInfo['02']) {
            if (decodedAccountInfo['02'].len === 12) {
              merchantDetailsPayload.MSISDN = await msisdnTransformer.formatNumberSingle(decodedAccountInfo['02'].data, 'local');
            } else if (decodedAccountInfo['02'].len === 11) {
              merchantDetailsPayload.MSISDN = decodedAccountInfo['02'].data;
            }
          }
          if (decodedQR['54']) {
            amount = decodedQR['54'].data
            logger.debug("Amount", amount);
          }
          
          // End of Proprietary QR Code IF payload = qrcode
        }
        else if (!FONEPAY_ENABLED) {
          logger.debug('Fonepay Disabled: Routing All requests to AKSA. Decoding MasterCard QR');
          isMasterCardQR = true;
          isAksa = true;
          logger.debug('Decoding QR code');
          const decodedQR = emvqr.decode(data.payload);
          let decodedAccountInfo = decodedQR['62'] ? emvqr.decode(decodedQR['62'].data) : {};

          // Setting the MSISDN or Tillnumber for fetching details from AKSA
          if (decodedAccountInfo['02']) {
            if (decodedAccountInfo['02'].len === 12) {
              merchantDetailsPayload.MSISDN = await msisdnTransformer.formatNumberSingle(decodedAccountInfo['02'].data, 'local');
            } else if (decodedAccountInfo['02'].len === 11) {
              merchantDetailsPayload.MSISDN = decodedAccountInfo['02'].data;
            }
          }
          else if (decodedAccountInfo['07']) {
            merchantDetailsPayload.TillNumber = decodedAccountInfo['07'].data;
          }

          // If TILLNUMBER FOUND CARDACCEPT TERM ID can be TILLNUMBER ELSE last 8 digits of initiator MSISDN
          if (decodedAccountInfo['07']) {
            qrDetails.cardAccepTermID = decodedAccountInfo['07'].data;
          } else {
            qrDetails.cardAccepTermID = data.msisdn.slice(-8);
          }

          // Getting the CardAccepIDCode 
          if (decodedQR['04']) {
            qrDetails.cardAccepIDCode = decodedQR['04'].data;
          } else if (decodedQR['05']) {
            qrDetails.cardAccepIDCode = decodedQR['05'].data;
          }

          // Checking for dynamic QR and picking out all the info related to fee, amount , tip
          qrDetails.isDynamic = '0';
          qrDetails.isTipRequired = '0';
          if (decodedQR['54']) {
            qrDetails.amount = decodedQR['54'].data
            qrDetails.isDynamic = '1'
          }
          if (decodedQR['55'] && decodedQR['55'].data == '01') {
            qrDetails.isTipRequired = '1';
          } else if (decodedQR['55'] && decodedQR['55'].data == '02') {
            qrDetails.convenienceFee = decodedQR['56'].data;
          } else if (decodedQR['55'] && decodedQR['55'].data == '03') {
            qrDetails.conveniencePercentage = decodedQR['57'].data;
          }
          if (qrDetails.isDynamic === '1' && qrDetails.conveniencePercentage) {
            let percentage = parseInt(qrDetails.conveniencePercentage);
            let percentageAmount = (parseFloat(qrDetails.amount) / 100) * percentage;
            percentageAmount = Math.round(percentageAmount * 100) / 100;
            // set data in response
            qrDetails.totalAmount = Number(qrDetails.amount) + percentageAmount;
            qrDetails.conveniencePercentageAmount = String(percentageAmount);
          } else if (qrDetails.isDynamic === '1' && qrDetails.convenienceFee) {
            let totalAmount = Number(qrDetails.amount) + Number(qrDetails.convenienceFee);
            qrDetails.totalAmount = String(totalAmount);
          } else if (qrDetails.isDynamic === '0') {
            qrDetails.amount = '0';
            qrDetails.totalAmount = '0';
          }
          // End of Master Card IF (FONEPAY_ENABLED = false) payload = qrcode
        }
        else if (FONEPAY_ENABLED && (decodedQR['04'] || decodedQR['05'])) {
          logger.debug("QR Code is from Fonepay");
          isFonepay = true;

          // End of Fonepay IF (FONEPAY_ENABLED = true) payload = qrcode
        }

        // End of QR Code payload == qrcode
      }
      // If FONEPAY_ENABLED = false we set the tillnumber route request to AKSA
      else if (!FONEPAY_ENABLED) {
        logger.debug('Fonepay Disabled: Routing All requests to AKSA');
        merchantDetailsPayload.TillNumber = data.payload;
        isAksa = true;
      }
      // Check till number of merchant id in case of fonepay
      else if (FONEPAY_ENABLED) {
        if (data.payload.length == 7 || data.payload.length == 9) {
          logger.debug("Till ID / Merchant ID is from Fonepay");
          merchantID = data.payload;
          isFonepay = true;
        }
        // if till id is of 8 length and starts with 0 then it means that it is from AKSA and if not found on AKSA
        // route it to fonepay
        else if (data.payload.length == 8 && data.payload.charAt(0) == '0') {
          logger.debug('Inside 8 digit aksa');
          merchantDetailsPayload.TillNumber = data.payload;
          isAksa = true;
        }
        // if till id is of 8 length and doesn't start with 0 route it to fonepay
        else if (data.payload.length == 8 && data.payload.charAt(0) != '0') {
          logger.debug("Till ID / Merchant ID is from Fonepay 8 digit");
          merchantID = data.payload;
          isFonepay = true;
        }
        // This is safety check if no above check succeeds for either fonepay or aksa, atleast check it once on AKSA and if no response found retrun erro.
        else {
          logger.debug("Till ID is from AKSA");
          merchantDetailsPayload.TillNumber = data.payload;
          isAksa = true;
        }

        // End of Fonepay Tillnumber payload = tillNumber
      }

      /** THE ABOVE CODE ONLY DECIDES IF THE PAYLOAD HAD QRCODE IN BODY OR TILL NUMBER and WHICH PLATFORM(AKSA, AKSA(MASTERCARD), FONEPAY) DOES IT BELONG TO */


      // Execute Fonepay or AKSA Logic
      if (isAksa) {
        // Proceed with calling AKSA APIs

        logger.debug(merchantDetailsPayload);
        const isPayloadEmpty = _.isEmpty(merchantDetailsPayload);
        let merchantResponse = null;
        
        if (process.env.FETCH_MERCHANT_DETAILS == "true") {
          logger.debug("******* fetch from details from db ******* ");
          let query = { deleteFlag: 0 };

          merchantDetailsPayload.TillNumber.length==8 ? query.oldtillNumber=merchantDetailsPayload.TillNumber : query.tillNumber=merchantDetailsPayload.TillNumber ;

          merchantResponse = await this.merchantDetail.findOne(query);
        }else merchantResponse = await cache.getValue(merchantDetailsPayload.TillNumber, config.cacheQRPayment.cacheName);

        if (!isPayloadEmpty && !merchantResponse) {
          let aksaToken = await this.loginAKSA();
          if (!aksaToken) {
            logger.debug("Authorization Failed on AKSA. Unable to Get Token.");
            clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.authentication, null, null);
            return clientResponse;
          }
          merchantDetailsPayload.PrintBit = PRINT_BIT;
          merchantResponse = await this.getMerchantDetailsFromAKSA(merchantDetailsPayload, aksaToken);
        }

        if (!merchantResponse || merchantResponse.success === false || merchantResponse.Data.length === 0) {
          // if the till id is 8 digit, starts with 0 and fails on aksa, then route it to fonepay. Other wise return error response
          if (FONEPAY_ENABLED && data.payload.length == 8 && data.payload.charAt(0) == '0') {
            logger.debug("AKSA 8 Digit call failed. Routing it to Fonepay");
            merchantID = data.payload;
            isFonepay = true;
          }
          else if (!FONEPAY_ENABLED && isMasterCardQR) {
            logger.debug("MasterCard Merchant Not Found On AKSA")
            // Check if QR Code Contains Merchant Name if Not return error
            if (!decodedQR.hasOwnProperty('59') || !decodedQR.hasOwnProperty('04')) {
              logger.debug("No name or PAN found");
              clientResponse = responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
              errorFound = true;
            }
            else {
              let decodedAccountInfo = decodedQR['62'] ? emvqr.decode(decodedQR['62'].data) : {};
              let qrMsisdn;
              let qrTill;
              if (decodedAccountInfo['02']) {
                if (decodedAccountInfo['02'].len === 12) {
                  qrMsisdn = await msisdnTransformer.formatNumberSingle(decodedAccountInfo['02'].data, 'local');
                } else if (decodedAccountInfo['02'].len === 11) {
                  qrMsisdn = decodedAccountInfo['02'].data;
                }
              }
              if (decodedAccountInfo['07']) {
                qrTill = decodedAccountInfo['07'].data;
              }
              returnResponse = {
                "merchantMsisdn": qrMsisdn ? qrMsisdn : "null",
                "merchantName": decodedQR['59'].data,
                "tillNumber": qrTill ? qrTill : 'null',
                "identifierType": "1",
                "qrString": data.payload,
                "txType": "QR Payment Open Loop Of Us"
              }
              if (qrMsisdn) {
                returnResponse.ratingIdentifier = await msisdnTransformer.formatNumberSingle(qrMsisdn, 'international');
              } else if (qrTill) {
                returnResponse.ratingIdentifier = qrTill
              } else {
                returnResponse.ratingIdentifier = decodedQR['04'].data;
              }
              logger.debug({ returnResponse, msg: "Info Found in QR for MasterCard" })
            }
          }
          else {
            clientResponse = responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
            errorFound = true;
          }
        }
        else {
          returnResponse = {
            "merchantMsisdn": merchantResponse.Data[0].MerchantMSISDN,
            "merchantName": merchantResponse.Data[0].ShopName,
            //"tillNumber": merchantResponse.Data[0].TillNumber,
            "tillNumber": data.type === "tillNumber" && data.payload && ( data.payload.length === 8 || data.payload.length === 9 ) ?  data.payload : merchantDetailsPayload.TillNumber,
            "identifierType": "1",
            "qrString": data.type === 'tillNumber' ? merchantResponse.Data[0].QRPayload : data.payload,
            "txType": merchantResponse.Data[0].MechantLoop === 1 ? "QR Payment Closed Loop" : "QR Payment Open Loop"
          }

          if (merchantResponse.Data[0].MechantLoop === 2 && data.type === 'tillNumber') {
            const decodedQR = emvqr.decode(merchantResponse.Data[0].QRPayload);
            let decodedAccountInfo = decodedQR['62'] ? emvqr.decode(decodedQR['62'].data) : {};

            if (decodedAccountInfo['07']) {
              returnResponse.cardAccepTermID = decodedAccountInfo['07'].data;
            } else {
              returnResponse.cardAccepTermID = data.msisdn.slice(-8);
            }

            if (decodedQR['04']) {
              returnResponse.cardAccepIDCode = decodedQR['04'].data;
            } else if (decodedQR['05']) {
              returnResponse.cardAccepIDCode = decodedQR['05'].data;
            }
          }
        }
      }
      if (isFonepay && !errorFound) {
        // Call the fonepay API (Merchant Inquiry)
        logger.debug("QR Code is from Fone Pay");
        let requestPayloadFonepay = {};
        if (merchantID) {
          requestPayloadFonepay.MERCHANT_ID = merchantID;
        } else {
          requestPayloadFonepay.QR_CODE = data.payload;
        }
        let fonepayResponse = await this.getMerchantDetailsFromFonepay(requestPayloadFonepay);
        if (fonepayResponse && fonepayResponse.RESPONSE_CODE === "0000") {
          responseData = {
            isFonepay: true,
            merchantID: fonepayResponse.MERCHANT_ID,
            merchantName: fonepayResponse.MERCHANT_NAME,
            txType: "Mastercard - FonePay",
            qrString: fonepayResponse.QR_STRING,
            isTipRequired: fonepayResponse.IS_TIP_REQUIRED,
            isDynamic: fonepayResponse.IS_DYNAMIC,
            amount: fonepayResponse.TRANSACTION_AMOUNT ? Number(fonepayResponse.TRANSACTION_AMOUNT) : 0,
            totalAmount: fonepayResponse.TRANSACTION_AMOUNT ? Number(fonepayResponse.TRANSACTION_AMOUNT) : 0,
            identifierType: "1"
          };
          let ratingResponse = await this.getMerchantRating(data.msisdn, fonepayResponse.MERCHANT_ID, 'fonepay');
          //logger.info(ratingResponse);
          // Check if user profile is already created and return rating
          if (ratingResponse.success) {
            responseData.merchantRating = ratingResponse.merchantRating;
          }
          else { // Else create the other profile of merchant for rating
            responseData.merchantRating = ratingResponse.merchantRating;
            let profilePayload = {
              identifier: fonepayResponse.MERCHANT_ID,
              type: 'fonepay',
              name: fonepayResponse.MERCHANT_NAME
            }
            await this.createOtherProfile(profilePayload);
          }
          if (fonepayResponse.CONVENIENCE_PERCENTAGE) {
            let percentage = parseInt(fonepayResponse.CONVENIENCE_PERCENTAGE);
            let percentageAmount = (parseFloat(responseData.amount) / 100) * percentage;
            percentageAmount = Math.round(percentageAmount * 100) / 100;
            // set data in response
            responseData.totalAmount = Number(responseData.amount) + percentageAmount;
            responseData.conveniencePercentageAmount = String(percentageAmount)
            responseData.conveniencePercentage = String(fonepayResponse.CONVENIENCE_PERCENTAGE);
          } else if (fonepayResponse.CONVENIENCE_FEE) {
            responseData.convenienceFee = String(fonepayResponse.CONVENIENCE_FEE);
            responseData.totalAmount = fonepayResponse.IS_DYNAMIC === '1' ? Number(responseData.amount + fonepayResponse.CONVENIENCE_FEE) : 0;
          }
          responseData.amount = String(responseData.amount);
          responseData.totalAmount = String(responseData.amount);
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.success, null, responseData);
        } else {
          errorFound = true;
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
        }
      }

      if (!errorFound && (isAksa || isMasterCardQR)) {
        let intMsisdn;
        let qrRating;
        if (!isMasterCardQR) {
          intMsisdn = await msisdnTransformer.formatNumberSingle(returnResponse.merchantMsisdn, 'International');
          logger.debug("Sending QR Rating Request to account management service");
          qrRating = await this.getMerchantRating(data.msisdn, intMsisdn, 'msisdn')
        } else {
          logger.debug("Sending QR Rating Request to account management service");
          qrRating = await this.getMerchantRating(data.msisdn, returnResponse.ratingIdentifier, 'mastercard')
        }


        // If rating.success === false is returned means that the profile for the merchant is non-existent and
        // defualt rating 0 and image url are returned, therefore creating other profile for merchant to maintain ratings.
        if (qrRating.success === false) {
          let profilePayload = {
            type: isMasterCardQR ? 'mastercard' : 'aksa',
            name: returnResponse.merchantName
          }

          // If of Us merhcant then use whichever rating identifier found in the following preference
          // msisdn > tillnumber > pan
          if (returnResponse.txType === 'QR Payment Open Loop Of Us') {
            profilePayload.identifier = returnResponse.ratingIdentifier;
          }
          // If not off us merchant then that means that the merchant is either a proprietary merchant or 
          // mastercard merchant but in both cases have a profile on AKSA therefore use msisdn as identifier
          else {
            let internationalMsisdn = await msisdnTransformer.formatNumberSingle(returnResponse.merchantMsisdn, 'international');
            profilePayload.identifier = internationalMsisdn
          }
          await this.createOtherProfile(profilePayload);
        }
        returnResponse.merchantRating = qrRating.merchantRating;
        returnResponse.profileImageURL = qrRating.profileImageURL;

        if (amount) {
          returnResponse.amount = amount;
        }

        if (isMasterCardQR) {
          logger.debug({ msg: 'merging details for MC merchant', returnResponse, qrDetails })
          responseData = Object.assign(returnResponse, qrDetails);
          responseData.isMastercard = true;
        } else {
          responseData = returnResponse;
        }
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.success, null, responseData);
      }

      // If the QR Code neither satisfies the conditions for aksa or fonepay return not found
      if (!isFonepay && !isAksa) {
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
      }
      logger.debug({ isMasterCardQR, responseData });
      logger.debug({ event: 'Exited function', functionName: 'merchantDetails in class QRPaymentService', clientResponse });
      return clientResponse;
    } catch (error) {
      // logger.error({event:'Error thrown',functionName:'merchantDetails in class QRPaymentService',error:{message:error.message,stack:error.stack}});
      // logger.debug(error);
      // let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.default, null, null);
      // return errorResponse;
      throw error;
    }
  }

  async updateDetails(data) {
    logger.debug({ event: 'Entered function', functionName: 'updateDetails in class QRPaymentService' });
    try {
        
      let  updateDetail;
      let  noRecFound;
      let updateDetail9;  let updateDetail8;
      if (process.env.FETCH_MERCHANT_DETAILS == "true") {
        updateDetail = await this.merchantDetail.findOneAndRemove({ tillNumber : data.tillNumber });
      }
      else{
        if(data.tillNumber)
        updateDetail9 = await cache.removeValue
                  (
                    data.tillNumber,
                    config.cacheQRPayment.cacheName
                  );

        if(data.oldtillNumber)
        updateDetail8 = await cache.removeValue
                  (
                    data.oldtillNumber,
                    config.cacheQRPayment.cacheName
                  );

        if (data?.Data[0]?.MerchantMSISDN) {
          let key = (data.Data[0].MerchantMSISDN?.toString().replace('0', '92') || "")
          cache.removeValue
            (
              key,
              config.cacheQRDisplay.cacheName
            );
        }

        if(!updateDetail9 && !updateDetail8) noRecFound = "Already no record found."

        updateDetail = updateDetail9 || updateDetail8 || 1;
      }

      //await this.merchantDetail.findOneAndUpdate({tillNumber : data.tillNumber}, data, { new: true, upsert: true, setDefaultsOnInsert: true})
      if (!updateDetail) {
          return { success: false, msg:"Operation failed." };
      }
      
      logger.debug({ updateDetail });
      logger.debug({ event: 'Exited function', functionName: 'updateDetails in class QRPaymentService' });
      return { success: true, msg: noRecFound || "Details removed successfully." };
    } catch (error) {
      logger.error({event:'Error thrown',functionName:'updateDetails in class QRPaymentService',error:{message:error.message,stack:error.stack}});
      logger.info(error);
      return { success: false, msg:"Operation failed." };
    }
  }

  async merchantDetails2(data) {
    logger.debug({ event: 'Entered function', functionName: 'merchantDetails in class QRPaymentService', data });
    try {
      let isCached = false
      let clientResponse = {};
      let merchantID;
      let amount = undefined;
      let isFonepay = false;
      let isAksa = false;
      let isMasterCardQR = false;
      let responseData = {};
      let qrDetails = {};
      let merchantDetailsPayload = {};
      let decodedQR = {};
      let returnResponse = {};
      let errorFound = false;
      let FONEPAY_ENABLED = (process.env.FONEPAY_ENABLED == 'true');
      if (data.fonepayEnabled == 'false') {
        FONEPAY_ENABLED = false;
      }
      logger.debug({ FONEPAY_ENABLED });

      // Check if the qrcode or tillnumber is either for AKSA or fonepay
      if (data.type === 'qrcode') {
        logger.debug('Decoding QR code');
        if (!data.payload.startsWith("0002")) {
          // logger.info({
          //   event: '****** Entered function ******',
          //   functionName: 'qrPaymentService.merchantDetails2',
          //   data: data.payload
          //  });
          log(logType.INFO,"merchantDetails2",data.payload,"****** Entered function ******")
          return clientResponse = responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
        }
        decodedQR = emvqr.decode(data.payload);

        if (decodedQR['26'] && decodedQR['26'].data === '000205') {
          // Do the following things if it is a AQSA QR Code
          isAksa = true;
          logger.debug("QR Code is from AKSA");
          let decodedAccountInfo = emvqr.decode(decodedQR['62'].data);
          logger.debug({ event: "Decoded Account Info:", decodedAccountInfo })
          if (decodedAccountInfo['07']) {
            merchantDetailsPayload.TillNumber = decodedAccountInfo['07'].data;
          } else if (decodedAccountInfo['02']) {
            if (decodedAccountInfo['02'].len === 12) {
              merchantDetailsPayload.MSISDN = await msisdnTransformer.formatNumberSingle(decodedAccountInfo['02'].data, 'local');
            } else if (decodedAccountInfo['02'].len === 11) {
              merchantDetailsPayload.MSISDN = decodedAccountInfo['02'].data;
            }
          }
          if (decodedQR['54']) {
            amount = decodedQR['54'].data
            logger.debug("Amount", amount);
          }

          if (decodedAccountInfo['05']) {
            qrDetails.referenceID = decodedAccountInfo['05']?.data
          }
          if (decodedAccountInfo['04']) {
            qrDetails.loyaltyNumber = decodedAccountInfo['04']?.data
          }
          if (decodedAccountInfo['08']) {
            qrDetails.purpose_of_transactions = decodedAccountInfo['08']?.data
          }

          // End of Proprietary QR Code IF payload = qrcode
        }
        else if (!FONEPAY_ENABLED) {
          logger.debug('Fonepay Disabled: Routing All requests to AKSA. Decoding MasterCard QR');
          isMasterCardQR = true;
          isAksa = true;
          logger.debug('Decoding QR code');
          const decodedQR = emvqr.decode(data.payload);
          let decodedAccountInfo = decodedQR['62'] ? emvqr.decode(decodedQR['62'].data) : {};

          // Setting the MSISDN or Tillnumber for fetching details from AKSA
          if (decodedAccountInfo['02']) {
            if (decodedAccountInfo['02'].len === 12) {
              merchantDetailsPayload.MSISDN = await msisdnTransformer.formatNumberSingle(decodedAccountInfo['02'].data, 'local');
            } else if (decodedAccountInfo['02'].len === 11) {
              merchantDetailsPayload.MSISDN = decodedAccountInfo['02'].data;
            }
          }
          else if (decodedAccountInfo['07']) {
            merchantDetailsPayload.TillNumber = decodedAccountInfo['07'].data;
          }

          // If TILLNUMBER FOUND CARDACCEPT TERM ID can be TILLNUMBER ELSE last 8 digits of initiator MSISDN
          if (decodedAccountInfo['07']) {
            qrDetails.cardAccepTermID = decodedAccountInfo['07'].data;
          } else {
            qrDetails.cardAccepTermID = data.msisdn.slice(-8);
          }

          // Getting the CardAccepIDCode 
          if (decodedQR['04']) {
            qrDetails.cardAccepIDCode = decodedQR['04'].data;
          } else if (decodedQR['05']) {
            qrDetails.cardAccepIDCode = decodedQR['05'].data;
          }

          // Checking for dynamic QR and picking out all the info related to fee, amount , tip
          qrDetails.isDynamic = '0';
          qrDetails.isTipRequired = '0';
          if (decodedQR['54']) {
            qrDetails.amount = decodedQR['54'].data
            qrDetails.isDynamic = '1'
          }
          if (decodedQR['55'] && decodedQR['55'].data == '01') {
            qrDetails.isTipRequired = '1';
          } else if (decodedQR['55'] && decodedQR['55'].data == '02') {
            qrDetails.convenienceFee = decodedQR['56'].data;
          } else if (decodedQR['55'] && decodedQR['55'].data == '03') {
            qrDetails.conveniencePercentage = decodedQR['57'].data;
          }
          if (qrDetails.isDynamic === '1' && qrDetails.conveniencePercentage) {
            let percentage = parseInt(qrDetails.conveniencePercentage);
            let percentageAmount = (parseFloat(qrDetails.amount) / 100) * percentage;
            percentageAmount = Math.round(percentageAmount * 100) / 100;
            // set data in response
            qrDetails.totalAmount = Number(qrDetails.amount) + percentageAmount;
            qrDetails.conveniencePercentageAmount = String(percentageAmount);
          } else if (qrDetails.isDynamic === '1' && qrDetails.convenienceFee) {
            let totalAmount = Number(qrDetails.amount) + Number(qrDetails.convenienceFee);
            qrDetails.totalAmount = String(totalAmount);
          } else if (qrDetails.isDynamic === '0') {
            qrDetails.amount = '0';
            qrDetails.totalAmount = '0';
          }
          // End of Master Card IF (FONEPAY_ENABLED = false) payload = qrcode
        }
        else if (FONEPAY_ENABLED && (decodedQR['04'] || decodedQR['05'])) {
          logger.debug("QR Code is from Fonepay");
          isFonepay = true;

          // End of Fonepay IF (FONEPAY_ENABLED = true) payload = qrcode
        }

        // End of QR Code payload == qrcode
      }
      // If FONEPAY_ENABLED = false we set the tillnumber route request to AKSA
      else if (!FONEPAY_ENABLED) {
        logger.debug('Fonepay Disabled: Routing All requests to AKSA');
        merchantDetailsPayload.TillNumber = data.payload;
        isAksa = true;
      }
      // Check till number of merchant id in case of fonepay
      else if (FONEPAY_ENABLED) {
        if (data.payload.length == 7 || data.payload.length == 9) {
          logger.debug("Till ID / Merchant ID is from Fonepay");
          merchantID = data.payload;
          isFonepay = true;
        }
        // if till id is of 8 length and starts with 0 then it means that it is from AKSA and if not found on AKSA
        // route it to fonepay
        else if (data.payload.length == 8 && data.payload.charAt(0) == '0') {
          logger.debug('Inside 8 digit aksa');
          merchantDetailsPayload.TillNumber = data.payload;
          isAksa = true;
        }
        // if till id is of 8 length and doesn't start with 0 route it to fonepay
        else if (data.payload.length == 8 && data.payload.charAt(0) != '0') {
          logger.debug("Till ID / Merchant ID is from Fonepay 8 digit");
          merchantID = data.payload;
          isFonepay = true;
        }
        // This is safety check if no above check succeeds for either fonepay or aksa, atleast check it once on AKSA and if no response found retrun erro.
        else {
          logger.debug("Till ID is from AKSA");
          merchantDetailsPayload.TillNumber = data.payload;
          isAksa = true;
        }

        // End of Fonepay Tillnumber payload = tillNumber
      }

      /** THE ABOVE CODE ONLY DECIDES IF THE PAYLOAD HAD QRCODE IN BODY OR TILL NUMBER and WHICH PLATFORM(AKSA, AKSA(MASTERCARD), FONEPAY) DOES IT BELONG TO */


      // Execute Fonepay or AKSA Logic
      if (isAksa) {
        // Proceed with calling AKSA APIs

        logger.debug(merchantDetailsPayload);
        // let aksaToken = await this.loginAKSA();
        // if (!aksaToken) {
        //   logger.debug("Authorization Failed on AKSA. Unable to Get Token.");
        //   clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.authentication, null, null);
        //   return clientResponse;
        // }
        // GET FROM CACHE IF EXIST
        // DONT CALL AKSA
        let merchantResponse;
        try {
          const key = merchantDetailsPayload.TillNumber
          logger.debug("merchantDetailsPayload ", merchantDetailsPayload);
          logger.debug("key ", key);
          const cacheName = config.cacheQRPayment.cacheName
          const expiration = config.cacheQRPayment.expiry
          logger.debug("cacheName ", cacheName)
          let cacheResponse;

          // merchant details fetch from monog or cache according to switch 
          if (process.env.FETCH_MERCHANT_DETAILS == "true") {
            logger.debug("******* fetch from details from db ******* ");
            let query = { deleteFlag: 0 };

            key.length==8 ? query.oldtillNumber=key : query.tillNumber=key ;
            cacheResponse = await this.merchantDetail.findOne(query);
          }
          else cacheResponse = await cache.getValue(key, cacheName);
          //End /// merchant details fetch from monog or cache according to switch 

          if (cacheResponse && key) {
            logger.debug("******* FETCH MERCHANT DETAILS FROM CACHE ******* ");
            logger.debug(cacheResponse);
            isCached=true
            logger.debug("******* FETCH MERCHANT DETAILS FROM CACHE ******* ");
            merchantResponse = cacheResponse
          }
          else {
            let aksaToken = await this.loginAKSA();
            if (!aksaToken) {
              logger.debug("Authorization Failed on AKSA. Unable to Get Token.");
              clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.authentication, null, null);
              return clientResponse;
            }
            logger.debug("******* FETCH MERCHANT DETAILS FROM AKSA ******* ");
            merchantDetailsPayload.PrintBit = PRINT_BIT;
            merchantResponse = await this.getMerchantDetailsFromAKSA(merchantDetailsPayload, aksaToken);
            logger.debug("******* FETCH MERCHANT merchantResponse FROM AKSA ******* ", merchantResponse);

            if (merchantResponse && merchantResponse.Data && merchantResponse.Data.length) {
              logger.debug("******* INSERT merchantResponse FROM AKSA INTO CACHE ******* ");
              // merchant details fetch from monog or cache according to switch 
              merchantResponse.tillNumber = merchantResponse?.Data[0]?.TillNumber;
              merchantResponse.oldtillNumber = merchantResponse?.Data[0]?.OldTillNumber;
              if(process.env.FETCH_MERCHANT_DETAILS == "true"){
                logger.debug("******* add details in db ******* ");
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
          }
        } catch (ex) {
          logger.debug("******* exception :: qrPaymentService :: merchantDetails2 *******", ex);
        }
        if (!merchantResponse || merchantResponse.success === false || merchantResponse.Data.length === 0) {
          // if the till id is 8 digit, starts with 0 and fails on aksa, then route it to fonepay. Other wise return error response
          if (FONEPAY_ENABLED && data.payload.length == 8 && data.payload.charAt(0) == '0') {
            logger.debug("AKSA 8 Digit call failed. Routing it to Fonepay");
            merchantID = data.payload;
            isFonepay = true;
          }
          else if (!FONEPAY_ENABLED && isMasterCardQR) {
            logger.debug("MasterCard Merchant Not Found On AKSA")
            // Check if QR Code Contains Merchant Name if Not return error
            if (!decodedQR.hasOwnProperty('59') || !decodedQR.hasOwnProperty('04')) {
              logger.debug("No name or PAN found");
              clientResponse = responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
              errorFound = true;
            }
            else {
              logger.info({ event: "Before Decoded Account Info:", timeStamp: moment().format('YYYY/MM/DD hh:mm:ss') })

              let decodedAccountInfo = decodedQR['62'] ? emvqr.decode(decodedQR['62'].data) : {};
  
              logger.info({ event: "After Decoded Account Info:", timeStamp: moment().format('YYYY/MM/DD hh:mm:ss') })

              let qrMsisdn;
              let qrTill;
              if (decodedAccountInfo['02']) {
                if (decodedAccountInfo['02'].len === 12) {
                  qrMsisdn = await msisdnTransformer.formatNumberSingle(decodedAccountInfo['02'].data, 'local');
                } else if (decodedAccountInfo['02'].len === 11) {
                  qrMsisdn = decodedAccountInfo['02'].data;
                }
              }
              if (decodedAccountInfo['07']) {
                qrTill = decodedAccountInfo['07'].data;
              }
              let categoryBalance_name = await cashToGoodService.categoryWiseBalance(data.msisdn, Number(decodedQR['52'].data))
              returnResponse = {
                "merchantMsisdn": qrMsisdn ? qrMsisdn : "null",
                "merchantName": decodedQR['59'].data,
                "tillNumber": qrTill ? qrTill : 'null',
                "identifierType": "1",
                "qrString": data.payload,
                "txType": "QR Payment Open Loop Of Us",
                "category": categoryBalance_name[0].Category,
                "balance": categoryBalance_name[0].Available,
                "categoryId": categoryBalance_name[0].Category_id
              }
              if (qrMsisdn) {
                returnResponse.ratingIdentifier = await msisdnTransformer.formatNumberSingle(qrMsisdn, 'international');
              } else if (qrTill) {
                returnResponse.ratingIdentifier = qrTill
              } else {
                returnResponse.ratingIdentifier = decodedQR['04'].data;
              }

              const mapping = {
                '01': 'bill_number',
                '02': 'mobileNumber',
                '03': 'store_id',
                '04': 'loyalty_number',
                '05': 'reference_id',
                '06': 'customer_name',
                '08': 'purpose_of_transactions'
              };
              
              for (const key in decodedAccountInfo) {
                if (decodedAccountInfo.hasOwnProperty(key) && mapping[key]) {
                  returnResponse[mapping[key]] = decodedAccountInfo[key]?.data;
                }
              }

              logger.debug({ returnResponse, msg: "Info Found in QR for MasterCard" })
            }
          }
          else {
            clientResponse = responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
            errorFound = true;
          }
        }
        else {
          const msisdn = merchantResponse.Data[0].MerchantMSISDN
          const notifierData = {
            MoblieNumber1: merchantResponse.Data[0].MoblieNumber1,
            MoblieNumber2: merchantResponse.Data[0].MoblieNumber2,
            MoblieNumber3: merchantResponse.Data[0].MoblieNumber3,
            MoblieNumber4: merchantResponse.Data[0].MoblieNumber4,
            MoblieNumber5: merchantResponse.Data[0].MoblieNumber5,
            MoblieNumber6: merchantResponse.Data[0].TerminalNumber && merchantResponse.Data[0].TerminalNumber != 'null' ? merchantResponse.Data[0].TerminalNumber : "",
            ShopName: merchantResponse.Data[0].ShopName
          }
          if(!isCached){
          this.updateNotifier(notifierData, msisdn);
          }
          let categoryBalance_name = await cashToGoodService.categoryWiseBalance(data.msisdn, Number(merchantResponse.Data[0].MerchantCategoryCode))
          logger.debug("category balance", categoryBalance_name[0]);
          returnResponse = {
            "merchantMsisdn": merchantResponse.Data[0].MerchantMSISDN,
            "merchantName": merchantResponse.Data[0].ShopName,
            "tillNumber": (merchantDetailsPayload?.TillNumber || merchantResponse.Data[0].TillNumber),
            "identifierType": "1",
            "qrString": merchantResponse.Data[0].QRPayload,
            "txType": merchantResponse.Data[0].MechantLoop === 1 ? "QR Payment Closed Loop" : "QR Payment Open Loop",
            "categoryName": categoryBalance_name[0].Category,
            "balance": categoryBalance_name[0].Available,
            "categoryId": categoryBalance_name[0].Category_id,
            "notifiers": notifierData || {},
            "IsSupplierPayment": merchantResponse.Data[0].IsSupplierPayment || false,
            "referenceID":qrDetails?.referenceID || '',
            "purpose_of_transactions": qrDetails?.purpose_of_transactions || '',
            "loyaltyNumber": qrDetails?.loyaltyNumber || '',
            "cnic": merchantResponse.Data[0].CNIC || '',
            "address":  merchantResponse.Data[0].BrandAddress || ''
          }

          if (merchantResponse.Data[0].MechantLoop === 2 && data.type === 'tillNumber') {

            logger.info({ event: "Before Decoded QR:", timeStamp: moment().format('YYYY/MM/DD hh:mm:ss') })

            const decodedQR = emvqr.decode(merchantResponse.Data[0].QRPayload);

            logger.info({ event: "After Decoded QR:", timeStamp: moment().format('YYYY/MM/DD hh:mm:ss') })

            logger.info({ event: "Before Decoded Account Info:", timeStamp: moment().format('YYYY/MM/DD hh:mm:ss') })

            let decodedAccountInfo = decodedQR['62'] ? emvqr.decode(decodedQR['62'].data) : {};

            logger.info({ event: "After Decoded Account Info:", timeStamp: moment().format('YYYY/MM/DD hh:mm:ss') })

            if (decodedAccountInfo['07']) {
              returnResponse.cardAccepTermID = decodedAccountInfo['07'].data;
            } else {
              returnResponse.cardAccepTermID = data.msisdn.slice(-8);
            }

            if (decodedQR['04']) {
              returnResponse.cardAccepIDCode = decodedQR['04'].data;
            } else if (decodedQR['05']) {
              returnResponse.cardAccepIDCode = decodedQR['05'].data;
            }

            const mapping = {
              '01': 'bill_number',
              '02': 'mobileNumber',
              '03': 'store_id',
              '04': 'loyalty_number',
              '05': 'reference_id',
              '06': 'customer_name',
              '08': 'purpose_of_transactions'
            };
            
            for (const key in decodedAccountInfo) {
              if (decodedAccountInfo.hasOwnProperty(key) && mapping[key]) {
                returnResponse[mapping[key]] = decodedAccountInfo[key]?.data;
              }
            }

            logger.info({ returnResponse, msg: "Info Found in QR for MasterCard" })

          }
        }
      }
      if (isFonepay && !errorFound) {
        // Call the fonepay API (Merchant Inquiry)
        logger.debug("QR Code is from Fone Pay");
        let requestPayloadFonepay = {};
        if (merchantID) {
          requestPayloadFonepay.MERCHANT_ID = merchantID;
        } else {
          requestPayloadFonepay.QR_CODE = data.payload;
        }
        let fonepayResponse = await this.getMerchantDetailsFromFonepay(requestPayloadFonepay);
        if (fonepayResponse && fonepayResponse.RESPONSE_CODE === "0000") {
          let categoryBalance_name = await cashToGoodService.categoryWiseBalance(data.msisdn, Number(decodedQR['52'].data))
          responseData = {
            isFonepay: true,
            merchantID: fonepayResponse.MERCHANT_ID,
            merchantName: fonepayResponse.MERCHANT_NAME,
            txType: "Mastercard - FonePay",
            qrString: fonepayResponse.QR_STRING,
            isTipRequired: fonepayResponse.IS_TIP_REQUIRED,
            isDynamic: fonepayResponse.IS_DYNAMIC,
            amount: fonepayResponse.TRANSACTION_AMOUNT ? Number(fonepayResponse.TRANSACTION_AMOUNT) : 0,
            totalAmount: fonepayResponse.TRANSACTION_AMOUNT ? Number(fonepayResponse.TRANSACTION_AMOUNT) : 0,
            identifierType: "1",
            categoryName: categoryBalance_name[0].Category,
            balance: categoryBalance_name[0].Available,
            categoryId: categoryBalance_name[0].Category_id
          };
          let ratingResponse = await this.getMerchantRating(data.msisdn, fonepayResponse.MERCHANT_ID, 'fonepay');
          logger.debug(ratingResponse);
          // Check if user profile is already created and return rating
          if (ratingResponse.success) {
            responseData.merchantRating = ratingResponse.merchantRating;
          }
          else { // Else create the other profile of merchant for rating
            responseData.merchantRating = ratingResponse.merchantRating;
            let profilePayload = {
              identifier: fonepayResponse.MERCHANT_ID,
              type: 'fonepay',
              name: fonepayResponse.MERCHANT_NAME
            }
            await this.createOtherProfile(profilePayload);
          }
          if (fonepayResponse.CONVENIENCE_PERCENTAGE) {
            let percentage = parseInt(fonepayResponse.CONVENIENCE_PERCENTAGE);
            let percentageAmount = (parseFloat(responseData.amount) / 100) * percentage;
            percentageAmount = Math.round(percentageAmount * 100) / 100;
            // set data in response
            responseData.totalAmount = Number(responseData.amount) + percentageAmount;
            responseData.conveniencePercentageAmount = String(percentageAmount)
            responseData.conveniencePercentage = String(fonepayResponse.CONVENIENCE_PERCENTAGE);
          } else if (fonepayResponse.CONVENIENCE_FEE) {
            responseData.convenienceFee = String(fonepayResponse.CONVENIENCE_FEE);
            responseData.totalAmount = fonepayResponse.IS_DYNAMIC === '1' ? Number(responseData.amount + fonepayResponse.CONVENIENCE_FEE) : 0;
          }
          responseData.amount = String(responseData.amount);
          responseData.totalAmount = String(responseData.amount);
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.success, null, responseData);
        } else {
          errorFound = true;
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
        }
      }

      if (!errorFound && (isAksa || isMasterCardQR)) {
        let intMsisdn;
        let qrRating;
        if (!isMasterCardQR) {
          intMsisdn = await msisdnTransformer.formatNumberSingle(returnResponse.merchantMsisdn, 'International');
          logger.debug("Sending QR Rating Request to account management service");
          qrRating = await this.getMerchantRating(data.msisdn, intMsisdn, 'msisdn')
        } else {
          logger.debug("Sending QR Rating Request to account management service");
          qrRating = await this.getMerchantRating(data.msisdn, returnResponse.ratingIdentifier, 'mastercard')
        }


        // If rating.success === false is returned means that the profile for the merchant is non-existent and
        // defualt rating 0 and image url are returned, therefore creating other profile for merchant to maintain ratings.
        if (qrRating.success === false) {
          let profilePayload = {
            type: isMasterCardQR ? 'mastercard' : 'aksa',
            name: returnResponse.merchantName
          }

          // If of Us merhcant then use whichever rating identifier found in the following preference
          // msisdn > tillnumber > pan
          if (returnResponse.txType === 'QR Payment Open Loop Of Us') {
            profilePayload.identifier = returnResponse.ratingIdentifier;
          }
          // If not off us merchant then that means that the merchant is either a proprietary merchant or 
          // mastercard merchant but in both cases have a profile on AKSA therefore use msisdn as identifier
          else {
            let internationalMsisdn = await msisdnTransformer.formatNumberSingle(returnResponse.merchantMsisdn, 'international');
            profilePayload.identifier = internationalMsisdn
          }
          await this.createOtherProfile(profilePayload);
        }
        returnResponse.merchantRating = qrRating.merchantRating;
        returnResponse.profileImageURL = qrRating.profileImageURL;

        if (amount) {
          returnResponse.amount = amount;
        }

        if (isMasterCardQR) {
          logger.debug({ msg: 'merging details for MC merchant', returnResponse, qrDetails })
          responseData = Object.assign(returnResponse, qrDetails);
          responseData.isMastercard = true;
        } else {
          responseData = returnResponse;
        }
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.success, null, responseData);
      }

      // If the QR Code neither satisfies the conditions for aksa or fonepay return not found
      if (!isFonepay && !isAksa) {
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
      }
      logger.debug({ isMasterCardQR, responseData });
      logger.debug({ event: 'Exited function', functionName: 'merchantDetails in class QRPaymentService', clientResponse });
      return clientResponse;
    } catch (error) {
      // logger.error({event:'Error thrown',functionName:'merchantDetails in class QRPaymentService',error:{message:error.message,stack:error.stack}});
      // logger.debug(error);
      // let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.default, null, null);
      // return errorResponse;
      throw error;
    }
  }

  async getMerchantDetailsFromAKSA(payload, aksaToken) {

    printLog(
      'Entered function',
      'qrpaymentservice.getMerchantDetailsFromAKSA',
      { payload, aksaToken }
   );

    try {

      let merchantResponse = {};
      const AKSA_MERCHANT_API = _.cloneDeep(this.APIConfig);
      AKSA_MERCHANT_API.headers = { Authorization: `Bearer ${aksaToken}` }

      printLog(
        'Merchant response from AKSA',
        'qrpaymentservice.getMerchantDetailsFromAKSA',
        { 
          payload :  {
            AKSA_MERCHANT_PATH,
            payload, 
            AKSA_MERCHANT_API
         }
        }
     );

      let merchantDetails = await axios.post(AKSA_MERCHANT_PATH, payload, AKSA_MERCHANT_API);

      printLog(
        'Merchant response from AKSA',
        'qrpaymentservice.getMerchantDetailsFromAKSA'
     );

      if (merchantDetails.data.Code == "203") {
        merchantResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
      }
      else if (merchantDetails.data.Code == "205") {
        merchantResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.authentication, null, null);
      }
      else if (merchantDetails.data.Code == "2035") {
        merchantResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.errorAKSA, null, null);
      } else {
        merchantResponse = merchantDetails.data;
      }

      printLog(
        'Exited function',
        'qrpaymentservice.getMerchantDetailsFromAKSA'
     );

      return merchantResponse;

    } catch (error) {

      printError(error, 'qrpaymentservice.getMerchantDetailsFromAKSA');

      let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.default.code, null, null);
      return errorResponse;
    }

  }

  async loginAKSA() {

    printLog(
      'Entered function',
      'qrpaymentservice.loginAKSA'
   );

    try {
     
      const login_payload = {
        UserName: AKSA_USERNAME,
        Password: AKSA_PASSWORD
      }

      let config =  this.APIConfig;

      printLog(
        'Payload before calling aksa get token api',
        'qrpaymentservice.loginAKSA',
        { 
          payload :  {
            AKSA_LOGIN_PATH,
            login_payload, 
            config
         }
        }
      );

     let loginResponse = await axios.post(AKSA_LOGIN_PATH, login_payload, config);

      printLog(
        'Response from calling aksa get token api',
        'qrpaymentservice.loginAKSA',
        loginResponse && loginResponse.data
      );

      if (loginResponse.data.Code == "00") {
        return loginResponse.data.Data.token;
      } else {
        return false
      }

    } catch (error) {

      printError(error, 'qrpaymentservice.loginAKSA');

      return false;
    }
  }

  async getMerchantDetailsFromFonepay(merchantInquiryPayload) {
    try {
      logger.debug({ event: 'Entered function', functionName: 'getMerchantDetailsFromFonepay in class QRPaymentService', merchantInquiryPayload });
      const apiConfigFonepay = {
        baseURL: FONEPAY_URL,
        timeout: FONEPAY_AXIOS_TIMEOUT
      };
      // date fomat yyyy/mm/dd hh:mm:ss
      let now = new Date().toISOString().
        replace(/T/, ' ').
        replace(/-/g, '/').
        replace(/\..+/, '')
      merchantInquiryPayload.USER_ID = FONEPAY_USERNAME;
      merchantInquiryPayload.PASSWORD = FONEPAY_PASSWORD;
      merchantInquiryPayload.DATE_TIME = now;
      logger.debug("Request Fonepay Payload:" + JSON.stringify(merchantInquiryPayload));
      let fonepayResponse = await axios.post(FONEPAY_MERCHANT_INQUIRY_PATH, merchantInquiryPayload, apiConfigFonepay);

      logger.debug({ event: 'Exited function', functionName: 'getMerchantDetailsFromFonepay in class QRPaymentService', fonepayResponse: fonepayResponse.data });
      return fonepayResponse.data;

    } catch (error) {
      logger.debug({ event: 'Error thrown', functionName: 'getMerchantDetailsFromFonepay in class QRPaymentService', error: { message: error.message, stack: error.stack } })
      return false;
    }
  }

  // async getMerchantRating(qrRatingPayload){
  //   try{
  //     const qrRating = await axios.post(QR_RATING_API, qrRatingPayload ); // here I have to handle this
  //     logger.debug(qrRating.data.data.merchantRatings);
  //     return {
  //       merchantRating: qrRating.data.data.merchantRatings[0].averageRating,
  //       profileImageURL: qrRating.data.data.merchantRatings[0].profileImageURL ? qrRating.data.data.merchantRatings[0].profileImageURL : ''
  //     }
  //   }catch(error){
  //     logger.debug({event:'Profile Not Found, Returning Rating=0',functionName:'getMerchantRating in class QRPaymentService. Other Profile Needs to be created.'})
  //     return {
  //       merchantRating: 0,
  //       profileImageURL: ''
  //     }
  //   }
  // }

  async getMerchantRating(msisdn, merchantIdentifier, merchantType) {
    try {
      logger.debug({ event: 'Entered function', functionName: 'getMerchantRating in class QRPaymentService', merchantIdentifier, merchantType });
      let path = QR_RATING_API;
      path = `${path}?${merchantType}=${merchantIdentifier}`;
      logger.debug(path);
      const ratingAPI = {
        baseURL: path,
        timeout: AKSA_AXIOS_TIMEOUT,
        headers: {
          'X-MSISDN': msisdn,
          'X-CHANNEL': 'consumerApp',
          'X-APP-TYPE': 'internal',
          'X-APP-VERSION': '1.0',
          'X-DEVICE-ID': 'internal',
          'X-IP-ADDRESS': 'localhost',
          'X-DEVICE-ID': 'paymentMS'
        }
      };

      const ratingResponse = await axios.get('', ratingAPI);
      logger.debug('profileRespoprofileResponse: ' + JSON.stringify(ratingResponse.data.data));
      let avgRating;
      // check if data object is returned and averageRating is a number
      if (ratingResponse.data.data && !isNaN(ratingResponse.data.data.averageRating)) {
        avgRating = ratingResponse.data.data.averageRating;
        return { success: true, merchantRating: Number(avgRating), profileImageURL: ratingResponse.data.data.profileImageURL };
      } else {
        avgRating = 0;
        return { success: false, merchantRating: Number(avgRating), profileImageURL: '' };
      }
    }
    catch (error) {
      logger.debug({ event: 'Error thrown', functionName: 'getMerchantRating in class QRPaymentService', error: { message: error.message, stack: error.stack } })
      logger.debug(error);
      return {
        success: false,
        merchantRating: 0,
        profileImageURL: ''
      }
    }
  }

  async recentScans(payload) {
    logger.debug({ event: 'Entered function', functionName: 'recentScans in class QRPaymentService', payload });
    try {
      let clientResponse = {};
      return clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRHistory.error, null, null);
      let query = {
        "msisdn": payload.msisdn,
        "contextData.merchantDetails.tillNumber": { $exists: true, $ne: null, $ne: "" }
      }
      if (payload.start && payload.end) {
        let endDate = new Date(payload.end);
        let startDate = new Date(payload.start);
        startDate = new Date(startDate.setUTCHours(0, 0, 0, 0)).toISOString();
        endDate = new Date(endDate.setUTCHours(23, 59, 59, 999)).toISOString();
        query.createdAt = {
          $gte: startDate,
          $lte: endDate
        }
      }
      logger.debug(query);
      let history = {};
      if (payload.range) {
        history = await this.QRPaymentModel.find(query, '-_id -__v').sort({ createdAt: -1 }).limit(parseInt(payload.range));
      }
      else {
        history = await this.QRPaymentModel.find(query, '-_id -__v').sort({ createdAt: -1 });
      }
      if (history && history.length > 0) {
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRHistory.success, null, history);
      }
      else {
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRHistory.error, null, null);
      }
      logger.debug({ event: 'Exited function', functionName: 'recentScans in class QRPaymentService', clientResponse });
      return clientResponse;
    } catch (error) {
      // logger.error({event:'Error thrown',functionName:'recentScans in class QRPaymentService',error:{message:error.message,stack:error.stack}})
      // let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.default, null, null);
      // return errorResponse;
      throw error;
    }
  }

  async transactionHistory(payload) {
    logger.debug({ event: 'Entered function', functionName: 'transactionHistory in class QRPaymentService', payload });
    try {
      let clientResponse = {};
      let query = {
        $or: [
          {
            "msisdn": payload.msisdn

          },
          {
            "contextData.merchantDetails.msisdn": payload.msisdn
          }
        ]
      }
      if (payload.start && payload.end) {
        let endDate = new Date(payload.end);
        let startDate = new Date(payload.start);
        startDate = new Date(startDate.setUTCHours(0, 0, 0, 0)).toISOString();
        endDate = new Date(endDate.setUTCHours(23, 59, 59, 999)).toISOString();
        query.createdAt = {
          $gte: startDate,
          $lte: endDate
        }
      }
      logger.debug(query);
      let history = {};
      if (payload.range) {
        history = await this.QRPaymentModel.find(query, '-_id -__v').sort({ createdAt: -1 }).limit(parseInt(payload.range)).lean();
      }
      else {
        history = await this.QRPaymentModel.find(query, '-_id -__v').sort({ createdAt: -1 }).lean();
      }
      if (history && history.length > 0) {
        logger.debug(history.length);
        let transHistoryResponse = [];
        for (let row of history) {
          logger.debug(row);
          //    console.log(row.isRefundable);
          let transaction = {
            txID: row.txID,
            sender: row.msisdn,
            senderName: row.name,
            receiverMsisdn: row.contextData.merchantDetails.msisdn,
            receiverName: row.contextData.merchantDetails.name,
            receiverTillNumber: row.contextData.merchantDetails.tillNumber,
            amount: row.amount,
            fee: row.fee,
            dateTime: row.createdAt,
            rating: row.rating ? row.rating : null,
            qrString: row.qrString
          }
          if (row.msisdn == payload.msisdn) {
            transaction.type = "Debit";
            transaction.isRepeatable = 'true';
            transaction.isRefundable = 'false';
          } else {
            transaction.type = "Credit";
            transaction.isRepeatable = 'false';
            transaction.isRefundable = row.isRefundable;
          }
          transHistoryResponse.push(transaction);
        }
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRHistory.success, null, transHistoryResponse);
      }
      else {
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRHistory.success, null, []);
      }
      logger.debug({ event: 'Exited function', functionName: 'transactionHistory in class QRPaymentService', clientResponse });
      return clientResponse;
    } catch (error) {
      // logger.error({event:'Error thrown',functionName:'transactionHistory in class QRPaymentService',error:{message:error.message,stack:error.stack}})
      // let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.default, null, null);
      // return errorResponse;
      throw error;
    }
  }

  async initQRPayment(payload) {
    let clientResponse = {};
    try {
      logger.debug({ event: 'Entered function', functionName: 'initQRPayment in class QRPaymentService', payload });

      let esbService = new ESBService();
      let transactionParams = [];
      let ESBRequestData = {};
      let receiver = payload.identifier;
      let userType = config.esb.thirdPartyMap[payload.channel].name
      let configCommand = `QRPayment_${userType}`;
      if (!COMMANDS_MAP[configCommand]) {
        configCommand = "QRPayment"
      }


      // Check if the identifier is MSISDN then transform into internation standard
      if (payload.identifierType == "1") {
        receiver = await msisdnTransformer.formatNumberSingle(payload.identifier, 'International');
      }
      payload.msisdn = await msisdnTransformer.formatNumberSingle(payload.msisdn, 'International');
      //Step 1 : Calling Init_Trans
      transactionParams = [
        {
          key: COMMANDS_MAP[configCommand].parameters.amount,
          value: String(payload.amount),
        },
        {
          key: "MerchantID",
          value: payload.identifier,
        }
      ];

      if (payload.tillNumber) {
        transactionParams.push({
          key: "ReservedField1",
          value: payload.tillNumber
        });
      }

      let channel = ""
      if(payload.type && payload.type === "M2D"){
        channel = "merchantAppUpdated";
      }else{
        channel = payload.channel;
      }

      ESBRequestData = await esbService.createESBRequestObject(
        channel,
        COMMANDS_MAP[configCommand],
        COMMANDS_MAP[configCommand].initiatorIdentifierType,
        payload.msisdn,
        null,
        payload.identifierType,
        receiver,
        transactionParams,
        null,
        null
      );

      logger.debug('ESB Template Data InitTrans_MerchantPaymentByCustomer', ESBRequestData);
      logger.debug(ESBRequestData.Transaction.Parameters.Parameter);

      let servResp = await esbService.getESBResponse(ESBRequestData);

      logger.debug(`After the InitTrans_MerchantPaymentByCustomer api call: data : ${servResp}`)

      if (servResp && servResp.Response && servResp.Response.ResponseCode === '0' && servResp.Result && servResp.Result.ResultCode === '0') {
        let initResponse = await QRHelper.initQRResponse(servResp);
        // cache insertion for trx history case qr
        let key = payload.msisdn + '_' + initResponse.transactionID;
      //  await cache.putValueWithExpiry(key, { requestPayload : payload, responsePayload : initResponse }, config?.cacheTRXHistoryRevamped?.cacheName || "transactionHistoryDB2", config?.cacheTRXHistoryRevamped?.cacheExpiry || "3600");
        
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.init, null, initResponse);
      }
      else {
        logger.debug('Faliure in InitTrans_MerchantPaymentByCustomer');
        if (servResp && servResp.Result && servResp.Result.ResultCode) {
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.cps + servResp.Result.ResultCode, servResp, null);
          return clientResponse;
        } else if (servResp && servResp.Response && servResp.Response.ResponseCode) {
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.cps + servResp.Response.ResponseCode, servResp, null);
          return clientResponse;
        }
        else {
          clientResponse = await responseCodeHandler_new.getThirdPartyResponseCode(config.responseCode.useCases.QRPayment.timeout, null, servResp);
        }
      }
      logger.debug({ event: 'Exited function', functionName: 'initQRPayment in class QRPaymentService', clientResponse });
      return clientResponse;
    }
    catch (error) {
      // logger.error({event:'Error thrown',functionName:'initQRPayment in class QRPaymentService',error:{message:error.message,stack:error.stack}})
      // let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.default, null, null);
      // return errorResponse;
      throw error;
    }
  }

  async confirmQRPayment(payload) {
    let clientResponse = {};

    payload.thirdParty = payload?.thirdParty || payload?.channel;

    try {
      logger.debug({ event: 'Entered function', functionName: 'confirmQRPayment in class QRPaymentService', payload });

      let esbService = new ESBService();
      let transactionParams = [];
      let ESBRequestData = {};

      transactionParams = [
        {
          key: COMMANDS_MAP.QRPaymentConfirm.parameters.transID,
          value: payload.transactionID
        }
      ];

      if (payload.isSuccess === 'false') {
        transactionParams.push({
          key: COMMANDS_MAP.QRPaymentConfirm.parameters.isSuccess,
          value: String('false')
        });
      } else {
        transactionParams.push({
          key: COMMANDS_MAP.QRPaymentConfirm.parameters.isSuccess,
          value: String('true')
        });
      }

      let customObj = {
        txType: payload.transactionType, // Static, Dynamic, TillNumber
        paidVia: payload.paidVia, // Scan from Camera, Scan from GAllery, TillNumber
        qrCode: payload.qrCode, // Optional
        senderName: payload.name,
        merchantName: payload.merchantDetails.name, // e.g. Nishat Linen, typically comes from AKSA, defaults to JazzCash Merchant
        merchantMsisdn: payload.merchantDetails.msisdn,
        merchantTillID: payload.merchantDetails.tillNumber // e.g. These come from AKSA 
      }

      const referenceData = await trxHistoryUtil.mapTrxHistory({
        ...payload,
        txType: "payment-qrpayment-confirm",
      });

      logger.debug({
        event: "Response after mapping transaction history payload",
        functionName: "qrPaymentService.confirmQRPayment",
        data: referenceData
      });

      ESBRequestData = await esbService.createESBRequestObject(
        payload.channel,
        COMMANDS_MAP.QRPaymentConfirm,
        COMMANDS_MAP.QRPaymentConfirm.initiatorIdentifierType,
        payload.msisdn,
        payload.MPIN,
        null,
        null,
        transactionParams,
        referenceData,
        customObj
      );

      logger.debug('ESB Template Data Confirm QR Payment', ESBRequestData);
      logger.debug(ESBRequestData.Transaction.Parameters.Parameter);
      

      let servResp = await esbService.getESBResponse(ESBRequestData);

      logger.debug(`After the Confirm QR Payment api call: data : ${servResp}`)

      if (servResp && servResp.Response && servResp.Response.ResponseCode === '0' && servResp.Result && servResp.Result.ResultCode === '0') {
        logger.debug(servResp.Result.ResultParameters.ResultParameter);
        let dataModel = await QRHelper.confirmQRResponse(servResp, payload, false);
        dataModel.isRefundable = 'true';
        dataModel.contextData.merchantDetails.notifiers = payload.merchantDetails?.notifiers || null;
        dataModel.customerCNIC = payload.customerCNIC || null;

        // updating invoice status
        if ((payload?.purpose_of_transactions && payload?.purpose_of_transactions.startsWith('r2p')) || 
          (payload?.merchantDetails?.purpose_of_transactions && payload?.merchantDetails?.purpose_of_transactions.startsWith('r2p'))) {
          let invoiceID = payload?.purpose_of_transactions?.split('-')[1] || payload?.merchantDetails?.purpose_of_transactions?.split('-')[1];
          const query = { "invoiceID": invoiceID };
          this.updateInvoiceStatus(query)
          }
        
        //calling new function and sending all data to it
        this.AddDataToTransactionHistory(payload, dataModel);
        
        // Trigger AKSA IPN
        QRHelper.triggerIPN({...payload, ...dataModel});
        this.addMongo(dataModel);
        QRHelper.notify(dataModel);
        // QRHelper.smsNotifiers(dataModel.contextData.merchantDetails.msisdn, dataModel.txID, dataModel.amount, payload.msisdn)
        QRHelper.smsNotifiers(dataModel.contextData.merchantDetails.msisdn, dataModel.txID, dataModel.amount, payload.msisdn)
        dataModel.isRated = await QRHelper.checkIfRatable(dataModel.msisdn, dataModel.contextData.merchantDetails.msisdn, dataModel.amount, false);
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.confirm, null, dataModel);

        if(payload.Fav_Flag && !payload.Fav_ID || payload.favFlag && !payload.Fav_ID || payload.FAV_FLAG && !payload.Fav_ID){
          favListHandler.createFavoritesQR(payload);
          clientResponse.data.favorite= 1
          }
        else if(!payload.Fav_Flag && payload.Fav_ID || !payload.favFlag && payload.Fav_ID || !payload.FAV_FLAG && payload.Fav_ID ){
          favListHandler.updateFavoritesQR(payload);
          clientResponse.data.favorite= 2
        }
        
      }
      else {
        logger.debug('Failure in Confirm InitTrans_MerchantPaymentByCustomer');
        if (servResp && servResp.Result && servResp.Result.ResultCode) {
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.cps + servResp.Result.ResultCode, servResp, null);
          return clientResponse;
        } else if (servResp && servResp.Response && servResp.Response.ResponseCode) {
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.cps + servResp.Response.ResponseCode, servResp, null);
          return clientResponse;
        }
        else {
          clientResponse = await responseCodeHandler_new.getThirdPartyResponseCode(config.responseCode.useCases.QRPayment.timeout, null, servResp);
        }
      }
      logger.debug({ event: 'Exited function', functionName: 'confirmQRPayment in class QRPaymentService', clientResponse });
      return clientResponse;
    }
    catch (error) {
      logger.error({event:'Error thrown',functionName:'confirmQRPayment in class QRPaymentService',error:{message:error.message,stack:error.stack}})
      // let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.default, null, null);
      // return errorResponse;
      throw error;
    }
  }

  async mastercardPayment(payload) {
    try {
      logger.debug({ event: 'Entered function', functionName: 'mastercardPayment in class QRPaymentService', payload });

      let deviceNumber = await this.getDeviceNumberFromLinkedCards(payload.msisdn, payload.channel);
      if (!deviceNumber) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRMastercard.deviceError, null, null);
        logger.debug({ event: 'Exited function', functionName: 'mastercardPayment in class QRPaymentService', errorResponse });
        return errorResponse;
      }

      // Initiating payment request 
      let paymentResponse = await this.qrIssuingTransactionMastercard(payload, deviceNumber);
      let esbResponse = paymentResponse.esbResponse;
      let isEsbSuccess = this.isEsbRspSuccess(esbResponse);
      if (!isEsbSuccess) {
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRMastercard.cps + esbResponse.Result.ResultCode, esbResponse, null);
        logger.debug({ event: 'Exited function', functionName: 'mastercardPayment in class QRPaymentService', clientResponse });
        return clientResponse;
      }

      // creating client response 
      let dataModel = await QRHelper.mastercardPaymentReponse(payload, esbResponse, paymentResponse.retrievalRefNumber, paymentResponse.traceAuditNumber);
      await this.addMongo(dataModel);
      dataModel.isRated = await QRHelper.checkIfRatable(dataModel.msisdn, dataModel.contextData.merchantDetails.tillNumber, dataModel.amount, true);
      let clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRMastercard.success, null, dataModel);

      // Only if we have the merchant msisdn only then we can perform the below actions
      if (payload.merchantDetails.msisdn && payload.merchantDetails.msisdn !== 'null' && payload.merchantDetails.msisdn !== '') {
        await QRHelper.triggerIPN(dataModel);
        await QRHelper.notify(dataModel);
        await QRHelper.smsNotifiers(dataModel.contextData.merchantDetails.msisdn, dataModel.txID, dataModel.totalAmount)
      }
      logger.debug({ event: 'Exited function', functionName: 'mastercardPayment in class QRPaymentService', clientResponse });

      //Adding to Favorites List
      logger.info({ event: 'Adding Favorite', functionName: 'confirmPayment.QRPaymentService'});
      if(payload.favoriteFlag)
      favListHandler.addFavorite(payload);

      return clientResponse;
    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'mastercardPayment in class QRPaymentService', error: { message: error.message, stack: error.stack } })
      // return false;
      throw error;
    }
  }

  async getDeviceNumberFromLinkedCards(msisdn, channel) {
    logger.debug({ event: 'Entered function', functionName: 'getDeviceNumberFromLinkedCards in class QRPaymentService', msisdn, channel });
    try {
      const COMMANDS_MAP_R_FIVE = process.env.COMMANDS_MAP_R_FIVE || config.rFive.commands;
      let esbRFiveService = new ESBRFiveService();

      const requestBody = await esbRFiveService.createESBRequestObject(
        channel,
        COMMANDS_MAP_R_FIVE.getLinkedCards,
        COMMANDS_MAP_R_FIVE.getLinkedCards.initiatorIdentifierType,
        'ORG',
        'ORGMPIN',
        COMMANDS_MAP_R_FIVE.getLinkedCards.receiverIdentifierType,
        msisdn,
        null,
        null,
        null,
        null
      );
      logger.debug(requestBody);
      if (requestBody != null) {
        requestBody.GetLinkedCardsRequest = null;
        let esbResponse = await esbRFiveService.getESBResponse(requestBody);
        logger.debug(esbResponse);

        if (esbResponse && esbResponse.Result.Response && esbResponse.Result.Response.ResultCode === '0') {
          if (esbResponse.Result.Response.GetLinkedCardsResult.LinkedCards && esbResponse.Result.Response.GetLinkedCardsResult.LinkedCards.length > 0) {
            let deviceNumber = '';
            for (let card of esbResponse.Result.Response.GetLinkedCardsResult.LinkedCards) {
              if (card.CardCategory === 'QR-VCN') {
                deviceNumber = card.CardNumber;
                break;
              }
            }
            return deviceNumber;
          }

        }
      } else {
        logger.info("Unable to Form Get Linked Card Request" + { requestBody })
      }
      return null;
    } catch (error) {
      logger.error('exception in getDeviceNumberFromLinkedCards in class QRPaymentService: ' + error.message);
      return null;
    }
  }

  async qrIssuingTransactionMastercard(payload, deviceNumber) {
    logger.debug({ event: 'Entered function', functionName: 'qrIssuingTransactionMastercard in class QRPaymentService', payload });
    try {
      const COMMANDS_MAP_R_FIVE = process.env.COMMANDS_MAP_R_FIVE || config.rFive.commands;
      let esbRFiveService = new ESBRFiveService();

      let customObj = {
        isFonepay: true,
        txType: payload.transactionType,
        paidVia: payload.paidVia,
        qrCode: payload.qrCode,
        senderName: payload.name,
        merchantName: payload.merchantDetails.name,
        merchantTillNumber: payload.merchantDetails.tillNumber,
        merchantMsisdn: payload.merchantDetails.msisdn,
        qrString: payload.qrString,
        totalAmount: payload.totalAmount,
        cardAccepTermID: payload.cardAccepTermID,
        cardAccepIDCode: payload.cardAccepIDCode
      }
      if (payload.tipAmount) {
        customObj.tipAmount = payload.tipAmount;
      }
      if (payload.convenienceFee) {
        customObj.convenienceFee = payload.convenienceFee;
      }
      if (payload.conveniencePercentage) {
        customObj.conveniencePercentage = payload.conveniencePercentage;
      }
      const requestBody = await esbRFiveService.createESBRequestObject(
        payload.channel,
        COMMANDS_MAP_R_FIVE.QRPaymentMasterCard,
        COMMANDS_MAP_R_FIVE.QRPaymentMasterCard.initiatorIdentifierType,
        payload.msisdn,
        payload.mpin,
        null,
        null,
        null,
        null,
        customObj,
        null
      );

      let traceAuditNumber = Math.random().toString().slice(2, 8);
      let retrievalRefNumber = Math.random().toString().slice(2, 14);
      let TransactionRequest = {
        "Parameters": {
          "Parameter": [
            {
              "Key": "MessageType",
              "Value": MC_MESSAGE_TYPE
            },
            {
              "Key": "DeviceNumber",
              "Value": deviceNumber
            },
            {
              "Key": "TransactionType",
              "Value": MC_TRANSACTION_TYPE
            },
            {
              "Key": "TraceAuditNumber",
              "Value": traceAuditNumber//generate unique 6 digit code for tracing
            },
            {
              "Key": "RetrievalRefNumber",
              "Value": retrievalRefNumber// generate unique 12 digit unique code for tracing
            },
            {
              "Key": "TransmissionDateTime", // GMT date in the MMDDHHmmss format 24 hour
              "Value": moment(moment().utc()).format('MMDDHHmmss')
            },
            {
              "Key": "TransactionLocalDate", // local date +5hr from GMT/UTC in the YYMMDDHHmmss format 24 hour
              "Value": moment(moment().utc().utcOffset("+0500")).format('YYMMDDHHmmss')
            },
            {
              "Key": "PosData",
              "Value": MC_POS_DATA
            },
            {
              "Key": "AcquiringCountryCode",
              "Value": MC_ACQUIRING_COUNTRY_CODE
            },
            {
              "Key": "AcquiringInstitutionCode",
              "Value": MC_ACQUIRING_INSTITUTION_CODE
            },
            {
              "Key": "TerminalType",
              "Value": MC_TERMINAL_TYPE
            },
            {
              "Key": "MPINVerification",
              "Value": MC_MPIN_VERIFICATION
            },
            {
              "Key": "QRCodeData",
              "Value": payload.qrString
            },
            {
              "Key": "Channel",
              "Value": MC_CHANNEL
            },
            {
              "Key": "CardAccepTermID",
              "Value": payload.cardAccepTermID
            },
            {
              "Key": "CardAccepIDCode",
              "Value": payload.cardAccepIDCode
            },
            {
              "Key": "Timestamp",
              "Value": (moment().unix() + MC_EPOCH_OFFSET) + "170" // Add an offset time to epochtime and add 170 in the end for futher breakdown to smaller units
            }
          ],
          "Amount": ("000000000000" + (payload.totalAmount * 100)).substr(-12, 12), // left 0 padded 12 digit number in paisas 
          "Currency": MC_CURRENCY
        }
      }
      Object.assign(requestBody, { "TransactionRequest": TransactionRequest });

      //   console.log({requestBody});
      // console.log(requestBody.TransactionRequest.Parameters);
      // console.log(JSON.stringify(requestBody));

      let esbResponse = await esbRFiveService.getESBResponse(requestBody);
      //console.log(JSON.stringify(esbResponse))
      logger.debug({ esbResponse });
      return { esbResponse, traceAuditNumber, retrievalRefNumber };

    } catch (error) {
      logger.error('exception in qrIssuingTransactionMastercard in class QRPaymentService: ' + error.message);
      return null;
    }
  }

  async fonepayMerchantPayment(payload, txnId) {
    try {
      logger.debug({ event: 'Entered function', functionName: 'fonepayMerchantPayment in class QRPaymentService', payload, txnId });
      const apiConfigFonepay = {
        baseURL: FONEPAY_URL,
        timeout: FONEPAY_AXIOS_TIMEOUT
      };

      const merchantPaymentPayload = {
        USER_ID: FONEPAY_USERNAME,
        PASSWORD: FONEPAY_PASSWORD,
        BANK_ID: FONEPAY_BANK_ID,
        MOBILE_NO: payload.msisdn,
        FIRST_NAME: 'Jazz',
        LAST_NAME: 'Cash',
        CNIC: '3111111111111',
        GENDER: 'M',
        DATE_OF_BIRTH: '28021990',
        QR_STRING: payload.qrString,
        MERCHANT_ID: payload.merchantDetails.merchantId,
        AMOUNT: String(payload.amount),
        TOTAL_AMOUNT: String(payload.totalAmount),
        DATE_TIME: moment().format('YYYY/MM/DD hh:mm:ss'),
        RRN: txnId
      };

      if (payload.tipAmount) {
        merchantPaymentPayload.TIP_AMOUNT = payload.tipAmount + "";
      } else if (payload.convenienceFee) {
        merchantPaymentPayload.CONVENIENCE_FEE = payload.convenienceFee + "";
      } else if (payload.conveniencePercentage) {
        merchantPaymentPayload.CONVENIENCE_PERCENTAGE = payload.conveniencePercentage + "";
      }
      logger.debug("Request Fonepay Payload:" + JSON.stringify(merchantPaymentPayload));
      let fonepayResponse = await axios.post(FONEPAY_MERCHANT_PAYMENT_PATH, merchantPaymentPayload, apiConfigFonepay);
      logger.debug("Response for Fonepay Merchant Payment:" + JSON.stringify(fonepayResponse.data));

      logger.debug({ event: 'Exited function', functionName: 'fonepayMerchantPayment in class QRPaymentService', fonepayPaymentResponse: fonepayResponse.data });
      return fonepayResponse.data;

    } catch (error) {
      // logger.error({event:'Error thrown',functionName:'fonepayMerchantPayment in class QRPaymentService',error:{message:error.message,stack:error.stack}})
      // return false;
      throw error;
    }
  }

  async confirmFonepayQRPayment(payload) {
    logger.debug({ event: 'Entered function', functionName: 'confirmFonepayQRPayment in class QRPaymentService', payload });
    const servRespInitTrans = await this.initTransFonepayEsb(payload);
    let isEsbSuccess = this.isEsbRspSuccess(servRespInitTrans);
    if (!isEsbSuccess) {
      return this.getEsbErrorRsp(servRespInitTrans);
    }

    const originalTxnId = servRespInitTrans.Result.TransactionID;
    const servRespConfirmTrans = await this.confirmTransFonepayEsb(originalTxnId, payload);
    isEsbSuccess = this.isEsbRspSuccess(servRespConfirmTrans);
    if (!isEsbSuccess) {
      return this.getEsbErrorRsp(servRespConfirmTrans);
    }
    let dataModel = await QRHelper.confirmQRResponse(servRespConfirmTrans, payload, true);
    await this.addMongo(dataModel);
    dataModel.isRated = await QRHelper.checkIfRatable(dataModel.msisdn, dataModel.contextData.merchantDetails.tillNumber, dataModel.amount, true);
    const fonepayPaymentRsp = await this.fonepayMerchantPayment(payload, originalTxnId);
    if (!fonepayPaymentRsp || fonepayPaymentRsp.RESPONSE_CODE !== '0000') {
      return this.initiateFonepayRefund(dataModel, payload);
    }
    let confirmFonepayPaymentresponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRFonepay.success, null, dataModel);
    logger.debug({ event: 'Exited function', functionName: 'confirmFonepayQRPayment in class QRPaymentService', confirmFonepayPaymentresponse });
    return confirmFonepayPaymentresponse;
  }

  async initiateFonepayRefund(dataModel, payload) {
    logger.debug({ event: 'Entered function', functionName: 'initiateFonepayRefund in class QRPaymentService', payload, dataModel });
    let servRespInitRefund;
    let isEsbSuccess = false;
    const maxRetryAttempts = COMMANDS_MAP.QRFonepayRefund.retryCount;
    for (let i = 0; i < maxRetryAttempts; i++) {
      servRespInitRefund = await this.initQRFonepayRefund(dataModel, payload);
      isEsbSuccess = this.isEsbRspSuccess(servRespInitRefund);
      if (isEsbSuccess) {
        break;
      }
    }
    if (!isEsbSuccess) {
      await this.updateQRRefundStatus(dataModel.txID, 'fonepay');
      return responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRFonepay.helpline, null, null);
    }
    let servRefundConfirmResp;
    for (let i = 0; i < maxRetryAttempts; i++) {
      servRefundConfirmResp = await this.confirmTransFonepayEsb(servRespInitRefund.Result.TransactionID, payload.channel, COMMANDS_MAP.QRFonepayRefund.initiatorIdentifier, COMMANDS_MAP.QRFonepayRefund.initiatorSecurityCredential);
      isEsbSuccess = this.isEsbRspSuccess(servRefundConfirmResp);
      if (isEsbSuccess) {
        break;
      }
    }
    if (!isEsbSuccess) {
      await this.updateQRRefundStatus(dataModel.txID);
      return responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRFonepay.helpline, null, null);
    }
    payload.originalTxID = dataModel.txID;
    dataModel = await QRHelper.confirmQRResponse(servRefundConfirmResp, payload, true);
    await this.addMongo(dataModel);
    let fonepayRefundResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRFonepay.refunded, null, null);
    logger.debug({ event: 'Exited function', functionName: 'initiateFonepayRefund in class QRPaymentService', fonepayRefundResponse });
    return fonepayRefundResponse;
  }

  async initQRFonepayRefund(qrPaymentModel, payload) {
    logger.debug({ event: 'Entered function', functionName: 'initQRFonepayRefund in class QRPaymentService', payload, qrPaymentModel });
    let esbService = new ESBService();
    let ESBRequestData = {};

    logger.debug(qrPaymentModel);
    let transactionParams = [
      {
        key: COMMANDS_MAP.QRFonepayRefund.parameters.amount,
        value: String(qrPaymentModel.amount),
      },
      {
        key: COMMANDS_MAP.QRFonepayRefund.parameters.fee,
        value: String(qrPaymentModel.fee),
      },
      {
        key: COMMANDS_MAP.QRFonepayRefund.parameters.transID,
        value: String(qrPaymentModel.txID),
      }
    ];

    ESBRequestData = await esbService.createESBRequestObject(
      payload.channel,
      COMMANDS_MAP.QRFonepayRefund,
      COMMANDS_MAP.QRFonepayRefund.initiatorIdentifierType,
      COMMANDS_MAP.QRFonepayRefund.initiatorIdentifier,
      null,
      null,
      null,
      transactionParams,
      null,
      null
    );

    logger.debug('ESB Template Data InitTrans_RefundMerchantPayment', ESBRequestData);
    logger.debug(ESBRequestData.Transaction.Parameters.Parameter);
    let fonepayRefundInitResponse = await esbService.getESBResponse(ESBRequestData);
    logger.debug({ event: 'Exited function', functionName: 'initQRFonepayRefund in class QRPaymentService', fonepayRefundInitResponse });
    return fonepayRefundInitResponse
  }

  async initTransFonepayEsb(payload) {
    logger.debug({ event: 'Entered function', functionName: 'initTransFonepayEsb in class QRPaymentService', payload });
    let esbService = new ESBService();
    let configCommand = 'QRPaymentFonepay';
    let transactionParams = [{
      key: COMMANDS_MAP[configCommand].parameters.amount,
      value: String(payload.totalAmount),
    }];
    let customObj = {
      isFonepay: true
    }
    const ESBRequestData = await esbService.createESBRequestObject(
      payload.channel,
      COMMANDS_MAP[configCommand],
      COMMANDS_MAP[configCommand].initiatorIdentifierType,
      payload.msisdn,
      null,
      COMMANDS_MAP[configCommand].receiverIdentifierType,
      COMMANDS_MAP[configCommand].receiverIdentifier,
      transactionParams,
      null,
      customObj
    );

    logger.debug('ESB Template Data InitTrans_MerchantPaymentByCustomer', ESBRequestData);
    logger.debug(ESBRequestData.Transaction.Parameters.Parameter);
    let initFonepayResponse = await esbService.getESBResponse(ESBRequestData);
    logger.debug({ event: 'Exited function', functionName: 'initTransFonepayEsb in class QRPaymentService', initFonepayResponse });
    return initFonepayResponse;
  }

  async confirmTransFonepayEsb(transactionID, payload) {
    logger.debug({ event: 'Entered function', functionName: 'confirmTransFonepayEsb in class QRPaymentService', transactionID, payload });
    let esbService = new ESBService();
    let transactionParams = [];

    transactionParams = [{
      key: COMMANDS_MAP.QRPaymentConfirm.parameters.transID,
      value: transactionID
    },
    {
      key: COMMANDS_MAP.QRPaymentConfirm.parameters.isSuccess,
      value: "true"
    }
    ];
    let customObj = {
      isFonepay: true,
      txType: payload.transactionType,
      paidVia: payload.paidVia,
      qrCode: payload.qrCode,
      senderName: payload.name,
      merchantName: payload.merchantDetails.name,
      merchantTillID: payload.merchantDetails.merchantId,
      shortcode: COMMANDS_MAP['QRPaymentFonepay'].receiverIdentifier,
      qrString: payload.qrString,
      totalAmount: payload.totalAmount
    }
    if (payload.tipAmount) {
      customObj.tipAmount = payload.tipAmount;
    }
    if (payload.convenienceFee) {
      customObj.convenienceFee = payload.convenienceFee;
    }
    if (payload.conveniencePercentage) {
      customObj.conveniencePercentage = payload.conveniencePercentage;
    }
    const ESBRequestData = await esbService.createESBRequestObject(
      payload.channel,
      COMMANDS_MAP.QRPaymentConfirm,
      COMMANDS_MAP.QRPaymentConfirm.initiatorIdentifierType,
      payload.msisdn,
      payload.MPIN,
      null,
      null,
      transactionParams,
      null,
      customObj
    );

    logger.debug('ESB Template Data Confirm Fonepay QR Payment', ESBRequestData);
    logger.debug(ESBRequestData.Transaction.Parameters.Parameter);
    let confirmFonepayResponse = await esbService.getESBResponse(ESBRequestData);
    logger.debug({ event: 'Exited function', functionName: 'confirmTransFonepayEsb in class QRPaymentService', confirmFonepayResponse });
    return confirmFonepayResponse;
  }

  isEsbRspSuccess(servResp) {
    return servResp && servResp.Response &&
      servResp.Response.ResponseCode === '0' &&
      servResp.Result &&
      servResp.Result.ResultCode === '0';
  }

  async getEsbErrorRsp(servResp) {
    if (servResp && servResp.Result && servResp.Result.ResultCode) {
      return responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRFonepay.cps + servResp.Result.ResultCode);
    } else if (servResp && servResp.Response && servResp.Response.ResponseCode) {
      return responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRFonepay.cps + servResp.Response.ResponseCode);
    } else {
      return responseCodeHandler_new.getThirdPartyResponseCode(config.responseCode.useCases.QRFonepay.timeout, servResp);
    }
  }

  async initQRRefund(payload) {
    let clientResponse = {};
    try {
      logger.debug({ event: 'Entered function', functionName: 'initQRRefund in class QRPaymentService', payload });

      let esbService = new ESBService();
      let transactionParams = [];
      let ESBRequestData = {};

      let transactionInfo = await this.getTransactionDetails(payload.originalTxID);
      logger.debug({ event: 'debugging', transactionInfo });
      if (!transactionInfo) {
        // return error add a new code for it
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRRefund.notFound, null, null);
        return clientResponse;
      }
      // txType paidVia qrCode amount fee msisdn name contextData.merchantDetails.name

      let customObj = {
        txType: transactionInfo.txType,
        paidVia: transactionInfo.paidVia,
        qrCode: transactionInfo.qrCode,
        originalSenderMsisdn: transactionInfo.msisdn,
        originalSenderName: transactionInfo.name,
        receiverMerchantName: transactionInfo.contextData.merchantDetails.name,
        originalTxID: payload.originalTxID
      }

      //Step 1 : Calling Init_Trans
      transactionParams = [
        {
          key: COMMANDS_MAP.QRRefund.parameters.amount,
          value: String(transactionInfo.amount),
        },
        {
          key: COMMANDS_MAP.QRRefund.parameters.fee,
          value: String(transactionInfo.fee),
        },
        {
          key: COMMANDS_MAP.QRRefund.parameters.transID,
          value: String(payload.originalTxID),
        }
      ];

      ESBRequestData = await esbService.createESBRequestObject(
        payload.channel,
        COMMANDS_MAP.QRRefund,
        COMMANDS_MAP.QRRefund.initiatorIdentifierType,
        payload.msisdn,
        null,
        null,
        null,
        transactionParams,
        null,
        customObj
      );

      logger.debug('ESB Template Data InitTrans_RefundMerchantPayment', ESBRequestData);
      logger.debug(ESBRequestData.Transaction.Parameters.Parameter);

      let servResp = await esbService.getESBResponse(ESBRequestData);

      logger.debug(`After the InitTrans_RefundMerchantPayment api call: data : ${servResp}`)

      if (servResp && servResp.Response && servResp.Response.ResponseCode === '0' && servResp.Result && servResp.Result.ResultCode === '0') {
        let initResponse = await QRHelper.initQRResponse(servResp);
        initResponse.originalTxID = payload.originalTxID;
        let key = payload.msisdn + '_' + initResponse.originalTxID;
      //   await cache.putValueWithExpiry(key, { requestPayload : payload, responsePayload : initResponse }, config?.cacheTRXHistoryRevamped?.cacheName || "transactionHistoryDB2", config?.cacheTRXHistoryRevamped?.cacheExpiry || "3600");
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRRefund.init, null, initResponse);
      }
      else {
        logger.debug('Faliure in InitTrans_RefundMerchantPayment');
        if (servResp && servResp.Result && servResp.Result.ResultCode) {
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRRefund.cps + servResp.Result.ResultCode, servResp, null);
          return clientResponse;
        } else if (servResp && servResp.Response && servResp.Response.ResponseCode) {
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRRefund.cps + servResp.Response.ResponseCode, servResp, null);
          return clientResponse;
        }
        else {
          clientResponse = await responseCodeHandler_new.getThirdPartyResponseCode(config.responseCode.useCases.QRRefund.timeout, null, null);
        }
      }
      logger.debug({ event: 'Exited function', functionName: 'initQRRefund in class QRPaymentService', clientResponse });
      return clientResponse;
    }
    catch (error) {
      // logger.error({event:'Error thrown',functionName:'initQRRefund in class QRPaymentService',error:{message:error.message,stack:error.stack}})
      // let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.default, null, null);
      // return errorResponse;
      throw error;
    }
  }

  async confirmQRRefund(payload) {
    let clientResponse = {};
    try {
      logger.debug({ event: 'Entered function', functionName: 'confirmQRRefund in class QRPaymentService', payload });

      let esbService = new ESBService();
      let transactionParams = [];
      let ESBRequestData = {};

      let transactionInfo = await this.getTransactionDetails(payload.originalTxID);
      logger.debug(transactionInfo);
      if (!transactionInfo) {
        // return error add a new code for it
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRRefund.notFound, null, null);
        return clientResponse;
      }

      // Setting original tx data in the refund for the below fields
      payload.paidVia = transactionInfo.paidVia;
      payload.qrCode = transactionInfo.qrCode;
      payload.transactionType = transactionInfo.txType;
      payload.name = transactionInfo.contextData.merchantDetails.name;
      payload.merchantDetails = {};
      payload.merchantDetails.name = transactionInfo.name;
      payload.merchantDetails.msisdn = transactionInfo.msisdn;
      payload.description = "QR Refund";
      payload.thirdParty = payload?.thirdParty || payload?.channel;
      payload.isRefundable = false

      transactionParams = [
        {
          key: COMMANDS_MAP.QRRefundConfirm.parameters.transID,
          value: payload.txID
        },
        {
          key: COMMANDS_MAP.QRRefundConfirm.parameters.isSuccess,
          value: "true"
        }
      ];

      const referenceData = await trxHistoryUtil.mapTrxHistory({
        ...payload,
        txType: "qr-payment-refund",
      });

      logger.debug({
        event: "Response after mapping transaction history payload",
        functionName: "qrPaymentService.confirmQRRefund",
        data: referenceData
      });

      ESBRequestData = await esbService.createESBRequestObject(
        payload.channel,
        COMMANDS_MAP.QRRefundConfirm,
        COMMANDS_MAP.QRRefundConfirm.initiatorIdentifierType,
        payload.msisdn,
        payload.MPIN,
        null,
        null,
        transactionParams,
        referenceData,
        null
      );

      logger.debug('ESB Template Data Confirm QR Payment', ESBRequestData);
      logger.debug(ESBRequestData.Transaction.Parameters.Parameter);

      let servResp = await esbService.getESBResponse(ESBRequestData);

      logger.debug(`After the Confirm QR Payment api call: data : ${servResp}`)

      if (servResp && servResp.Response && servResp.Response.ResponseCode === '0' && servResp.Result && servResp.Result.ResultCode === '0') {
        logger.debug(servResp.Result.ResultParameters.ResultParameter);
        let dataModel = await QRHelper.confirmQRResponse(servResp, payload, false);
        let transactionService = new transactionHistoryService(transactionHistoryModel.getInstance());
        let txHistoryUpdate = await transactionService.updateRefundStatus(payload.originalTxID, payload.msisdn);
        await this.updateQRRefundStatus(payload.originalTxID, 'proprietary');
        if (txHistoryUpdate) {
          logger.debug("Refund Status Updated Successfully");
        }

        logger.info("***** payload *****",payload)

          this.AddDataToTransactionHistory(payload, dataModel);

        await this.addMongo(dataModel);
        await QRHelper.notify(dataModel);
        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.confirm, null, dataModel);
      }
      else {
        logger.debug('Failure in Confirm Refund InitTrans_MerchantPaymentByCustomer');
        if (servResp && servResp.Result && servResp.Result.ResultCode) {
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.cps + servResp.Result.ResultCode, servResp, null);
          return clientResponse;
        } else if (servResp && servResp.Response && servResp.Response.ResponseCode) {
          clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.cps + servResp.Response.ResponseCode, servResp, null);
          return clientResponse;
        }
        else {
          clientResponse = await responseCodeHandler_new.getThirdPartyResponseCode(config.responseCode.useCases.QRPayment.timeout, null, null);
        }
      }
      logger.debug({ event: 'Exited function', functionName: 'confirmQRRefund in class QRPaymentService', clientResponse });
      return clientResponse;
    }
    catch (error) {
      // logger.error({event:'Error thrown',functionName:'confirmQRRefund in class QRPaymentService',error:{message:error.message,stack:error.stack}})
      // let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.default, null, null);
      // return errorResponse;
      throw error;
    }
  }

  async updateQRRating(payload) {
    logger.debug({ event: 'Entered function', functionName: 'updateQRRating in class QRPaymentService', payload });
    const query = { "txID": payload.txID };
    logger.debug(query);
    try {
      let responseObject = await this.QRPaymentModel.findOneAndUpdate(query, { rating: payload.rating });
      const QuickPayModelObj = QuickPayModel.getInstance();
      let checkQuickPay = await QuickPayModelObj.findOne(query);
      const RequestInvoiceModelObj = ResquestInvoiceModel.getInstance();
      const checkRequestInvoice = RequestInvoiceModelObj.findOne(query);
      logger.debug({ checkQuickPay });
      logger.debug({ responseObject });
      logger.debug({ checkRequestInvoice });

      if (responseObject || checkRequestInvoice || checkQuickPay) {
        let transactionService = new transactionHistoryService(transactionHistoryModel.getInstance());
        let txHistoryUpdate = await transactionService.updateTxHistoryData(payload);
        if (txHistoryUpdate) {
          logger.debug({ event: 'Updated Tx History Rating Successful', functionName: 'updateQRRating in class QRPaymentService', success: true });
        } else {
          logger.debug({ event: 'Unable to Update Tx History Rating', functionName: 'updateQRRating in class QRPaymentService', success: false });
        }

        logger.debug({ event: 'Exited function', functionName: 'updateQRRating in class QRPaymentService', success: true });
        return { success: true };
      } else {
        logger.debug({ event: 'Exited function', functionName: 'updateQRRating in class QRPaymentService', success: false });
        return { success: false };
      }
    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'updateQRRating in class QRPaymentService', error: { message: error.message, stack: error.stack } })
      return { success: false };
    }
  }

  async getTransactionDetails(txID) {
    logger.debug({ event: 'Entered function', functionName: 'getTransactionDetails in class QRPaymentService', txID });
    const query = { "txID": txID };
    logger.debug(query);
    try {
      let responseObject = await this.QRPaymentModel.find(query, 'txType paidVia qrCode amount fee msisdn name contextData.merchantDetails.name -_id').lean();

      if (responseObject) {
        logger.debug({ event: 'Exited function', functionName: 'getTransactionDetails in class QRPaymentService', txDetails: responseObject[0] });
        return responseObject[0];
      } else {
        logger.debug({ event: 'Exited function', functionName: 'getTransactionDetails in class QRPaymentService', txDetails: false });
        return false;
      }
    } catch (error) {
      // This is done intentionally don't change
      logger.debug({ event: 'Error thrown', functionName: 'getTransactionDetails in class QRPaymentService', error: { message: error.message, stack: error.stack } })
      return false;
    }
  }

  async updateQRRefundStatus(txID, type) {
    logger.debug({ event: 'Entered function', functionName: 'updateQRRefundStatus in class QRPaymentService', txID, type });
    const query = { "txID": txID };
    let updatePayload = {};
    if (type === 'proprietary') {
      updatePayload = { isRefundable: 'false' }
    } else {
      updatePayload = { txStatus: 'To be Refunded - Fonepay' }
    }
    try {
      let responseObject = await this.QRPaymentModel.findOneAndUpdate(query, updatePayload);
      if (responseObject) {
        logger.debug({ event: 'Exited function', functionName: 'updateQRRefundStatus in class QRPaymentService', success: true });
        return { success: true };
      } else {
        logger.debug({ event: 'Exited function', functionName: 'updateQRRefundStatus in class QRPaymentService', success: false });
        return { success: false };
      }
    } catch (error) {
      // This is done intentionally don't change
      logger.debug({ event: 'Error thrown', functionName: 'updateQRRefundStatus in class QRPaymentService', error: { message: error.message, stack: error.stack } })
      return { success: false };
    }
  }

  async addMongo(payload) {
    logger.debug({ event: 'Entered function', functionName: 'addMongo in class QRPaymentService', payload });
    logger.debug(payload);
    try {
      let responseObject = await this.QRPaymentModel.create(payload);

      if (responseObject) {
        logger.debug({ event: 'Exited function', functionName: 'addMongo in class QRPaymentService', success: true });
        return true;
      } else {
        logger.debug({ event: 'Exited function', functionName: 'addMongo in class QRPaymentService', success: false });
        return false;
      }
    } catch (error) {
      // This is done intentionally don't change
      logger.debug({ event: 'Error thrown', functionName: 'addMongo in class QRPaymentService', error: { message: error.message, stack: error.stack } })
      return false;
    }
  }

  async createOtherProfile(payload) {
    try {
      logger.debug({ event: 'Entered function', functionName: 'createOtherProfile in class QRPaymentService', payload });
      const otherProfileAPI = {
        baseURL: CREATE_OTHER_PROFILE,
        timeout: AKSA_AXIOS_TIMEOUT,
      };

      const otherProfileResponse = await axios.post('', payload, otherProfileAPI);
      logger.debug('otherProfileResponse: ' + JSON.stringify(otherProfileResponse.data));
      return true;
    }
    catch (error) {
      // This is done intentionally don't change
      logger.debug({ event: 'Error thrown', functionName: 'createOtherProfile in class QRPaymentService', error: { message: error.message, stack: error.stack } })
      logger.debug(error);
      return null;
    }
  }

  async updateNotifier(payload, msisdn) {

    printLog(
      'Entered function',
      'qrpaymentservice.updateNotifier',
      { payload, msisdn }
   );

    try {

      const config = {
        headers: {
          "X-MSISDN": msisdn
        }
      }
      printLog(
        'Payload before calling updatenotifers api',
        'qrpaymentservice.updateNotifier',
        { UPDATE_NOTIFIER, payload, config }
     );

      const updateNotifierResponse = await axios.put(UPDATE_NOTIFIER, payload, config);

      printLog(
        'Response after calling updatenotifers api',
        'qrpaymentservice.updateNotifier',
        updateNotifierResponse
     );

      return true;
    }
    catch (error) {

      printError(error, 'qrpaymentservice.updateNotifier');

      return null;
    }
  }
  async AddDataToTransactionHistory(payload, data) {
    let trxHistoryPayload;
    let key = payload.msisdn + '_' + data.txID;
    //const cacheResponse = await cache.getValue(key, config?.cacheTRXHistoryRevamped?.cacheName || "transactionHistoryDB2");

   logger.info({
    event: '****** Entered function ******',
    functionName: 'qrPaymentService.AddDataToTransactionHistory',
    payload: payload,
    data: data,
    TIMESTAMP: new Date().toISOString()
   });

    //taking data from cache
    trxHistoryPayload = {
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
        FEE: data?.fee || payload?.fee || "0.00",
        FED: "0.00",
        WHT: "0.00",
        GROSS_AMT: ((parseFloat(data?.fee || 0) || 0) + parseFloat(data?.amount || 0)).toString() || "0.00",
        AMOUNT_DEBITED: data?.amount || "",
        AMOUNT_CREDITED: data?.amount || "",
        BENEFICIARY_MSISDN: payload?.merchantDetails?.msisdn || "",
        DESCRIPTION: payload?.description || "QR Payment",
        REASON_TYPE: payload?.trxName || "",
        PUBLIC_IP: payload.publicIP,
        PUBLIC_PORT: payload.publicPort,
        IDENTIFIER_TYPE: payload?.identifierType || "",
        CONTEXT_DATA: {
            //reciever name saved as json
            RECEIVER_NAME: payload?.merchantDetails?.name || "",
            customerCNIC : payload?.customerCNIC || "",
            qrCode : payload?.qrCode || "",
            paidVia: payload?.paidVia || "",            
            useCase:  payload?.useCase || "",
            isRefundable : payload?.isRefundable || true,
            isRepeatable: !(payload?.thirdParty.includes('merchant')),
            trx_name: payload?.trxName || "",
            flowId: payload?.flowId || "",
            category: payload?.category || "",
            subCategory: payload?.subCategory || "",

        }
    }



    logger.info({
      event: 'transaction history options object with payload',
      functionName: 'qrPaymentService.AddDataToTransactionHistory',
      data: trxHistoryPayload,
    });

    logger.debug({
      event: '** Exited function **',
      functionName: 'qrPaymentService.AddDataToTransactionHistory',
      data: trxHistoryPayload,
      TIMESTAMP: new Date().toISOString()
    });

    let subscriber = Subscriber.getInstance();
    subscriber.event.produceMessage(trxHistoryPayload, 'TRX_HISTORY_REPORTING');

  }
  async updateInvoiceStatus(query) {
    logger.info({
      event: '*** Entered function ***',
      functionName: 'QRPaymentService.updateInvoiceStatus',
      data: { query },
      TIMESTAMP: new Date().toISOString()
    });

    const RequestInvoiceModelObj = ResquestInvoiceModel.getInstance();  
    let responseObject = await RequestInvoiceModelObj.findOneAndUpdate(query, { status: 'completed' });
  
    logger.info({
      event: '*** After updating invoice status ***',
      functionName: 'QRPaymentService.updateInvoiceStatus',
      data: { responseObject },
      TIMESTAMP: new Date().toISOString()
    });
  
    return responseObject;
  }

  /**
     * @method p2mRefund calling ws02 method to refund p2m
     * @param {object} payload
     * @returns response
     */
  async p2mRefund(payload) {

    logger.info({
        event: '*** Entered function ***',
        functionName: 'p2mRefund.QRPaymentService',
        data: { payload },
        TIMESTAMP: new Date().toISOString()
    });

    let clientResponse = {};
    try {
        let resp = {};
        let merchantResponse = {}

        let WSO2_Refund_Payload = {
            "ref_id": payload.reverseTransaction.ref_id,
            "reversalReason": payload?.reverseTransaction?.reversalReaso || '',
            "reversalAdditionalInfo": payload?.reverseTransaction?.reversalAdditionalInfo || ''
        }

        logger.debug({
            event: '*** Payload for WSO2 call ***',
            functionName: 'p2mRefund.QRPaymentService',
            data: WSO2_Refund_Payload,
            TIMESTAMP: new Date().toISOString()
        });

        resp = await axios.post(P2M_REFUND_API, payload.reverseTransaction);

        logger.debug({
            event: '*** WSO2 Refund API Response ***',
            functionName: 'p2mRefund.QRPaymentService',
            data: resp.data,
            TIMESTAMP: new Date().toISOString()
        });

        if (resp.data.success === "true" && resp.data.response.responseCode === "0") {

            let aksaToken = await this.loginAKSA();
            if (!aksaToken) {
                logger.debug("Authorization Failed on AKSA. Unable to Get Token.");
                clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.authentication, null, null);
                return clientResponse;
            }

            let merchantDetailsPayload = {};
            let merchantMSISDN = payload.msisdn.startsWith("92") ? payload?.msisdn?.replace("92", "0") : payload?.msisdn

            payload?.reverseTransaction?.till_id ? merchantDetailsPayload.TillNumber = payload?.reverseTransaction?.till_id : merchantDetailsPayload.MSISDN = merchantMSISDN

            logger.debug({
                event: '*** Merchant Details Payload ***',
                functionName: 'p2mRefund.QRPaymentService',
                data: merchantDetailsPayload,
                TIMESTAMP: new Date().toISOString()
            });

            merchantResponse = await this.getMerchantDetailsFromAKSA(merchantDetailsPayload, aksaToken);

            logger.debug({
                event: '*** Merchant Detail Response ***',
                functionName: 'p2mRefund.QRPaymentService',
                data: merchantResponse.Data,
                TIMESTAMP: new Date().toISOString()
            });

            if (merchantResponse && merchantResponse.Data && merchantResponse.Data.length) {

                let resultItem = {};
                resultItem = merchantResponse?.Data?.find(item => item.ISCAS === 1 && item.IsStatic)

                if (!resultItem) {
                    resultItem = merchantResponse?.Data.find(item => item.IsStatic === true)
                }

                logger.debug({
                    event: '*** After filtering merchant detail response ***',
                    functionName: 'p2mRefund.QRPaymentService',
                    data: resultItem,
                    TIMESTAMP: new Date().toISOString()
                });

                let notifiersData = {
                    MoblieNumber1: resultItem?.MoblieNumber1 || '',
                    MoblieNumber2: resultItem?.MoblieNumber2 || '',
                    MoblieNumber3: resultItem?.MoblieNumber3 || '',
                    MoblieNumber4: resultItem?.MoblieNumber4 || '',
                    MoblieNumber5: resultItem?.MoblieNumber5 || '',
                    MoblieNumber6: resultItem?.TerminalNumber && resultItem?.TerminalNumber != 'null' ? resultItem?.TerminalNumber : ""
                }

                const dataObj = {
                    senderName: payload.sender_name || '',
                    msisdn: payload.ac_to || '',
                    description: "Raast",
                    transactionType: "QR Payment Refunded",
                    thirdParty: payload.thirdParty,
                    useCase: "QR Payment Refunded",
                    fee: resp.data.fee,
                    fed: resp.data.fed,
                    rrn: resp.data.rrn,
                    wht: resp.data.wht,
                    isRefundable: false,
                    merchantDetails: {
                        name: payload.receiver_name || "",
                        msisdn: payload.ac_from || "",
                    }
                }

                const dataModel = {
                    txID: resp.data.transactionID,
                    txEndDate: resp.data.transaction_date,
                    name: payload.customerName,
                    amount: payload.amount,
                    contextData: {
                        merchantDetails: {
                            name: payload?.sender_name || "",
                        }
                    }
                }

                const notifierModel = {
                    txID: resp.data.transactionID || '',
                    msisdn: payload.msisdn || '',
                    name: payload.sender_name || '',
                    fee: resp.data.fee,
                    txEndDate: resp.data.transaction_date,
                    amount: payload.amount,
                    contextData: {
                        merchantDetails: {
                            msisdn: payload?.ac_to || '',
                            name: payload?.receiver_name || '',
                            tillNumber: payload?.reverseTransaction?.till_id || ''
                        }
                    }
                }

                this.updateNotifier(notifiersData, payload.msisdn);
                this.AddDataToTransactionHistory(dataObj, dataModel);
                QRHelper.smsNotifiers(payload.msisdn, resp.data.transactionID, payload.amount, payload.ac_from)
                QRHelper.notify(notifierModel);

                let dataToReturn = {
                  transactionID: resp?.data?.transactionID || ''
                }

                clientResponse = responseCodeHandler_new.getResponseCode(config.responseCode.useCases.p2mRefund.success, null, dataToReturn);
                return clientResponse
            }

            else {
                clientResponse = responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
                return clientResponse
            }
        }

        else if (resp.data.response.responseCode === "18") {
            clientResponse = responseCodeHandler_new.getResponseCode(config.responseCode.useCases.p2mRefund.trxAlreadyReversed, null, resp.data);
            return clientResponse
        }

        else {
            clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.p2mRefund.refundFailure, null, resp.data);
            return clientResponse;
        }
    }

    catch (error) {
        logger.error({
            event: '***** In catch block *****',
            functionName: 'p2mRefund.QRPaymentService',
            error: error?.message,
            errorStack: error?.error || error,
            TIMESTAMP: new Date().toISOString()
        });

        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.p2mRefund.internal, null, null);
        return clientResponse;
    }
  }

  async getMerchantDetailsByRaast(payload) {

    printLog(
      'Entered function',
      'qrpaymentservice.getMerchantDetailsByRaast',
      { payload }
   );

    try {

      let merchantResponse = {};

      let merchantDetails = await axios.post(DEFAULT_ACC_BY_ALIAS_PATH, payload);

      printLog(
        'Merchant response from Raast',
        'qrpaymentservice.getMerchantDetailsByRaast',
        merchantDetails
     );

      if (merchantDetails?.data?.Response?.responseCode == "EE11") {
        merchantResponse.Success = false;
        merchantResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.notFound, null, null);
      } else if (merchantDetails?.data?.Response?.responseCode?.includes("EE") || merchantDetails?.data?.Response?.responseCode == "48" || merchantDetails?.data?.Response?.responseCode == "99") {
        merchantResponse.Success = false;
        merchantResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.errorRaast, null, null);
      } else if (merchantDetails?.data?.Response?.responseCode == "00")  {
        merchantResponse = { ...merchantDetails.data, Success: true };
      } else {
        merchantResponse.Success = false
      }

      printLog(
        'Exited function',
        'qrpaymentservice.getMerchantDetailsByRaast',
        merchantResponse
     );

      return merchantResponse;

    } catch (error) {

      printError(error, 'qrpaymentservice.getMerchantDetailsByRaast');

      let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.default.code, null, null);
      return errorResponse;
    }

  }

  /**
 * @method displayQRV2 Calling AKSA API to display QR For App
 * @param {object} payload
 * @returns response
 */
  async displayQRV2(payload) {
    logger.info({
        event: '*** Entered function ***',
        functionName: 'QRPaymentService.displayQRV2',
        data: payload,
        TIMESTAMP: new Date().toISOString()
    });

    let clientResponse = {};
    try {
        let clientResponse={};
        const cacheName = config.cacheQRDisplay.cacheName
        const expiration = config.cacheQRDisplay.expiry
        const key = payload.MSISDN.startsWith("0") ? payload.MSISDN.toString().replace('0', '92') : payload.MSISDN

        try {
        
          logger.debug("merchantDetailsPayload ", payload);
          logger.debug("key ", key);
          logger.debug("cacheName ", cacheName)

          if(payload.TYPE !== 2){
            let cacheResponse = await cache_rest.getValue(key, cacheName);
            if (cacheResponse && key) {
              logger.debug("==================FETCH MERCHANT DETAILS FROM CACHE ========================");
              logger.debug(cacheResponse);
              logger.debug("==================FETCH MERCHANT DETAILS FROM CACHE ========================");
              let merchantResponse = cacheResponse
              logger.info({event:'Exited function',functionName:'Display QR in class displayQR Service',data:merchantResponse});
            return merchantResponse
            }
          }
        } catch (e) {
          logger.info("==================In Catch block DETAILS FROM CACHE ========================");
  
        }

        let get_qr_payload = payload;
        let bearerToken = await this.loginAKSA();
        let qrCodeData = {};

        if (bearerToken) {
            let apiConfig = this.APIConfig;
            apiConfig.headers = { Authorization: `Bearer ${bearerToken}` }

            logger.info({
                event: '**** GetQrCodeByTypev1 Payload ****',
                functionName: 'QRPaymentService.displayQRV2',
                data: { AKSA_GETQR_V1, get_qr_payload, apiConfig },
                TIMESTAMP: new Date().toISOString()
            });

            let getQRResponse = await axios.post(AKSA_GETQR_V1, get_qr_payload, apiConfig);

            if (getQRResponse.data.Code == "00" && getQRResponse.data.Data.length != 0) {

                if (payload.TYPE === 1) {
                    qrCodeData = getQRResponse?.data?.Data?.find(item => item.IsCAS === 1 && item.IsStatic === true) ||
                        getQRResponse?.data?.Data?.find(item => item.IsStatic === true) ||
                        getQRResponse?.data?.Data[0];
                } else {
                    qrCodeData = getQRResponse?.data?.Data?.find(item => item.IsStatic === false) ||
                        getQRResponse?.data?.Data[0];
                }

                logger.info({
                    event: '**** QR Code From AKSA ****',
                    functionName: 'QRPaymentService.displayQRV2',
                    data: qrCodeData,
                    TIMESTAMP: new Date().toISOString()
                });


                let qrBase64 = await qrcode.toDataURL(qrCodeData.QRPayload)
                qrBase64 = qrBase64.split(',')[1];

                let responseData = {
                    "tillNumber": qrCodeData.TillNumber,
                    "merchantMSISDN": qrCodeData.MerchantMSISDN,
                    "brandName": qrCodeData.BrandName,
                    "qrImageSimple": qrBase64,
                    "qrImage": qrCodeData.QRImage,
                    "merchantLoop": qrCodeData.MechantLoop,
                    "scheme": qrCodeData.Scheme
                }

                let subscriber = Subscriber.getInstance();
                subscriber.event.produceMessage(qrCodeData, config.kafkaBroker.DisplayQR_Success);
                clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.success, null, responseData);
                await cache_rest.putValueWithExpiry
                  (
                    key,
                    clientResponse,
                    cacheName,
                    expiration
                  );
            }

            else {
                clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.error, null, null);
            }
        }
        else {
            clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.authentication, null, null);
        }
        return clientResponse;

    } catch (error) {
        logger.error({
            event: '***** Error in function *****',
            functionName: 'QRPaymentService.displayQRV2',
            error: error.message,
            TIMESTAMP: new Date().toISOString()
        });

        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.internal);
        return clientResponse;
    }
  }

  /**
 * @method generateQRV2 Calling AKSA API to generate QR For Thirdparties
 * @param {object} payload
 * @returns response
 */
  async generateQRV2(payload) {
    logger.info({
        event: '*** Entered function ***',
        functionName: 'QRPaymentService.generateQRV2',
        data: payload,
        TIMESTAMP: new Date().toISOString()
    });

    let clientResponse = {};
    try {
        let get_qr_payload = payload;
        let bearerToken = await this.loginAKSA();
        let qrCodeData = {};

        if (bearerToken) {
            let apiConfig = this.APIConfig;
            apiConfig.headers = { Authorization: `Bearer ${bearerToken}` }

            logger.info({
                event: '**** GetQrCodeByTypev1 Payload ****',
                functionName: 'QRPaymentService.generateQRV2',
                data: { AKSA_GETQR_V1, get_qr_payload, apiConfig },
                TIMESTAMP: new Date().toISOString()
            });

            let getQRResponse = await axios.post(AKSA_GETQR_V1, get_qr_payload, apiConfig);

            if (getQRResponse.data.Code == "00" && getQRResponse.data.Data.length != 0) {

                if (payload.TYPE === 1) {
                    qrCodeData = getQRResponse?.data?.Data?.find(item => item.IsCAS === 1 && item.IsStatic === true) ||
                        getQRResponse?.data?.Data?.find(item => item.IsStatic === true) ||
                        getQRResponse?.data?.Data[0];
                } else {
                    qrCodeData = getQRResponse?.data?.Data?.find(item => item.IsStatic === false) ||
                        getQRResponse?.data?.Data[0];
                }

                logger.info({
                    event: '**** QR Code From AKSA ****',
                    functionName: 'QRPaymentService.generateQRV2',
                    data: qrCodeData,
                    TIMESTAMP: new Date().toISOString()
                });

                let qrBase64 = await qrcode.toDataURL(qrCodeData.QRPayload)
                qrBase64 = qrBase64.split(',')[1];

                let responseData = {
                    "tillNumber": qrCodeData.TillNumber,
                    "merchantMSISDN": qrCodeData.MerchantMSISDN,
                    "brandName": qrCodeData.BrandName,
                    "qrImageSimple": qrBase64,
                    "qrImage": qrCodeData.QRImage,
                    "merchantLoop": qrCodeData.MechantLoop,
                    "scheme": qrCodeData.Scheme
                }

                clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.success, null, responseData);
            }

            else {
                clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.error, null, null);
            }
        }
        else {
            clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.authentication, null, null);
        }
        return clientResponse;

    } catch (error) {
        logger.error({
            event: '***** Error in function *****',
            functionName: 'QRPaymentService.generateQRV2',
            error: error.message,
            TIMESTAMP: new Date().toISOString()
        });

        clientResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.internal);
        return clientResponse;
    }
  }
}

export default new QRPaymentService(QRPaymentModel);
