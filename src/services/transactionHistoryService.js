import _ from 'lodash';
import logger from '../util/logger';
import cache from '../util/cache';
const CACHE_TRANSACTION_TTL = process.env.CACHE_TRANSACTION_TTL || '86400' //24 Hours default
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}
class transactionHistoryService {
    constructor(model) {
        this.transactionHistoryModel = model;
    }

    async updateTxHistoryData(payload) {
        logger.debug({
            event: 'Entered function',
            functionName: 'updateTxHistoryData in class TransactionHistoryService',
            payload
        });
        try {
            let flattenJSON = await this.flatten(payload, null, null);
           // console.log('flattenJSON: ', flattenJSON);
            let query = {
                txID: payload.txID
            };
          //  console.log('Query: ', query);
            let getData = await this.transactionHistoryModel.findOne(query);
      //      console.log('Data : ', getData);
            console.log('Data{} : ', {
                getData
            });
         //   console.log('Data[0] : ', getData[0]);
            let updateData = await this.transactionHistoryModel.updateOne(query, flattenJSON);
            // console.log('updateData: ', {
            //     updateData
            // });
            if (updateData) {
            //    console.log('-----Inside updatedData----');
                let updatedRecord = await this.transactionHistoryModel.find(query, '-_id -__v').lean();
                await this.updateTxHistoryDataInCache(updatedRecord[0]);
                logger.debug({
                    event: `Record updated in Mongo`,
                    updateData
                });
            } else {
                logger.debug({
                    event: 'Record updation failed in Mongo'
                });
            }
            logger.debug({
                event: 'Exited function',
                functionName: 'updateTxHistoryData in class TransactionHistoryService',
                payload
            });
            return true;
        } catch (error) {
            throw new Error(' Error in  updateTxHistoryData ' + error);
        }
        return false;
    }

    async updateRefundStatus(originalTxID, merchantMsisdn) {
        logger.debug({
            event: 'Entered function',
            functionName: 'updateRefundStatus in class TransactionHistoryService',
            originalTxID,
            merchantMsisdn
        });
        try {
            let keyValue = `${merchantMsisdn}_${originalTxID}`;
            logger.debug(keyValue);
            let receiverDetails = await cache.getValue(keyValue, config.cacheTransactionHistory.cacheName);
            logger.debug({
                receiverDetails
            });
            if (receiverDetails) {
                receiverDetails.isRefundable = 'false';
                await cache.putValueWithExpiryRest(keyValue, receiverDetails, config.cacheTransactionHistory.cacheName, CACHE_TRANSACTION_TTL);
            } else {
                return false;
            }
            logger.debug({
                event: 'Exited function',
                functionName: 'updateRefundStatus in class TransactionHistoryService',
                receiverDetails
            });
            return true;
        } catch (error) {
            // logger.error({ event: 'Error thrown', functionName: 'updateRefundStatus in class TransactionHistoryService', error: { message: error.message, stack: error.stack } });
            throw new Error(' Error in  updateRefundStatus ' + error);
        }
        return false;
    }

    // This function is used to flatten out nested JSON objects into dot notation used by mongo
    // the 2nd and 3rd arguments are used in recursive call so in intial call set them to null.
    async flatten(obj, prefix, current) {
        prefix = prefix || [];
        current = current || {};

        // Remember null is also an object!
        if (typeof (obj) === 'object' && obj !== null) {
            Object.keys(obj).forEach(key => {
                this.flatten(obj[key], prefix.concat(key), current);
            });
        } else {
            current[prefix.join('.')] = obj;
        }
        return current;
    }

    async updateTxHistoryDataInCache(payload) {
        try {
            logger.debug({
                event: 'Entered function',
                functionName: 'updateTxHistoryDataInCache in class TransactionHistoryService',
                payload
            });
            let key = payload.msisdn_txID;
            let refundable;
            if (payload.isRefundable === "true") {
                payload.isRefundable = "false";
                refundable = true;
            }
            await cache.putValueWithExpiryRest(key, payload, config.cacheTransactionHistory.cacheName,CACHE_TRANSACTION_TTL);
            if (payload.isReciever === 'true' && payload.contextData.rxDetails.msisdn) {
                logger.debug("Is Reciver True and Msisdn in RxDetails Found")
                // Apply the transaciton history update for merchant as well
                let key2 = `${payload.contextData.rxDetails.msisdn}_${payload.txID}`;
                payload.debit = "false";
                payload.isRepeatable = "false";
                payload.msisdn_txID = key2;
                if (refundable) {
                    payload.isRefundable = "true";
                }
                await cache.putValueWithExpiryRest(key2, payload, config.cacheTransactionHistory.cacheName,CACHE_TRANSACTION_TTL);
            }
            logger.debug({
                event: 'Exited function',
                functionName: 'updateTxHistoryDataInCache in class TransactionHistoryService',
                payload
            });

        } catch (error) {
            //logger.error({ event: 'Error thrown', functionName: 'updateTxHistoryData in class TransactionHistoryService', error: { message: error.message, stack: error.stack } });
            throw new Error(' Error in  updateTxHistoryDataInCache ' + error);
        }
    }
}
export default transactionHistoryService;
