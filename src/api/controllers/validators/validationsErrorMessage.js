import _ajv from 'ajv';
import _ from 'lodash';

const verifySchema = (Schema, requestedJSON) => {
  logger.debug(requestedJSON);
  let result = {};
  const ajv = new _ajv({allErrors:true , useDefaults: true});

  try {
    const validate = ajv.compile(Schema);
    const valid = validate(requestedJSON);
    if (!valid) {
      logger.debug('requested JSON is INVALID!');
      logger.debug(validate.errors);
      logger.debug(
        _.map(validate.errors, function (er) {
          return er.message;
        })
      );
      // eslint-disable-next-line max-len
      result = {
        success: false,
        message: _.map(validate.errors, function (er) {
          return er.message;
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

export default { verifySchema };
