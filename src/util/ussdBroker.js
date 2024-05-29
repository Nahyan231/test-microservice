import Kafka from 'node-rdkafka';


const CONSUMER_GROUP_USSD_ID = process.env.CONSUMER_GROUP_USSD_ID || config.kafkaBroker.consumerConfig.group_id;

class USSDBroker {
  constructor(topicsArray) {

    logger.debug(' USSDBroker kafka consumer constructor called');
    this.consumer =  this._ConnectConsumer(topicsArray);
  }


  _ConnectConsumer(topicsArray) {
    const consumer = new Kafka.KafkaConsumer({
      "debug":config.kafkaBroker.consumerConfig.debug,
      "client.id": config.kafkaBroker.consumerConfig.client_id,
      "group.id":  CONSUMER_GROUP_USSD_ID,  /* config.kafkaBroker.consumerConfig.group_id,*/
      "metadata.broker.list": config.kafkaBroker.consumerConfig.metadata_broker_list,
      "security.protocol": config.kafkaBroker.consumerConfig.security_protocol,
      "sasl.mechanisms": config.kafkaBroker.consumerConfig.sasl_mechanisms,
      "ssl.ca.location": config.kafkaBroker.consumerConfig.ssl_ca_location,
      "sasl.username": config.kafkaBroker.consumerConfig.sasl_username,
      "sasl.password": config.kafkaBroker.consumerConfig.sasl_password,
      "enable.ssl.certificate.verification": false,
      "enable.auto.commit": true,
      "broker.version.fallback": config.kafkaBroker.consumerConfig.broker_version_fallback,  // still needed with librdkafka 0.11.5
      "log.connection.close" : false,
    },{"auto.offset.reset": config.kafkaBroker.consumerConfig.auto_offset_reset});
    //


    // logging all errors
    consumer.on('event.error', function (err) {
      logger.error('error from consumer: %s' + err);
    });

    consumer.on('ready', function (arg) {
      logger.debug('ussd consumer ready' + arg);
     // console.log(JSON.stringify(topicsArray,null,1))
      consumer.subscribe(topicsArray);
      consumer.consume();
    });

    // starting the consumer
    consumer.connect();
    return consumer;
  }



  addConsumerOnDataEvent(func) {

    let consumer = this.consumer;

    consumer.on('data', function (msg) {
     func(msg);
    });


  }

  // try {
  //   const kafka = new Kafka({
  //     logLevel: logLevel.INFO,
  //     ssl: true,
  //     clientId: 'kafka-nodejs-console-sample-consumer--dev41911',
  //     brokers: ['es-1-kafka-bootstrap-es.apps.tjcocp.jazz.com.pk:443'],
  //     ssl: {
  //       rejectUnauthorized: false,
  //       cert: fs.readFileSync('./estest-cert.pem', 'utf-8');
  //     },
  //     sasl: {
  //       mechanism: 'SCRAM-SHA-512', // scram-sha-256 or scram-sha-512
  //       username: 'testkafka',
  //       password: 'C2yxplFZJtmZ'
  //     }
  //   });
  //   const consumer = kafka.consumer({
  //     groupId: 'kafka-nodejs-console-sample-group--dev41911'
  //   });
    
  //   return consumer;
  
  // } catch (error) {
  //   console.log("KAFKA JS CONNNECTIVITY ISSUES!!!")
  //   console.log(error)
  // }


}

export default USSDBroker;