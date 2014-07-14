/**
 * This module has several HTTP utils
 */

'use strict';

var utils = require('./utils');

var getBasicAuthDataset = function getBasicAuthDataset(goodAuth, badAuth) {
  var midPos = Math.floor(badAuth.user.length / 2);
  var badUserWithSemicolon = badAuth.user.slice(0, midPos) + ':' + badAuth.user.slice(midPos);

  // Dataset template: { skip: true, only: true, tag: 'skip', bugId: 'JIRA-ID', desc: 'test description', ... }
  return [
    { desc: 'with wrong user and password.', auth: badAuth, error: '401' },
    { desc: 'with a wrong password.', auth: { user: goodAuth.user, pass: badAuth.pass }, error: '401' },
    { desc: 'with a wrong user and a valid password.', auth: { user: badAuth.user, pass: goodAuth.pass }, error: '401' },
    { desc: 'with an empty user.', auth: { user: '', pass: goodAuth.pass }, error: '401' },
    { desc: 'with an empty password.', auth: { user: goodAuth.user, pass: '' }, error: '401' },
    { desc: 'without Authorization header.', auth: null, error: '401' },
    { desc: 'with a username containing \':\'', auth: { user: badUserWithSemicolon, pass: goodAuth.pass }, error: '401' },
    { desc: 'with a username containing non-ascci chars.', auth: { user: utils.NONASCII_STRING, pass: goodAuth.pass }, error: '401' },
    { desc: 'with a username containing injection chars.', auth: { user: utils.INJECTION_STRING, pass: goodAuth.pass }, error: '401' }
  ];
};

var httpReasons = {
  100: 'Continue',
  101: 'Switching Protocols',
  103: 'Checkpoint',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  306: 'Switch Proxy',
  307: 'Temporary Redirect',
  308: 'Resume Incomplete',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Request Entity Too Large',
  414: 'Request-URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Requested Range Not Satisfiable',
  417: 'Expectation Failed',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  511: 'Network Authentication Required'
};

var getReason = function getReason(statusCode) {
  return (statusCode in httpReasons ? httpReasons[statusCode] : 'Unknown status code');
};

/**
 * Return the same object passed as parameter with all its properties lower-cased.
 * Useful with HTTP headers since they are case-insensitive.
 *
 * @param headers
 * @private
 */
var lowerCaseHeaders = function lowerCaseHeaders(headers) {
  var lowerCasedHeaders = {};

  for (var headerName in (headers || {})) {
    if (headers.hasOwnProperty(headerName)) {
      lowerCasedHeaders[headerName.toLowerCase()] = headers[headerName];
    }
  }

  return lowerCasedHeaders;
};

/**
 * Return the charset (if any) from a Content-Type header value
 *
 * @param value
 * @private
 */
var getCharsetFromContentType = function getCharsetFromContentType(value) {
  if (!value) {
    return null;
  }
  var regexp = /^.*;\s*charset=["']?([A-Za-z0-9\-_.:()]+)["']?(?:;.*)*$/i;
  var matches = value.match(regexp);
  return (matches ? matches[1].toLowerCase() : null);
};


module.exports = {
  getReason: getReason,
  getBasicAuthDataset: getBasicAuthDataset,
  lowerCaseHeaders: lowerCaseHeaders,
  getCharsetFromContentType: getCharsetFromContentType
};
