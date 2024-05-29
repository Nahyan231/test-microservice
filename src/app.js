import express from 'express';
import bodyParser from 'body-parser';
import routes from './api/routes/routes';
import logger from './util/logger';
global.logger = logger;
import middleware from './api/middlewares/testMiddleware';
import { logRequestMW } from './api/middlewares';
import path from 'path';
import httpContext from 'express-http-context';
import axiosInterceptor from './util/axiosUtil';
import failedIPNScheduler from './services/schedulers/failedIPNScheduler';
import dbConnection from './util/dbConnection';

logger.debug('printing webserver value' + config.mongodb.host);
logger.debug('Trace message, Winston!');

const app = express();

app.use(middleware.logRequestTime);
app.use(bodyParser.urlencoded({limit: '16mb', extended: true }));
app.use(bodyParser.json({limit: '16mb'}));

app.use(httpContext.middleware);
app.use(logRequestMW);
axiosInterceptor();

const imagePath = path.join(__dirname, '../public/images/');
global.imageDIR = imagePath;
let event = '';

// ********* SAMPLE CODE TESTING
// if (process.env.IS_SUBCRIBER && process.env.IS_SUBCRIBER.toLowerCase() === "true") {
//   const subscriber = new Subscriber();
//   const ussdKafkaSubscriber = new USSDSubscriber();
//   logger.info({
//     event: 'kafka subscriber true conditon',
//     data: process.env.IS_SUBCRIBER
//   });
//   ussdKafkaSubscriber.setConsumer();
//   subscriber.setConsumer();

// } else if (process.env.IS_SUBCRIBER && process.env.IS_SUBCRIBER.toLowerCase() === "false") {

//   logger.info({
//     event: 'kafka subscriber false conditon',
//     data: process.env.IS_SUBCRIBER
//   });
// }





// app.get('/put', async (req, res) => {
//   logger.debug(req.logRequestTime);
//   await Cache.putValue('jk', 'final count', config.cach.cacheName);
//   res.send('value inserted in the data cache');
// });

// app.get('/get', async (req, res) => {
//   logger.debug(req.logRequestTime);
//   let value = await Cache.getValue('jk', config.cache.cacheName);
//   res.send('value fetched from value' + value);
// });

// app.get('/produceinit', async (req, res) => {
//   logger.debug(req.logRequestTime);
//   await subscriber.event.produceMessage('hello init', 'initTopic');
//   res.send('messages produced to Init Topic Kafka');
// });

// app.post('/paymentconfirmkafka', async (req, res) => {
//   logger.debug(req.logRequestTime);
//   await subscriber.event.produceMessage(req.body, 'confirmTransaction');
//   res.send('messages produced to Init Topic Kafka');
// });

// app.post('/utilitybillconfirmkafka', async (req, res) => {
//   logger.debug(req.logRequestTime);
//   await subscriber.event.produceMessage(req.body, 'confirmBillPayment');
//   res.send('messages produced to Init Topic Kafka');
// });

// app.get('/produceconfirm', async (req, res) => {
//   logger.debug(req.logRequestTime);
//   await subscriber.event.produceMessage('hello confirm', 'confirmTopic');
//   res.send('messages produced to Confirm Topic Kafka');
// });

// app.post('/producesignupreward', async (req, res) => {
//   logger.debug(req.logRequestTime);
//   await subscriber.event.produceMessage(req.body, 'signUpRewardSubmit');
//   res.send('messages produced to sign up reward topic Kafka');
// });

// ********* SAMPLE CODE TESTING
// app.post('/produceC2CInitTrans', async (req, res) => {

//   logger.debug(req.logRequestTime);
//   logger.debug("/produceC2CInitTrans");
//   logger.debug(req.logRequestTime);
//   let response = dataMapping.getInitTransB2CResponse(req.body);
//   //let response_Confirm = dataMapping.getSendMoneyConfirmResponse(req.body);
//   // logger.debug("Mapped Response");
//   // logger.debug(response);

//   let transactionService = new transactionHistoryService(transactionHistoryModel.getInstance());
//   let transactionHistoryResponse = await transactionService.addInTransactionHistory(response.initTransData);
//   //let confirmResponse = await transactionService.updateInTransactionHistory(response_Confirm.confirmData);


//   //let upateMongoResponse = await moneyService.addInMongoDB(response.initTransData);
//   //let updateCacheResponse = await moneyService.addCache(response.initTransData,response.initTransData.msisdn);




//   res.status(200).send(transactionHistoryResponse);

// });
/*
app.post('/sendMoneyc2c', async (req, res) => {
   logger.debug(req.logRequestTime);
  await subscriber.event.produceMessage(req.body, 'intTrans_sendMoney_c2c');
  res.send('messages produced to init trans sendMoney c2c topic Kafka');

});
app.post('/sendMoneynic', async (req, res) => {
  logger.debug(req.logRequestTime);
  await subscriber.event.produceMessage(req.body, 'intTrans_sendMoney_cnic');
  res.send('messages produced to init trans sendMoney cnic topic Kafka');

});
app.post('/sendMoneyBank', async (req, res) => {
  logger.debug(req.logRequestTime);
  await subscriber.event.produceMessage(req.body, 'intTrans_sendMoney_bank');
  res.send('messages produced to init trans sendMoney bank topic Kafka');

});
app.post('/sendMoneyConfirm', async (req, res) => {
  logger.debug(req.logRequestTime);
  await subscriber.event.produceMessage(req.body, 'confirm_sendMoney');
  res.send('messages produced to confirm send money topic Kafka');

}); 
app.post('/produceInitJazzPrepaidTopupTransToKafka', async (req, res) => {
  logger.debug(req.logRequestTime);
await subscriber.event.produceMessage(req.body, 'InitiatePrepaidJazzTopupTransaction');
res.send('messages produced to InitiatePrepaidJazzTopupTransaction topic Kafka');

});*/

// app.get('/produceC2CInitTrans', async (req, res) => {
//   logger.debug(req.logRequestTime);
//   await subscriber.event.produceMessage(req.body, config.kafkaBroker.intTrans_sendMoney_c2c);
//   res.send('messages produced to Init Topic Kafka');

// });

// app.get('/produceInitTrans_PayPostPaidBillIndigoTransToKafka', async (req, res) => {
//   logger.debug(req.logRequestTime);
//   await subscriber.event.produceMessage(req.body, config.kafkaBroker.topics.initTrans_postpaidMobileLoad);
//   res.send('messages produced to Init Topic Kafka');

// });

routes(app);

module.exports = () => app;
