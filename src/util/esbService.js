import axios from 'axios';
import crypto from 'crypto';
import logger from './logger';

import _ from 'lodash';
import templates from '../config/templates.json';
import moment from 'moment';
import httpContext from 'express-http-context';
import md5 from 'md5';


let ESB_URL = process.env.ESB_URL || config.esb.url;
let ESB_SPSU_URL = process.env.ESB_SPSU_URL || config.esb.gToPUrl;
const CALLER_TYPE = process.env.CALLER_TYPE || config.esb.callerType;
let THIRD_PARTY_MAP = process.env.THIRD_PARTY_MAP || config.esb.thirdPartyMap;
const ESB_KEY_OWNER = process.env.KEY_OWNER || config.esb.keyOwner;
const AXIOS_OPTIONS = process.env.ESB_AXIOS_OPTIONS || config.esb.axiosOptions;
const ORG_CVID_REQUESTID = process.env.ORG_CVID_REQUESTID || "true";

const MPIN_ENCRYPTION_KEY = process.env.MPIN_ENCRYPTION_KEY || config.mpinKey.value;
const POD_NAME=process.env.POD_NAME || 'Payment&TransactionPod';

let iv = Buffer.from(config.iv.value, 'utf8');

class ESBService {

  constructor() {
    this.ESBRequestData = _.cloneDeep(templates.ESB_REQUESTBODY);
  }

  async createESBRequestObject(appType, configCPS, initiatorIdentifierType, initiatorIdentifier, initiatorSecurityCredentials, receiverIdentifierType, receiverIdentifier, transactionParams, referenceData, customObject) {
  logger.debug("Function createESBRequestObject");
    let thirdPartyID, thirdPartyPassword, channelCode, orgInitiatorType, orgInitiator, orgMPIN, channel;
    if (THIRD_PARTY_MAP && _.isString(THIRD_PARTY_MAP)) {
      THIRD_PARTY_MAP = JSON.parse(THIRD_PARTY_MAP);
    }

    thirdPartyID = THIRD_PARTY_MAP[appType].value;
    thirdPartyPassword = THIRD_PARTY_MAP[appType].password;
    channelCode = THIRD_PARTY_MAP[appType].channelCode;
    orgInitiatorType = THIRD_PARTY_MAP[appType].organizationIniatorType;
    orgInitiator = THIRD_PARTY_MAP[appType].organizationIniatorMSISDN;
    orgMPIN = THIRD_PARTY_MAP[appType].organizationIniatorMPIN;
    channel = THIRD_PARTY_MAP[appType].channel;



    this.ESBRequestData.Identity.UseCase = configCPS.useCase;
    this.ESBRequestData.Identity.Channel = channel;
    this.ESBRequestData.Identity.ThirdPartyType = appType;
    this.ESBRequestData.Identity.Caller.CallerType = CALLER_TYPE;
    this.ESBRequestData.Identity.Caller.ThirdPartyID = thirdPartyID;
    this.ESBRequestData.Identity.Caller.Password = thirdPartyPassword;




    //Primary Party
    delete this.ESBRequestData.Identity.PrimaryParty;

    // Setting Initiator
    this.ESBRequestData.Identity.Initiator.IdentifierType = initiatorIdentifierType;

    //if Initiator is Organisation
    if (initiatorIdentifier === 'ORG') {
      this.ESBRequestData.Identity.Initiator.IdentifierType = orgInitiatorType;
      this.ESBRequestData.Identity.Initiator.Identifier = orgInitiator;
      if (!initiatorSecurityCredentials) {
        delete this.ESBRequestData.Identity.Initiator.SecurityCredential;
      } else {
        this.ESBRequestData.Identity.Initiator.SecurityCredential = orgMPIN;
      }
    } else {
      this.ESBRequestData.Identity.Initiator.Identifier = initiatorIdentifier;

      if (!initiatorSecurityCredentials) {
        delete this.ESBRequestData.Identity.Initiator.SecurityCredential;
      } else {
        //Apply Encryption AES to 3DES
        let encrypted3desKey;
        //if (ENCRYPTION_ENABLED && ENCRYPTION_ENABLED === 'true') {
        encrypted3desKey = await this.mpinDecryptionTo3DES(initiatorSecurityCredentials, MPIN_ENCRYPTION_KEY);
        /*} else {
        this.ESBRequestData.Identity.Initiator.SecurityCredential = 'dP31WpTjhoo=';
      }*/

        this.ESBRequestData.Identity.Initiator.SecurityCredential = encrypted3desKey;
      }
    }
    //Receiver Party
    if (!receiverIdentifier) {
      delete this.ESBRequestData.Identity.ReceiverParty;
    } else {
      this.ESBRequestData.Identity.ReceiverParty.IdentifierType = receiverIdentifierType;
      this.ESBRequestData.Identity.ReceiverParty.Identifier = receiverIdentifier;
    }
    //Setting Transaction Prarameters

    this.ESBRequestData.Transaction.CommandID = configCPS.commandID;

    //Reference Data
    if (!referenceData) {
      delete this.ESBRequestData.Transaction.ReferenceData;
    } else {
      referenceData.forEach(transParam =>
        this.ESBRequestData.Transaction.ReferenceData.ReferenceItem.push({
          Key: transParam.key,
          Value: transParam.value,
        })
      );
    }
    if(ORG_CVID_REQUESTID != "false"){
      this.ESBRequestData.Transaction.OriginatorConversationID = this.getOriginatorConversationID();
    }
    else {
      const logObj = httpContext.get('logObj') || null;
      logger.debug('logObj axios interceptor_esb', logObj);
      if (logObj && logObj.requestID) {
        this.ESBRequestData.Transaction.OriginatorConversationID = logObj.requestID;
      } else {
        this.ESBRequestData.Transaction.OriginatorConversationID = this.getOriginatorConversationID();
      }
    }




    if (transactionParams != null) {
      /// *** Setting Transactional Params Start
      transactionParams.forEach(transParam =>
        this.ESBRequestData.Transaction.Parameters.Parameter.push({
          Key: transParam.key,
          Value: transParam.value,
        })
      );
    }

    //Pushing Channel Code

    if (configCPS.channelCode) {
      let commandChannelCode = configCPS.channelCode;
      if (commandChannelCode) {
        channelCode = commandChannelCode;
      }
    }
    this.ESBRequestData.Transaction.Parameters.Parameter.push({
      Key: config.esb.channelCode,
      Value: channelCode,
    });

    this.ESBRequestData.KeyOwner = ESB_KEY_OWNER;
    this.ESBRequestData.Transaction.Timestamp = moment(new Date()).format(
      'YYYYMMDDHHmmss'
    );
    /// *** Setting Transactional Params End


    //checking custom Object
    const logObj = httpContext.get('logObj') || null;
    if (!customObject) {
      if(logObj)
      {
        this.ESBRequestData.CustomObject={
           requestID: logObj.requestID
        };
      }
    }else {
      if(logObj)
      {
        customObject.requestID=logObj.requestID;
      }
      this.ESBRequestData.CustomObject = customObject;
    }

    logger.debug(this.ESBRequestData);

    // remark field

    if (configCPS.remark && configCPS.remark !== "") {
      this.ESBRequestData.Transaction.Remark = configCPS.remark
    }

    logger.debug(this.ESBRequestData);
    return this.ESBRequestData;
  }




  async getESBResponse(data) {
    logger.debug(' Calling ESB function to call CPS function');
    logger.debug(ESB_URL);
    logger.debug(data);
    let resp;
    let flag = await axios.post(ESB_URL, data, AXIOS_OPTIONS)
      .then(function (response) {
        logger.debug('************ Successs ********************')
        logger.debug('response.status', response.status);
        logger.debug(JSON.stringify(response.data));
        if (response.status === 200 && response.data) {
          resp = response.data;
          return resp;
        } else {
          return null;
        }
      })
      .catch(function (error) {
        //logger.error('Error calling ESB '+ error.message);
        //throw "Error calling ESB Service "+error.message;
        throw new Error(" Error calling ESB  CPS R1 Service "+error);

      });

    return flag;
  }

  getOriginatorConversationID() {
    return md5(POD_NAME+'R1T'+Date.now());
  }

  async mpinDecryptionTo3DES(data, key) {

    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), iv);
      let decrypted = decipher.update(data, 'base64');
      decrypted = decrypted + decipher.final('utf8')

      logger.debug({
        decrypted
      });
      return decrypted;
    } catch (err) {
      throw new Error(" Error in mpinDecryptionTo3DES esbService "+err);
    }
  }
  async getESBResponseForSpsu(data) {
    logger.debug(' Calling ESB SPSU function to call CPS function');
    logger.debug(ESB_URL);
    logger.debug(data);
    let resp;
    let flag = await axios.post(ESB_SPSU_URL, data, AXIOS_OPTIONS)
      .then(function (response) {
        logger.debug('************ Successs ********************')
        logger.debug('response.status', response.status);
        logger.debug(JSON.stringify(response.data));
        if (response.status === 200 && response.data) {
          resp = response.data;
          return resp;
        } else {
          return null;
        }
      })
      .catch(function (error) {
        //logger.error('Error calling ESB '+ error.message);
        //throw "Error calling ESB Service "+error.message;
        throw new Error(" Error calling ESB  CPS R1 Service "+error);

      });

    return flag;
  }
}

export default ESBService;