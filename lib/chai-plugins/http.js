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

var chai = require('chai')
  , _ = require('underscore')
  , tartareHttp = require('../http')
  ;
require('buffertools').extend();


chai.use(function(_chai, utils) {
  var Assertion = chai.Assertion;

  Assertion.addMethod('httpMethod', function assertHttpMethod(expectedMethod) {
    var actualMethod = this._obj.method || null;
    var negated = utils.flag(this, 'negate');

    if (!actualMethod) {
      throw new Error('This does not seem to be an HTTP Request');
    }
    if (!expectedMethod) {
      throw new Error('expectedMethod shouldn\'t be falsy');
    }

    this.assert(
      actualMethod === expectedMethod,
      'expected HTTP Method to be #{exp} but it is #{act}',
      'expected HTTP Method to not be #{act}',
      negated ? undefined : expectedMethod,
      actualMethod
    );
  });

  Assertion.addMethod('httpRequestUri', function assertHttpRequestUri(expectedRequestUri) {
    var actualRequestUri = this._obj.requestUri || null;
    var negated = utils.flag(this, 'negate');

    if (!actualRequestUri) {
      throw new Error('This does not seem to be an HTTP Request');
    }
    if (!expectedRequestUri) {
      throw new Error('expectedRequestUri shouldn\'t be falsy');
    }

    this.assert(
      actualRequestUri === expectedRequestUri,
      'expected HTTP Request URI to be #{exp} but it is #{act}',
      'expected HTTP Request URI to not be #{act}',
      negated ? undefined : expectedRequestUri,
      actualRequestUri
    );
  });

  Assertion.addMethod('httpPath', function assertHttpPath(expectedPath) {
    var actualPath = this._obj.path || null;
    var negated = utils.flag(this, 'negate');

    if (!actualPath) {
      throw new Error('This does not seem to be an HTTP Request');
    }
    if (!expectedPath) {
      throw new Error('expectedPath shouldn\'t be falsy');
    }

    this.assert(
      actualPath === expectedPath,
      'expected HTTP Path to be #{exp} but it is #{act}',
      'expected HTTP Path to not be #{act}',
      negated ? undefined : expectedPath,
      actualPath
    );
  });

  Assertion.addMethod('httpStatusCode', function assertHttpStatusCode(expectedStatusCode) {
    var actualStatusCode = this._obj.statusCode || null;
    var negated = utils.flag(this, 'negate');

    if (!actualStatusCode) {
      throw new Error('This does not seem to be an HTTP Response');
    }
    if (!expectedStatusCode) {
      throw new Error('expectedStatusCode shouldn\'t be falsy');
    }

    this.assert(
      actualStatusCode === expectedStatusCode,
      'expected HTTP Status Code to be #{exp} but it is #{act}',
      'expected HTTP Status Code to not be #{act}',
      negated ? undefined : expectedStatusCode,
      actualStatusCode
    );
  });

  Assertion.addMethod('httpHeaders', function assertHttpHeaders(expectedHeaders, valuesCaseInsensitive) {
    var actualHeaders = this._obj.headers;
    var negated = utils.flag(this, 'negate');

    if (!expectedHeaders) {
      throw new Error('expectedHeaders shouldn\'t be falsy');
    }
    if (typeof expectedHeaders === 'string') {
      // expectedHeaders is a header name, without significant value
      expectedHeaders = [ expectedHeaders ];
    }
    if (expectedHeaders instanceof Array) {
      // expectedHeaders is an array of header names, without significant values
      if (expectedHeaders.length === 0) {
        throw new Error('expectedHeaders shouldn\'t be an empty array');
      }
      expectedHeaders = _.object(expectedHeaders, []);  // Create an object with array's elements as keys and undefined as values
    }
    if (Object.keys(expectedHeaders).length === 0) {
      throw new Error('expectedHeaders shouldn\'t be an empty object');
    }

    var lowerCasedActualHeaders = tartareHttp.lowerCaseHeaders(actualHeaders);
    var lowerCasedExpectedHeaders = tartareHttp.lowerCaseHeaders(expectedHeaders);
    for (var headerName in lowerCasedExpectedHeaders) {
      if (lowerCasedExpectedHeaders.hasOwnProperty(headerName)) {
        this.assert(
          lowerCasedActualHeaders.hasOwnProperty(headerName),
          'expected HTTP headers to have a #{exp} header',
          'expected HTTP headers to not have a #{act} header',
          negated ? null : headerName,
          negated ? headerName : null
        );
        if (lowerCasedExpectedHeaders[headerName]) {
          // If header value is null or undefined this assertion doesn't check the header value
          var actualValue = lowerCasedActualHeaders[headerName];
          var expectedValue = lowerCasedExpectedHeaders[headerName];
          if (valuesCaseInsensitive) {
            actualValue = actualValue.toLowerCase();
            expectedValue = expectedValue.toLowerCase();
          }
          this.assert(
            actualValue === expectedValue,
            'expected HTTP header "' + headerName + '" to have value #{exp} but it has value #{act}',
            'expected HTTP header "' + headerName + '" to not have value #{act}',
            lowerCasedExpectedHeaders[headerName],
            lowerCasedActualHeaders[headerName]
          );
        }
      }
    }
  });

  Assertion.addMethod('httpAllowHeader', function assertHttpAllowHeader(expectedAllowHeader) {
    var actualAllowHeader = this._obj.headers.allow || null;
    var negated = utils.flag(this, 'negate');

    if (!expectedAllowHeader) {
      this.assert(
        actualAllowHeader && actualAllowHeader.length > 0,
        'expected HTTP Allow Header to exist',
        'expected HTTP Allow Header to not exist',
        negated ? null : undefined,
        actualAllowHeader
      )
    } else {
      var sortedActualAllowHeader = actualAllowHeader.trim().split(/\s*,\s*/).sort();
      var sortedExpectedAllowHeader = expectedAllowHeader.sort();
      this.assert(
        sortedActualAllowHeader.length === sortedExpectedAllowHeader.length,
        'expected HTTP Allow Header value to have #{exp} methods but it has #{act} methods',
        'expected HTTP Allow Header value to not have #{act} methods',
        sortedExpectedAllowHeader.length,
        sortedActualAllowHeader.length
      );
      for (var i = 0; i < sortedExpectedAllowHeader.length; i++) {
        this.assert(
          sortedActualAllowHeader[i] === sortedExpectedAllowHeader[i],
          'expected HTTP Allow Header value to include #{exp} method',
          'expected HTTP Allow Header value to not include #{exp} method',
          negated? null : sortedExpectedAllowHeader[i],
          actualAllowHeader
        );
      }
    }
  });

  Assertion.addMethod('httpBody', function assertHttpBody(expectedBody) {
    var actualBody = this._obj.body || null;
    var negated = utils.flag(this, 'negate');

    if (!expectedBody) {
      this.assert(
        actualBody && actualBody.length > 0,
        'expected HTTP Body to exist',
        'expected HTTP Body to not exist',
        negated ? null : undefined,
        actualBody
      );
    } else {
      this.assert(
        Buffer.isBuffer(actualBody) ? actualBody.equals(expectedBody) : (actualBody === expectedBody),
        'expected HTTP Body to be #{exp} but it is #{act}',
        'expected HTTP Body to not be #{act}',
        negated ? undefined : expectedBody,
        actualBody
      );
    }
  });

  Assertion.addMethod('httpQueryParams', function assertHttpQueryParams(expectedQueryParams) {
    var actualQueryParams = this._obj.requestUri.indexOf('?') !== -1 ?
      this._obj.requestUri.substring(this._obj.requestUri.indexOf('?') + 1) : '' ;
    var negated = utils.flag(this, 'negate');
    if(!expectedQueryParams) {
      this.assert(
        actualQueryParams.length > 0,
        'expected HTTP Query Params to exist',
        'expected HTTP Query Params to not exist'
      );
    } else {
      this.assert(
        actualQueryParams === expectedQueryParams,
        'expected HTTP Query Params to be #{exp} but is #{act}',
        'expected HTTP Query Params to not be #{act}',
        negated ? undefined : expectedQueryParams,
        actualQueryParams
      );
    }
  });

  Assertion.addProperty('httpChunked', function assertHttpChunked() {
    var lowerCasedHeaders = tartareHttp.lowerCaseHeaders(this._obj.headers);
    var actualChunked = (lowerCasedHeaders['transfer-encoding'] ?
      lowerCasedHeaders['transfer-encoding'].toLowerCase() === 'chunked' :
      false);
    var negated = utils.flag(this, 'negate');

    this.assert(
      actualChunked === true,
      'expected Transfer Encoding to be chunked',
      'expected Transfer Encoding to not be chunked',
      negated ? false : true,
      actualChunked
    );
  });

  Assertion.addMethod('httpCharset', function assertHttpCharset(expectedCharset) {
    var lowerCasedHeaders = tartareHttp.lowerCaseHeaders(this._obj.headers);
    var actualCharset = tartareHttp.getCharsetFromContentType(lowerCasedHeaders['content-type']);
    var negated = utils.flag(this, 'negate');

    if (!expectedCharset) {
      throw new Error('expectedCharset shouldn\'t be falsy');
    }

    this.assert(
      actualCharset === expectedCharset,
      'expected Charset to be #{exp}',
      'expected Charset to not be #{act}',
      negated ? undefined : expectedCharset,
      actualCharset
    );
  });

  Assertion.addMethod('httpUnicaScopes', function assertHttpUnicaScopes(expectedScopes) {
    var negated = utils.flag(this, 'negate');
    var lowerCasedHeaders = tartareHttp.lowerCaseHeaders(this._obj.headers);
    var actualScopes = lowerCasedHeaders['unica-scopes'] || '';
    actualScopes = actualScopes.split(/\s*,\s*/);

    if (!expectedScopes) {
      throw new Error('expectedScopes shouldn\'t be falsy');
    }

    this.assert(
      _.intersection(actualScopes, expectedScopes).length === expectedScopes.length,
      'expected Unica Scopes to be #{exp}',
      'expected Unica Scopes to not be #{act}',
      negated ? undefined : expectedScopes,
      actualScopes
    );
  });

});
