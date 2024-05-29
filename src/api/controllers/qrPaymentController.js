import validations from './validators/validatorEnhanced';
import QRPaymentService from '../../services/qrPaymentService';
import responseCodeHandler_new from '../../util/responseCodeHandler_New';
import msisdnTransformer from '../../util/msisdnTransformer';
import EncryptHelperUtil from '../../util/EncryptionHelperUtil';
import { HTTP_STATUS } from '../../util/constants';
import logger from '../../util/logger';
import {printLog, printError} from '../../util/utility';


const QR_CODE_ENCRYPTION_KEY = config.thirdPartyEncryption.name.qr_code;

let ENCYPTION_ENABLED = config.thirdPartyEncryption;
ENCYPTION_ENABLED = typeof(ENCYPTION_ENABLED) === 'string' ? JSON.parse(ENCYPTION_ENABLED) : ENCYPTION_ENABLED;
class QRPaymentController {
  constructor(service) {
    this.QRPaymentService = service;

  }

  async merchantDetails(req, res) {
    logger.debug({ event: 'Entered function', functionName: 'merchantDetails in class qrPaymentController' });
    try {
      if (process.env.CLOSE_MERCHANT_DETAILS == "true") {
        let disabledService = await responseCodeHandler_new.getResponseCode(
          config.responseCode.useCases.MerchantDetails.isClosed, null, null
        );
        return res.status(422).json(disabledService);
      }
      const headersValidationResponse = validations.verifySchema("QR_HEADER_SCHEMA", req.headers);
      if (!headersValidationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.header, null, null);
        return res.status(422).send(errorResponse);
      }

      let payload = req.body;
      payload.msisdn = req.get('X-MSISDN');
      if (req.query.fonepayEnabled) {
        payload.fonepayEnabled = 'false'
      }
      logger.debug({ event: 'debugging merchantDetails', payload })

      const validationResponse = validations.verifySchema("MERCHANT_DETAILS", payload);
      if (!validationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.invalid, null, null);
        return res.status(422).send(errorResponse);
      }

      let qrCodeResponse = await QRPaymentService.merchantDetails(payload);

      let status = qrCodeResponse.success ? 200 : 422;
      logger.debug({ event: 'Exited function', functionName: 'merchantDetails in class qrPaymentController' });
      return res.status(status).json(qrCodeResponse);

    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'merchantDetails in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      let errorResponse = await responseCodeHandler_new.getErrorResponseCode(
        config.responseCode.default, null, error
      );
      return res.status(422).json(errorResponse);
    }
  }

  async updateDetails(req, res) {
    logger.debug({ event: 'Entered function', functionName: 'updateDetails in class qrPaymentController' });
    try {

      let payload = req.body;
      // payload.msisdn = req.get('X-MSISDN');
      // if(req.params.tillNumber) 
      payload.tillNumber = req.params?.tillNumber || payload.tillNumber;
      logger.debug({ event: 'debugging updateDetails' })

      const validationResponse = validations.verifySchema("UPDATE_DETAILS", payload);

      if (!validationResponse.success) {
        return res.status(422).send({ success: false, msg:"Oops! validation failed." });
      }

      let updateDetailResponse = await QRPaymentService.updateDetails(payload);

      let status = updateDetailResponse.success ? 200 : 422;
      logger.debug({ event: 'Exited function', functionName: 'updateDetails in class qrPaymentController' });
      return res.status(status).json(updateDetailResponse);

    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'updateDetails in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      return res.status(422).json({ success: false, msg:"Something went wrong try again." });
    }
  }

  async merchantDetails2(req, res) {
    if (process.env.CLOSE_MERCHANT_DETAILS == "true") {
      let disabledService = await responseCodeHandler_new.getResponseCode(
        config.responseCode.useCases.MerchantDetails.isClosed, null, null
      );
      return res.status(422).json(disabledService);
    }
    logger.debug({ event: 'Entered function', functionName: 'merchantDetails in class qrPaymentController' });
    try {

      const headersValidationResponse = validations.verifySchema("QR_HEADER_SCHEMA", req.headers);
      if (!headersValidationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.header, null, null);
        return res.status(422).send(errorResponse);
      }

      let payload = req.body;
      payload.msisdn = req.get('X-MSISDN');
      if (req.query.fonepayEnabled) {
        payload.fonepayEnabled = 'false'
      }
      logger.debug({ event: 'debugging merchantDetails', payload })

      const validationResponse = validations.verifySchema("MERCHANT_DETAILS", payload);
      if (!validationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.MerchantDetails.invalid, null, null);
        return res.status(422).send(errorResponse);
      }

      let qrCodeResponse = await QRPaymentService.merchantDetails2(payload);

      let status = qrCodeResponse.success ? 200 : 422;
      logger.debug({ event: 'Exited function', functionName: 'merchantDetails in class qrPaymentController' });
      return res.status(status).json(qrCodeResponse);

    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'merchantDetails in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      let errorResponse = await responseCodeHandler_new.getErrorResponseCode(
        config.responseCode.default, null, error
      );
      return res.status(422).json(errorResponse);
    }
  }

  async recentScans(req, res) {
    logger.debug({ event: 'Entered function', functionName: 'recentScans in class qrPaymentController' });

    try {

      const headersValidationResponse = validations.verifySchema("QR_HEADER_SCHEMA", req.headers);
      if (!headersValidationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRHistory.header, null, null);
        return res.status(422).send(errorResponse);
      }
      let payload = req.query;
      payload.msisdn = req.get('X-MSISDN');
      logger.debug({ event: 'debugging recentScans', payload })

      let recentScansResponse = await QRPaymentService.recentScans(payload);

      let status = recentScansResponse.success ? 200 : 422;
      logger.debug({ event: 'Exited function', functionName: 'recentScans in class qrPaymentController' });
      return res.status(status).json(recentScansResponse);
    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'recentScans in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      let errorResponse = await responseCodeHandler_new.getErrorResponseCode(
        config.responseCode.default, null, error
      );
      return res.status(422).json(errorResponse);
    }
  }

  async transactionHistory(req, res) {
    logger.debug({ event: 'Entered function', functionName: 'transactionHistory in class qrPaymentController' });

    try {

      const headersValidationResponse = validations.verifySchema("QR_HEADER_SCHEMA", req.headers);
      if (!headersValidationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRHistory.header, null, null);
        return res.status(422).send(errorResponse);
      }
      let payload = req.query;
      payload.msisdn = req.get('X-MSISDN');
      logger.debug({ event: 'debugging recentScans', payload });

      let txHistoryResponse = await QRPaymentService.transactionHistory(payload);

      let status = txHistoryResponse.success ? 200 : 422;
      logger.debug({ event: 'Exited function', functionName: 'transactionHistory in class qrPaymentController' });
      return res.status(status).json(txHistoryResponse);

    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'transactionHistory in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      let errorResponse = await responseCodeHandler_new.getErrorResponseCode(
        config.responseCode.default, null, error
      );
      return res.status(422).json(errorResponse);
    }
  }

  async qrPaymentInit(req, res) {
    try {
      logger.debug({ event: 'Entered function', functionName: 'qrPaymentInit in class qrPaymentController' });

      const headersValidationResponse = validations.verifySchema("QR_HEADER_SCHEMA", req.headers);
      if (!headersValidationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.header, null, null);
        return res.status(422).send(errorResponse);
      }

      let payload = req.body;
      logger.debug({ event: 'debugging qrPaymentInit', payload })

      const validationResponse = validations.verifySchema("QR_PAYMENT", payload);
      if (!validationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.invalid, null, null);
        return res.status(422).send(errorResponse);
      }

      payload.msisdn = req.get('X-MSISDN');
      payload.channel = req.get('X-CHANNEL');

      let qrPaymentResp = await QRPaymentService.initQRPayment(payload);

      let status = qrPaymentResp.success ? 200 : 422;
      logger.debug({ event: 'Exited function', functionName: 'qrPaymentInit in class qrPaymentController' });
      return res.status(status).send(qrPaymentResp);

    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'qrPaymentInit in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      let errorResponse = await responseCodeHandler_new.getErrorResponseCode(
        config.responseCode.default, null, error
      );
      return res.status(422).json(errorResponse);
    }
  }

  async qrPaymentConfirm(req, res) {
    try {
      logger.info({ event: 'Entered function', functionName: 'qrPaymentConfirm in class qrPaymentController' });

      const headersValidationResponse = validations.verifySchema("CONFIRM_HEADER_SCHEMA", req.headers);
      if (!headersValidationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.header, null, null);
        return res.status(422).send(errorResponse);
      }

      let payload = req.body;
      logger.info({ event: 'debugging qrPaymentConfirm', payload })

      const validationResponse = validations.verifySchema("QR_CONFIRM_SCHEMA", payload);
      if (!validationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.invalid, null, null);
        return res.status(422).send(errorResponse);
      }

      let metadataHeaders = req.get("x-user-metadata");
      if (metadataHeaders && metadataHeaders.substring(0, 2) === "a:") {
        metadataHeaders = metadataHeaders.replace("a:", "");
        payload.name = JSON.parse(metadataHeaders).e + " " + JSON.parse(metadataHeaders).f
        logger.debug(payload.name);
      } else if (req.get("X-CHANNEL") == "merchantApp") {
        payload.name = "JazzCash Merchant";
      } else {
        payload.name = "JazzCash Consumer";
      }

      payload.msisdn = req.get('X-MSISDN');
      payload.channel = req.get('X-CHANNEL');
      payload.MPIN = req.get('X-MPIN');
      payload.txType = payload.channel == "consumerApp" ? "C2B" : "B2B";
      payload.publicIP = req.get('x-forwarded-for') || req.get('x-x-forwarded-for') || payload.publicIP;
      payload.publicPort = req.get('client-ip') || payload.publicPort;

      let qrPaymentResponse = await QRPaymentService.confirmQRPayment(payload);

      let status = qrPaymentResponse.success ? 200 : 422;
      logger.info({ event: 'Exited function', functionName: 'qrPaymentConfirm in class qrPaymentController' });
      return res.status(status).send(qrPaymentResponse);

    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'qrPaymentConfirm in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      let errorResponse = await responseCodeHandler_new.getErrorResponseCode(
        config.responseCode.default, null, error
      );
      return res.status(422).json(errorResponse);
    }
  }

  async qrFonepayConfirm(req, res) {
    try {
      logger.debug({ event: 'Entered function', functionName: 'qrFonepayConfirm in class qrPaymentController' });

      const headersValidationResponse = validations.verifySchema("CONFIRM_HEADER_SCHEMA", req.headers);
      if (!headersValidationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRFonepay.header, null, null);
        return res.status(422).send(errorResponse);
      }

      let payload = req.body;
      logger.debug({ event: 'debugging qrFonepayConfirm', payload })

      const validationResponse = validations.verifySchema("QR_FONEPAY_CONFIRM_SCHEMA", payload);
      if (!validationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRFonepay.invalid, null, null);
        return res.status(422).send(errorResponse);
      }

      if (req.get("X-META-DATA")) {
        const metaData = JSON.parse(req.get("X-META-DATA"));
        if (metaData.e && metaData.f) {
          payload.name = `${metaData.e} ${metaData.f}`;
          logger.debug(payload.name);
        }
      } else if (req.get("X-CHANNEL") == "merchantApp") {
        payload.name = "JazzCash Merchant";
      } else {
        payload.name = "JazzCash Consumer";
      }

      payload.msisdn = req.get('X-MSISDN');
      payload.channel = req.get('X-CHANNEL');
      payload.MPIN = req.get('X-MPIN');
      payload.txType = payload.channel == "consumerApp" ? "C2B" : "B2B";

      let fonePayResponse = await QRPaymentService.confirmFonepayQRPayment(payload);

      let status = fonePayResponse.success ? 200 : 422;
      logger.debug({ event: 'Exited function', functionName: 'qrFonepayConfirm in class qrPaymentController' });
      return res.status(status).send(fonePayResponse);

    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'qrFonepayConfirm in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      let errorResponse = await responseCodeHandler_new.getErrorResponseCode(
        config.responseCode.default, null, error
      );
      return res.status(422).json(errorResponse);
    }
  }

  async qrMastercardPayment(req, res) {
    try {
      logger.debug({ event: 'Entered function', functionName: 'qrMastercard in class qrPaymentController' });

      const headersValidationResponse = validations.verifySchema("CONFIRM_HEADER_SCHEMA", req.headers);
      if (!headersValidationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRMastercard.header, null, null);
        return res.status(422).send(errorResponse);
      }

      let payload = req.body;
      logger.debug({ event: 'debugging qrMastercard', payload })

      const validationResponse = validations.verifySchema("QR_Mastercard_Payment_SCHEMA", payload);
      if (!validationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRMastercard.invalid, null, null);
        return res.status(422).send(errorResponse);
      }

      let metadataHeaders = req.get("x-user-metadata");
      if (metadataHeaders && metadataHeaders.substring(0, 2) === "a:") {
        metadataHeaders = metadataHeaders.replace("a:", "");
        payload.name = JSON.parse(metadataHeaders).e + " " + JSON.parse(metadataHeaders).f
        logger.debug(payload.name);
      } else if (req.get("X-CHANNEL") == "merchantApp") {
        payload.name = "JazzCash Merchant";
      } else {
        payload.name = "JazzCash Consumer";
      }

      payload.msisdn = req.get('X-MSISDN');
      payload.channel = req.get('X-CHANNEL');
      payload.mpin = req.get('X-MPIN');
      payload.txType = payload.channel == "consumerApp" ? "C2B" : "B2B";

      let fonePayResponse = await QRPaymentService.mastercardPayment(payload);

      let status = fonePayResponse.success ? 200 : 422;
      logger.debug({ event: 'Exited function', functionName: 'qrMastercard in class qrPaymentController' });
      return res.status(status).send(fonePayResponse);

    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'qrMastercard in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      let errorResponse = await responseCodeHandler_new.getErrorResponseCode(
        config.responseCode.default, null, error
      );
      return res.status(422).json(errorResponse);
    }
  }

  async qrRefundInit(req, res) {
    try {
      logger.debug({ event: 'Entered function', functionName: 'qrRefundInit in class qrPaymentController' });

      const headersValidationResponse = validations.verifySchema("QR_HEADER_SCHEMA", req.headers);
      if (!headersValidationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRRefund.header, null, null);
        return res.status(422).send(errorResponse);
      }

      let payload = req.body;
      logger.debug({ event: 'debugging qrRefundInit', payload })

      const validationResponse = validations.verifySchema("QR_REFUND", payload);
      if (!validationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRRefund.invalid, null, null);
        return res.status(422).send(errorResponse);
      }

      payload.msisdn = req.get('X-MSISDN');
      payload.channel = req.get('X-CHANNEL');

      let qrRefundResp = await QRPaymentService.initQRRefund(payload);
      let status = qrRefundResp.success ? 200 : 422;
      logger.debug({ event: 'Exited function', functionName: 'qrRefundInit in class qrPaymentController' });
      return res.status(status).send(qrRefundResp);

    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'qrRefundInit in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      let errorResponse = await responseCodeHandler_new.getErrorResponseCode(
        config.responseCode.default, null, error
      );
      return res.status(422).json(errorResponse);
    }
  }

  async qrRefundConfirm(req, res) {
    try {
      logger.debug({ event: 'Entered function', functionName: 'qrRefundConfirm in class qrPaymentController' });

      const headersValidationResponse = validations.verifySchema("CONFIRM_HEADER_SCHEMA", req.headers);
      if (!headersValidationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.header, null, null);
        return res.status(422).send(errorResponse);
      }

      let payload = req.body;
      logger.debug({ event: 'debugging qrRefundConfirm', payload })

      const validationResponse = validations.verifySchema("QR_REFUND_CONFIRM_SCHEMA", payload);
      if (!validationResponse.success) {
        let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.QRPayment.invalid, null, null);
        return res.status(422).send(errorResponse);
      }

      if (req.get("X-META-DATA")) {
        const metaData = JSON.parse(req.get("X-META-DATA"));
        if (metaData.e && metaData.f) {
          payload.name = `${metaData.e} ${metaData.f}`
          logger.debug(payload.name);
        }
      } else if (req.get("X-CHANNEL") == "merchantApp") {
        payload.name = "JazzCash Merchant";
      } else {
        payload.name = "JazzCash Consumer";
      }

      payload.msisdn = req.get('X-MSISDN');
      payload.channel = req.get('X-CHANNEL');
      payload.MPIN = req.get('X-MPIN');

      let qrRefundResponse = await QRPaymentService.confirmQRRefund(payload);

      let status = qrRefundResponse.success ? 200 : 422;
      logger.debug({ event: 'Exited function', functionName: 'qrRefundConfirm in class qrPaymentController' });
      return res.status(status).send(qrRefundResponse);

    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'qrRefundConfirm in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      let errorResponse = await responseCodeHandler_new.getErrorResponseCode(
        config.responseCode.default, null, error
      );
      return res.status(422).json(errorResponse);
    }
  }

  async qrAddRating(req, res) {
    try {
      logger.debug({ event: 'Entered function', functionName: 'qrAddRating in class qrPaymentController' });

      let payload = req.body;
      payload.txID = req.query.txID;

      let updateRatingResponse = await QRPaymentService.updateQRRating(payload);

      let status = updateRatingResponse.success ? 200 : 422;
      logger.debug({ event: 'Exited function', functionName: 'qrAddRating in class qrPaymentController' });
      return res.status(status).send(updateRatingResponse);

    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'qrAddRating in class qrPaymentController', error: { message: error.message, stack: error.stack } });
      let errorResponse = await responseCodeHandler_new.getErrorResponseCode(
        config.responseCode.default, null, error
      );
      return res.status(422).json(errorResponse);
    }
  }

  async p2mRefund(req, res) {
    logger.info({
        event: '*** Entered function ***',
        functionName: 'p2mRefund.QRPaymentController',
        data: req.body,
        TIMESTAMP: new Date().toISOString()
    });

    let response = {};

    try {
        const headersValidationResponse = validations.verifySchema(
            "P2M_REFUND_HEADERS",
            req.headers
        );

        if (!headersValidationResponse.success) {
            response = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.p2mRefund.invalidHeader);
            return res.status(422).send(response);
        }

        const bodyValidationResponse = validations.verifySchema(
            "P2M_REFUND_SCHEMA",
            req.body
        );

        if (!bodyValidationResponse.success) {
            response = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.p2mRefund.invalidBody);
            return res.status(422).send(response);
        }

        logger.info('Validation Successfull');
        let payload = req.body;
        payload.msisdn = req.get('X-MSISDN');
        payload.thirdParty = req.get("X-CHANNEL");


        response = await QRPaymentService.p2mRefund(payload);
        let status = response.success ? 200 : 422;
        return res.status(status).send(response);

    } catch (error) {
        logger.error({
            event: '***** Error in function *****',
            functionName: 'p2mRefund.QRPaymentController',
            error: error.message,
            TIMESTAMP: new Date().toISOString()
        });
        response = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.p2mRefund.internal);
        return res.status(500).send(response);
    }
  }

  async displayQRV2(req, res) {
    logger.info({
        event: '*** Entered function ***',
        functionName: 'QRPaymentController.displayQRV2',
        data: req.query,
        TIMESTAMP: new Date().toISOString()
    });

    let response = {};
    try {
        const headersValidationResponse = validations.verifySchema(
            "QR_GENERATION_REQUEST_HEADERS",
            req.headers
        );

        if (!headersValidationResponse.success) {
            let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.header, null, null);
            return res.status(422).send(errorResponse);
        }

        let payload = {
            "MSISDN": msisdnTransformer.formatNumberSingle(req.get('X-MSISDN'), 'local'),
            "TYPE": 1
        }

        if (req.query.amount) {
            payload.Amount = req.query.amount;
            payload.TYPE = 2;
        }

        payload.StoreId = req.query?.StoreId || '';
        payload.LoyaltyNumber = req.query?.LoyaltyNumber || '';
        payload.ReferenceId = req.query?.ReferenceId || '';
        payload.PurposeOfTransactions = req.query?.PurposeOfTransactions || '';
        payload.CustomerPromtedTip = req.query?.CustomerPromtedTip || '';
        payload.FixedAmount = req.query?.FixedAmount || '';
        payload.PercentageAmount = req.query?.PercentageAmount || '';
        payload.Channel = req.get("X-CHANNEL") === "merchantApp" ? 1 : 2

        response = await QRPaymentService.displayQRV2(payload);

        logger.info({
            event: '*** Response from QRPaymentService.displayQR  ***',
            functionName: 'QRPaymentController.displayQRV2',
            data: response,
            TIMESTAMP: new Date().toISOString()
        });

        let status = response.success ? 200 : 422;
        return res.status(status).send(response);

    } catch (error) {
        logger.error({
            event: '***** Error in function *****',
            functionName: 'QRPaymentService.displayQRV2',
            error: error.message,
            TIMESTAMP: new Date().toISOString()
        });

        response = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.internal);
        return res.status(500).send(response);
    }
  }

  async thirdpartyStaticQR(req, res) {
    logger.info({
        event: '*** Entered function ***',
        functionName: 'QRPaymentController.thirdpartyStaticQR',
        data: req.query,
        TIMESTAMP: new Date().toISOString()
    });

    let serviceResponse = {};
    let errorResponse = {};
    let encryptResp = {};

    try {
        const headersValidationResponse = validations.verifySchema(
            "QR_GENERATION_REQUEST_HEADERS",
            req.headers
        );

        if (!headersValidationResponse.success) {
            errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.header, null, null);
            if (ENCYPTION_ENABLED.ENABLED === '1') {
                encryptResp = await EncryptHelperUtil.encrypt({ ...errorResponse }, req?.query?.clientName);
                return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({ data: encryptResp });
            }

            else {
                return res.status(422).send(errorResponse);
            }

        }

        let payload = {
            "MSISDN": msisdnTransformer.formatNumberSingle(req.get('X-MSISDN'), 'local'),
            "TYPE": 1
        }

        if (req.query.amount) {
            errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.invalidBody, null, null);
            if (ENCYPTION_ENABLED.ENABLED === '1') {
                encryptResp = await EncryptHelperUtil.encrypt({ ...errorResponse }, req?.query?.clientName);
                return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({ data: encryptResp });
            }

            else {
                let errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.invalidBody, null, null);
                return res.status(422).send(errorResponse);
            }
        }

        payload.StoreId = req.query?.StoreId || '';
        payload.LoyaltyNumber = req.query?.LoyaltyNumber || '';
        payload.ReferenceId = req.query?.ReferenceId || '';
        payload.PurposeOfTransactions = req.query?.PurposeOfTransactions || '';
        payload.CustomerPromtedTip = req.query?.CustomerPromtedTip || '';
        payload.FixedAmount = req.query?.FixedAmount || '';
        payload.PercentageAmount = req.query?.PercentageAmount || '';
        payload.Channel = req.get("X-CHANNEL") === "merchantApp" ? 1 : 2

        serviceResponse = await QRPaymentService.generateQRV2(payload);

        logger.info({
            event: '*** Response from QRPaymentService.generateQRV2  ***',
            functionName: 'QRPaymentController.thirdpartyStaticQR',
            data: serviceResponse,
            TIMESTAMP: new Date().toISOString()
        });

        const { success = false } = serviceResponse;

        if (ENCYPTION_ENABLED.ENABLED === '1') {
            let encryptResp = await EncryptHelperUtil.encrypt(serviceResponse, req?.query?.clientName);
            return res.status(success ? HTTP_STATUS.OK : HTTP_STATUS.UNPROCESSABLE_ENTITY).send({ data: encryptResp });
        }

        else {
            return res.status(success ? HTTP_STATUS.OK : HTTP_STATUS.UNPROCESSABLE_ENTITY).send(serviceResponse);
        }

    } catch (error) {
        logger.error({
            event: '***** Error in function *****',
            functionName: 'QRPaymentController.thirdpartyStaticQR',
            error: error.message,
            TIMESTAMP: new Date().toISOString()
        });

        errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.internal);
        return res.status(500).send(errorResponse);
    }
  }

  async thirdpartyDynamicQR(req, res) {
    logger.info({
        event: '*** Entered function ***',
        functionName: 'QRPaymentController.thirdpartyDynamicQR',
        data: req.query,
        TIMESTAMP: new Date().toISOString()
    });

    let serviceResponse = {};
    let errorResponse = {}
    let encryptResp = {}
    try {
        const headersValidationResponse = validations.verifySchema(
            "QR_GENERATION_REQUEST_HEADERS",
            req.headers
        );

        if (!headersValidationResponse.success) {
            errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.header, null, null);
            if (ENCYPTION_ENABLED.ENABLED === '1') {
                encryptResp = await EncryptHelperUtil.encrypt({ ...errorResponse }, req?.query?.clientName);
                return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({ data: encryptResp });
            }

            else {
                return res.status(422).send(errorResponse);
            }

        }

        let payload = {
            "MSISDN": msisdnTransformer.formatNumberSingle(req.get('X-MSISDN'), 'local'),
            "TYPE": 2
        }

        if (!req.query.amount) {
            errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.invalidBody, null, null);
            if (ENCYPTION_ENABLED.ENABLED === '1') {
                encryptResp = await EncryptHelperUtil.encrypt({ ...errorResponse }, req?.query?.clientName);
                return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({ data: encryptResp });
            }

            else {
                errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.invalidBody, null, null);
                return res.status(422).send(errorResponse);
            }
        }

        payload.Amount = req.query.amount;
        payload.StoreId = req.query?.StoreId || '';
        payload.LoyaltyNumber = req.query?.LoyaltyNumber || '';
        payload.ReferenceId = req.query?.ReferenceId || '';
        payload.PurposeOfTransactions = req.query?.PurposeOfTransactions || '';
        payload.CustomerPromtedTip = req.query?.CustomerPromtedTip || '';
        payload.FixedAmount = req.query?.FixedAmount || '';
        payload.PercentageAmount = req.query?.PercentageAmount || '';
        payload.Channel = req.get("X-CHANNEL") === "merchantApp" ? 1 : 2

        serviceResponse = await QRPaymentService.generateQRV2(payload);

        const { success = false } = serviceResponse;

        logger.info({
            event: '*** Response from QRPaymentService.generateQRV2  ***',
            functionName: 'QRPaymentController.thirdpartyDynamicQR',
            data: serviceResponse,
            TIMESTAMP: new Date().toISOString()
        });

        if (ENCYPTION_ENABLED.ENABLED === '1') {
            let encryptResp = await EncryptHelperUtil.encrypt(serviceResponse, req?.query?.clientName);
            return res.status(success ? HTTP_STATUS.OK : HTTP_STATUS.UNPROCESSABLE_ENTITY).send({ data: encryptResp });
        }

        else {
            return res.status(success ? HTTP_STATUS.OK : HTTP_STATUS.UNPROCESSABLE_ENTITY).send(serviceResponse);
        }

    } catch (error) {
        logger.error({
            event: '***** Error in function *****',
            functionName: 'QRPaymentService.thirdpartyDynamicQR',
            error: error.message,
            TIMESTAMP: new Date().toISOString()
        });

        errorResponse = await responseCodeHandler_new.getResponseCode(config.responseCode.useCases.displayQR.internal);
        return res.status(500).send(errorResponse);
    }
  }
}
export default new QRPaymentController(QRPaymentService);
