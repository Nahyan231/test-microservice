import Kafka from 'node-rdkafka';
import path from 'path'
import logger from '../util/logger';

const brokers = process.env.KAFKA_BOOTSTRAP_SERVERS || config.brokers.kafkaBroker;
const CONSUMER_GROUP_ID = process.env.CONSUMER_GROUP_ID || config.kafkaBroker.consumerConfig.group_id;



class Broker {
  constructor(topicsArray) {

    logger.debug(' Event Stream constructor called');
    logger.debug('Kafka features: %s' + Kafka.features);
    logger.debug('Kafka brokers: %s' + brokers);
    this.producer = this._ConnectProducer();
    this.consumer = this._ConnectConsumer(topicsArray);
  }


  _ConnectProducer() {
    logger.debug('_connectProducer called');
    var brokerConfig = {
      "bootstrap.servers": config.kafkaBroker.producerConfig.bootstrap_servers,
      "security.protocol": config.kafkaBroker.producerConfig.security_protocol,
      "sasl.mechanisms": config.kafkaBroker.producerConfig.sasl_mechanisms,
      "ssl.ca.location": config.kafkaBroker.producerConfig.ssl_ca_location,
      "sasl.username": config.kafkaBroker.producerConfig.sasl_username,
      "sasl.password": config.kafkaBroker.producerConfig.sasl_password,
      "enable.ssl.certificate.verification": false,
      "broker.version.fallback": config.kafkaBroker.producerConfig.broker_version_fallback,
      "log.connection.close": false
  };


    
    
    brokerConfig.dr_msg_cb = true; // Enable delivery reports with message payload
    var producer = new Kafka.Producer(brokerConfig);

    producer.setPollInterval(config.kafkaBroker.pollInterval);

    // only if debug option set in config
    producer.on('event.log', function (msg) {
      logger.debug('debug from producer:' + msg);
    });

    // logging all errors
    producer.on('event.error', function (err) {
      logger.error('error from producer: %s' + err);
    });

    // wait for the ready event before producing
    producer.on('ready', function (arg) {
      logger.debug('producer ready' + arg);
    });

    // log delivery reports
    producer.on('delivery-report', function (err, dr) {
      if (err) {
        logger.error('Delivery failed: %j' + err);
        // consider retrying
      } else {
        logger.debug('Delivery success: %j' + dr);
      }
    });

    // starting the producer
    producer.connect();

    return producer;
  }


  _ConnectConsumer(topicsArray) {
    const consumer = new Kafka.KafkaConsumer({
      "debug":config.kafkaBroker.consumerConfig.debug,
      "client.id": config.kafkaBroker.consumerConfig.client_id,
      "group.id": CONSUMER_GROUP_ID,
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

    // counter to commit offsets every numMessages are received
    var counter = 0;
    var numMessages = config.kafkaBroker.numMessages;

    consumer.on('ready', function (arg) {
      logger.debug('consumer ready' + arg);

      consumer.subscribe(topicsArray);
      // start consuming messages
      // setInterval(function() {
      //   consumer.consume(10);
      // }, 100);
      consumer.consume();
    });

    /*consumer.on('data', function (m) {
      counter++;

      // committing offsets every numMessages
      if (counter % numMessages === 0) {
        logger.debug('calling commit');
        consumer.commit(m);
      }

      // convert value to JSON (if it is) before logging
      try {
        m.value = JSON.parse(m.value.toString());
      } catch {}

      // convert key to string before logging
      if (m.key) m.key = m.key.toString();

      // Output the actual message contents
      logger.debug('data received value');
      logger.debug(' value is ' + m.value);
      logger.debug(' Printing topic Name' + m.topic);

    });*/

    // starting the consumer
    consumer.connect();
    return consumer;
  }



  addConsumerOnDataEvent(func) {

    //counter to commit offsets every numMessages are received
    var counter = 0;
    var numMessages = config.kafkaBroker.numMessages;
    let consumer = this.consumer;

    consumer.on('data', function (msg) {

      // // committing offsets every numMessages
      // if (counter % numMessages === 0) {
      //   consumer.commit(msg);
      // }
     // logger.debug(msg);
     func(msg);
    });


  }



  produceMessage(msg, topicName) {

    logger.debug(" About to produce message");
    // if partition is set to -1, librdkafka will use the default partitioner
    const partition = -1;
    const value = Buffer.from(JSON.stringify(msg));
    logger.debug('value ' + value);

    try {
      this.producer.produce(topicName, partition, value);

    } catch (err) {
      logger.error('Production failed: %j' + err);
    }

  }


}

export default Broker;