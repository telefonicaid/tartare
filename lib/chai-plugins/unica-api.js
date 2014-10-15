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
  , xml = require('libxmljs')
  , schemas = require('./schemas')
  , tartareHttp = require('../http')
  ;

chai.use(require('chai-json-schema'));


chai.use(function(_chai, utils) {
  var Assertion = chai.Assertion;

  // This is a shortcut for wellFormedJsonApiResponse (backwards compatibility)
  Assertion.addProperty('wellFormedApiResponse', function assertWellFormedApiResponse() {
    var res = this._obj;
    new Assertion(res).to.be.a.wellFormedJsonApiResponse;
  });

  Assertion.addProperty('wellFormedJsonApiResponse', function assertWellFormedJsonApiResponse() {
    var negated = utils.flag(this, 'negate');
    var res = this._obj;

    new Assertion(res).to.have.httpHeaders('content-type');

    var actualContentType = res.headers['content-type'].split(';')[0];
    var expectedContentType = 'application/json';
    this.assert(
      actualContentType === expectedContentType,
      'expected Content-Type header to be #{exp} but is #{act}',
      'expected Content-Type header to not be #{act}',
      negated ? undefined : expectedContentType,
      actualContentType
    );

    // If HTTP Body can be parsed as JSON, it is a JSON document
    var isJson = null;
    try {
      JSON.parse(res.body);
      isJson = true;
    } catch (err) {
      isJson = false;
    }
    this.assert(
      isJson === true,
      'expected Response Body to be a valid JSON document but is #{act}',
      'expected Response Body to not be a valid JSON document',
      undefined,
      res.body
    );
  });

  Assertion.addProperty('wellFormedXmlApiResponse', function assertWellFormedXmlApiResponse() {
    var negated = utils.flag(this, 'negate');
    var res = this._obj;

    new Assertion(res).to.have.httpHeaders('content-type');

    var actualContentType = res.headers['content-type'].split(';')[0];
    var expectedContentTypes = [ 'application/xml', 'text/xml' ];
    this.assert(
      expectedContentTypes.indexOf(actualContentType) !== -1,
      'expected Content-Type header to be one of #{exp} but is #{act}',
      'expected Content-Type header to not be #{act}',
      negated ? undefined : expectedContentTypes,
      actualContentType
    );

    // If HTTP Body can be parsed as XML, it is an XML document
    var isXml = null;
    try {
      xml.parseXmlString(res.body);
      isXml = true;
    } catch (err) {
      isXml = false;
    }
    this.assert(
      isXml === true,
      'expected Response Body to be a valid XML document but is #{act}',
      'expected Response Body to not be a valid XML document',
      undefined,
      res.body
    );
  });

  Assertion.addProperty('wellFormedSoap11ApiResponse', function assertWellFormedSoap11ApiResponse() {
    var negated = utils.flag(this, 'negate');
    var res = this._obj;

    new Assertion(res).to.have.httpHeaders('content-type');

    var actualContentType = res.headers['content-type'].split(';')[0];
    var expectedContentType = 'text/xml';
    this.assert(
      actualContentType === expectedContentType,
      'expected Content-Type header to be #{exp} but is #{act}',
      'expected Content-Type header to not be #{act}',
      negated ? undefined : expectedContentType,
      actualContentType
    );

    var isXml = null
      , xmlDoc = null
      ;

    // If HTTP Body can be parsed as XML, it is the first step to be a SOAP message
    try {
      xmlDoc = xml.parseXmlString(res.body);
      isXml = true;
    } catch (err) {
      isXml = false;
    }
    this.assert(
      isXml === true,
      'expected Response Body to be a valid XML document but is #{act}',
      'expected Response Body to not be a valid XML document',
      undefined,
      res.body
    );

    // Check that the XML document validates against the SOAP 1.1 schema
    if (isXml) {
      var isSoap11 = xmlDoc.validate(schemas.soap11);
      this.assert(
        isSoap11 === true,
        'expected Response Body to be a valid SOAP 1.1 document but is #{act}',
        'expected Response Body to not be a valid SOAP 1.1 document',
        undefined,
        res.body
      );
    }
  });

  // This is a shortcut for jsonApiError (backwards compatibility)
  Assertion.addMethod('apiError', function assertApiError(expectedStatusCode, expectedErrorId) {
    var res = this._obj;
    new Assertion(res).to.be.a.jsonApiError(expectedStatusCode, expectedErrorId, 'v2');
  });

  Assertion.addMethod('jsonApiError', function assertJsonApiError(expectedStatusCode, expectedErrorId, expectedVersion, havePlaceholders) {
    var negated = utils.flag(this, 'negate');
    var res = this._obj;
    expectedVersion = expectedVersion || 'v2';  // Defaults to UNICA v2 specification
    if (expectedVersion !== 'v1' && expectedVersion !== 'v2') {
      throw new Error('Unsupported UNICA API version: ' + expectedVersion);
    }

    this.assert(
      res.statusCode === expectedStatusCode,
      'expected HTTP Status Code to be #{exp} but is #{act}',
      'expected HTTP Status Code to not be #{act}',
      negated ? undefined : expectedStatusCode,
      res.statusCode
    );
    this.assert(
      res.statusCode >= 400 && res.statusCode < 600,
      'expected HTTP Status Code to be between 400 and 599 but is #{act}',
      'expected HTTP Status Code to not not be between 400 and 599 but is #{act}',
      undefined,
      res.statusCode
    );

    // Check some mandatory headers that must always be present depending on the Status Code
    var mandatoryHeaders = {
      401: ['www-authenticate'],
      405: ['allow']
    };
    var expectedHeaders = mandatoryHeaders[res.statusCode] || [];
    var actualHeaders = tartareHttp.lowerCaseHeaders(res.headers);
    expectedHeaders.forEach(function(expectedHeader) {
      this.assert(
        expectedHeader in actualHeaders,
        'expected HTTP header #{exp} to exist when HTTP Status Code is ' + res.statusCode,
        'expected HTTP header #{exp} to not exist when HTTP Status Code is ' + res.statusCode,
        expectedHeader,
        res.headers
      );
    }, this);

    // Check that, above all, it is a well formed JSON API response
    new Assertion(res).to.be.a.wellFormedJsonApiResponse;

    // Parse JSON body and validates it against the JSON UNICA schema (depending on the expected version)
    var jsonBody = JSON.parse(res.body);
    new Assertion(jsonBody).to.be.jsonSchema(schemas.unicaApiErrors.json[expectedVersion]);

    // Message structure is different depending on the version
    switch(expectedVersion) {
      case 'v1':
        var actualExceptionCategory = null
          , actualExceptionId = null
          , actualExceptionText = null
          , actualExceptionVariables = null
          , expectedExceptionCategory = expectedErrorId.slice(0, 3)
          , expectedExceptionId = expectedErrorId.slice(3)
          , expectedFirstLevelElement = null
          , placeholders = null
          ;

        // Are we expected a ClientException or a ServerException?
        if (expectedExceptionCategory.match(/^SVC|POL|SEC/)) {
          // ClientException
          expectedFirstLevelElement = 'ClientException';
        } else if (expectedExceptionCategory.match(/^SVR/)) {
          // ServerException
          expectedFirstLevelElement = 'ServerException';
        } else {
          throw new Error('Unsupported Exception Category: ' + expectedExceptionCategory);
        }

        // Check that the first element of the document matches the expected type of exception
        // and depending on it, get exceptionCategory and exceptionId
        this.assert(
          jsonBody[expectedFirstLevelElement],
          'expected JSON UNICA v1 Exception to have a #{exp} element',
          'expected JSON UNICA v1 Exception to not have a #{exp} element',
          negated ? undefined : expectedFirstLevelElement,
          null
        );
        actualExceptionCategory = jsonBody[expectedFirstLevelElement].exceptionCategory;
        actualExceptionId = jsonBody[expectedFirstLevelElement].exceptionId;

        this.assert(
          actualExceptionCategory === expectedExceptionCategory,
          'expected Exception Category to be #{exp} but is #{act}',
          'expected Exception Category to not be #{act}',
          negated ? undefined : expectedExceptionCategory,
          actualExceptionCategory
        );
        this.assert(
          actualExceptionId == expectedExceptionId,
          'expected Exception Id to be #{exp} but is #{act}',
          'expected Exception Id to not be #{act}',
          negated ? undefined : expectedExceptionId,
          actualExceptionId
        );

        actualExceptionText = jsonBody[expectedFirstLevelElement].text;
        actualExceptionVariables = jsonBody[expectedFirstLevelElement].variables;
        placeholders = actualExceptionText.match(/%\d+/g) || [];
        if (havePlaceholders === true) {
          //Find the highest placeholder
          var highestPlaceholder = placeholders.map(function(placeholder) { return parseInt(placeholder.slice(1));})
            .sort().pop();
          if (highestPlaceholder) {
            this.assert(
              actualExceptionVariables && actualExceptionVariables.length === highestPlaceholder,
              'expect Exception Variables to have #{exp} elements but it has #{act}',
              'expect Exception Variables not have elements but it has #{act}',
              highestPlaceholder,
              actualExceptionVariables.length
            );
          } else {
            this.assert(
              actualExceptionVariables === undefined,
              'expected Exception Variables to not exist but it has #{act} elements',
              'expected Exception Variables to exist but it does not',
              negated? undefined : null,
              actualExceptionVariables
            )
          }

        } else if (havePlaceholders === false) {
          //There is not any placeholder in the exception Text
          this.assert(
            placeholders.length === 0,
            'expected Exception Text to not have placeholders but it has #{act}',
            'expected Exception Text to have placeholders but it has #{act}',
            negated? undefined : null,
            placeholders.length
          );
          //There is no variables field
          this.assert(
            actualExceptionVariables === undefined,
            'expected Exception Variables to not exist but it has #{act} elements',
            'expected Exception Variables field to exist',
            negated ? undefined : null,
            actualExceptionVariables
          )
        }
        break;

      case 'v2':
        // This is straightforward in v2 since there is an only type of Exception, 
        // and exceptionCategory and exceptionId have been merged
        this.assert(
          jsonBody.exceptionId === expectedErrorId,
          'expected Exception Id to be #{exp} but is #{act}',
          'expected Exception Id to not be #{act}',
          negated ? undefined : expectedErrorId,
          jsonBody.exceptionId
        );
        break;
    }
  });

  Assertion.addMethod('xmlApiError', function assertXmlApiError(expectedStatusCode, expectedErrorId, expectedVersion, havePlaceholders) {
    var negated = utils.flag(this, 'negate');
    var res = this._obj;
    expectedVersion = expectedVersion || 'v2';  // Defaults to UNICA v2 specification
    if (expectedVersion !== 'v1' && expectedVersion !== 'v2') {
      throw new Error('Unsupported UNICA API version: ' + expectedVersion);
    }

    this.assert(
      res.statusCode === expectedStatusCode,
      'expected HTTP Status Code to be #{exp} but is #{act}',
      'expected HTTP Status Code to not be #{act}',
      negated ? undefined : expectedStatusCode,
      res.statusCode
    );
    this.assert(
      res.statusCode >= 400 && res.statusCode < 600,
      'expected HTTP Status Code to be between 400 and 599 but is #{act}',
      'expected HTTP Status Code to not not be between 400 and 599 but is #{act}',
      undefined,
      res.statusCode
    );

    // Check some mandatory headers that must always be present depending on the Status Code
    var mandatoryHeaders = {
      401: ['www-authenticate'],
      405: ['allow']
    };
    var expectedHeaders = mandatoryHeaders[res.statusCode] || [];
    var actualHeaders = tartareHttp.lowerCaseHeaders(res.headers);
    expectedHeaders.forEach(function(expectedHeader) {
      this.assert(
        expectedHeader in actualHeaders,
        'expected HTTP header #{exp} to exist when HTTP Status Code is ' + res.statusCode,
        'expected HTTP header #{exp} to not exist when HTTP Status Code is ' + res.statusCode,
        expectedHeader,
        res.headers
      );
    }, this);

    // Check that, above all, it is a well formed XML API response
    new Assertion(res).to.be.a.wellFormedXmlApiResponse;

    // Parse XML body and validates it against the XML UNICA schema (depending on the expected version)
    var xmlBody = xml.parseXmlString(res.body);
    this.assert(
      xmlBody.validate(schemas.unicaApiErrors.xml[expectedVersion]),
      'expected HTTP Body to validate against the UNICA API schema',
      'expected HTTP Body to not validate against the UNICA API schema',
      undefined,
      res.body
    );

    // Message structure is different depending on the version
    switch(expectedVersion) {
      case 'v1':
        var actualExceptionCategory = null
          , actualExceptionId = null
          , actualExceptionText
          , actualExceptionVariables
          , expectedExceptionCategory = expectedErrorId.slice(0, 3)
          , expectedExceptionId = expectedErrorId.slice(3)
          , expectedFirstLevelElement = null
          , placeholders
          ;

        // Are we expected a ClientException or a ServerException?
        if (expectedExceptionCategory.match(/^SVC|POL|SEC/)) {
          // ClientException
          expectedFirstLevelElement = 'ClientException';
        } else if (expectedExceptionCategory.match(/^SVR/)) {
          // ServerException
          expectedFirstLevelElement = 'ServerException';
        } else {
          throw new Error('Unsupported Exception Category: ' + expectedExceptionCategory);
        }

        // Check that the first element of the document matches the expected type of exception
        // and depending on it, get exceptionCategory and exceptionId
        this.assert(
          xmlBody.find(
            '/uct:' + expectedFirstLevelElement,
            { uct: 'http://www.telefonica.com/schemas/UNICA/REST/common/v1' }
          ).length === 1,
          'expected XML UNICA v1 Exception to have a #{exp} element',
          'expected XML UNICA v1 Exception to not have a #{exp} element',
          negated ? undefined : expectedFirstLevelElement,
          null
        );
        actualExceptionCategory = xmlBody.get(
          '/uct:' + expectedFirstLevelElement + '/uct:exceptionCategory',
          { uct: 'http://www.telefonica.com/schemas/UNICA/REST/common/v1' }
        ).text();
        actualExceptionId = xmlBody.get(
          '/uct:' + expectedFirstLevelElement + '/uct:exceptionId',
          { uct: 'http://www.telefonica.com/schemas/UNICA/REST/common/v1' }
        ).text();

        this.assert(
          actualExceptionCategory === expectedExceptionCategory,
          'expected Exception Category to be #{exp} but is #{act}',
          'expected Exception Category to not be #{act}',
          negated ? undefined : expectedExceptionCategory,
          actualExceptionCategory
        );
        this.assert(
          actualExceptionId == expectedExceptionId,
          'expected Exception Id to be #{exp} but is #{act}',
          'expected Exception Id to not be #{act}',
          negated ? undefined : expectedExceptionId,
          actualExceptionId
        );

        actualExceptionText = xmlBody.get(
          '/uct:' + expectedFirstLevelElement + '/uct:text',
          { uct: 'http://www.telefonica.com/schemas/UNICA/REST/common/v1' }
        ).text();
        actualExceptionVariables = xmlBody.find(
          '/uct:' + expectedFirstLevelElement + '/uct:variables',
          { uct: 'http://www.telefonica.com/schemas/UNICA/REST/common/v1' }
        );
        placeholders = actualExceptionText.match(/%\d+/g) || [];
        if (havePlaceholders === true) {
          //Find the highest placeholder
          var highestPlaceholder = placeholders.map(function(placeholder) { return parseInt(placeholder.slice(1));})
            .sort().pop();
          if (highestPlaceholder) {
            this.assert(
              actualExceptionVariables.length === highestPlaceholder,
              'expect Exception Variables to have #{exp} elements but it has #{act}',
              'expect Exception Variables not have be less than #{exp} but is #{act}',
              highestPlaceholder,
              actualExceptionVariables.length
            );
          } else {
            this.assert(
              actualExceptionVariables.length === 0,
              'expect Exception Variables to not exist it has #{act} elements',
              'expect Exception Variables to exist but it does not',
              negated ? undefined : 0,
              actualExceptionVariables.length
            )
          }
        } else if (havePlaceholders === false) {
          //There is not any placeholder in the exception Text
          this.assert(
            placeholders.length === 0,
            'expected Exception Text to not have placeholders but it has #{act}',
            'expected Exception Text to have placeholders but it has #{act}',
            negated ? undefined : null,
            placeholders.length
          );
          //There is not variables field
          this.assert(
            actualExceptionVariables.length === 0 ,
            'expect Exception Variables to not exist but it has #{act} elements',
            'expected Exception Variables to exist but it does not',
            negated ? undefined : null,
            actualExceptionVariables.length
          )
        }
        break;

      case 'v2':
        // This is straightforward in v2 since there is an only type of Exception, 
        // and exceptionCategory and exceptionId have been merged
        var actualExceptionId = xmlBody.get(
          '/uct:exception/uct:exceptionId',
          { uct: 'http://www.telefonica.com/schemas/UNICA/REST/common/v2' }
        ).text();
        this.assert(
          actualExceptionId === expectedErrorId,
          'expected Exception Id to be #{exp} but is #{act}',
          'expected Exception Id to not be #{act}',
          negated ? undefined : expectedErrorId,
          actualExceptionId
        );
        break;
    }
  });

  Assertion.addMethod('soap11ApiError', function assertSoap11ApiError(expectedErrorId, expectedVersion, havePlaceholders) {
    var negated = utils.flag(this, 'negate');
    var res = this._obj;
    expectedVersion = expectedVersion || 'v2';  // Defaults to UNICA v2 specification
    if (expectedVersion !== 'v1' && expectedVersion !== 'v2') {
      throw new Error('Unsupported UNICA API version: ' + expectedVersion);
    }

    // SOAP faults are always returned using 500 as HTTP Status Code
    var expectedStatusCode = 500;
    this.assert(
      res.statusCode === expectedStatusCode,
      'expected HTTP Status Code to be #{exp} but is #{act}',
      'expected HTTP Status Code to not be #{act}',
      negated ? undefined : expectedStatusCode,
      res.statusCode
    );

    // Check that, above all, it is a well formed SOAP 1.1 API response
    new Assertion(res).to.be.a.wellFormedSoap11ApiResponse;

    // Parse XML body and validates it against the SOAP 1.1 UNICA schema (depending on the expected version)
    var soapBody = xml.parseXmlString(res.body);
    this.assert(
      soapBody.validate(schemas.unicaApiErrors.soap11[expectedVersion]),
      'expected HTTP Body to validate against the UNICA API schema',
      'expected HTTP Body to not validate against the UNICA API schema',
      undefined,
      res.body
    );

    // Message structure is the same both for v1 and v2, except for the namespaces
    var actualExceptionCategory = null
      , actualExceptionId = null
      , actualExceptionText = null
      , actualExceptionVariables = null
      , expectedExceptionCategory = expectedErrorId.slice(0, 3)
      , expectedExceptionId = expectedErrorId.slice(3)
      , expectedFirstLevelElement = null
      , placeholders = null
      ;

    // Are we expected a ClientException or a ServerException?
    if (expectedExceptionCategory.match(/^SVC|POL|SEC/)) {
      // ClientException
      expectedFirstLevelElement = 'ClientException';
    } else if (expectedExceptionCategory.match(/^SVR/)) {
      // ServerException
      expectedFirstLevelElement = 'ServerException';
    } else {
      throw new Error('Unsupported Exception Category: ' + expectedExceptionCategory);
    }

    // Check that the first element of the document inside the fault's detail element matches the expected type of exception
    // and depending on it, get exceptionCategory and exceptionId
    this.assert(
      soapBody.find(
        '/soap:Envelope/soap:Body/soap:Fault/detail/faults:' + expectedFirstLevelElement,
        { soap: 'http://schemas.xmlsoap.org/soap/envelope/',
          faults: 'http://www.telefonica.com/wsdl/UNICA/SOAP/common/' + expectedVersion + '/faults' }
      ).length === 1,
      'expected SOAP 1.1 UNICA ' + expectedVersion + ' Exception to have a #{exp} element',
      'expected SOAP 1.1 UNICA ' + expectedVersion + ' Exception to not have a #{exp} element',
      negated ? undefined : expectedFirstLevelElement,
      null
    );
    actualExceptionCategory = soapBody.get(
      '/soap:Envelope/soap:Body/soap:Fault/detail/faults:' + expectedFirstLevelElement + '/uct:exceptionCategory',
      { soap: 'http://schemas.xmlsoap.org/soap/envelope/',
        faults: 'http://www.telefonica.com/wsdl/UNICA/SOAP/common/' + expectedVersion + '/faults',
        uct: 'http://www.telefonica.com/schemas/UNICA/SOAP/common/' + expectedVersion }
    ).text();
    actualExceptionId = soapBody.get(
      '/soap:Envelope/soap:Body/soap:Fault/detail/faults:' + expectedFirstLevelElement + '/uct:exceptionId',
      { soap: 'http://schemas.xmlsoap.org/soap/envelope/',
        faults: 'http://www.telefonica.com/wsdl/UNICA/SOAP/common/' + expectedVersion + '/faults',
        uct: 'http://www.telefonica.com/schemas/UNICA/SOAP/common/' + expectedVersion }
    ).text();

    this.assert(
      actualExceptionCategory === expectedExceptionCategory,
      'expected Exception Category to be #{exp} but is #{act}',
      'expected Exception Category to not be #{act}',
      negated ? undefined : expectedExceptionCategory,
      actualExceptionCategory
    );
    this.assert(
      actualExceptionId == expectedExceptionId,
      'expected Exception Id to be #{exp} but is #{act}',
      'expected Exception Id to not be #{act}',
      negated ? undefined : expectedExceptionId,
      actualExceptionId
    );

    actualExceptionText = soapBody.get(
      '/soap:Envelope/soap:Body/soap:Fault/detail/faults:' + expectedFirstLevelElement + '/uct:text',
      { soap: 'http://schemas.xmlsoap.org/soap/envelope/',
        faults: 'http://www.telefonica.com/wsdl/UNICA/SOAP/common/' + expectedVersion + '/faults',
        uct: 'http://www.telefonica.com/schemas/UNICA/SOAP/common/' + expectedVersion }
    ).text();
    actualExceptionVariables = soapBody.find(
      '/soap:Envelope/soap:Body/soap:Fault/detail/faults:' + expectedFirstLevelElement + '/uct:variables',
      { soap: 'http://schemas.xmlsoap.org/soap/envelope/',
        faults: 'http://www.telefonica.com/wsdl/UNICA/SOAP/common/' + expectedVersion + '/faults',
        uct: 'http://www.telefonica.com/schemas/UNICA/SOAP/common/' + expectedVersion }
    );
    placeholders = actualExceptionText.match(/%\d+/g) || [];

    if (havePlaceholders === true) {
      //Find the highest placeholder
      var highestPlaceholder = placeholders.map(function(placeholder) { return parseInt(placeholder.slice(1));})
        .sort().pop();
      if (highestPlaceholder) {
        this.assert(
          actualExceptionVariables.length === highestPlaceholder,
          'expect Exception Variables to have #{exp} elements but it has #{act}',
          'expect Exception Variables to not have #{exp} elements',
          highestPlaceholder,
          actualExceptionVariables.length
        );
      } else {
        this.assert(
          actualExceptionVariables.length === 0,
          'expect Exception Variables to not exist but it has #{act} elements',
          'expect Exception Variables to exist but it does not',
          negated ? undefined : 0,
          actualExceptionVariables.length
        )
      }
    } else if (havePlaceholders === false) {
      //There is not any placeholder in the exception Text
      this.assert(
        placeholders.length === 0,
        'expected Exception Text to not have placeholders but it has #{act}',
        'expected Exception Text to have placeholders but it has #{act}',
        negated ? undefined : null,
        placeholders.length
      );
      //There is not variables field
      this.assert(
        actualExceptionVariables.length === 0 ,
        'expected Exception Variables to not exist but it has #{act} elements',
        'expected Exception Variables to exist but it does not',
        negated ? undefined : null,
        actualExceptionVariables.length
      )
    }
  });

});
