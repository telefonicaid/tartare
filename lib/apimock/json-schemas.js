'use strict';

var createConfigSchema = {
  "title": "Create mock configuration schema",
  "type": "object",
  "properties": {
    "method": {
      "type": "string",
      "required": true
    },
    "path": {
      "type": "string",
      "required": true
    },
    "binaryBody": {
      "type": "boolean"
    },
    "response": {
      "type": "object",
      "required": true,
      "properties": {
        "statusCode": {
          "type": "integer",
          "required": true
        },
        "headers": {
          "type": "object"
        },
        "body": {
          "type": "string"
        },
        "delay": {
          "type": "integer",
          "minimum": 0
        },
        "chunked": {
          "type": "boolean"
        },
        "charset": {
          "type": "string"
        },
        "binaryBody": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
};

var updateTimeoutSchema = {
  "title": "Update server timeout schema",
  "type": "object",
  "properties": {
    "timeout": {
      "type": "integer",
      "minimum": 0,
      "required": true
    }
  },
  "additionalProperties": false
};


module.exports = {
  createConfig: createConfigSchema,
  updateTimeout: updateTimeoutSchema
};
