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

var fs = require('fs')
  , path = require('path')
  , xml = require('libxmljs')
  ;


module.exports = {
  soap11: xml.parseXmlString(fs.readFileSync(path.resolve(__dirname, './schemas/SOAP11_Envelope.xsd'), { encoding: 'utf-8' })),
  unicaApiErrors: {
    json: {
      v1: JSON.parse(fs.readFileSync(path.resolve(__dirname, './schemas/UNICA_API_Errors_json_v1.json'), { encoding: 'utf-8' })),
      v2: JSON.parse(fs.readFileSync(path.resolve(__dirname, './schemas/UNICA_API_Errors_json_v2.json'), { encoding: 'utf-8' }))
    },
    xml: {
      v1: xml.parseXmlString(fs.readFileSync(path.resolve(__dirname, './schemas/UNICA_API_Errors_xml_v1.xsd'), { encoding: 'utf-8' })),
      v2: xml.parseXmlString(fs.readFileSync(path.resolve(__dirname, './schemas/UNICA_API_Errors_xml_v2.xsd'), { encoding: 'utf-8' }))
    },
    soap11: {
      v1: xml.parseXmlString(fs.readFileSync(path.resolve(__dirname, './schemas/UNICA_API_Errors_soap11_v1.xsd'), { encoding: 'utf-8' })),
      v2: xml.parseXmlString(fs.readFileSync(path.resolve(__dirname, './schemas/UNICA_API_Errors_soap11_v2.xsd'), { encoding: 'utf-8' }))
    }
  }
};

// Change UNICA_API_Errors_soapXX_vY schemas' import tag so the schemaLocation attribute points to a full path
for (var version in module.exports.unicaApiErrors.soap11) {
  if (module.exports.unicaApiErrors.soap11.hasOwnProperty(version)) {
    var schema = module.exports.unicaApiErrors.soap11[version];
    var importTag = schema.get('/xs:schema/xs:import', { xs: 'http://www.w3.org/2001/XMLSchema' });
    var currentSchemaLocation = importTag.attr('schemaLocation').value();
    importTag.attr('schemaLocation').value('file://' + path.resolve(__dirname, './schemas/' + currentSchemaLocation));
  }
}
