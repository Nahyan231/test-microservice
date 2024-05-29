import _ from 'lodash';
import templates from '../../config/dataModelTemplates.json'
import logger from '../../util/logger';
import MSISDNTransformer from '../../util/msisdnTransformer';
import moment from 'moment';
import txCategoryMappingHandler from '../../util/trxCategoryMappingHandler';
import trxMappingHandler from '../../util/trxCategoryMappingHandler';
import { printError, printLog } from '../../util/utility';
import { logType,log } from '../../model/logType';


const PINLESS_TXN_CHANNEL_CODE = process.env.PINLESS_TXN_CHANNEL_CODE || '1033';
const txnHistoryCategoriesMapping = config.txnHistoryCategoriesMapping

const formatNumber = (number) => { //used to convert 0300 to 92300
  try {
    const numberToBeCheck = number.substring(0, 1);
    if (numberToBeCheck === "0") {
      return "92" + number.substring(1)
    } else {
      return number
    }
  } catch (error) {
    logger.error(error);
  }
};
class dataMapping {
  constructor() { }
  mapp(key) {
    let mapper = {
      profiles: profileList,
    };
    return mapper[key];
  }

  getRequstMoneyConfirmation(data) {
    logger.debug('Inside the Data Mapping function');

    if (data.ResponseCode == 0) {
      let requestMoneyConfirmationData = _.cloneDeep(templates.REQUESTMONEY_CONFIRM);
      requestMoneyConfirmationData.msisdn = data.KafkaPubMessage.Header.Identity.Initiator.Identifier;
      requestMoneyConfirmationData.txID = data.KafkaPubMessage.Result.TransactionID;
      requestMoneyConfirmationData.txStatus = 'confirm';
      requestMoneyConfirmationData.amount = _.find(
        data.KafkaPubMessage.Result.ResultParameters.ResultParameter,
        function (obj) {
          if (obj.Key == 'Amount') return obj.Value;
        }).Value;
      requestMoneyConfirmationData.txEndDate = _.find(
        data.KafkaPubMessage.Result.ResultParameters.ResultParameter,
        function (obj) {
          if (obj.Key == 'TransEndDate') return obj.Value;
        }
      ).Value;
      requestMoneyConfirmationData.txEndTime = _.find(
        data.KafkaPubMessage.Result.ResultParameters.ResultParameter,
        function (obj) {
          if (obj.Key == 'TransEndTime') return obj.Value;
        }
      ).Value;
      requestMoneyConfirmationData.chCode = _.find(data.KafkaPubMessage.Request.Transaction.Parameters.Parameter, function (obj) {
        if (obj.Key == 'ChannelCode') return obj.Value;
      }
      ).Value;
      requestMoneyConfirmationData.contextData.ocvID = data.KafkaPubMessage.Request.Transaction.OriginatorConversationID;
      requestMoneyConfirmationData.contextData.cvID = data.KafkaPubMessage.Request.Transaction.ConversationID;
      requestMoneyConfirmationData.contextData.rxDetails.rxCNIC = _.find(
        data.KafkaPubMessage.Result.ResultParameters.ResultParameter,
        function (obj) {
          if (obj.Key == 'CNIC') return obj.Value;
        }
      ).Value;
      requestMoneyConfirmationData.contextData.rxDetails.msisdn = data.KafkaPubMessage.Header.Identity.Initiator.Identifier;
      return { requestMoneyConfirmationData };
    } else {
      return null;
    }
  }
  getBillPaymentConfirmResponse(data) {
    let confirmData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getPayBillsConfirmResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        confirmData = _.cloneDeep(templates.TRX_HISTORY);
        confirmData.msisdn = data.Header.Identity?.Initiator.Identifier;
        confirmData.txType = "ConfirmTransaction";
        confirmData.txID = data.Result.TransactionID;
        confirmData.txStatus = 'Complete';
        confirmData.contextData.ocvID = data.Request.Transaction.OriginatorConversationID || '';

        // confirmData.contextData.cvID = data.Request.Transaction?.ConversationID || '';;
        logger.debug("contextData");
        logger.debug(confirmData);
        return { confirmData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug(err);
      return null;
    }


  }
  getInitTransBillPaymentResponse(data) {
    let initData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getInitTransBillPaymentResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        initData = _.cloneDeep(templates.TRX_HISTORY);
        initData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initData.msisdn = data.Header.Identity?.Initiator.Identifier;
        initData.txType = "Bill Payment";
        initData.txID = data.Result.TransactionID;
        initData.txStatus = 'Complete';
        initData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        if (initData.amount == 0) { //using this for partial payment case, we dont have amount parameter coming from CPS. 
          initData.amount = Number(data.CustomObject?.dueAmount || '0')
        }
        initData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initData.chCode = data.Request.Transaction.Parameters.Parameter.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initData.senderMsisdn = data.Header.Identity?.Initiator.Identifier;
        initData.senderName = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initData.debit = "true";
        initData.isRepeatable = "true";
        initData.txCategory = "Bill Payment";
        initData.useCase = data.Header.UseCase;
        initData.fee = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        let billMonth = "";
        billMonth = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Month'; })?.Value || '';
        logger.debug("billMonth" + billMonth);
        //reading from custom Object
        if (data.CustomObject) {
          logger.debug('reading from custom object');
          logger.debug(data.CustomObject);
          initData.contextData.rxDetails.consumerRefNum = data.CustomObject?.consumerRefNum || '';
          initData.contextData.rxDetails.companyID = data.CustomObject?.companyID || '';
          initData.contextData.rxDetails.customerMSISDN = data.CustomObject?.customerMSISDN || '';
          initData.contextData.rxDetails.category = data.CustomObject?.category || '';
          initData.contextData.rxDetails.companyName = data.CustomObject?.companyName || '';
          initData.contextData.rxDetails.subCategory = data.CustomObject?.subCategory || '';
          initData.contextData.rxDetails.companyType = data.CustomObject?.companyType || '';
          initData.contextData.rxDetails.month = data.CustomObject?.month || billMonth;
          initData.contextData.rxDetails.dueAmount = data.CustomObject?.dueAmount || '';
          initData.contextData.rxDetails.balance = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Balance'; })?.Value || '';
          initData.contextData.rxDetails.flowId = data.CustomObject?.flowId || '';
        }
        initData.contextData.header = "Payment - " + initData.contextData.rxDetails?.companyName || '';
        initData.contextData.footer = initData.contextData.rxDetails?.consumerRefNum || '';
        //adding lable
        let trxTypeMapping = trxMappingHandler.resolveTxnType(initData.useCase, initData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }

        initData.txCategoryLabel = initData.contextData.rxDetails?.companyName //Consumer need to show company name 
        // let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(initData.useCase, initData.debit)
        // if(trxCategoryMapping && trxCategoryMapping!=null){
        //   initData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        // }

        logger.debug("contextData");
        logger.debug(initData);
        return { initData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -> getInitTransBillPaymentResponse');
      logger.debug(err);
      return null;
    }
  }
  getInitTransC2CResponse(data) {
    let initTransData = {};
    try {
      
      // logger.info({
      //   event: 'Entered function',
      //   functionName: 'dataMapping.getInitTransC2CResponse',
      //   data: data
      // });
      log(logType.INFO,"getInitTransC2CResponse",data,"Entered function");

      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        const channelCode = data.Request.Transaction.Parameters.Parameter.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header.Identity?.Initiator.Identifier;
        initTransData.txType = "Money Transfer - Mobile Account";
        initTransData.isReciever = "true";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = channelCode === PINLESS_TXN_CHANNEL_CODE ? 'Complete' : 'Pending';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        // initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = channelCode;
        initTransData.senderMsisdn = data.Header.Identity?.Initiator.Identifier;
        initTransData.senderName = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'senderName'; })?.Value || data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';;
        initTransData.debit = "true";
        initTransData.isRepeatable = "true";
        initTransData.txCategory = "Money Transfer";
        initTransData.fee = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        initTransData.contextData.rxDetails = data.CustomObject ? data.CustomObject : {};
        initTransData.contextData.rxDetails.name = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'BeneficiaryName'; })?.Value || '';
        initTransData.contextData.rxDetails.msisdn = data.Header.Identity?.ReceiverParty?.Identifier;
        initTransData.contextData.header = "Money Transfer - JazzCash";
        initTransData.contextData.footer = data.Header.Identity?.ReceiverParty?.Identifier;
        initTransData.useCase = data.Header.UseCase;
        //fetching Transaction Parent category Type and sub-category Type

        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -> getInitTransC2CResponse');
      logger.debug(err);
      return null;
    }


  }

  getCashbackRewardResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function -------> getCashbackRewardResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        const channelCode = data.Request.Transaction.Parameters.Parameter.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0'; //1031 for consumer
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header.Identity?.ReceiverParty.Identifier;
        initTransData.txType = "Cashback Reward";
        initTransData.isReciever = "true";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = "Complete";
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = channelCode;
        initTransData.senderMsisdn = data.Header.Identity?.Initiator.Identifier;
        initTransData.senderName = " ";
        initTransData.debit = "false";
        initTransData.isRepeatable = "false";
        initTransData.txCategory = "Cashback";
        initTransData.fee = "0";
        initTransData.commission = "0";
        initTransData.companyCode = " ";
        initTransData.contextData.rxDetails = data.CustomObject ? data.CustomObject : {};
        initTransData.contextData.rxDetails.name = " ";
        // initTransData.contextData.rxDetails.msisdn = " ";
        initTransData.contextData.header = " ";
        initTransData.contextData.footer = " ";
        initTransData.useCase = data.Header.UseCase;
        //fetching Transaction Parent category Type and sub-category Type

        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -------> getCashbackRewardResponse');
      logger.debug(err);
      return null;
    }


  }

  getInitTransISOIncomingIBFTResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getInitTransISOIncomingIBFTResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        const channelCode = data.Header.Channel || "ISO";
        const msisdn = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'AccountIdentification1_103'; })?.Value || '';
        if (!msisdn) {
          logger.info(`for tx : ${data.Result.TransactionID} - No msisdn found from incoming IBFT payload hence no mapping made`)
          return null;
        }

        const amount = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'AmountTransaction_004'; })?.Value || '0')
        let processedAmount = Number(amount / 100) //doing this because the payload have amount as 1000 for Rs.10 which means last two zeros are decimals

        initTransData.msisdn_txID = msisdn + "_" + data.Result.TransactionID;
        initTransData.msisdn = msisdn;
        initTransData.txType = "IBFT Transfer";
        initTransData.isReciever = "false";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Complete';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.amount = processedAmount;
        initTransData.chCode = channelCode;
        initTransData.senderMsisdn = '';
        initTransData.senderName = '';
        initTransData.debit = "false";
        initTransData.isRepeatable = "false";
        initTransData.txCategory = "Money Transfer";
        initTransData.fee = 0;
        initTransData.commission = 0;

        let bankName = data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'CardAcceptorNameLocation_043'; })?.Value || ''
        if (bankName) { //This condition will filter string with Bank Name only. i.e "Meezan Bank PK INTERNET" will become Meezan Bank
          bankName = bankName.trim(); //Removing spaces from string

          var indexOfBankString = bankName.toLowerCase().indexOf("bank");

          if (indexOfBankString != -1) { //take out string till "Bank" Keyword and remove rest
            if (indexOfBankString != 0) { //Condition that restrict string to have "Bank" word at start i.e BankAlfalah
              indexOfBankString = indexOfBankString + 4;
              bankName = bankName.substring(0, indexOfBankString);
            }
          }
        }

        initTransData.contextData.rxDetails.bankName = bankName
        initTransData.contextData.rxDetails.bankAcctNum = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'PrimaryAccountNumber_002'; })?.Value || '';

        let dateFromPayload = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'DateLocalTransaction_013'; })?.Value || '';
        let timeFromPayload = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransmissionDatetime_007'; })?.Value || '';
        initTransData.txEndDate = new Date().getFullYear().toString() + dateFromPayload; //no year is added in payload date parameter.
        initTransData.txEndTime = timeFromPayload.substring(4); //key value has first 4 character as date then time starts

        initTransData.contextData.header = "Money Received - " + initTransData.contextData.rxDetails.bankName;
        initTransData.contextData.footer = initTransData.contextData.rxDetails.bankAcctNum
        initTransData.useCase = "IBFT";
        //fetching Transaction Parent category Type and sub-category Type

        let trxTypeMapping = trxMappingHandler.resolveTxnType(initTransData.useCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(initTransData.useCase, initTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        return { initTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -> getInitTransISOIncomingIBFTResponse');
      logger.debug(err);
      logger.error(`Error mapping Incoming IBFT for tx : ${data.Result.TransactionID} -> ` + JSON.stringify(err));
      return null;
    }


  }
  getInitTransCNICResponse(data) {
    let initTransData = {};
    try {
      
      logger.info({
        event: 'Entered function',
        functionName: 'dataMapping.getInitTransCNICResponse',
        data: data
      });

      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        const channelCode = data.Request.Transaction.Parameters.Parameter.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header?.Identity?.Initiator?.Identifier;
        initTransData.txType = "Money Transfer - CNIC";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = channelCode === PINLESS_TXN_CHANNEL_CODE ? 'Complete' : 'Pending';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        //initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = channelCode;
        initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.senderName =  data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'senderName'; })?.Value || data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "true";
        initTransData.txCategory = "Money Transfer";
        initTransData.fee = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        initTransData.contextData.rxDetails = data.CustomObject ? data.CustomObject : {};
        initTransData.contextData.rxDetails.cnic = data?.Request?.Transaction?.Parameters.Parameter?.find((param) => { return param.Key == 'ReceiverCNIC'; })?.Value || '';
        initTransData.contextData.rxDetails.msisdn = data?.Request?.Transaction?.Parameters.Parameter?.find((param) => { return param.Key == 'ReceiverMSISDN'; })?.Value || '';
        initTransData.contextData.header = "Money Transfer - CNIC";
        initTransData.contextData.footer = initTransData.contextData.rxDetails.cnic;
        initTransData.useCase = data.Header.UseCase;
        // initTransData.contextData.rxDetails.msisdn=data.Header.Identity.ReceiverParty.Identifier;
        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug(err);
      return null;
    }


  }
  getInitTransBankResponse(data) {
    let initTransData = {};
    try {
     
      logger.info({
        event: 'Entered function',
        functionName: 'dataMapping.getInitTransBankResponse',
        data: data
      });

      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.txType = "IBFT Transfer";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Pending';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        //initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.senderName =  data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'senderName'; })?.Value || data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "true";
        initTransData.txCategory = "Money Transfer";
        initTransData.useCase = data.Header.UseCase;
        initTransData.fee = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        initTransData.contextData.rxDetails.bankName = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'BankName'; })?.Value || '';
        initTransData.contextData.rxDetails.bankAcctNum = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'BankAccountNumber'; })?.Value || '';
        initTransData.contextData.rxDetails.name = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'BankAccountTitle'; })?.Value || '';
        logger.debug("customObject");
        if (data.CustomObject) {
          logger.debug("Reading from customObject");
          initTransData.contextData.rxDetails.bankCode = data.CustomObject?.bankCode || '';
          initTransData.contextData.rxDetails.purposeofRemittanceCode = data.CustomObject?.purposeofRemittanceCode || '';
          initTransData.contextData.rxDetails.senderCNIC = data.CustomObject?.senderCNIC || '';
          initTransData.contextData.rxDetails.recieverMsisdn = data.CustomObject?.recieverMsisdn || '';
          initTransData.contextData.rxDetails.purposeValue = data.CustomObject?.purposeValue || '';
        }
        initTransData.contextData.header = "Money Transfer - " + initTransData.contextData.rxDetails.bankName || '';
        initTransData.contextData.footer = initTransData.contextData.rxDetails.bankAcctNum;
        // initTransData.contextData.rxDetails.msisdn=data.Header.Identity.ReceiverParty.Identifier;
        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }

        initTransData.txCategoryLabel = initTransData.contextData.rxDetails.bankName
        // let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        // if(trxCategoryMapping && trxCategoryMapping!=null){
        //   initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        // }
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };

      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug(err);
      return null;
    }


  }
  getInitTransB2CResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getInitTransB2CResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.txType = "Money Transfer - Organization to Customer";
        initTransData.isReciever = "true";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Pending';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        // initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.senderName = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "true";
        initTransData.txCategory = data.Header.UseCase;;
        initTransData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        initTransData.contextData.rxDetails.name = data.CustomObject?.receiverTitle;
        initTransData.contextData.rxDetails.msisdn = data.Header.Identity.ReceiverParty.Identifier;
        initTransData.contextData.header = "Money Transfer - JazzCash";
        initTransData.contextData.footer = data.Header.Identity?.ReceiverParty?.Identifier;
        initTransData.useCase = data.Header.UseCase;

        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug(err);
      return null;
    }


  }
  getInitTransB2BResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getInitTransB2BResponse');
      logger.debug(data);
      const senderMSISDN = data.Header.Identity.Initiator.Identifier;

      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        const channelCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = senderMSISDN;
        initTransData.txType = "Money Transfer - Organization Operator";
        initTransData.isReciever = "true";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = channelCode === PINLESS_TXN_CHANNEL_CODE ? 'Complete' : 'Pending';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = channelCode;
        initTransData.senderMsisdn = senderMSISDN;
        initTransData.senderName = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "true";
        initTransData.txCategory = data.Header.UseCase;
        initTransData.useCase = data.Header.UseCase;
        initTransData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        if (data.CustomObject) {
          logger.debug("Reading from customObject");
          initTransData.contextData.rxDetails = data.CustomObject;
          initTransData.contextData.rxDetails.msisdn = data.CustomObject?.msisdn || '';
          initTransData.contextData.rxDetails.name = data.CustomObject?.receiverTitle;
          initTransData.contextData.rxDetails.MDRFee = 0
          initTransData.contextData.rxDetails.showMDRFee = "false"
          initTransData.contextData.header = "Money Transfer - JazzCash Business";
          // initTransData.contextData.footer = senderMSISDN; // we should have sender msisdn here JMPI-3565 NOT initTransData.contextData?.rxDetails?.msisdn || '';
          initTransData.contextData.footer =  data.CustomObject?.msisdn || ''; // JMPI-3356
        }
        //initTransData.contextData.rxDetails.msisdn=data.Header.Identity?.ReceiverParty?.Identifier;
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug(err);
      return null;
    }


  }

  getInitTransAggregatorResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getInitTransAggregatorResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        const channelCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.txType = data.Header.UseCase;
        initTransData.isReciever = "true";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Pending';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = channelCode;
        initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.senderName = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "false";
        initTransData.txCategory = data.Header.UseCase;
        initTransData.useCase = data.Header.UseCase;
        initTransData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        initTransData.contextData.rxDetails = data.CustomObject ? data.CustomObject : {};
        initTransData.contextData.rxDetails.name = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'BeneficiaryName'; })?.Value || '';
        initTransData.contextData.rxDetails.msisdn = data.Header.Identity?.ReceiverParty?.Identifier || data.CustomObject?.originalSenderMsisdn;
        initTransData.contextData.rxDetails.refundedTxID = data.CustomObject?.originalTxID;

        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }



        if (data.Header.UseCase === 'BusTickets') {
          initTransData.contextData.header = "Bus Ticket Payment";
          initTransData.contextData.footer = data.CustomObject?.serviceName;
          initTransData.txCategoryLabel = data.CustomObject?.serviceName; // this is for consumer 
        } else if (data.Header.UseCase === "RefundBusTickets") {
          let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
          if (trxCategoryMapping && trxCategoryMapping != null) {
            initTransData.txCategoryLabel = trxTypeMapping.txCategoryLabel
          }
        } else if (data.Header.UseCase === "RefundEventTickets") {
          let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
          if (trxCategoryMapping && trxCategoryMapping != null) {
            initTransData.txCategoryLabel = trxTypeMapping.txCategoryLabel
          }
        } else {
          initTransData.txCategoryLabel = data.CustomObject?.eventTitle; // this is for consumer 
        }


        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug(err);
      return null;
    }
  }

  getInitTransMovieTicketResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getInitTransMovieTicketResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        const channelCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.txType = data.Header.UseCase;
        initTransData.isReciever = "false";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Pending';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = channelCode;
        initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.senderName = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "false";
        initTransData.txCategory = data.Header.UseCase;
        initTransData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        initTransData.contextData.rxDetails = data.CustomObject ? data.CustomObject : {};
        initTransData.contextData.rxDetails.msisdn = data.Header.Identity?.ReceiverParty?.Identifier || data.CustomObject?.msisdn;

        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug(err);
      return null;
    }
  }

  getPaymentsConfirmResponse(data) {
    let confirmData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getPaymentsConfirmResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        confirmData = _.cloneDeep(templates.TRX_HISTORY);
        confirmData.msisdn = data.Header.Identity?.Initiator.Identifier;
        confirmData.txType = "ConfirmTransaction";
        confirmData.txID = data.Result.TransactionID;
        confirmData.txStatus = 'Complete';
        //confirmData.contextData.ocvID = data.Request.Transaction.OriginatorConversationID || '';

        // confirmData.contextData.cvID = data.Request.Transaction?.ConversationID || '';;
        logger.debug("contextData");
        logger.debug(confirmData);
        return { confirmData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug(err);
      return null;
    }


  }

  async getLoanManagementInitTransResponse(data, channel) {
    let initTransData = {};
    try {
      logger.info('Inside the Data Mapping function-> getLoanManagementInitTransResponse');
      logger.info(data);
      initTransData = _.cloneDeep(templates.TRX_HISTORY);
      //Using Receiver MSISDN here (customer) because loan is disburse by settlement account (Initiator identifier)
      initTransData.msisdn_txID = formatNumber(data.Header.Identity?.ReceiverParty.Identifier) + "_" + data.Result.TransactionID;
      initTransData.msisdn = formatNumber(data.Header.Identity?.ReceiverParty.Identifier);
      initTransData.txType = (channel === 'merchantApp') ? 'Instant Loan Request' : 'ReadyCash Received';
      initTransData.useCase = 'LoanManagement'; //no data.header.UseCase coming in the object
      initTransData.isReciever = "false";
      initTransData.txID = data.Result.TransactionID;
      initTransData.txStatus = 'Complete'; //We get only one topic for this, so this will be complete
      initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
      initTransData.contextData.header = "ReadyCash Received";
      initTransData.contextData.footer =  initTransData.msisdn_txID;
      initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
      initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
      initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
      initTransData.senderMsisdn = formatNumber(data.Header.Identity?.Initiator.Identifier);
      initTransData.debit = "false";
      initTransData.isRepeatable = "false";
      initTransData.txCategory = (channel === 'merchantApp') ? "Instant Loan Received" : "Readycash Received";
      initTransData.contextData.rxDetails = {};
      initTransData.fee = 0;
        
      initTransData.txTypeLabel = "ReadyCash";
      initTransData.txCategoryLabel = "ReadyCash Loan";
      logger.info("contextData");
      logger.info(initTransData);
      return { initTransData };
    }catch (err) {
      logger.info('error -> getLoanManagementInitTransResponse');
      logger.info(err.message);
      return null;
    }
  }

  async getLoanAutoRepayInitTransResponse(data) {
    let initTransData = {};
    try {
      logger.info('Inside the Data Mapping function-> getLoanAutoRepayInitTransResponse');
      logger.info(data);
      initTransData = _.cloneDeep(templates.TRX_HISTORY);
      initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
      initTransData.msisdn = data.Header.Identity?.Initiator.Identifier;
      initTransData.txType = 'LoanAutoRepay';
      initTransData.useCase = data.Header.UseCase;
      initTransData.isReciever = "false";
      initTransData.txID = data.Result.TransactionID;
      initTransData.txStatus = 'Pending';
      initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
      initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
      initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
      initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
      initTransData.senderMsisdn = data.Header.Identity?.Initiator.Identifier;
      initTransData.debit = "true";
      initTransData.isRepeatable = "true";
      initTransData.txCategory = "";
      initTransData.contextData.rxDetails = {};

      let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
      if (trxTypeMapping && trxTypeMapping != null) {
        initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
      }
      let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
      if (trxCategoryMapping && trxCategoryMapping != null) {
        initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
      }
      logger.info("contextData");
      logger.info(initTransData);
      return { initTransData };
    } catch (err) {
      logger.info('error -> getLoanAutoRepayInitTransResponse');
      logger.info(err.message);
      return null;
    }
  }

  async getCardOrderChargeWithoutMPINInitTransResponse(data) {
    let initTransData = {};
    try {
      logger.info('Inside the Data Mapping function-> getCardOrderChargeWithoutMPINInitTransResponse');
      logger.info(data);
      initTransData = _.cloneDeep(templates.TRX_HISTORY);
      initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
      initTransData.msisdn = data.Header.Identity?.Initiator.Identifier;
      const cardNature = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'CardNature'; })?.Value || '';
      initTransData.txType = `${cardNature === 'Virtual' ? 'Virtual' : 'Physical'} Card Order`;
      initTransData.useCase = data.Header.UseCase;
      initTransData.isReciever = "false";
      initTransData.txID = data.Result.TransactionID;
      initTransData.txStatus = 'Complete';
      initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
      initTransData.amount = Number(data?.Request?.R5RequestBody?.Parameters?.Amount || '0');//Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
      let timestamp = data?.Request?.Transaction?.Timestamp;
      initTransData.txEndDate = timestamp.substring(0,8);//data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
      initTransData.txEndTime = timestamp.substring(8);//data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
      initTransData.senderMsisdn = data.Header.Identity?.Initiator.Identifier;
      initTransData.debit = "true";
      initTransData.isRepeatable = "false";
      initTransData.txCategory = "Card Ordering";
      initTransData.fee = 0;
      initTransData.commission = 0;
      initTransData.contextData.rxDetails = {};
      initTransData.contextData.rxDetails.msisdn = data.Header.Identity?.Initiator.Identifier;
      initTransData.contextData.rxDetails.CardNature   = cardNature;
      initTransData.contextData.rxDetails.CardCategory = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'CardCategory'; })?.Value || '';;
      initTransData.contextData.rxDetails.CardScheme   = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'CardScheme'; })?.Value || '';;
      initTransData.contextData.footer = data.Header.Identity?.Initiator.Identifier;
      let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
      if(trxTypeMapping && trxTypeMapping !=null){
        initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
      }
      let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
      if(trxCategoryMapping && trxCategoryMapping!=null){
        initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel + initTransData.contextData.rxDetails.CardScheme
      }
      logger.info("contextData");
      logger.info(initTransData);
      return { initTransData };
    }catch (err) {
      logger.info('error -> getCardOrderChargeWithoutMPINInitTransResponse');
      logger.info(err.message);
      return null;
    }
  }

  async getReverseTransactionInitTransResponse(data) {
    let initTransData = {};
    try {
      logger.info('Inside the Data Mapping function-> getReverseTransactionInitTransResponse');
      logger.info(data);
      initTransData = _.cloneDeep(templates.TRX_HISTORY);
      // let name = data.Result.R5ResultBody.CreditPartyPublicName;
      // let splits = name.split("\\");
      let initiator = data.CustomObject?.originalSenderMsisdn;
      //console.log('initiator: ' , splits , ' , ' , initiator , ' , ' , name.split("\\")[1]);
      initTransData.msisdn_txID = initiator + "_" + data.Result.R5ResultBody.ReceiptNumber;
      initTransData.msisdn = initiator;
      initTransData.txType = 'CardOrderReverseTransaction';
      initTransData.useCase = data.Header.UseCase;
      initTransData.isReciever = "false";
      initTransData.txID = data.Result.R5ResultBody.ReceiptNumber;
      initTransData.txStatus = 'Complete';
      initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
      initTransData.amount = Number(data.Result.R5ResultBody.Amount || '0');
      let timestamp = data?.Result?.R5ResultBody?.BOCompletedTime;
      initTransData.txEndDate = timestamp.substring(0, 8);//data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
      initTransData.txEndTime = timestamp.substring(8);//data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
      initTransData.senderMsisdn = initiator;
      initTransData.debit = "false";
      initTransData.isRepeatable = "false";
      initTransData.txCategory = "";
      initTransData.fee = 0;
      initTransData.commission = 0;
      initTransData.contextData.rxDetails = {};
      initTransData.contextData.rxDetails.msisdn = initiator;
      initTransData.contextData.rxDetails.OriginalReceiptNumber = data.Request.R5RequestBody?.OriginalReceiptNumber || '';

      let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
      if (trxTypeMapping && trxTypeMapping != null) {
        initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
      }
      let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
      if (trxCategoryMapping && trxCategoryMapping != null) {
        initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
      }
      logger.info("contextData");
      logger.info(initTransData);
      return { initTransData };
    } catch (err) {
      logger.info('error -> getReverseTransactionInitTransResponse');
      logger.info(err.message);
      return null;
    }
  }

  async getQRIssuingInitTransResponse(data) {
    let initTransData = {};
    try {
      logger.info('Inside the Data Mapping function-> getQRIssuingInitTransResponse');
      logger.info(data);
      initTransData = _.cloneDeep(templates.TRX_HISTORY);
      initTransData.msisdn_txID = `${data.Header.Identity.Initiator.Identifier}_${data.Result.R5ResultBody.TransactionID}`
      initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
      initTransData.txCategory = "QR Payment";
      initTransData.txID = data.Result.R5ResultBody.TransactionID;
      initTransData.txStatus = 'Complete';
      initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
      initTransData.amount = Number(data.CustomObject?.totalAmount) || 0;
      let timestamp = data?.Request?.Transaction?.Timestamp;
      initTransData.txEndDate = timestamp ? timestamp.substring(0, 8) : '';
      initTransData.txEndTime = timestamp ? timestamp.substring(8) : '';
      initTransData.chCode = data.Request.R5RequestBody.Parameters.Parameter.find((param) => { return param.Key == 'Channel'; })?.Value || '0';
      initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
      initTransData.senderName = data.CustomObject.senderName;
      initTransData.debit = "true";
      initTransData.isRepeatable = "true";
      initTransData.useCase = data.Header.UseCase;
      initTransData.fee = 0; //Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'Fee';})?.Value || '0');
      initTransData.txType = 'Mastercard';
      initTransData.isReciever = "false";
      let rxDetails = data.CustomObject;
      delete rxDetails.isFonepay;
      rxDetails.isMasterCardQR = true;
      rxDetails.name = data.CustomObject.merchantName
      initTransData.contextData.rxDetails = rxDetails;
      delete initTransData.commission;

      initTransData.contextData.header = `QR Payment - ${data.CustomObject.merchantName}`
      initTransData.contextData.footer = data.CustomObject.merchantTillNumber;
      // Adding label details
      let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
      if (trxTypeMapping && trxTypeMapping != null) {
        initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
      }
      let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
      if (trxCategoryMapping && trxCategoryMapping != null) {
        initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
      }
      logger.info("contextData");
      logger.info(initTransData);
      return { initTransData };
    } catch (err) {
      logger.info('error -> getQRIssuingInitTransResponse');
      logger.info(err.message);
      return null;
    }
  }

  async getMobileLoadAndMobileBundleInitTransResponse(data, txType) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getMobileLoadAndMobileBundleInitTransResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        let discounted =  data?.Result?.ResultParameters?.ResultParameter?.some(e =>(e.Key== 'discounted'));
        let Operate = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'operator'; })?.Value);
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header.Identity?.Initiator.Identifier;
        initTransData.txType = data.Header.UseCase;//"Jazz Prepaid Topup - Mobile Bundle";
        initTransData.isReciever = "false";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Pending';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = data.Request.Transaction.Parameters.Parameter.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.senderMsisdn = data.Header.Identity?.Initiator.Identifier;
        initTransData.senderName = data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'targetName'; })?.Value || '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "true";
        initTransData.txCategory = "MobileBundle";
        initTransData.fee = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        let transactionDetails = {};
        transactionDetails.useCase = data.Header.UseCase;

        //add targetMSISDN or targetReceiver
        if (data.Request.Transaction.CommandID == "InitTrans_MerchantPaymentByCustomer") {
          transactionDetails.msisdn =discounted == true && Operate != 'jazz' ? data.Header.Identity?.Initiator.Identifier: (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'TargetMSISDN'; })?.Value || data.Header.Identity.ReceiverParty.Identifier || '');
        } else if (data.Request.Transaction.CommandID == "InitTrans_RefundMerchantPayment") {
          transactionDetails.operator = 'ufone';
          transactionDetails.originalTransactionId = (data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'OriginalTID'; })?.Value || '');
        } else {
          let msisdn =(data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'TargetMSISDN'; })?.Value || '');
          transactionDetails.msisdn = discounted == true && Operate != 'jazz'  ? data.Header.Identity?.Initiator.Identifier: MSISDNTransformer.formatNumberSingle(msisdn, 'international');
        }

        //add useCase related data ex: bundleDetails, loadAmount
        if (data.Header.UseCase == "MobileBundle") {
          transactionDetails.bundlePrice = Number(data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'bundlePrice'; })?.Value || 0);
          transactionDetails.bundleId = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'bundleId'; })?.Value || '');
          transactionDetails.operator = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'operator'; })?.Value || '');
          transactionDetails.bundleValidity = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'bundleValidity'; })?.Value || '');
          transactionDetails.bundleName = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'bundleName'; })?.Value || '');
          initTransData.fee = Number(data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'bundleFees'; })?.Value || '0');
          initTransData.contextData.header = "Mobile Bundles - " + transactionDetails.operator;
          initTransData.contextData.footer = data.Header.Identity.ReceiverParty.Identifier || '';
        } else if (data.Header.UseCase == "PrePaidLoad" || data.Header.UseCase == "PostPaidLoad") {
          transactionDetails.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
          transactionDetails.operator = "Jazz";
          if (data.Header.UseCase == "PrePaidLoad") {
            initTransData.contextData.header = "Prepaid Load - Jazz";
            initTransData.contextData.footer = transactionDetails.msisdn;
          } else {
            initTransData.contextData.header = "Postpaid Bill - Jazz";
            initTransData.contextData.footer = transactionDetails.msisdn;
          }
        }
        logger.debug(transactionDetails);
        initTransData.contextData.rxDetails = transactionDetails;
        // Adding label details
        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        initTransData.txCategoryLabel = transactionDetails.operator

        // let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        // if(trxCategoryMapping && trxCategoryMapping!=null){
        //   initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        // }
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -> getMobileLoadAndMobileBundleInitTransResponse');
      logger.debug(err.message);
      return null;
    }
  }

  async getConfirmTransResponse(data) {
    let confirmData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getConfirmTransResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        confirmData = _.cloneDeep(templates.TRX_HISTORY);
        confirmData.msisdn = data.Header.Identity?.Initiator.Identifier;
        confirmData.txType = "ConfirmTransaction";
        confirmData.txID = data.Result.TransactionID;
        confirmData.txStatus = 'Complete';
        confirmData.contextData.ocvID = data.Request.Transaction.OriginatorConversationID || '';
        if (data.Header.UseCase == "ReadyCashRePayment" || data.Header.UseCase == "InstantLoanRepayment") {
          confirmData.amount = data.CustomObject.amount;
        }
        // confirmData.contextData.cvID = data.Request.Transaction?.ConversationID || '';;
        logger.debug("contextData");
        logger.debug(confirmData);
        return { confirmData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -> getConfirmTransResponse');
      logger.debug(err.message);
      return null;
    }
  }

  getInitTransDepositViaDebitCardResponse(data, topicName) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getInitTransDepositViaDebitCardResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        const channelCode = data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        if (channelCode == config.esb.thirdPartyMap.consumerApp.channelCode && topicName != config.kafkaBroker.topics.confirm_deposit_DVDC) {
          return null;
        }
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        const receiverMsisdn = data.CustomObject?.customerMSISDN || data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'CustomerMSISDN'; })?.Value || data.Header.Identity.ReceiverParty?.Identifier;
        initTransData.msisdn_txID = receiverMsisdn + "_" + data.Result.TransactionID;
        initTransData.msisdn = receiverMsisdn;
        initTransData.txType = "Debit Card";
        initTransData.txID = data.Result.TransactionID;
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        //initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = channelCode;
        initTransData.txStatus = 'Complete';
        initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.senderName = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initTransData.debit = "false";
        initTransData.isRepeatable = "false";
        initTransData.txCategory = data.Header.UseCase;
        initTransData.fee = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        initTransData.contextData.rxDetails = data.CustomObject;
        initTransData.contextData.rxDetails.name = ""; // sending this as empty since FE requires this for receipt rendering
        initTransData.contextData.rxDetails.msisdn = receiverMsisdn; //sending msisdn seperately because FE team is mapping number with this field not with customerMSISDN
        initTransData.contextData.header = "Add Money - Debit Card";
        initTransData.contextData.footer = data.CustomObject?.maskedCardNo;
        // Adding label details
        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    } catch (err) {
      logger.debug(err);
      return null;
    }
  }

  async queryIdentityInformationResponse(responsePayload) {
    try {

      const cnic = responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IDNumber ? responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IDNumber : null;

      const name = responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IdentityOwnerName ? responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IdentityOwnerName : null;

      const cnicInBlackList = responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.CNICInBlackList ? responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.CNICInBlackList : null;

      const identityType = responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IdentityData.IdentityInformation[0].IdentityType ? responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IdentityData.IdentityInformation[0].IdentityType : null;

      const identityStatus = responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IdentityData.IdentityInformation[0].IdentityStatus ? responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IdentityData.IdentityInformation[0].IdentityStatus : null;

      const trustLevel = responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IdentityData.IdentityInformation[0].TrustLevel ? responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IdentityData.IdentityInformation[0].TrustLevel : null;

      const orgShortCode = responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IdentityData.IdentityInformation[0].OrgShortCode ? responsePayload.Result.CustomizedResult.QueryIdentityInformationResult.IdentityData.IdentityInformation[0].OrgShortCode : null;

      return {
        cnic: cnic,
        name: name,
        cnicInBlackList: cnicInBlackList,
        identityType: identityType,
        identityStatus: identityStatus,
        trustLevel: trustLevel,
        orgShortCode: orgShortCode
      };

    } catch (error) {
      logger.error(
        'exception in dataMapping.queryIdentityInformationResponse: ' + error.message
      );
      return null;
    }
  }

  async queryIdentityLimitUsageResponse(responsePayload) {
    try {

      const rulesList = responsePayload.Result.QueryIdentityLimitRemainingResult.RuleList;
      return rulesList;

    } catch (error) {
      logger.error(
        'exception in dataMapping.queryIdentityLimitUsageResponse: ' + error.message
      );
      return null;
    }
  }

  async initTransDirectIBFTIncomingResponse(responsePayload) {
    try {

      const transactionID = responsePayload.Result.TransactionID;
      return {
        transactionID: transactionID
      };
    } catch (error) {
      logger.error(
        'exception in dataMapping.initTransDirectIBFTIncomingResponse: ' + error.message
      );
      return null;
    }
  }

  async titleFetchConsumerResponse(responsePayload) {
    try {

      let bankName = responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'BankName';
      })?.Value || '';

      let bankAccountTitle = responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'BankAccountTitle';
      })?.Value || '';


      if (typeof (bankName) === 'object' && obj !== null) {
        bankName = 'Not avaliable'
      }

      if (typeof (bankAccountTitle) === 'object' && obj !== null) {
        bankAccountTitle = 'Unknown'
      }

      return {
        bankName: bankName,
        bankAccountTitle: bankAccountTitle
      };

    } catch (error) {
      logger.error(
        'exception in dataMapping.initTransDirectIBFTOutgoingResponse: ' + error.message
      );
      return null;
    }
  }

  async initTransDirectIBFTOutgoingResponse(responsePayload) {
    try {

      const transactionID = responsePayload.Result.TransactionID;
      const originatorConversationID = responsePayload.Result.OriginatorConversationID;

      const fee = responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Fee';
      })?.Value || '0.00';

      return {
        transactionID: transactionID,
        originatorConversationID: originatorConversationID,
        fees: parseFloat(fee),
        wht: 0.0,
        fed: 0.0,
        commission: 0.0
      };
    } catch (error) {
      logger.error(
        'exception in dataMapping.initTransDirectIBFTOutgoingResponse: ' + error.message
      );
      return null;
    }
  }

  async initTransOFTOutgoingConsumerResponse(responsePayload) {
    try {

      logger.debug(JSON.stringify(responsePayload));
      let ussdResponsePayload = [];

      const transactionID = responsePayload.Result.TransactionID;
      const originatorConversationID = responsePayload.Result.OriginatorConversationID;

      const fee = Number(responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Fee';
      })?.Value || '0.00');

      const wht = Number(responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Wht';
      })?.Value || '0.00');

      const fed = Number(responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Fed';
      })?.Value || '0.00');

      const commission = Number(responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Commission';
      })?.Value || '0.00');


      ussdResponsePayload.push({
        key: 'tID',
        value: transactionID
      });

      ussdResponsePayload.push({
        key: 'orgID',
        value: originatorConversationID
      });

      ussdResponsePayload.push({
        key: 'fees',
        value: fee
      });

      ussdResponsePayload.push({
        key: 'wht',
        value: wht
      });

      ussdResponsePayload.push({
        key: 'fed',
        value: fed
      });

      ussdResponsePayload.push({
        key: 'commission',
        value: commission
      });

      return {
        transactionID: transactionID,
        originatorConversationID: originatorConversationID,
        fees: fee,
        wht: wht,
        fed: fed,
        commission: commission,
        ussdResponsePayload
      };


    } catch (error) {
      logger.error(
        'exception in dataMapping.initTransOFTOutgoingConsumerResponse: ' + error.message
      );
      return null;
    }
  }

  async confirmTransactionUSSDResponse(responsePayload) {
    try {

      let ussdResponsePayload = [];

      const transactionID = responsePayload.Result.TransactionID;
      const originatorConversationID = responsePayload.Result.OriginatorConversationID;

      const fee = Number(responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Fee';
      })?.Value || '0.00');

      const balance = Number(responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Balance';
      })?.Value || '0.00');

      const amount = Number(responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Amount';
      })?.Value || '0.00');

      const wht = Number(responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Wht';
      })?.Value || '0.00');

      const fed = Number(responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Fed';
      })?.Value || '0.00');

      const commission = Number(responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Commission';
      })?.Value || '0.00');

      const beneficiaryName = responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'BeneficiaryName';
      })?.Value || '';

      ussdResponsePayload.push({
        key: 'tID',
        value: transactionID
      });

      ussdResponsePayload.push({
        key: 'orgID',
        value: originatorConversationID
      });

      ussdResponsePayload.push({
        key: 'fees',
        value: fee
      });

      ussdResponsePayload.push({
        key: 'amount',
        value: amount
      });

      ussdResponsePayload.push({
        key: 'deduction',
        value: amount + fee
      });

      ussdResponsePayload.push({
        key: 'balance',
        value: balance
      });

      ussdResponsePayload.push({
        key: 'beneficiaryName',
        value: beneficiaryName
      });

      ussdResponsePayload.push({
        key: 'wht',
        value: wht
      });

      ussdResponsePayload.push({
        key: 'fed',
        value: fed
      });

      ussdResponsePayload.push({
        key: 'commission',
        value: commission
      });

      return {
        transactionID: transactionID,
        originatorConversationID: originatorConversationID,
        amount: amount,
        fees: fee,
        tAmount: amount + fee,
        uAmount: balance,
        beneficiaryName: beneficiaryName,
        wht: wht,
        fed: fed,
        commission: commission,
        ussdResponsePayload
      };

    } catch (error) {
      logger.error(
        'exception in dataMapping.confirmTransactionUSSDResponse: ' + error.message
      );
      return null;
    }
  }

  async searchTransactionResponse(responsePayload) {
    logger.debug("Inside Search Transaction Response function");
    try {

      const senderTransactionID = responsePayload.Result.SearchTransactionResult.TransactionDetailData.ReceiptNumber;
      const transactionStatus = responsePayload.Result.SearchTransactionResult.TransactionDetailData.TransactionStatus;
      const originalTransactionID = responsePayload.Result.OriginatorConversationID;
      const amount = responsePayload.Result.SearchTransactionResult.TransactionDetailData.Amount;
      const transactionReversed = responsePayload.Result.SearchTransactionResult.TransactionDetailData.IsReverseTransaction;
      const reversedTransactionReceiptID = '';

      return {
        originalTransactionID: originalTransactionID,
        transactionStatus: transactionStatus,
        senderTransactionID: senderTransactionID,
        amount: parseFloat(amount),
        transactionReversed: transactionReversed,
        reversedTransactionReceiptID: reversedTransactionReceiptID
      };

    } catch (error) {
      logger.error(
        'exception in dataMapping.searchTransactionResponse: ' + error.message
      );
      return null;
    }
  }

  async queryTransactionStatusResponse(responsePayload) {
    logger.debug("Inside Query Transaction Status Response function");
    try {

      const jazzCashTransactonID = responsePayload.Result.QueryTransactionStatusResult.ReceiptNumber;
      const transactionStatus = responsePayload.Result.QueryTransactionStatusResult.TransactionStatus;
      const transactionReversed = responsePayload.Result.QueryTransactionStatusResult.IsReversed;

      return {
        jazzCashTransactonID: jazzCashTransactonID,
        transactionStatus: transactionStatus,
        transactionReversed: transactionReversed
      };

    } catch (error) {
      logger.error(
        'exception in dataMapping.queryTransactionStatusResponse: ' + error.message
      );
      return null;
    }
  }

  async getFailureReason(responsePayload) {
    logger.debug("Inside Get Failure Reason function");
    try {

      const resultDescription = responsePayload.Result.ResultDesc;
      const failedReason = responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'FailedReason';
      })?.Value || 'default';

      return {
        resultDescription: resultDescription,
        failedReason: failedReason
      };

    } catch (error) {
      logger.error(
        'exception in dataMapping.getFailureReason: ' + error.message
      );
      return null;
    }
  }

  async vouchersResponseMapping(data) {
    let initTransData = {};
    try {
      logger.debug('inside dataMapping -> voucherPaymentResponseMapping');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header.Identity?.Initiator.Identifier;
        initTransData.txType = data.Header.UseCase;
        initTransData.isReciever = "false"; // Setting this to false as Vouchers don't need to have a counterparty who is a jazzcash user which's txn history need to be populated
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Pending';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'DueAmount'; })?.Value || '0');
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = data.Request.Transaction.Parameters.Parameter.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.senderMsisdn = data.Header.Identity?.Initiator.Identifier;
        initTransData.debit = "true";
        initTransData.isRepeatable = "false";
        //initTransData.txCategory = data.Header.UseCase;
        initTransData.fee = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        let transactionDetails = {};
        transactionDetails.useCase = data.Header.UseCase;
        if (data.Header.UseCase == "VoucherPayment") {
          let msisdn = (data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'CustomerMSISDN'; })?.Value || '');
          transactionDetails.msisdn = MSISDNTransformer.formatNumberSingle(msisdn, 'international');
          transactionDetails.ConsumerRefNum = (data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'ConsumerRefNum'; })?.Value || '');
          //transactionDetails.CompanyCode      = (data?.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'CompanyCode';})?.Value || '');
          transactionDetails.CompanyShortName = (data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'CompanyShortName'; })?.Value || '');
          initTransData.txCategory = "Travel & Food";
          initTransData.contextData.header = "Careem Payment";
          initTransData.isRepeatable = "false";
          initTransData.contextData.footer = transactionDetails.msisdn;
          initTransData.amount = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'DueAmount'; })?.Value || '0');
        } else if (data.Header.UseCase == "DarazVoucher") {
          transactionDetails.msisdn = data.CustomObject.targetMSISDN || data.Header.Identity?.ReceiverParty.Identifier;
          initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
          initTransData.txCategory = "Entertainment & Online Purchases";
          initTransData.senderName = data.CustomObject.targetName || "";
        } else if (data.Header.UseCase == "ReadyCashRePayment") {
          initTransData.isRepeatable = "false";
          transactionDetails.msisdn = MSISDNTransformer.formatNumberSingle((data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ConsumerRefNum'; })?.Value || ''), 'international');
          transactionDetails.CompanyCode = (data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'CompanyCode'; })?.Value || '');
          initTransData.amount = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'DueAmount'; })?.Value || '0');
          initTransData.txCategory = "Banking & Finance";
        }
        else if (data.Header.UseCase == "InstantLoanRepayment") {
          transactionDetails.msisdn = MSISDNTransformer.formatNumberSingle((data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ConsumerRefNum'; })?.Value || ''), 'international');
          transactionDetails.CompanyCode = (data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'CompanyCode'; })?.Value || '');
          initTransData.amount = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'DueAmount'; })?.Value || '0');
          initTransData.txCategory = "Banking & Finance";
          initTransData.contextData.header = "Instant Loan Repayment";
          initTransData.contextData.footer =  data?.Result?.TransactionID;
        }
        else if (data.Header.UseCase == "eVouchers") {
          initTransData.amount = Number(data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
          initTransData.txCategory = "Entertainment & Online Purchases";
          initTransData.txType = "e-vouchers";
          initTransData.isReciever = "false";
          transactionDetails.msisdn = data.Header.Identity?.ReceiverParty?.Identifier || '';
          initTransData.txTypeLabel = initTransData.txType;
          initTransData.txCategoryLabel = initTransData.txCategory;
          if (data.CustomObject) {
            logger.debug("Reading from customObject");
            transactionDetails.productCode = data.CustomObject?.productCode || '';
            transactionDetails.email = data.CustomObject?.email || '';
          }
          initTransData.contextData.header = "Voucher Payment";
          initTransData.contextData.footer = transactionDetails?.productCode || '';
        }

        // Adding label details
        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.debug(transactionDetails);
        initTransData.contextData.rxDetails = transactionDetails;
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    } catch (error) {
      logger.error('exception in dataMapping -> voucherPaymentResponseMapping : ' + error.message);
      return null;
    }
  }

  getIBFTIncomingConfirmMapping(data) {
    let confirmTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getIBFTIncomingConfirmMapping');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        confirmTransData = _.cloneDeep(templates.TRX_HISTORY);
        const channelCode = data.Request.Transaction.Parameters.Parameter.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        confirmTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        confirmTransData.msisdn = data.Header.Identity?.Initiator.Identifier;
        confirmTransData.txType = "EasyPaisa - IBFT Incoming";
        confirmTransData.isReciever = "false";
        confirmTransData.txID = data.Result.TransactionID;
        confirmTransData.txStatus = 'Complete';
        confirmTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        confirmTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        confirmTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        confirmTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        confirmTransData.chCode = channelCode;
        confirmTransData.senderMsisdn = data.CustomObject.debitParty.msisdn;
        confirmTransData.senderName = data.CustomObject.debitParty.accountTitle;
        confirmTransData.debit = "true";
        confirmTransData.isRepeatable = "false";
        confirmTransData.txCategory = data.Header.UseCase;
        confirmTransData.fee = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        confirmTransData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        confirmTransData.contextData.rxDetails.name = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'BeneficiaryName'; })?.Value || '';
        confirmTransData.contextData.rxDetails.msisdn = data.Header.Identity?.ReceiverParty?.Identifier;

        let transactionDetails = {};
        transactionDetails.senderTransactionID = CustomObject.senderTransactionID;
        transactionDetails.senderFinancialID = CustomObject.senderFinancialID;
        transactionDetails.senderIBAN = CustomObject.debitParty.iban;
        transactionDetails.senderbankIMD = CustomObject.debitParty.bankIMD;
        transactionDetails.receiverMsisdn = CustomObject.creditParty.msisdn;
        transactionDetails.receiverIBAN = CustomObject.creditParty.iban;
        transactionDetails.requestDateTime = CustomObject.requestDateTime;
        transactionDetails.requestDate = CustomObject.requestDate;
        transactionDetails.requestTime = CustomObject.requestTime;
        transactionDetails.paymentPurpose = CustomObject.paymentPurpose;
        transactionDetails.metadata = CustomObject.metadata;
        confirmTransData.contextData.rxDetails = transactionDetails;

        // Adding label details
        let trxTypeMapping = trxMappingHandler.resolveTxnType(confirmTransData.txType, confirmTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          confirmTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(confirmTransData.txType, confirmTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          confirmTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.debug("contextData");
        logger.debug(JSON.stringify(confirmTransData));
        return { confirmTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -> getIBFTIncomingConfirmMapping');
      logger.debug(err);
      return null;
    }
  }

  getIBFTIncomingConfirmDB2Mapping(data) {
    let confirmTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getIBFTIncomingConfirmDB2Mapping');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {

        confirmTransData.transactionIDEasyPaisa = data.CustomObject.senderTransactionID;
        confirmTransData.transactionIDEasyJazzcash = data.Result.TransactionID;

        confirmTransData.transactionDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || ''
        if (confirmTransData.transactionDate !== '') {
          confirmTransData.transactionDate = moment(confirmTransData.transactionDate).format('YYYY-MM-DD');
        }

        confirmTransData.transactionTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || ''
        if (confirmTransData.transactionTime !== '') {
          const time = moment(confirmTransData.transactionTime, 'HHmmss').format('HH:mm:ss');
          confirmTransData.transactionTime = confirmTransData.transactionDate + " " + time;
        }

        confirmTransData.receiverMsisdn = data.CustomObject.creditParty.msisdn;
        confirmTransData.receiverCnic = '';
        confirmTransData.receiverName = '';
        confirmTransData.identityLevel = '';
        confirmTransData.region = '';
        confirmTransData.city = '';
        confirmTransData.address = '';
        confirmTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        confirmTransData.transactionStatus = 'Completed';
        confirmTransData.reversalStatus = '';
        confirmTransData.senderName = data.CustomObject.debitParty.accountTitle;
        confirmTransData.senderBankName = '';
        confirmTransData.senderAccount = data.CustomObject.debitParty.iban;
        confirmTransData.reasonOfFailure = '';
        confirmTransData.reversedTrasactionID = '';
        confirmTransData.reversedReason = '';
        confirmTransData.fee = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        confirmTransData.fed = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Fed'; })?.Value || '0');
        confirmTransData.stan = data.Result.TransactionID;
        confirmTransData.currentBalance = 0;
        confirmTransData.channel = data.Header.SubChannel;
        logger.debug("contextData");
        logger.debug(JSON.stringify(confirmTransData));
        return { confirmTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -> getIBFTIncomingConfirmDB2Mapping');
      logger.debug(err);
      return null;
    }
  }

  getIBFTOutgoingInitDB2Mapping(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getIBFTOutgoingInitDB2Mapping');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {

        initTransData.transactionObjective = data.CustomObject.paymentPurpose;
        initTransData.transactionIDEasyPaisa = '';
        initTransData.transactionIDJazzcash = data.Result.TransactionID;

        initTransData.transactionDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || ''
        if (initTransData.transactionDate !== '') {
          initTransData.transactionDate = moment(initTransData.transactionDate).format('YYYY-MM-DD');
        }

        initTransData.transactionTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || ''
        if (initTransData.transactionTime !== '') {
          const time = moment(initTransData.transactionTime, 'HHmmss').format('HH:mm:ss');
          initTransData.transactionTime = initTransData.transactionDate + " " + time;
        }
        //  initTransData.transactionDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'TransEndDate';})?.Value || ''
        //  initTransData.transactionTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'TransEndTime';})?.Value || ''

        initTransData.beneficiaryMsisdn = CustomObject.receiverMsisdn;
        initTransData.beneficiaryBankName = 'JazzCash';
        initTransData.senderMsisdn = data.CustomObject.senderMsisdn;
        initTransData.beneficiaryBankAccount = data.CustomObject.beneficiaryBankName;
        initTransData.senderLevel = data.CustomObject.identityType;
        initTransData.senderCnic = data.CustomObject.senderCNIC;
        initTransData.receiverMsisdn = data.CustomObject.receiverMsisdn;
        initTransData.initiatorMsisdn = data.CustomObject.senderMsisdn;
        initTransData.initiatorCity = '';
        initTransData.initiatorRegion = '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.transactionStatus = 'Pending';
        initTransData.reasonOfFailure = '';
        initTransData.fee = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.fed = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Fed'; })?.Value || '0');
        initTransData.commission = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        initTransData.wht = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'WHT'; })?.Value || '0');
        initTransData.stan = data.Result.TransactionID;
        initTransData.currentBalance = 0;
        initTransData.reversalStatus = '';
        initTransData.channel = data.Header.Channel;

        logger.debug("contextData");
        logger.debug(JSON.stringify(initTransData));
        return { initTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -> getIBFTOutgoingInitDB2Mapping');
      logger.debug(err);
      return null;
    }
  }

  getIBFTOutgoingConfirmDB2Mapping(data) {
    let confirmTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getIBFTOutgoingConfirmDB2Mapping');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {

        confirmTransData.transactionIDEasyPaisa = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'senderTransactionID'; })?.Value || '';

        confirmTransData.transactionDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || ''
        if (confirmTransData.transactionDate !== '') {
          confirmTransData.transactionDate = moment(confirmTransData.transactionDate).format('YYYY-MM-DD');
        }

        confirmTransData.transactionTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || ''
        if (confirmTransData.transactionTime !== '') {
          const time = moment(confirmTransData.transactionTime, 'HHmmss').format('HH:mm:ss');
          confirmTransData.transactionTime = confirmTransData.transactionDate + " " + time;
        }

        // confirmTransData.transactionDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'TransEndDate';})?.Value || ''
        // confirmTransData.transactionTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'TransEndTime';})?.Value || ''

        confirmTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        confirmTransData.transactionStatus = 'Completed';
        confirmTransData.fee = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        confirmTransData.fed = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Fed'; })?.Value || '0');
        confirmTransData.commission = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        confirmTransData.wht = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'WHT'; })?.Value || '0');
        confirmTransData.currentBalance = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Balance'; })?.Value || '0');

        logger.debug("contextData");
        logger.debug(JSON.stringify(confirmTransData));
        return { confirmTransData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -> getIBFTOutgoingConfirmDB2Mapping');
      logger.debug(err);
      return null;
    }
  }

  // getIBFTOutgoingInitMapping(data) {
  //   let confirmTransData={};
  //   try{ 
  //     logger.debug('Inside the Data Mapping function-> getIBFTOutgoingInitMapping');
  //     logger.debug(data);
  //     if (data.Result.ResultCode == 0) {
  //          confirmTransData =  _.cloneDeep(templates.TRX_HISTORY);
  //          const channelCode = data.Request.Transaction.Parameters.Parameter.find((param) => {return param.Key == 'ChannelCode';})?.Value || '0';
  //          confirmTransData.msisdn_txID =data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
  //          confirmTransData.msisdn = data.Header.Identity?.Initiator.Identifier;
  //          confirmTransData.txType = "EasyPaisa - IBFT Incoming";
  //          confirmTransData.isReciever  = "true";
  //          confirmTransData.txID = data.Result.TransactionID;
  //          confirmTransData.txStatus = 'Complete';
  //          confirmTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
  //          confirmTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => {return param.Key == 'Amount';})?.Value || '0');
  //          confirmTransData.txEndDate=data?.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'TransEndDate';})?.Value || '';
  //          confirmTransData.txEndTime=data?.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'TransEndTime';})?.Value || '';
  //          confirmTransData.chCode = channelCode;
  //          confirmTransData.senderMsisdn = data.CustomObject.debitParty.msisdn;
  //          confirmTransData.senderName = data.CustomObject.debitParty.accountTitle;
  //          confirmTransData.debit = "true";
  //          confirmTransData.isRepeatable ="true";
  //          confirmTransData.txCategory =data.Header.UseCase;
  //          confirmTransData.fee =Number(data.Result?.Parameters?.ResultParameter?.find((param) => {return param.Key == 'Fee';})?.Value || '0');
  //          confirmTransData.commission=Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'Commission';})?.Value || '0');
  //          confirmTransData.contextData.rxDetails.name=data.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'BeneficiaryName';})?.Value || '';
  //          confirmTransData.contextData.rxDetails.msisdn=data.Header.Identity?.ReceiverParty?.Identifier;

  //          let transactionDetails = {};
  //          transactionDetails.senderTransactionID = CustomObject.senderTransactionID;
  //          transactionDetails.senderFinancialID = CustomObject.senderFinancialID;
  //          transactionDetails.senderIBAN = CustomObject.debitParty.iban;
  //          transactionDetails.senderbankIMD = CustomObject.debitParty.bankIMD;
  //          transactionDetails.receiverMsisdn = CustomObject.creditParty.msisdn;
  //          transactionDetails.receiverIBAN = CustomObject.creditParty.iban;
  //          transactionDetails.requestDateTime = CustomObject.requestDateTime;
  //          transactionDetails.requestDate = CustomObject.requestDate;
  //          transactionDetails.requestTime = CustomObject.requestTime;
  //          transactionDetails.paymentPurpose = CustomObject.paymentPurpose;
  //          transactionDetails.metadata = CustomObject.metadata;
  //          confirmTransData.contextData.rxDetails =transactionDetails;

  //         logger.debug("contextData");
  //         logger.debug(JSON.stringify(confirmTransData));
  //        return { confirmTransData };
  //     } else {
  //       return null;
  //     }
  //   }
  //   catch(err){
  //     logger.debug('error -> getIBFTIncomingConfirmMapping');
  //     logger.debug(err);
  //     return null;
  //   }
  // }

  // getIBFTOutgoingConfirmMapping(data) {
  //   let confirmTransData={};
  //   try{ 
  //     logger.debug('Inside the Data Mapping function-> getIBFTOutgoingConfirmMapping');
  //     logger.debug(data);
  //     if (data.Result.ResultCode == 0) {
  //          confirmTransData =  _.cloneDeep(templates.TRX_HISTORY);
  //          const channelCode = data.Request.Transaction.Parameters.Parameter.find((param) => {return param.Key == 'ChannelCode';})?.Value || '0';
  //          confirmTransData.msisdn_txID =data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
  //          confirmTransData.msisdn = data.Header.Identity?.Initiator.Identifier;
  //          confirmTransData.txType = "EasyPaisa - IBFT Incoming";
  //          confirmTransData.isReciever  = "true";
  //          confirmTransData.txID = data.Result.TransactionID;
  //          confirmTransData.txStatus = 'Complete';
  //          confirmTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
  //          confirmTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => {return param.Key == 'Amount';})?.Value || '0');
  //          confirmTransData.txEndDate=data?.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'TransEndDate';})?.Value || '';
  //          confirmTransData.txEndTime=data?.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'TransEndTime';})?.Value || '';
  //          confirmTransData.chCode = channelCode;
  //          confirmTransData.senderMsisdn = data.CustomObject.debitParty.msisdn;
  //          confirmTransData.senderName = data.CustomObject.debitParty.accountTitle;
  //          confirmTransData.debit = "true";
  //          confirmTransData.isRepeatable ="true";
  //          confirmTransData.txCategory =data.Header.UseCase;
  //          confirmTransData.fee =Number(data.Result?.Parameters?.ResultParameter?.find((param) => {return param.Key == 'Fee';})?.Value || '0');
  //          confirmTransData.commission=Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'Commission';})?.Value || '0');
  //          confirmTransData.contextData.rxDetails.name=data.Result?.ResultParameters?.ResultParameter?.find((param) => {return param.Key == 'BeneficiaryName';})?.Value || '';
  //          confirmTransData.contextData.rxDetails.msisdn=data.Header.Identity?.ReceiverParty?.Identifier;

  //          let transactionDetails = {};
  //          transactionDetails.senderTransactionID = CustomObject.senderTransactionID;
  //          transactionDetails.senderFinancialID = CustomObject.senderFinancialID;
  //          transactionDetails.senderIBAN = CustomObject.debitParty.iban;
  //          transactionDetails.senderbankIMD = CustomObject.debitParty.bankIMD;
  //          transactionDetails.receiverMsisdn = CustomObject.creditParty.msisdn;
  //          transactionDetails.receiverIBAN = CustomObject.creditParty.iban;
  //          transactionDetails.requestDateTime = CustomObject.requestDateTime;
  //          transactionDetails.requestDate = CustomObject.requestDate;
  //          transactionDetails.requestTime = CustomObject.requestTime;
  //          transactionDetails.paymentPurpose = CustomObject.paymentPurpose;
  //          transactionDetails.metadata = CustomObject.metadata;
  //          confirmTransData.contextData.rxDetails =transactionDetails;

  //         logger.debug("contextData");
  //         logger.debug(JSON.stringify(confirmTransData));
  //        return { confirmTransData };
  //     } else {
  //       return null;
  //     }
  //   }
  //   catch(err){
  //     logger.debug('error -> getIBFTOutgoingConfirmMapping');
  //     logger.debug(err);
  //     return null;
  //   }
  // }

  // asyncOFTCreditConsunerResponse(responsePayload) {

  //   try {

  //     let transactionDetails = {};


  //      transactionDetails.fed = responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
  //           return param.Key == 'FED';
  //         })?.Value || '0.00';

  //       transactionDetails.wht =
  //       responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
  //           return param.Key == 'WHT';
  //         })?.Value || '0.00';

  //       transactionDetails.fee = responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
  //           return param.Key == 'Fee';
  //         })?.Value || '0.00';

  //       transactionDetails.commission = responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
  //           return param.Key == 'Commission';
  //         })?.Value || '0.00';

  //       transactionDetails.deduction = responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
  //           return param.Key == 'Deduction';
  //         })?.Value || '0.00';

  //       transactionDetails.amount = responsePayload?.Result?.ResultParameters?.ResultParameter?.find((param) => {
  //           return param.Key == 'Amount';
  //         })?.Value || '0.00';

  //   } catch (error) {
  //     logger.error(
  //       'exception in dataMapping.initTransDirectIBFTIncomingResponse: ' + error.message
  //     );
  //     return null;
  //   }



  // }
  getInitTransDonationResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getInitTransDonationResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.txType = "Donation";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Pending';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        //initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.senderName = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "true";
        initTransData.txCategory = "Donation";
        initTransData.useCase = data.Header.UseCase;
        initTransData.fee = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        if (data.CustomObject) {
          logger.debug("Reading from custom obj")
          if (data.CustomObject.orgShortCode) {
            initTransData.contextData.rxDetails.orgShortCode = data.CustomObject.orgShortCode;
          }
          else {
            initTransData.contextData.rxDetails.orgShortCode = "";
          }
          if (data.CustomObject.donationType) {
            initTransData.contextData.rxDetails.donationType = data.CustomObject.donationType;
          }
          else {
            initTransData.contextData.rxDetails.donationType = "";
          }
          if (data.CustomObject.orgName) {
            initTransData.contextData.rxDetails.orgName = data.CustomObject.orgName;
          }
          else {
            initTransData.contextData.rxDetails.orgName = "";
          }
          initTransData.contextData.header = "Donation - " + initTransData.contextData?.rxDetails?.orgName || '';
          initTransData.contextData.footer = initTransData.contextData.rxDetails.donationType;
        }
        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        initTransData.txCategoryLabel = initTransData.contextData?.rxDetails?.orgName || ''
        // let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        // if(trxCategoryMapping && trxCategoryMapping!=null){
        //   initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        // }
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };

      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug(err);
      return null;
    }


  }
  getInitTransMRRequest2PayResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getInitTransMRRequest2PayResponse');
      logger.debug(data);
      const senderMSISDN = data.Header.Identity.Initiator.Identifier;
      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = senderMSISDN;
        initTransData.txType = "Request2Pay";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Pending';
        initTransData.isReciever = "true";
        initTransData.isRefundable = "true";
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        //initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.senderMsisdn = senderMSISDN
        initTransData.senderName = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "true";
        initTransData.txCategory = "Request2Pay";
        initTransData.fee = Number(data.Result?.Parameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        initTransData.contextData.rxDetails = data.rxDetails || {};
        initTransData.contextData.rxDetails.msisdn = data.Header.Identity.ReceiverParty.Identifier;
        initTransData.contextData.rxDetails.MDRFee = 0;
        initTransData.contextData.rxDetails.showMDRFee = "false";
        initTransData.contextData.header = "Payment Request";
        initTransData.contextData.footer = data.Header.Identity.ReceiverParty.Identifier;
        //Adding labels
        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };

      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug(err);
      return null;
    }


  }

  async insuranceSubscriptionPaymentInitResponseMapping(data) {
    let initTransData = {};
    try {
      logger.debug({ event: 'Entered function', functionName: 'insuranceSubscriptionPaymentInitResponseMapping in class dataMapping', data });
      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        initTransData.msisdn_txID = `${data.Header.Identity.Initiator.Identifier}_${data.Result.TransactionID}`
        initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Pending';
        initTransData.txType = data.Header.UseCase;
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.amount = Number(data.Request.Transaction.Parameters.Parameter.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = data.Request.Transaction.Parameters.Parameter.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.senderName = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initTransData.debit = data.Request.Transaction.CommandID == "InitTrans_RefundMerchantPayment" ? "false" : "true";
        initTransData.isRepeatable = "false";
        initTransData.isReciever = "true";
        initTransData.useCase = data.Header.UseCase;
        initTransData.fee = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        initTransData.txCategory = "Banking & Finance";
        let rxDetails = {};
        if (data.Request.Transaction.CommandID == "InitTrans_RefundMerchantPayment") {
          rxDetails.msisdn = data.CustomObject?.originalSenderMsisdn;
          rxDetails.planID = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'planID'; })?.Value || 0);
          rxDetails.subscriptionID = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'subscriptionID'; })?.Value || 0);
          initTransData.amount = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
          let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
          if (trxCategoryMapping && trxCategoryMapping != null) {
            initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
          }
        } else {
          rxDetails.msisdn = data.Header.Identity.ReceiverParty.Identifier;
          rxDetails.planID = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'planID'; })?.Value || 0);
          rxDetails.pulse = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'pulse'; })?.Value || '');
          rxDetails.premium = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'premium'; })?.Value || 0);
          rxDetails.duration = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'duration'; })?.Value || 0);
          rxDetails.planName = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'planName'; })?.Value || '');

          if (data.Request.Transaction.CommandID == "InitTrans_AutoRepayLoan") {
            initTransData.txCategoryLabel = rxDetails.planName + " Monthly Payment "
          } else {
            initTransData.txCategoryLabel = rxDetails.planName //Need to show company name thats why txCategoryLabel is empty in mapping sheet
          }
        }
        initTransData.contextData.rxDetails = rxDetails;
        initTransData.contextData.header = "Life Insurance - Insurance Type";
        initTransData.contextData.footer = String(rxDetails.planID);
        //Adding labels
        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }

        logger.debug({ event: 'Exited function', functionName: 'dataMapping.insuranceSubscriptionPaymentInitResponseMapping in class dataMapping', initTransData });
        return { initTransData };
      } else {
        return null;
      }
    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'dataMapping.insuranceSubscriptionPaymentInitResponseMapping in class dataMapping', error: { message: error.message, stack: error.stack } })
      return null;
    }
  }

  async insuranceSubscriptionConfirmTransResponseMapping(data) {
    let confirmData = {};
    try {
      logger.debug('Inside the Data Mapping function-> insuranceSubscriptionConfirmTransResponseMapping');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        confirmData = _.cloneDeep(templates.TRX_HISTORY);
        confirmData.msisdn = data.Header.Identity?.Initiator.Identifier;
        confirmData.txType = "ConfirmTransaction";
        confirmData.txID = data.Result.TransactionID;
        confirmData.txStatus = 'Complete';
        confirmData.contextData.ocvID = data.Request.Transaction.OriginatorConversationID || '';
        logger.debug("contextData");
        logger.debug(confirmData);
        return { confirmData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -> insuranceSubscriptionConfirmTransResponseMapping');
      logger.debug(err.message);
      return null;
    }
  }

  async cardOrderingPaymentResponseMapping(data) {
    let initTransData = {};
    try {
      logger.debug({ event: 'Entered function', functionName: 'cardOrderingPaymentResponseMapping in class dataMapping', data });
      if (data.Result.ResultCode == 0) {
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        initTransData.msisdn_txID = `${data.Header.Identity.Initiator.Identifier}_${data.Result.TransactionID}`
        initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Pending';
        initTransData.txType = data.Header.UseCase;
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.amount = Number(data.Request.Transaction.Parameters.Parameter.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data.Result.ResultParameters.ResultParameter.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = data.Request.Transaction.Parameters.Parameter.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.senderName = data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'SenderName'; })?.Value || '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "false";
        initTransData.isReciever = "true";
        initTransData.useCase = data.Header.UseCase;
        initTransData.fee = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        initTransData.txCategory = "Banking & Finance";
        let rxDetails = {};
        if (data.Request.Transaction.CommandID == "InitTrans_MerchantPaymentByCustomer") {
          rxDetails.msisdn = data.Header.Identity.ReceiverParty.Identifier;
        }
        if (data.Request.Transaction.CommandID == "InitTrans_RefundMerchantPayment") {
          rxDetails.msisdn = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'receiver'; })?.Value || '');
        }
        rxDetails.cardId = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'cardId'; })?.Value || '');
        rxDetails.cardType = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'cardType'; })?.Value || '');
        rxDetails.cardCategory = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'cardCategory'; })?.Value || '');
        rxDetails.amount = (data.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => { return param.Key == 'amount'; })?.Value || 0);
        initTransData.contextData.rxDetails = rxDetails;
        initTransData.contextData.header = "Card Ordering";
        initTransData.contextData.footer = rxDetails.cardType;
          // Adding label details
          let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
          if(trxTypeMapping && trxTypeMapping !=null){
            initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
          }
          let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
          if(trxCategoryMapping && trxCategoryMapping!=null){
            if (data.Header.UseCase == "RefundCardOrdering") {
              initTransData.txCategoryLabel = "JazzCash "+rxDetails.cardType+" Debit Card"
            }else{
              initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
            }
            
          }
  
        logger.debug({ event: 'Exited function', functionName: 'cardOrderingPaymentResponseMapping in class dataMapping', initTransData });
        return { initTransData };
      } else {
        return null;
      }
    } catch (error) {
      logger.error({ event: 'Error thrown', functionName: 'cardOrderingPaymentResponseMapping in class dataMapping', error: { message: error.message, stack: error.stack } })
      return null;
    }
  }

  async cardOrderingConfirmResponseMapping(data) {
    let confirmData = {};
    try {
      logger.debug('Inside the Data Mapping function-> cardOrderingConfirmResponseMapping');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {
        confirmData = _.cloneDeep(templates.TRX_HISTORY);
        confirmData.msisdn = data.Header.Identity?.Initiator.Identifier;
        confirmData.txType = "ConfirmTransaction";
        confirmData.txID = data.Result.TransactionID;
        confirmData.txStatus = 'Complete';
        confirmData.contextData.ocvID = data.Request.Transaction.OriginatorConversationID || '';
        logger.debug("contextData");
        logger.debug(confirmData);
        return { confirmData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.debug('error -> cardOrderingConfirmResponseMapping');
      logger.debug(err.message);
      return null;
    }
  }

  getInitTransSignUpRewardResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getInitTransSignUpRewardResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {

        initTransData = _.cloneDeep(templates.TRX_HISTORY);

        if (data.Request.Transaction.CommandID == "InitTrans_BusinessCashIn") {
          const channelCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
          initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
          initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
          initTransData.txType = "Signup Reward";
          initTransData.isReciever = "true";
          initTransData.txID = data.Result.TransactionID;
          initTransData.txStatus = 'Complete';
          initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
          initTransData.contextData.cvID = data?.ConversationID || '';
          initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
          initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
          initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
          initTransData.chCode = channelCode;
          initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
          initTransData.senderName = '';
          initTransData.debit = "true";
          initTransData.isRepeatable = "false";
          initTransData.txCategory = data.Header.UseCase;
          initTransData.useCase = data.Header.UseCase;
          initTransData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
          initTransData.commission = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
          if (data.CustomObject) {
            logger.debug("Reading from customObject");
            initTransData.contextData.rxDetails.msisdn = data.CustomObject?.customerMSISDN || '';
          }
          initTransData.contextData.header = "Reward - Sign up"
          initTransData.contextData.footer = 'JazzCash Business'
          //initTransData.contextData.rxDetails.msisdn=data.Header.Identity?.ReceiverParty?.Identifier;
          // Adding label details
          let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
          if (trxTypeMapping && trxTypeMapping != null) {
            initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
          }
          let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
          if (trxCategoryMapping && trxCategoryMapping != null) {
            initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
          }

          logger.debug("contextData");
          logger.debug(initTransData);
          return { initTransData };
        } else {
          return null;
        }
      } else {
        return null;
      }
    } catch (err) {
      logger.debug(err);
      return null;
    }
  }

  getConfirmTransSignUpRewardResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getConfirmTransSignUpRewardResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {

        initTransData = _.cloneDeep(templates.TRX_HISTORY);

        const channelCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.txType = "Signup Reward";
        initTransData.isReciever = "true";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Complete';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = channelCode;
        initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.senderName = '';
        initTransData.debit = "false";
        initTransData.isRepeatable = "false";
        initTransData.txCategory = data.Header.UseCase;
        initTransData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        if (data.CustomObject) {
          logger.debug("Reading from customObject");
          initTransData.contextData.rxDetails.msisdn = data.CustomObject?.customerMSISDN || '';
        }
        initTransData.contextData.header = "Reward - Sign up"
        initTransData.contextData.footer = 'JazzCash Business'
        logger.debug("contextData");
        //reading labels
        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    } catch (err) {
      logger.debug(err);
      return null;
    }
  }

  getUSSDTrxBankCachInResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getUSSDTrxBankCachInResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {

        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        initTransData.msisdn = data.Header.Identity?.PrimaryParty.Identifier;
        initTransData.txType = data.Header.UseCase || '';
        initTransData.isReciever = "false";
        initTransData.txID = data.Result.TransactionID;
        initTransData.msisdn_txID = initTransData.msisdn + "_" + initTransData.txID;
        initTransData.txStatus = 'Complete';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.contextData.cvID = data.Request.Transaction?.ConversationID || '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'amount'; })?.Value || '0');
        initTransData.txEndDate = data?.Request?.Transaction?.Timestamp || '';
        initTransData.chCode = data.Header?.Channel || '';
        initTransData.senderMsisdn = data.Header.Identity?.PrimaryParty.Identifier;
        initTransData.senderName = '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "false";
        initTransData.txCategory = data.Request.Transaction?.CommandID || '';
        //initTransData.fee =  Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => {return param.Key == 'Fee';})?.Value || '0');
        //initTransData.commission =  Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => {return param.Key == 'Comission';})?.Value || '0');
        let resultData = data?.Result?.ResultParameters?.ResultParameter || '';
        initTransData.contextData.rxDetails = resultData;
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    } catch (err) {
      logger.debug(err);
      return null;
    }
  }

  getInitTransInviteAndEarnResponse(data) {
    let initTransData = {};
    try {
      logger.info('Inside the Data Mapping function-> getInitTransInviteAndEarnResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {

        initTransData = _.cloneDeep(templates.TRX_HISTORY);

        if (data.Request.Transaction.CommandID == "InitTrans_BusinessCashIn") {
          const channelCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
          initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
          initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
          initTransData.txType = "Invite And Earn";
          initTransData.isReciever = "true";
          initTransData.txID = data.Result.TransactionID;
          initTransData.txStatus = 'Complete';
          initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
          initTransData.contextData.cvID = data?.ConversationID || '';
          initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
          initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
          initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
          initTransData.chCode = channelCode;
          initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
          initTransData.senderName = '';
          initTransData.debit = "false";
          initTransData.isRepeatable = "false";
          initTransData.txCategory = data.Header.UseCase;
          initTransData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
          initTransData.commission = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
          if (data.CustomObject) {
            logger.debug("Reading from customObject");
            initTransData.contextData.rxDetails.msisdn = data.CustomObject?.invitedByMsisdn || '';
            initTransData.contextData.header = "Reward - Invite & Earn"
            initTransData.contextData.footer = data.CustomObject?.invitedByMsisdn || '';
          }
          //initTransData.contextData.rxDetails.msisdn=data.Header.Identity?.ReceiverParty?.Identifier;
          //reading labels
          let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
          if (trxTypeMapping && trxTypeMapping != null) {
            initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
          }
          let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
          if (trxCategoryMapping && trxCategoryMapping != null) {
            initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
          }
          logger.info("contextData");
          logger.info(initTransData);
          return { initTransData };
        } else {
          return null;
        }
      } else {
        return null;
      }
    } catch (err) {
      logger.debug(err);
      return null;
    }
  }

  getConfirmTransInviteAndEarnResponse(data) {
    let initTransData = {};
    try {
      logger.debug('Inside the Data Mapping function-> getConfirmTransInviteAndEarnResponse');
      logger.debug(data);
      if (data.Result.ResultCode == 0) {

        initTransData = _.cloneDeep(templates.TRX_HISTORY);

        const channelCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ChannelCode'; })?.Value || '0';
        initTransData.msisdn_txID = data.Header.Identity?.Initiator.Identifier + "_" + data.Result.TransactionID;
        initTransData.msisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.txType = "Invite And Earn";
        initTransData.isReciever = "true";
        initTransData.txID = data.Result.TransactionID;
        initTransData.txStatus = 'Complete';
        initTransData.contextData.ocvID = data.Request.Transaction?.OriginatorConversationID || '';
        initTransData.contextData.cvID = data?.ConversationID || '';
        initTransData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = channelCode;
        initTransData.senderMsisdn = data.Header.Identity.Initiator.Identifier;
        initTransData.senderName = '';
        initTransData.debit = "true";
        initTransData.isRepeatable = "false";
        initTransData.txCategory = data.Header.UseCase;
        initTransData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Fee'; })?.Value || '0');
        initTransData.commission = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'Commission'; })?.Value || '0');
        if (data.CustomObject) {
          logger.debug("Reading from customObject");
          initTransData.contextData.rxDetails.msisdn = data.CustomObject?.invitedByMsisdn || '';
          initTransData.contextData.header = "Reward - Invite & Earn"
          initTransData.contextData.footer = data.CustomObject?.invitedByMsisdn || '';
        }
        //reading labels
        let trxTypeMapping = trxMappingHandler.resolveTxnType(data.Header.UseCase, initTransData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(data.Header.UseCase, initTransData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.debug("contextData");
        logger.debug(initTransData);
        return { initTransData };
      } else {
        return null;
      }
    } catch (err) {
      logger.debug(err);
      return null;
    }
  }

  async cardOrderChargeWithoutMPINResponseMapping(data) {
    let confirmData = {};
    try {
      logger.info('Inside the Data Mapping function-> cardOrderChargeWithoutMPINResponseMapping');
      logger.info(data);
      if (data.Result.ResultCode == 0) {
        confirmData = _.cloneDeep(templates.TRX_HISTORY);
        confirmData.msisdn = data.Header.Identity?.Initiator.Identifier;
        confirmData.txType = "CardOrderChargeWithoutMPIN";
        confirmData.txID = data.Result.R5ResultBody.TransactionID;
        confirmData.txStatus = 'Complete';
        confirmData.fee = data.Result.R5RequestBody.Parameters.Amount;
        confirmData.contextData.ocvID = data.Request.Transaction.OriginatorConversationID || '';
        logger.info("contextData");
        logger.info(confirmData);
        return { confirmData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.info('error -> cardOrderChargeWithoutMPINResponseMapping');
      logger.info(err.message);
      return null;
    }
  }

  async reverseTransactionResponseMapping(data) {
    let confirmData = {};
    try {
      logger.info('Inside the Data Mapping function-> reverseTransactionResponseMapping');
      logger.info(data);//Fund Adjustment ->Refund
      if (data.Result.ResultCode == 0) {
        confirmData = _.cloneDeep(templates.TRX_HISTORY);
        confirmData.msisdn = data.Header.Identity?.Initiator.Identifier;
        confirmData.txType = "reverseTransaction";
        confirmData.txID = data.Result.R5ResultBody.OriginalReceiptNumber;
        confirmData.txStatus = 'Complete';
        confirmData.debit = 'false';
        confirmData.fee = data.Result.R5ResultBody.OriginalAmount;
        confirmData.contextData.ocvID = data.Request.Transaction.OriginatorConversationID || '';
        //reading labels
        let trxTypeMapping = trxMappingHandler.resolveTxnType(confirmData.txType, confirmData.debit)
        if (trxTypeMapping && trxTypeMapping != null) {
          confirmData.txTypeLabel = trxTypeMapping.txnTypeLabel
        }
        let trxCategoryMapping = trxMappingHandler.resolveTxnCategory(confirmData.txType, confirmData.debit)
        if (trxCategoryMapping && trxCategoryMapping != null) {
          confirmData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
        }
        logger.info("contextData");
        logger.info(confirmData);
        return { confirmData };
      } else {
        return null;
      }
    }
    catch (err) {
      logger.info('error -> reverseTransactionResponseMapping');
      logger.info(err.message);
      return null;
    }
  }

  async payoneerTransactionSuccessResponseMapping(data) {
    let initTransData = {};
    try {
      logger.info('Inside the Data Mapping function-> payoneerTransactionSuccessResponseMapping');
      logger.info(data);
      initTransData = _.cloneDeep(templates.TRX_HISTORY);
      initTransData.msisdn_txID = data.msisdn + "_" + data.txID;
      initTransData.msisdn = data.msisdn;
      initTransData.txType = "PayoneerTransaction";
      initTransData.isReciever = "false";
      initTransData.txID = data.txID;
      initTransData.txStatus = 'Complete';
      initTransData.amount = Number(data.amountInPKR);
      initTransData.fee = 0;
      initTransData.txEndDate = data.txEndDate
      initTransData.txEndTime = data.txEndTime
      initTransData.chCode = "Mobile";
      initTransData.senderName = 'Payoneer';
      initTransData.debit = "false";
      initTransData.txCategory = "Payoneer";
      initTransData.useCase = "PayoneerTransaction"
      initTransData.contextData.header = "Money Transfers"
      initTransData.contextData.footer = "Payoneer - " + data.currency
      initTransData.isRepeatable = "false"
      initTransData.contextData.rxDetails = data
      //reading labels
      let trxTypeMapping = trxMappingHandler.resolveTxnType("PayoneerTransaction", initTransData.debit)
      if (trxTypeMapping && trxTypeMapping != null) {
        initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
      }
      let trxCategoryMapping = trxMappingHandler.resolveTxnCategory("PayoneerTransaction", initTransData.debit)
      if (trxCategoryMapping && trxCategoryMapping != null) {
        initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
      }
      logger.info(initTransData);
      return { initTransData };
    }
    catch (err) {
      logger.info('error -> payoneerTransactionSuccessResponseMapping');
      logger.info(err.message);
      return null;
    }
  }

  async cashToGoodConfirmSuccessResponseMapping(data) {

    logger.info({
      event: 'Entered function',
      functionName: 'dataMapping.cashToGoodConfirmSuccessResponseMapping',
      data: data
    });

    let confirmData = {};

    try {

      confirmData = _.cloneDeep(templates.TRX_HISTORY);

      confirmData.senderMsisdn = data.Header.Identity?.Initiator.Identifier;
      confirmData.msisdn = data.Header.Identity?.Initiator.Identifier;

      confirmData.senderName = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
        return param.Key == 'senderName';
      })?.Value || '';

      confirmData.txType = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
        return param.Key == 'txType';
      })?.Value || '';

      confirmData.txTypeLabel = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
        return param.Key == 'txTypeLabel';
      })?.Value || '';

      confirmData.txID = data.Result.TransactionID;
      confirmData.debit = "true";
      confirmData.isReciever = "true";
      confirmData.contextData.ocvID = data.Request.Transaction.OriginatorConversationID || '';

      confirmData.txEndDate = data.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'TransEndDate';
      })?.Value || '';

      confirmData.txEndTime = data.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'TransEndTime';
      })?.Value || '';

      confirmData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Fee';
      })?.Value || '0.00');

      confirmData.commission = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Commission';
      })?.Value || '0.00');

      confirmData.amount = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Amount';
      })?.Value || '0.00');

      confirmData.chCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => {
        return param.Key == 'ChannelCode';
      })?.Value || '0';

      confirmData.contextData.rxDetails.msisdn = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
        return param.Key == 'receiverMsisdn';
      })?.Value || '';

      confirmData.contextData.rxDetails.name = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
        return param.Key == 'receiverName';
      })?.Value || '';

      confirmData.txCategory = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
        return param.Key == 'txCategory';
      })?.Value || '';

      confirmData.txCategoryLabel = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
        return param.Key == 'txCategoryLabel';
      })?.Value || '';

      confirmData.contextData.rxDetails.merchantCategory = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
        return param.Key == 'categoryName';
      })?.Value || '';

      confirmData.contextData.header = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
        return param.Key == 'header';
      })?.Value || '';

      confirmData.contextData.footer = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
        return param.Key == 'footer';
      })?.Value || '';

      confirmData.contextData.rxDetails.requestID = data?.CustomObject?.requestID || '';

      confirmData.txStatus = 'Complete';

      return { confirmData }

    } catch (error) {

      logger.error({
        event: 'Exited function with error',
        functionName: 'dataMapping.cashToGoodConfirmSuccessResponseMapping',
        error: error
      });

      return null;

    }

  }

  async cashToGoodConfirmSuccessRedeemResponseMapping(data) {

    logger.info({
      event: 'Entered function',
      functionName: 'dataMapping.cashToGoodConfirmSuccessRedeemResponseMapping',
      data: data
    });

    let confirmData = {};

    try {

      confirmData = _.cloneDeep(templates.TRX_HISTORY);

      confirmData.senderMsisdn = data.Header.Identity?.Initiator.Identifier;
      confirmData.msisdn = data.Header.Identity?.Initiator.Identifier;

      confirmData.txType = data.Header.UseCase;

      confirmData.txID = data.Result.TransactionID;
      confirmData.contextData.ocvID = data.Request.Transaction.OriginatorConversationID || '';

      confirmData.txEndDate = data.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'TransEndDate';
      })?.Value || '';

      confirmData.txEndTime = data.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'TransEndTime';
      })?.Value || '';

      confirmData.amount = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Amount';
      })?.Value || '0.00');

      confirmData.chCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => {
        return param.Key == 'ChannelCode';
      })?.Value || '0';

      confirmData.txStatus = 'Complete';

      return { confirmData }

    } catch (error) {

      logger.error({
        event: 'Exited function with error',
        functionName: 'dataMapping.cashToGoodConfirmSuccessRedeemResponseMapping',
        error: error
      });

      return null;

    }

  }

  async cashToGoodRefundSuccessResponseMapping(data) {

    logger.info({
      event: 'Entered function',
      functionName: 'dataMapping.cashToGoodRefundSuccessResponseMapping',
      data: data
    });

    let confirmData = {};

    try {

      confirmData = _.cloneDeep(templates.TRX_HISTORY);

      // only save transaction history when history flag is present

      if (data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
        return param.Key == 'history';
      })?.Value) {

        logger.info({
          event: 'History flag is present in payload',
          functionName: 'dataMapping.cashToGoodRefundSuccessResponseMapping'
        });

        confirmData.senderMsisdn = data.Header.Identity?.Initiator.Identifier;
        confirmData.msisdn = data.Header.Identity?.Initiator.Identifier;

        confirmData.senderName = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
          return param.Key == 'senderName';
        })?.Value || '';

        confirmData.txType = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
          return param.Key == 'txType';
        })?.Value || '';

        confirmData.txTypeLabel = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
          return param.Key == 'txTypeLabel';
        })?.Value || '';

        confirmData.txID = data.Result.TransactionID;
        confirmData.debit = "true";
        confirmData.isReciever = "true";
        confirmData.contextData.ocvID = data.Request.Transaction.OriginatorConversationID || '';

        confirmData.txEndDate = data.Result?.ResultParameters?.ResultParameter?.find((param) => {
          return param.Key == 'TransEndDate';
        })?.Value || '';

        confirmData.txEndTime = data.Result?.ResultParameters?.ResultParameter?.find((param) => {
          return param.Key == 'TransEndTime';
        })?.Value || '';

        confirmData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
          return param.Key == 'Fee';
        })?.Value || '0.00');

        confirmData.commission = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
          return param.Key == 'Commission';
        })?.Value || '0.00');

        confirmData.amount = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
          return param.Key == 'Amount';
        })?.Value || '0.00');

        confirmData.chCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => {
          return param.Key == 'ChannelCode';
        })?.Value || '0';

        confirmData.contextData.rxDetails.msisdn = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
          return param.Key == 'receiverMsisdn';
        })?.Value || '';

        confirmData.contextData.rxDetails.name = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
          return param.Key == 'receiverName';
        })?.Value || '';

        confirmData.txCategory = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
          return param.Key == 'txCategory';
        })?.Value || '';

        confirmData.txCategoryLabel = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
          return param.Key == 'txCategoryLabel';
        })?.Value || '';

        confirmData.contextData.rxDetails.merchantCategory = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
          return param.Key == 'categoryName';
        })?.Value || '';

        confirmData.contextData.header = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
          return param.Key == 'header';
        })?.Value || '';

        confirmData.contextData.footer = data?.Request?.Transaction?.ReferenceData?.ReferenceItem?.find((param) => {
          return param.Key == 'footer';
        })?.Value || '';

        confirmData.contextData.rxDetails.requestID = data?.CustomObject?.requestID || '';

        confirmData.txStatus = 'Complete';

        return { confirmData }

      } else {

        logger.info({
          event: 'History flag is NOT present in payload',
          functionName: 'dataMapping.cashToGoodRefundSuccessResponseMapping'
        });

        return null;

      }

    } catch (error) {

      logger.error({
        event: 'Exited function with error',
        functionName: 'dataMapping.cashToGoodRefundSuccessResponseMapping',
        error: error
      });

      return null;

    }

  }
  
  async nanoLoanConfirmRepaymentSuccessResponseMapping(data) {
    logger.info('Inside the Data Mapping function-> nanoLoanConfirmRepaymentSuccessResponseMapping');
    try {
      logger.info(" Transaction Info ", data);
      let confirmData = _.cloneDeep(templates.TRX_HISTORY);

      data.Request?.Transaction?.ReferenceData?.ReferenceItem?.forEach((param) => {
        if(param.Key == 'beneficiaryName') {
          confirmData.beneficiaryName = param.Value ? param.Value : "JazzCash App";
        };
        if(param.Key === 'txType') { confirmData.txType = param.Value ? param.Value : 'ReadyCash By Alfalah'; };
        if(param.Key === 'txTypeLabel') { confirmData.txTypeLabel = param.Value ? param.Value : 'Loan Repayment'; };
        if(param.Key === 'txCategory') { confirmData.txCategory = param.Value ? param.Value : 'ReadyCash By Alfalah'; };
        if(param.Key === 'txCategoryLabel') { confirmData.txCategoryLabel = param.Value ? param.Value : 'ReadyCash By Alfalah'; };
        if(param.Key === 'header') { confirmData.txType = param.Value ?  param.Value : ""; };
        if(param.Key === 'footer') { confirmData.txType = param.Value ?  param.Value : ""; };
      });

      data.Result?.ResultParameters?.ResultParameter?.forEach((param) => {
        if(param.Key === 'TransEndDate') { confirmData.txEndDate = param.Value ? param.Value : "" };
        if(param.Key === 'TransEndTime') { confirmData.txEndTime = param.Value ? param.Value : "" };
        if(param.Key === 'Fee') { 
          confirmData.fee = param.Value ? param.Value : "" 
        };
        if(param.Key === 'Amount') { 
          confirmData.amount = param.Value ? param.Value : "" 
        };
      });

      
      confirmData.txID = data?.Result?.TransactionID || "";
      confirmData.senderMsisdn = formatNumber(data?.Header?.Identity?.Initiator?.Identifier) || "";
      confirmData.msisdn = formatNumber(data?.Header?.Identity?.Initiator.Identifier) || "";
      confirmData.name = "";
      confirmData.debit = "true";
      confirmData.isReciever = "true";
      confirmData.contextData = {
        ocvID: data?.Request?.Transaction?.OriginatorConversationID || '',
      };

      confirmData.txStatus = 'Complete';
      return { confirmData };
    } catch (error) {

      logger.error({
        event: 'Exited function with error',
        functionName: 'dataMapping.nanoLoanConfirmRepaymentSuccessResponseMapping',
        error: error
      });

      return null;

    }

  }

  async nanoLoanAutoRepaymentSuccessResponseMapping(data) {
    logger.info('Inside the Data Mapping function-> nanoLoanAutoRepaymentSuccessResponseMapping');
    try {
      logger.info(" Transaction Info ", data);

      let confirmData = _.cloneDeep(templates.TRX_HISTORY);

      data.Request?.Transaction?.ReferenceData?.ReferenceItem?.forEach((param) => {
        if(param.Key == 'beneficiaryName') {
          confirmData.beneficiaryName = param.Value ? param.Value : "JazzCash App";
        };
        if(param.Key === 'txType') { confirmData.txType = param.Value ? param.Value : 'ReadyCash By Alfalah'; };
        if(param.Key === 'txTypeLabel') { confirmData.txTypeLabel = param.Value ? param.Value : 'Loan Repayment'; };
        if(param.Key === 'txCategory') { confirmData.txCategory = param.Value ? param.Value : 'ReadyCash By Alfalah'; };
        if(param.Key === 'txCategoryLabel') { confirmData.txCategoryLabel = param.Value ? param.Value : 'ReadyCash By Alfalah'; };
        if(param.Key === 'header') { confirmData.txType = param.Value ?  param.Value : ""; };
        if(param.Key === 'footer') { confirmData.txType = param.Value ?  param.Value : ""; };
      });

      data.Result?.ResultParameters?.ResultParameter?.forEach((param) => {
        if(param.Key === 'TransEndDate') { confirmData.txEndDate = param.Value ? param.Value : "" };
        if(param.Key === 'TransEndTime') { confirmData.txEndTime = param.Value ? thirdPartyMap.Value : "" };
        if(param.Key === 'Fee') { 
          confirmData.fee = param.Value ?  param.Value : "" 
        };
        if(param.Key === 'Amount') { 
          confirmData.amount = param.Value ?  param.Value : "0.00" 
        };
      });
      
      confirmData.txID = data?.Result?.TransactionID || "";
      confirmData.senderMsisdn = formatNumber(data?.Header?.Identity?.Initiator?.Identifier) || "";
      confirmData.msisdn = formatNumber(data?.Header?.Identity?.Initiator.Identifier) || "";
      confirmData.name = "";
      confirmData.debit = "true";
      confirmData.isReciever = "true";
      confirmData.contextData = {
        ocvID: data?.Request?.Transaction?.OriginatorConversationID || '',
      };
      confirmData.txStatus = 'Complete';

      return { confirmData };
    } catch (err) {
      logger.info('error -> getLoanAutoRepayInitTransResponse');
      logger.info(err.message);
      return null;
    }
  }

  async nanoLoanDisburseLoanSuccessResponseMapping(data) {
    logger.info('Inside the Data Mapping function-> nanoLoanDisburseLoanSuccessResponseMapping');
    try {
      logger.info(" Transaction Info ", data);
      let confirmData = _.cloneDeep(templates.TRX_HISTORY);

      data.Request?.Transaction?.ReferenceData?.ReferenceItem?.forEach((param) => {
        if(param.Key === 'senderName') { confirmData.senderMsisdn = param.Value ? param.Value : 'JazzCash App'; };
        if(param.Key === 'senderMsisdn') { confirmData.msisdn = param.Value ? param.Value : 'JazzCash App'; };
        if(param.Key === 'txType') { confirmData.txType = param.Value ? param.Value : 'ReadyCash By Alfalah'; };
        if(param.Key === 'txTypeLabel') { confirmData.txTypeLabel = param.Value ? param.Value : 'Loan Received'; };
        if(param.Key === 'txCategory') { confirmData.txCategory = param.Value ? param.Value : 'ReadyCash By Alfalah'; };
        if(param.Key === 'txCategoryLabel') { confirmData.txCategoryLabel = param.Value ? param.Value : 'ReadyCash By Alfalah'; };
        if(param.Key === 'header') { confirmData.header = param.Value ?  param.Value : ""; };
        if(param.Key === 'footer') { confirmData.footer = param.Value ?  param.Value : ""; };
      });

      data.Result?.ResultParameters?.ResultParameter?.forEach((param) => {
        if(param.Key === 'TransEndDate') { confirmData.txEndDate = param.Value ? param.Value : "" };
        if(param.Key === 'TransEndTime') { confirmData.txEndTime = param.Value ? param.Value : "" };
      });

      data.Request?.Transaction?.Parameters?.Parameter?.forEach((param) => {
        if(param.Key === 'Amount') { confirmData.amount = param.Value ? param.Value : "" };
        if(param.Key === 'Fee') { confirmData.fee = param.Value ? param.Value : "" };
      });
      
      confirmData.msisdn = data?.Header?.Identity?.ReceiverParty?.Identifier;
      confirmData.msisdn_txID = formatNumber(data?.Header?.Identity?.ReceiverParty?.Identifier) + "_" + data?.Result?.TransactionID;
      confirmData.beneficiaryName = data.Header.Identity?.ReceiverParty.Identifier ? data.Header.Identity?.ReceiverParty.Identifier : "";
      confirmData.txID = data?.Result?.TransactionID;
      confirmData.contextData = {
        ocvID: data?.Request?.Transaction?.OriginatorConversationID || '',
        cvID : "" ,
        header : "ReadyCash By Alfalah", 
        footer : "JazzCash App", 
        rxDetails: { 
          requestID: data?.CustomObject?.requestID || "",
          msisdn:  formatNumber(data?.Header?.Identity?.ReceiverParty?.Identifier),
          name: ""
        }
      };
      confirmData.txStatus = 'Complete';
      confirmData.isReciever = "false";
      confirmData.debit = "false";
      confirmData.isRepeatable = "false";
      
      let trxCategoryMapping = trxMappingHandler.resolveTxnCategory("NanoLoanLoanReceived", confirmData.debit);

      if(trxCategoryMapping){
        confirmData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
      }
      return { confirmData };
    }catch (err) {
      logger.info('error -> getLoanManagementInitTransResponse');
      logger.info(err.message);
      return null;
    }
  }
  
  getRemittanceSuccessResponse(data){
    let confirmData = {};
    try {
      logger.info('Inside the Data Mapping function-> getRemittanceSuccessResponse');
      logger.info(data);
      confirmData = _.cloneDeep(templates.TRX_HISTORY);
      confirmData.txID = data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'RemittanceID'; })?.Value || '0';
      confirmData.cnic = data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ReceiverCNIC'; })?.Value || '0';
      confirmData.txStatus = 'Complete';
      logger.info(confirmData);
      return { confirmData };
    }
    catch (err) {
      logger.info('error -> getRemittanceSuccessResponse');
      logger.info(err.message);
      return null;
    }
  }


  getRemittanceSuccessResponse(data){
    let confirmData = {};
    try {
      logger.info('Inside the Data Mapping function-> getRemittanceSuccessResponse');
      logger.info(data);
      confirmData = _.cloneDeep(templates.TRX_HISTORY);
      confirmData.txID = data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'RemittanceID'; })?.Value || '0';
      confirmData.cnic = data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'ReceiverCNIC'; })?.Value || '0';
      confirmData.txStatus = 'Complete';
      logger.info(confirmData);
      return { confirmData };
    }
    catch (err) {
      logger.info('error -> getRemittanceSuccessResponse');
      logger.info(err.message);
      return null;
    }
  }

  getQueryInfoCustomerMapping(data) {

    printLog(
      'Entered function',
      'dataMapping.getQueryInfoCustomerMapping',
      data
    );

    // let confirmData = {};

    try {


      // let customerBasicData = data?.Result?.QueryCustomerInfoResult?.CustomerBasicData;

      // Object.keys(customerBasicData).forEach(key => {

      //   if (['RegistrationDate'].includes(key)) {
      //     confirmData[key] = customerBasicData[key]
      //   }

      // });

      let registrationDate = data?.Result?.QueryCustomerInfoResult?.CustomerBasicData?.RegistrationDate;

      return { registrationDate }

    } catch (error) {

      printError(error, 'dataMapping.getQueryInfoCustomerMapping')

      return {};

    }

  }

  getQueryOrgOperatorInforMapping(data) {

    printLog(
      'Entered function',
      'dataMapping.getQueryOrgOperatorInforMapping',
      data
    );

    try {

      let registrationDate = data?.Result?.QueryOrgOperatorInfoResult?.OrgOperatorBasicData?.CreationDate || "";

      return { registrationDate }

    } catch (error) {

      printError(error, 'dataMapping.getQueryOrgOperatorInforMapping')

      return {};

    }

  }

  sendMoneyToRaastC2BMapping(data) {

    logger.info({
      event: 'Entered function',
      functionName: 'dataMapping.sendMoneyToRaastC2BMapping',
      data: data
    });

    let confirmData = {};

    try {

      confirmData = _.cloneDeep(templates.TRX_HISTORY);

      confirmData.senderMsisdn = data?.Header?.Identity?.Initiator?.Identifier || "";
      confirmData.msisdn = data?.Header?.Identity?.Initiator?.Identifier || "";
      confirmData.txType = data?.Header?.UseCase || "";

      confirmData.txID = data?.Result?.TransactionID || "";

      confirmData.contextData.ocvID = data?.Request?.Transaction?.OriginatorConversationID || '';

      confirmData.chCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => {
        return param.Key == 'ChannelCode';
      })?.Value || '';

      confirmData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'TransEndDate';
      })?.Value || '';

      confirmData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'TransEndTime';
      })?.Value || '';

      confirmData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => {
        return param.Key == 'Amount';
      })?.Value || '0.00');

      confirmData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Fee';
      })?.Value || '0.00');

      confirmData.txCategory = 'Money Transfer';
      confirmData.txTypeLabel = 'Money Transfer';
      confirmData.txCategoryLabel = 'RAAST';
      confirmData.debit = "true";

      let remark = data?.Request?.Transaction?.Remark || "";

      if (remark !== "") {

        // const [senderIban = "", purpose = "", receiverTitle = "", receiverIban = "", bank = "", recipientMobileNumber = ""] = remark.split("|");

        // confirmData.contextData.rxDetails.to = {
        //   senderIban, purpose, receiverTitle, receiverIban, bank, recipientMobileNumber
        // }

        const [senderIban = "", purposeValue = "", name = "", receiverIban = "", bankName = "", receiverMsisdn = ""] = remark.split("|");

        confirmData.contextData.rxDetails = {

          requestID: data?.CustomObject?.requestID || '',
          receiverMsisdn: data?.Header?.Identity?.ReceiverParty?.Identifier || '',
          senderIban, purposeValue, name, receiverIban, bankName, receiverMsisdn, bankAcctNum: receiverIban

        }

      }

      confirmData.txStatus = 'Pending';

      return { confirmData }

    } catch (error) {

      logger.error({
        event: 'Exited function with error',
        functionName: 'dataMapping.sendMoneyToRaastC2BMapping',
        error: error
      });

      return null;

    }

  }

  receiveMoneyFromRaastB2CMapping(data) {

    logger.info({
      event: 'Entered function',
      functionName: 'dataMapping.receiveMoneyFromRaastB2CMapping',
      data: data
    });

    let confirmData = {};

    try {

      confirmData = _.cloneDeep(templates.TRX_HISTORY);

      // transaction history is being populated based on msisdn
      confirmData.senderMsisdn = data?.Header?.Identity?.ReceiverParty?.Identifier || '';
      confirmData.msisdn = data?.Header?.Identity?.ReceiverParty?.Identifier || '';
      confirmData.txType = data?.Header?.UseCase || "";

      confirmData.txID = data?.Result?.TransactionID || "";

      confirmData.contextData.ocvID = data?.Request?.Transaction?.OriginatorConversationID || '';

      confirmData.chCode = data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => {
        return param.Key == 'ChannelCode';
      })?.Value || '';

      confirmData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'TransEndDate';
      })?.Value || '';

      confirmData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'TransEndTime';
      })?.Value || '';

      confirmData.amount = Number(data?.Request?.Transaction?.Parameters?.Parameter?.find((param) => {
        return param.Key == 'Amount';
      })?.Value || '0.00');

      confirmData.fee = Number(data?.Result?.ResultParameters?.ResultParameter?.find((param) => {
        return param.Key == 'Fee';
      })?.Value || '0.00');

      confirmData.txCategory = 'Money Transfer';
      confirmData.txTypeLabel = 'Money Transfer';
      confirmData.txCategoryLabel = 'RAAST';
      confirmData.isReciever = "true";
      confirmData.debit = "false";

      let remark = data?.Request?.Transaction?.Remark || "";

      if (remark !== "") {

        // const [senderTitle = "", senderIban = "", senderBank = "", stan = "", receiverIban = ""] = remark.split("|");

        // confirmData.contextData.rxDetails.to = {
        //   senderTitle, senderIban, senderBank, stan, receiverIban
        // }

        const [name = "", senderIban = "", bankName = "", stan = "", receiverIban = ""] = remark.split("|");

        confirmData.contextData.rxDetails = {
          requestID: data?.CustomObject?.requestID || '',
          receiverMsisdn: data?.Header?.Identity?.ReceiverParty?.Identifier || '',
          name, senderIban, bankName, stan, receiverIban, bankAcctNum: senderIban
        }

      }

      confirmData.txStatus = 'Pending';

      return { confirmData }

    } catch (error) {

      logger.error({
        event: 'Exited function with error',
        functionName: 'dataMapping.receiveMoneyFromRaastB2CMapping',
        error: error
      });

      return null;

    }

  }

  getRaastConfirmResponse(data,type) {

    logger.info({
      event: 'Entered function',
      functionName: 'dataMapping.getRaastConfirmResponse',
      data: data
    });

    // return transaction id and status

    let confirmData = {};

    try {

      if (data?.Result?.ResultCode == 0) {

        confirmData.txID = data?.Result?.TransactionID || "";
        confirmData.msisdn = type === 'c2b' ? data?.Header?.Identity?.Initiator?.Identifier : data?.Header?.Identity?.ReceiverParty?.Identifier;
        confirmData.txStatus = 'Complete';

      } else {

        return null;

      }

      return { confirmData }

    } catch (error) {

      logger.error({
        event: 'Exited function with error',
        functionName: 'dataMapping.getRaastConfirmResponse',
        error: error
      });

      return null;

    }

  }
  async getkTradeInitSuccessResponse(data){
    let initTransData = {};
    try {
      logger.info('Inside the Data Mapping function-> getkTradeInitSuccessResponse');
      logger.info(data);
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        initTransData.msisdn_txID = data.msisdn+"_"+data.txID;
        initTransData.msisdn = data.msisdn;
        initTransData.txType = "kTradeTransaction";
        initTransData.txID = data.txID;
        initTransData.txStatus = 'Pending';
        initTransData.amount = Number(data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.fee = 0;
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = "Mobile";
        initTransData.debit = "false";
        initTransData.contextData.header = "Money Transfer - kTrade";
        initTransData.txCategory = "kTrade";
        initTransData.useCase = "kTrade"
        initTransData.contextData.rxDetails= data
          //reading labels
          let trxTypeMapping = trxMappingHandler.resolveTxnType("kTradeTransaction", initTransData.debit)
          if(trxTypeMapping && trxTypeMapping !=null){
            initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
          }
          let trxCategoryMapping = trxMappingHandler.resolveTxnCategory("kTradeTransaction", initTransData.debit)
          if(trxCategoryMapping && trxCategoryMapping!=null){
            initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
          }
        logger.info(initTransData);
        return { initTransData };
    }
    catch (err) {
      logger.info('error -> payoneerTransactionSuccessResponseMapping');
      logger.info(err.message);
      return null;
    }
  }
  async getkTradeConfirmSuccessResponse(data){
    let initTransData = {};
    try {
      logger.info('Inside the Data Mapping function-> getkTradeInitSuccessResponse');
      logger.info(data);
        initTransData = _.cloneDeep(templates.TRX_HISTORY);
        initTransData.msisdn_txID = data.msisdn+"_"+data.txID;
        initTransData.msisdn = data.msisdn;
        initTransData.txType = "kTradeTransaction";
        initTransData.txID = data.txID;
        initTransData.txStatus = 'Complete';
        initTransData.amount = Number(data.Request?.Transaction?.Parameters?.Parameter?.find((param) => { return param.Key == 'Amount'; })?.Value || '0');
        initTransData.fee = 0;
        initTransData.txEndDate = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndDate'; })?.Value || '';
        initTransData.txEndTime = data?.Result?.ResultParameters?.ResultParameter?.find((param) => { return param.Key == 'TransEndTime'; })?.Value || '';
        initTransData.chCode = "Mobile";
        initTransData.debit = "false";
        initTransData.contextData.header = "Money Transfer - kTrade ";
        initTransData.txCategory = "kTrade";
        initTransData.useCase = "kTrade"
        initTransData.contextData.rxDetails= data
          //reading labels
          let trxTypeMapping = trxMappingHandler.resolveTxnType("kTradeTransaction", initTransData.debit)
          if(trxTypeMapping && trxTypeMapping !=null){
            initTransData.txTypeLabel = trxTypeMapping.txnTypeLabel
          }
          let trxCategoryMapping = trxMappingHandler.resolveTxnCategory("kTradeTransaction", initTransData.debit)
          if(trxCategoryMapping && trxCategoryMapping!=null){
            initTransData.txCategoryLabel = trxCategoryMapping.txnCategoryLabel
          }
        logger.info(initTransData);
        return { initTransData };
    }
    catch (err) {
      logger.info('error -> payoneerTransactionSuccessResponseMapping');
      logger.info(err.message);
      return null;
    }
  }

  async getTXHistoryData(data) {
    try {
      logger.debug({event:'Entered function',functionName:'getTXHistoryData in class DataMapping',data});
      let transactionData = {
        contextData: {}
      };
      
      // Start

      let initTransData = {};
      initTransData = _.cloneDeep(templates.TRX_HISTORY);
      const channelCode = data.Parameters.Parameter.find(elem => elem.Key === 'ChannelCode')?.Value || '0';
      initTransData.msisdn_txID = data.Parameters.Parameter.find(elem => elem.Key === 'ReceiptNumber')?.Value || '';
      initTransData.msisdn = formatNumber(data.Parameters.Parameter.find(elem => elem.Key === 'ReceivingMSISDN')?.Value);
      initTransData.txType = "Money Received";
      initTransData.isReciever = "true";
      initTransData.txID = data.Parameters.Parameter.find(elem => elem.Key === 'ReceiptNumber')?.Value || '';
      initTransData.txStatus = 'Complete';
      initTransData.contextData.ocvID = data?.Request?.Transaction?.OriginatorConversationID || '';
      
      initTransData.amount = Number(data.Parameters.Parameter.find(elem => elem.Key === 'PrincipleTransactionAmount')?.Value || '0');
      initTransData.txEndDate = data.Parameters.Parameter.find(elem => elem.Key === 'Date/Timestamp')?.Value.substring(0, 8) || '';
      initTransData.txEndTime = data.Parameters.Parameter.find(elem => elem.Key === 'Date/Timestamp')?.Value.substring(8, 14) || '';
      initTransData.chCode = channelCode;
      initTransData.senderMsisdn = formatNumber(data?.Header?.Identity?.Initiator.Identifier) || "";
      initTransData.senderName = data?.Parameters?.Parameter.find(elem => elem.Key === 'SenderName')?.Value || '';
      initTransData.debit = "false";
      initTransData.isRepeatable = "false";
      initTransData.txCategory = "Money Transfer";
      initTransData.fee = Number(data.Parameters.Parameter.find(elem => elem.Key === 'Fee')?.Value || "0");
      initTransData.commission = Number(data.Parameters.Parameter.find(elem => elem.Key === 'Commission')?.Value || "0");
      initTransData.contextData.rxDetails = data.CustomObject ? data.CustomObject : {};
      initTransData.contextData.rxDetails.name = data.Parameters.Parameter.find(elem => elem.Key === 'ReceivingIdentityName')?.Value || '';
      initTransData.contextData.rxDetails.msisdn = formatNumber(data.Parameters.Parameter.find(elem => elem.Key === 'ReceivingMSISDN')?.Value);
      initTransData.contextData.header = "Money Received";
      initTransData.contextData.footer = formatNumber(data.Parameters.Parameter.find(elem => elem.Key === 'ReceivingMSISDN')?.Value);
      initTransData.useCase = "Incoming IBFT";
      //fetching Transaction Parent category Type and sub-category Type
      initTransData.txTypeLabel = "Incoming";
      initTransData.txCategoryLabel = "IBFT";
        
      logger.debug({event:'Exited function',functionName:'getTXHistoryData in class DataMapping',initTransData});
      return { data: initTransData };
    
    }
    catch (error) {
      logger.error({event:'Error thrown',functionName:'getTXHistoryData in class DataMapping',error:{message:error.message,stack:error.stack}})
      return { data: {} };
    }
  }

}

export default new dataMapping();
