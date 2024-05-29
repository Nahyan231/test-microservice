import Broker from '../util/broker';
import logger from '../util/logger';
import { logType,log } from '../model/logType';


const KAFKA_DRAIN_CHECK = process.env.KAFKA_DRAIN_CHECK || "false";
let instance = null;
class Subscriber {
  constructor() {
    //provide list of topics from which you want to consume messages
    this.event = new Broker([]);
  }

  setConsumer() {

    let requestID = "";
    this.event.addConsumerOnDataEvent(async function (msg) {
      try {

        if (KAFKA_DRAIN_CHECK == "true") {

          //logger.info({ debugMessage: "KAFKA DRAIN CHECK TRUE", topic: msg.topic, msgOffset: msg.offset, partition: msg.partition })
          log(logType.INFO,"setConsumer",logObj,"KAFKA DRAIN CHECK TRUE");

          return;
        }

        if (msg && msg.value && msg.value) {
          let value = JSON.parse(msg.value);
          if (value && value.CustomObject) {
            requestID = value.CustomObject?.requestID || '';
            //logger.log({ message: "Consumer called for Topic " + msg.topic, requestID: requestID, level: 'info', Kafka_Msg: JSON.stringify(value) });
            const logObj = {topic: msg.topic,requestID: requestID,Kafka_Msg: JSON.stringify(value)};
            log(logType.INFO,"setConsumer",logObj,"Consumer called for Topic");
          }

        }


        logger.debug({
          event: 'Eneterd function',
          functionName: 'subscriberService.addConsumerOnDataEvent',
        });
        logger.debug("***** KAFKA Consumer Called ***********");

        logger.debug({
          event: 'Exited function',
          functionName: 'subscriberService',
        });

      } catch (error) {
        //logger.error(error.message);
        logger.error("Error in Subscriber service Request ID " + requestID + " Error " + error.msg + " Error Stack" + error.stack);
      }
    });
  }

  static getInstance() {
    if (!instance) {
      instance = new Subscriber();
    }

    return instance;
  }
}

export default Subscriber;
