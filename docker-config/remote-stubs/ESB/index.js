const {
  heads: {
    RoboHydraHead
  }
} = require('robohydra');
const validations = require("../validators/validations.js");
const schema = require('../validators/schema.json');

const getCNIC = {
  "Response": {
    "ResponseCode": 0,
    "ResponseDesc": "Unknown Type: string,null",
    "ConversationID": "string",
    "OriginatorConversationID": "Unknown Type: string,null",
    "ServiceStatus": 0
  },
  "Result": {
    "ResultType": 0,
    "ResultCode": "string",
    "ResultDesc": "Unknown Type: string,null",
    "OriginatorConversationID": "Unknown Type: string,null",
    "ConversationID": "string",
    "TransactionID": "Unknown Type: string,null",
    "ResultParameters": {
      "ResultParameter": [{
        "Key": "CNIC",
        "Value": "12345"
      }]
    },
    "ReferenceData": {
      "ReferenceItem": [{
        "Key": "string",
        "Value": "string"
      }]
    }
  }
}
const getMSISDNAndCNIC = {
  "Response": {
    "ResponseCode": 0,
    "ResponseDesc": "Unknown Type: string,null",
    "ConversationID": "string",
    "OriginatorConversationID": "Unknown Type: string,null",
    "ServiceStatus": 0
  },
  "Result": {
    "ResultType": 0,
    "ResultCode": "string",
    "ResultDesc": "Unknown Type: string,null",
    "OriginatorConversationID": "Unknown Type: string,null",
    "ConversationID": "string",
    "TransactionID": "Unknown Type: string,null",
    "ResultParameters": {
      "ResultParameter": [{
        "Key": "IdentityStatus",
        "Value": "03"
      },
      {
        "Key": "IsInBlackList",
        "Value": "0"
      },
      {
        "Key": "CNICUsage",
        "Value": "registered"
      },
      {
        "Key": "MPINStatus",
        "Value": "1"
      },

      ]
    },
    "ReferenceData": {
      "ReferenceItem": [{
        "Key": "string",
        "Value": "string"
      }]
    }
  }
}
const getIdentityAndCNIC = {
  "Response": {
    "ResponseCode": 0,
    "ResponseDesc": "Unknown Type: string,null",
    "ConversationID": "string",
    "OriginatorConversationID": "Unknown Type: string,null",
    "ServiceStatus": 0
  },
  "Result": {
    "ResultType": 0,
    "ResultCode": "string",
    "ResultDesc": "Unknown Type: string,null",
    "OriginatorConversationID": "Unknown Type: string,null",
    "ConversationID": "string",
    "TransactionID": "Unknown Type: string,null",
    "ResultParameters": {
      "ResultParameter": [{
        "Key": "IdentityName",
        "Value": "Khaled"
      }]
    },
    "ReferenceData": {
      "ReferenceItem": [{
        "Key": "string",
        "Value": "string"
      }]
    }
  }
};
const getSendMoneyC2CResponse = {

  "Response": {
    "ResponseCode": "0",
    "ResultDesc": "Process service request successfully.",
    "ConversationID": "AG_20130129T102103",
    "OriginatorConversationID": "S_X2013012921001",
    "ServiceStatus": 0
  },
  "Result": {
    "ResultType": 1,
    "ResultCode": "0",
    "ResultDesc": "Process service request successfully.",
    "OriginatorConversationID": "S_X2013012921001",
    "ConversationID": "AG_20130129T102103",
    "TransactionID": "XD2013012923789234",
    "ResultParameters": {
      "ResultParameter": [
        {
          "Key": "TransEndDate",
          "Value": "201010"
        },
        {
          "Key": "TransEndTime",
          "Value": "210159"
        },
        {
          "Key": "Fee",
          "Value": "10.0"
        },
        {
          "Key": "Commission",
          "Value": "0.1"
        },
        {
          "Key": "FED",
          "Value": "0.50"
        },
        {
          "Key": "WHT",
          "Value": "0.30"
        },
        {
          "Key": "BeneficiaryName",
          "Value": "AAA"
        }
      ]
    },
    "ReferenceData": {
      "ReferenceItem": [
        {
          "Key": "test",
          "Value": "0"
        }
      ]
    }
  }


}

const queryBillResponse = {

  "Response": {
    "ResponseCode": "0",
    "ResultDesc": "Process service request successfully.",
    "ConversationID": "AG_20130129T102103",
    "OriginatorConversationID": "S_X2013012921001",
    "ServiceStatus": 0
  },
  "Result": {
    "ResultType": 1,
    "ResultCode": "0",
    "ResultDesc": "Process service request successfully.",
    "OriginatorConversationID": "S_X2013012921001",
    "ConversationID": "AG_20130129T102103",
    "TransactionID": "XD2013012923789234",
    "ResultParameters": {
      "ResultParameter": [
        {
          "Key": "TransEndDate",
          "Value": "201010"
        },
        {
          "Key": "TransEndTime",
          "Value": "210159"
        },
        {
          "Key": "Fee",
          "Value": "10.0"
        },
        {
          "Key": "Commission",
          "Value": "0.1"
        },
        {
          "Key": "FED",
          "Value": "0.50"
        },
        {
          "Key": "WHT",
          "Value": "0.30"
        },
        {
          "Key": "BeneficiaryName",
          "Value": "AAA"
        }
      ]
    },
    "ReferenceData": {
      "ReferenceItem": [
        {
          "Key": "test",
          "Value": "0"
        }
      ]
    }
  }
};

exports.getBodyParts = () => ({
  heads: [
    new RoboHydraHead({
      path: '/sync/getCNIC',
      method: 'POST',
      async handler(req, res) {
        if (req.body.some)
          res.statusCode = 200;
        res.send(JSON.stringify(getCNIC));
      }
    }),
    new RoboHydraHead({
      path: 'sync/getMSISDNAndCNIC',
      method: 'POST',
      async handler(req, res) {
        res.statusCode = 200;
        res.send(JSON.stringify(getMSISDNAndCNIC));
      }
    }),
    new RoboHydraHead({
      path: '/sync/getIdentityAndCNIC',
      method: 'POST',
      async handler(req, res) {
        res.statusCode = 200;
        res.send(JSON.stringify(getIdentityAndCNIC));
      }
    }),
    new RoboHydraHead({
      path: '/rest/api/v1/payment/utility/query',
      method: 'GET',
      async handler(req, res) {
        res.statusCode = 200;
        res.send(JSON.stringify(queryBillResponse));
      }
    }),
    new RoboHydraHead({
      path: 'rest/requestmgrservice/v1/sync/sendMoneyC2C',
      method: 'POST',
      async handler(req, res) {
        const validationResponse = validations.verifySchema(
          schema.ESB_SCHEMA,
          req.body
        );

        if (!validationResponse.success) {
          res.statusCode = 200;
          logger.debug(validationResponse.message);
          return res.send(JSON.stringify(validationResponse));
        } else {
          res.statusCode = 200;
          return res.send(JSON.stringify(getSendMoneyC2CResponse));
        }
      }
    })
  ]
});