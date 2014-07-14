/*

 Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U

 This file is part of Tartare.

 Tartare is free software: you can redistribute it and/or modify it under the
 terms of the Apache License as published by the Apache Software Foundation,
 either version 2.0 of the License, or (at your option) any later version.
 Tartare is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the Apache License for more details.

 You should have received a copy of the Apache License along with Tartare.
 If not, see http://www.apache.org/licenses/LICENSE-2.0

 For those usages not covered by the Apache License please contact with:
 joseantonio.rodriguezfernandez@telefonica.com

 */

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
