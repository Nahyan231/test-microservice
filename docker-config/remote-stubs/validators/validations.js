const _ajv = require('ajv');
const _ = require('lodash');

exports.verifySchema = (Schema, requestedJSON) => {
  logger.debug(requestedJSON);
  let result = {};
  const ajv = _ajv({
    allErrors: true,
  });
  try {
    const validate = ajv.compile(Schema);
    const valid = validate(requestedJSON);
    if (!valid) {
      logger.debug('requested JSON is INVALID!');
      logger.debug(validate.errors);

      result = {
        success: false,
        message: _.map(validate.errors, function (er) {
          let message;
          message = er.dataPath + "  " + er.message;
          return message;
        }),
      };
    } else {
      logger.debug('requested JSON is valid');
      result = {
        success: true,
        message: 'requested JSON is valid',
      };
    }
  } catch (err) {
    result = {
      success: false,
      message: err,
    };
  }
  return result;
};