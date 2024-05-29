import Ajv from 'ajv';
import _ from 'lodash';
import valueValidator from 'validator';
const baseSchema = require('./baseSchema.json');

// createRequestSchemaID creates a regexp for the method/path
// combination to allow matching urls -> schemas
function createRequestSchemaID(basePath, path, method) {

    // need to check if path is base path to prevent double slashes
    const schemaID = `^${method.toUpperCase()}${basePath}${path === '/' ? '' : path}/?(\\?+.*)?$`;
    return schemaID
        .replace(/{/, '(?<') // replace opening '{' with first part of capture group for path parameters
        .replace(/}/, '>[^/]+/?)'); // replace closing '}' with closing part of capture group for path parameters
}

// compileDefinitions takes the swagger and loops through the definitions adding a schema for each
function compileDefinitions(ajv, swagger) {

    Object.keys(swagger.definitions).forEach((key) => {
        ajv.addSchema(Object.assign({
            $id: `/definitions/${key}`,
            type: 'object'
        }, swagger.definitions[key]));
    });
}

// handleBodyEntry appends an entry to the schemaObject for a body parameter.
function handleBodyEntry(schemaObject, field) {

    const localSchema = _.cloneDeep(schemaObject);
    // logger.debug('localSchema', localSchema);
    // logger.debug('schemaObject', schemaObject);
    if (!localSchema.required.includes('body')) {
        localSchema.required.push('body');
    }

    // body is already set by a ref. ignore new data to prevent override.
    if (localSchema.properties.body.$ref) {
        return localSchema;
    }


    // body is already set by an array ref. ignore new data to prevent override.
    if (localSchema.properties.body.items && localSchema.properties.body.items.$ref) {
        return localSchema;
    }

    if (field.schema && field.schema.$ref) {
        localSchema.properties.body = {
            $ref: field.schema.$ref.substr(1, field.schema.$ref.length - 1)
        };
    } else if (field.schema && field.schema.items && field.schema.items.$ref) {
        localSchema.properties.body.items = {};
        localSchema.properties.body.items.$ref = field.schema.items.$ref.substr(
            1,
            field.schema.items.$ref.length - 1
        );
    } else {
        const currentRequired = localSchema.properties.body.required;
        localSchema.properties.body.required = currentRequired.concat(field.schema.required);
        localSchema.properties.body.properties = Object.assign(
            localSchema.properties.body.properties,
            field.schema.properties
        );
    }
    return localSchema;
}

// handleGenericEntry creates functions to deal with headers/query/path params
function handleGenericEntry(type) {
    return function handleEntry(schemaObject, field) {

        const localSchema = _.cloneDeep(schemaObject);

        if (!localSchema.required.includes(type)) {
            localSchema.required.push(type);
        }
        if (field.required) {
            localSchema.properties[type].required.push(field.name);
        }
        const fields = _.cloneDeep(field);
        delete fields.required;
        localSchema.properties[type].properties[field.name] = fields;
        return localSchema;
    };
}

// creates methods for headers/query/path
// const handleHeaderEntry = handleGenericEntry('headers');
const handleQueryEntry = handleGenericEntry('query');
const handlePathEntry = handleGenericEntry('path');

// compileSchema loops through swagger file routes and creates schemas for each route.
function compileRequestSchema(ajv, swagger) {
    Object.keys(swagger.paths).forEach((path) => {
        Object.keys(swagger.paths[path]).forEach((method) => {
            const schemaFields = swagger.paths[path][method].parameters || [];


            let schemaObject = _.cloneDeep(baseSchema);
            schemaFields.forEach((field) => {
                switch (field.in) {
                    case 'body':
                        schemaObject = handleBodyEntry(schemaObject, field);
                        break;
                        // case 'header':
                        //   schemaObject = handleHeaderEntry(schemaObject, field);
                        //   break;
                    case 'query':
                        schemaObject = handleQueryEntry(schemaObject, field);
                        break;
                    case 'path':
                        schemaObject = handlePathEntry(schemaObject, field);
                        break;
                    default:
                        break;
                }
            });

            ajv.addSchema(Object.assign({ $id: createRequestSchemaID(swagger.basePath, path, method) },
                schemaObject
            ));
        });
    });
}


// buildSchemaValidator builds schema from swagger file
const buildSchemaValidator = (swagger) => {
    try {
        // logger.debug('hello buildSchemaValidator', swagger);
        const ajv = new Ajv({
            allErrors: true,
            formats: {
                int32: valueValidator.isInt,
                int64: valueValidator.isInt,
                url: valueValidator.isURL,
                byte: true
            },
            coerceTypes: true
        });
        compileDefinitions(ajv, swagger);
        compileRequestSchema(ajv, swagger);

        return ajv;
    } catch (err) {
        // if we can't parse schemas, fail fast.
        // logger.debug('err', err);
        logger.error(err);
        return err;
        // return process.exit(1);
    }
};

export default { buildSchemaValidator };