import cache from './cache';
import axios from 'axios';
import logger from './logger';
import _ from 'lodash';
import ESBRFiveService from './esbRFiveService';


const COMMANDS_MAP = process.env.COMMANDS || config.esb.commands;
const COMMANDS_MAP_RFIVE = process.env.COMMANDS_MAP_R_FIVE || config.rFive.commands;
const ADD_TO_FAV_LIST = process.env.ACCOUNT_MANAGEMENT_API_ADD_TO_FAV_URL || config.externalServices.accountManagementAPI.favListURL;

class favListHandler {
  constructor() {}

  /**
   * Usecase Error/Success Code
   * @param {Object} data 
   * Data that needs to be part of response
   */
  async addToFavoriteList(data) {
    logger.debug('addToFavoriteList')
     logger.debug(data);

    // let responseCodeObj;

    //Default Response message in case no ResponseCode
    let response = {
      success: false,
      responseCode: config.responseCode.default.code,
      message_en: config.responseCode.default.message,
      message_ur: config.responseCode.default.message,
      data: []
    };

    try {
      //Get Response Code Object From Cache
      // let cacheresponseObj = await cache.getValue(code, config.cache.responseCodeCache);
      // if (!cacheresponseObj) { //If not found in cache get Response Code from Master Data Microservice
        logger.debug("Add To Fav List by Acc Management Microservice");
        const url = ADD_TO_FAV_LIST;
        let axiosResp = await axios.post(url, data);
        if (axiosResp && axiosResp.status == 200) {
          logger.debug('Object added to favorite list');
          let response = {
            success: true,
            message_en:'bill added successfully', 
            message_ur:'bill added successfully', 
          };
        }
      // }
      
      logger.debug("response" + response);
    } catch (err) {
      logger.error("Error adding bill to fav list: " + err);
    }

    return response;
  }

  /**
 * @method
 * Add item to favorite list of the customer
 * @param {*} data should have an array of objects with different key/value pairs in it.
 * @returns {Object} acknowledgement from CPS
 */
  async createFavoritesQR(data) {
    logger.info({
      event: 'Entered function',
      function: 'favListHandler.createFavorites',
      data: data
    });

    const { msisdn } = data;
    try {
      let customerType = "consumerAppFavorite";
      let initiator = COMMANDS_MAP_RFIVE.ManageFavoriteRequest.initiatorIdentifier
      let initiatorSecurityCredential = null;

      if(data.channel.includes("merchantApp")){
        customerType = data.channel;
        initiator = 'ORG'
        initiatorSecurityCredential = 'ORGMPIN'
      }

      let esbRFiveService = new ESBRFiveService();
      const ESBRequestData = await esbRFiveService.createESBRequestObject(
        customerType,
        COMMANDS_MAP_RFIVE.ManageFavoriteRequest,
        COMMANDS_MAP_RFIVE.ManageFavoriteRequest.initiatorIdentifierType,
        initiator,
        initiatorSecurityCredential,
        COMMANDS_MAP_RFIVE.ManageFavoriteRequest.receiverIdentifierType,
        msisdn,
        null,
        null,
        null,
        null
      );
      ESBRequestData.ManageFavoriteRequest = this.formatAdd(data)
      if(!data.channel.includes("merchantApp")){
        ESBRequestData.Identity.Initiator.SecurityCredential =  COMMANDS_MAP_RFIVE.ManageFavoriteRequest.initiatorIdentifierMPIN
      }

      logger.info({
        event: 'Sending Packet to CPS',
        functionName: 'favListHandler.createFavorites',
        data: ESBRequestData,
      });

      let serviceResp = await esbRFiveService.getESBResponse(ESBRequestData);

      logger.info({
        event: 'Response after creating favorite from CPS',
        functionName: 'favListHandler.createFavorites',
        data: serviceResp,
      });

      if (serviceResp &&
        serviceResp.Response &&
        serviceResp.Response.ResponseCode === '0' &&
        serviceResp.Result &&
        serviceResp.Result.ResultCode === '0') {

        //need to add helper class here and response code from masterdata

        logger.info({
          event: 'Response from responseCodeHandler_New function',
          functionName: 'favListHandler.createFavorites',
          data: serviceResp.Result,
        });

        return {
          success: true,
          responseCode: serviceResp?.Response?.ResponseCode,
          message_en: serviceResp?.Response?.ResponseDesc,
          message_ur: serviceResp?.Response?.ResponseDesc,
          data: serviceResp?.Result?.ManageFavoriteResult
        }
      } else {
        logger.info({
          event: "exiting function",
          function: "favListHandler.addFavorite",
          data: serviceResp
        })
        return {
          success: false,
          data: serviceResp
        }
      }
    } catch (error) {
      logger.error({
        event: 'Exited function with error',
        functionName: 'favListHandler.createFavorites',
        error: {
          message: error && error.message ? error.message : "",
          error: error && error.error ? error.error : "",
          stack: error && error.stack ? error.stack : ""
        },
      });

      return { success: false };

    }
  }

  /**
   * @method
   * Manage parameters for Add favorite request
   * @param {*} data
   * @returns 
   */
  formatAdd(data) {
    const { serviceAlias } = data;
    const favoriteName = data.useCase + "-" + data.merchantDetails.tillNumber;

    logger.debug({
      event: "Creating format Add Obj",
      data: data,
      nick: data.favNickName
    })

    const AddParameters = [
      {
        "Key": "FavoriteName",
        "Value": favoriteName
      },
      {
        "Key": "OwnerName",
        "Value": data.merchantDetails.name
      },
      {
        "Key": "Nickname",
        "Value": data.favNickName || data.Fav_Nickname || ''
      },
      {
        "Key": "TillNumber",
        "Value": data.merchantDetails.tillNumber
      },
      {
        "Key": "Usecase",
        "Value": data.useCase
      },
      {
        "Key": "Flow ID",
        "Value": data.flowId || ''
      },
      {
        "Key": "Channel",
        "Value": data.channel
      },
      {
        "Key": "Reg_no",
        "Value": data.amount || ''
      },
      {
        "Key": "UpdateTime",
        "Value": new Date().getTime()
    },
    {
        "Key": "CreationTime",
        "Value": new Date().getTime()
    }
    ];
    return {
      OperationType: "A",
      FavoriteName: favoriteName,
      ServiceAlias: serviceAlias,
      FavoriteUpdateParameters: { AddParameters: AddParameters }
    }
  }

  /**
 * @method
 * Update item in favorite list of the customer
 * @param {*} data should have an array of objects with different key/value pairs in it.
 * @returns {Object} acknowledgement from CPS
 */
  async updateFavoritesQR(data) {
    logger.info({
      event: 'Entered function',
      function: 'favListHandler.updateFavorites',
      data: data
    });

    const { msisdn } = data;
    try {
      let customerType = "consumerAppFavorite";
      let initiator = COMMANDS_MAP_RFIVE.ManageFavoriteRequest.initiatorIdentifier
      let initiatorSecurityCredential = null;

      if(data.channel.includes("merchantApp")){
        customerType = data.channel;
        initiator = 'ORG'
        initiatorSecurityCredential = 'ORGMPIN'
      }

      let esbRFiveService = new ESBRFiveService();
      const ESBRequestData = await esbRFiveService.createESBRequestObject(
        customerType,
        COMMANDS_MAP_RFIVE.ManageFavoriteRequest,
        COMMANDS_MAP_RFIVE.ManageFavoriteRequest.initiatorIdentifierType,
        initiator,
        initiatorSecurityCredential,
        COMMANDS_MAP_RFIVE.ManageFavoriteRequest.receiverIdentifierType,
        msisdn,
        null,
        null,
        null,
        null
      );
      ESBRequestData.ManageFavoriteRequest = this.formatUpdate(data)
      if(!data.channel.includes("merchantApp")){
        ESBRequestData.Identity.Initiator.SecurityCredential =  COMMANDS_MAP_RFIVE.ManageFavoriteRequest.initiatorIdentifierMPIN
      }

      logger.info({
        event: 'Sending Packet to CPS',
        functionName: 'favListHandler.updateFavorites',
        data: ESBRequestData,
      });

      let serviceResp = await esbRFiveService.getESBResponse(ESBRequestData);

      logger.info({
        event: 'Response after creating favorite from CPS',
        functionName: 'favListHandler.updateFavorites',
        data: serviceResp,
      });

      if (serviceResp &&
        serviceResp.Response &&
        serviceResp.Response.ResponseCode === '0' &&
        serviceResp.Result &&
        serviceResp.Result.ResultCode === '0') {

        //need to add helper class here and response code from masterdata

        logger.info({
          event: 'Response from responseCodeHandler_New function',
          functionName: 'favListHandler.updateFavorites',
          data: serviceResp.Result,
        });

        return {
          success: true,
          responseCode: serviceResp?.Response?.ResponseCode,
          message_en: serviceResp?.Response?.ResponseDesc,
          message_ur: serviceResp?.Response?.ResponseDesc,
          data: serviceResp?.Result?.ManageFavoriteResult
        }
      } else {
        logger.info({
          event: "exiting function",
          function: "favListHandler.updateFavorite",
          data: serviceResp
        })
        return {
          success: false,
          data: serviceResp
        }
      }
    } catch (error) {
      logger.error({
        event: 'Exited function with error',
        functionName: 'favListHandler.updateFavorites',
        error: {
          message: error && error.message ? error.message : "",
          error: error && error.error ? error.error : "",
          stack: error && error.stack ? error.stack : ""
        },
      });

      return { success: false };

    }
  }

  /**
   * @method
   * Manage parameters for Update favorite request
   * @param {*} data
   * @returns 
   */
  formatUpdate(data) {
    const { serviceAlias } = data;
    const favoriteName = data.useCase + "-" + data.merchantDetails.tillNumber;

    logger.debug({
      event: "Creating format Update Obj",
      data: data,
      nick: data.favNickName
    })

    //Update Params for CPS
    const UpdateParameters = [
      {
        "Key": "FavoriteName",
        "Value": favoriteName
      },
      {
        "Key": "OwnerName",
        "Value": data.merchantDetails.name
      },
      {
        "Key": "Nickname",
        "Value": data.favNickName || data.Fav_Nickname || ''
      },
      {
        "Key": "TillNumber",
        "Value": data.merchantDetails.tillNumber
      },
      {
        "Key": "Usecase",
        "Value": data.useCase
      },
      {
        "Key": "Flow ID",
        "Value": data.flowId || ''
      },
      {
        "Key": "Channel",
        "Value": data.channel
      },
      {
        "Key": "Reg_no",
        "Value": data.amount || ''
      },
      {
        "Key": "UpdateTime",
        "Value": new Date().getTime()
    }
    ];
    return {
      OperationType: "M",
      FavoriteName: favoriteName,
      ServiceAlias: serviceAlias,
      FavoriteUpdateParameters :  {UpdateParameters : UpdateParameters}
    }
  }
}
export default new favListHandler();