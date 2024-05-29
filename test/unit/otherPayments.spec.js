// var expect = require('chai').expect;
// var request = require('request');
// const dbHandler = require('../db-handler');

// const server = require('../../../server').server;
// const PORT = require('../../../server').PORT;
// const url = "http://localhost:3000"; //+ PORT;

// const queryReq = {
//   "msisdn": "9232192727200",
//   "channelCode": "1020",
//   "paymentDetails": {
//     "consumerRefNum": "3415678906",
//     "companyCode": "3434"
//   }
// };
// const queryHeader = {
//   // "X-MSISDN": "923005067513",
//   // "X-CHANNEL": "Backend Portal",
//   "Content-Type": "application/json",
//   "X-MSISDN": "923219272700",
//   "X-CHANNEL": "apiCaller",
//   "X-APP-TYPE": "test",
//   "X-APP-VERSION": "v2",
//   "X-DEVICE-ID": "12",
//   "X-IP-ADDRESS": "12.3",
// };


// const confirmReq = {
//   "msisdn": "9232192727200",
//   "transactionID": "XD2013012923789234",
//   "MPIN": "encrypted",
//   "channelCode": "1020",
//   "receiverDetails": {
//     "consumerRefNum": "3415678906",
//     "companyCode": "3434",
//     "customerMSISDN": "920341567899"
//   }
// };

// const confirmHeader = {
//   "Content-Type": application / json,
//   "X-MSISDN": 9232192727200,
//   "X-CHANNEL": 1020,
//   "X-MPIN": encrypted,
// };


// describe('Other Payments APIs', function () {
//   this.beforeEach(async () => await dbHandler.connect());

//   /**
//    * Clear all test data after every test.
//    */
//   this.afterEach(async () => await dbHandler.clearDatabase());

//   // /**
//   //  * Remove and close the db and server.
//   //  */
//   this.afterAll(async () => await dbHandler.closeDatabase());

//   describe('Query payments', function () {
//     logger.debug('Query payments----------')
//     it('Status is 200 OK with success message', function (done) {
//       request.get({
//         url: `${url}/rest/api/v1/payment/utility/query?consumerRefNum=00063500003&companyCode=88`,
//         // body: queryReq,
//         headers: queryHeader,
//         json: true
//       }, function (error, response, body) {
//         logger.debug('error', error);
//         expect(response.statusCoode).to.equal(200);
//         expect(response.body.responseCode).to.equal('0');
//         expect(response.body.responseMessage_en).to.equal('Process service request successfully.');
//         done();
//       });
//     });
//   });
//   describe('Confirm Payment', function () {
//     it('Status is 200 OK with success message', function (done) {
//       request.post({
//         url: `${url}/rest/api/v1/payment/other/confirm`,
//         body: confirmReq,
//         headers: confirmHeader,
//         json: true
//       }, function (error, response, body) {
//         logger.debug('error', error);
//         expect(response.statusCode).to.equal(200);
//         expect(response.body.responseCode).to.equal('0');
//         expect(response.body.responseMessage_en).to.equal('Process service request successfully.');
//         done();
//       });
//     });
//   });
//   // Stop the server after testing
//   after(done => {
//     server.close(done);
//   });
// });