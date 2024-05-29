import _ajv from 'ajv';
import _ from 'lodash';
import schema from './schema.json'

const ajv = new _ajv({allErrors:true , useDefaults: true});

function getValidator(schemaName){
  let validate = ajv.getSchema(schemaName)
  if (!validate) {
    ajv.addSchema(schema[schemaName], schemaName)
    validate = ajv.getSchema(schemaName)
  }
  return validate;
}

const verifySchema = (schemaName, requestedJSON) => {
  logger.debug(requestedJSON);
  let result = {};

  try {
    const validate = getValidator(schemaName) //ajv.compile(Schema);
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
