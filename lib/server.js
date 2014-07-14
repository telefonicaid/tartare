'use strict';

var fs = require('fs')
  , mustache = require('mustache')
  , _ = require('underscore')
  , path = require('path')
  , cp = require('child_process')
  , utils = require('./utils')
  ;


/**
 * Read a configuration file containing mustache placeholders, replace them with baseConfig and additionalConfig,
 * and write the resulting configuration file.
 *
 *
 * @param templateConfigFile Configuration template filename containing mustache placeholders
 * @param outputConfigFile Resulting file after having applied configurations over templateConfigFile
 * @param baseConfig Configuration object to be applied over templateConfigFile's mustache placeholders
 * @param additionalConfig (optional) The same that the former parameter. Properties in this object will overwrite
 *                         the ones in baseConfig with the same name. This allows to use a basic configuration in
 *                         baseConfig and some more specific configuration in additionalConfig.
 */
var renderConfigFile = function renderConfigFile(templateConfigFile, outputConfigFile, baseConfig, additionalConfig) {
  var configTemplate = fs.readFileSync(templateConfigFile, { encoding: 'utf-8' });
  var config = {};
  _.extend(config, baseConfig, additionalConfig);
  var outputConfig = mustache.render(configTemplate, config);
  fs.writeFileSync(outputConfigFile, outputConfig, { encoding: 'utf-8' });
};


/**
 * Run an instance of API Mock Server.
 * @param settings Startup settings for the mock:
 *                 - adminPort: Administration port.
 *                 - httpPort: HTTP port.
 *                 - httpsPort: HTTPS port.
 *                 - key: Key file used to run the HTTPS server.
 *                 - cert: Cert file used to run the HTTPS server.
 *                 - timeout: Default response timeout.
 * @param timeout Max time to wait for the API Mock Server to start before returning an error.
 * @param cb
 */
var startApiMockServer = function startApiMockServer(settings, timeout, cb) {
  if (!cb && (timeout instanceof Function)) {
    cb = timeout;
    timeout = null;
  }
  timeout = timeout || 5000;

  var args = [];
  if (settings.adminPort) {
    args.push('-a');
    args.push(settings.adminPort);
  }
  if (settings.httpPort) {
    args.push('-p');
    args.push(settings.httpPort);
  }
  if (settings.httpsPort) {
    args.push('-s');
    args.push(settings.httpsPort);
    if (settings.key) {
      args.push('-k');
      args.push(settings.key);
    }
    if (settings.cert) {
      args.push('-c');
      args.push(settings.cert);
    }
  }
  if (settings.timeout) {
    args.push('-t');
    args.push(settings.timeout);
  }

  var apiMockServer = cp.fork(path.resolve(__dirname, '../bin/apimockserver'), args, { silent: true });

  var stderr = ''
    , stdout = '';

  var listening = {
    adminPort: false,
    httpPort: false
  };
  if (settings.httpsPort) {
    listening.httpsPort = false;
  }

  var timeoutId = setTimeout(function() {
    // Just in case the API mock server does not start properly after some time
    apiMockServer.stdout.removeAllListeners('data');
    apiMockServer.kill();
    var err = new Error('API Mock Server couldn\'t be started before ' + timeout + ' milliseconds');
    err.stderr = stderr;
    err.stdout = stdout;
    cb(err);
  }, timeout);

  apiMockServer.on('error', function(err) {
    cb(err);
  });
  apiMockServer.on('exit', function(code, signal) {
    if (/*code !== 0 &&*/ code !== 143) {
      var err = new Error('API Mock Server Error');
      err.stderr = stderr;
      cb(err);
    }
  });
  apiMockServer.stderr.on('data', function(chunk) {
    stderr += chunk.toString();
  });
  apiMockServer.stdout.on('data', function(chunk) {
    stdout += chunk.toString();
    // Look for each server to have been started
    for (var server in listening) {
      if (listening.hasOwnProperty(server)) {
        listening[server] = (stdout.indexOf('listening on port ' + settings[server]) !== -1);
      }
    }
    if (_.reduce(listening, function(memo, value) { return memo && value; }, true)) {
      // If all servers have started
      clearTimeout(timeoutId);
      apiMockServer.stdout.removeAllListeners('data');
      apiMockServer.stderr.removeAllListeners('data');
      cb(null, apiMockServer.pid);
    }
  });
};

var stopApiMockServer = function stopApiMockServer(pid) {
  process.kill(pid);
};

/**
 * Run an instance of a generic server and optionally wait for something to be written in stdout or stderr to consider
 * that the server has correctly started.
 * @param serverOpts Object with the following information about the server:
 *                   - command: The server executable command.
 *                   - args: Array of arguments to be passed to the server.
 *                   - env: Object with environment key-value pairs.
 *                   - startupMessages: Messages (String or Array) to be searched in stdout or stderr
 *                                      to consider that the served has started.
 *                                      If it doesn't exist or is empty this function will wait for the server to exit
 * @param timeout Max time to wait for the Server to start.
 * @param cb The callback function will be called with the following parameters:
 *           - pid: the process' pid, or null if it cannot be started.
 *           - stdout: what the process has printed to stdout.
 *           - stderr: what the process has printed to stderr.
 *           - exitCode: exit code returned by the process, in case it has exited.
 *           - signal: signal that terminated the process, in case it has exited.
 */
var startServer = function startServer(serverOpts, timeout, cb) {
  if (!cb && (timeout instanceof Function)) {
    cb = timeout;
    timeout = null;
  }
  timeout = timeout || 5000;

  if (serverOpts.startupMessages && !Array.isArray(serverOpts.startupMessages)) {
    serverOpts.startupMessages = [ serverOpts.startupMessages ];
  }
  var startupMessagesFound = serverOpts.startupMessages ? serverOpts.startupMessages.map(function() { return false; }) : null;

  var server = cp.spawn(serverOpts.command, serverOpts.args, { env: serverOpts.env });

  var stderr = ''
    , stdout = '';

  var timeoutId = setTimeout(function() {
    // Just in case the server does not start properly after some time
    server.removeAllListeners();
    server.stdout.removeAllListeners('data');
    server.stderr.removeAllListeners('data');
    if (serverOpts.startupMessages) {
      // If there is some startupMessage, exiting by timeout is an error
      server.kill();
      var err = new Error('Server couldn\'t be started before ' + timeout + ' milliseconds');
      err.stderr = stderr;
      err.stdout = stdout;
      cb(err);
    } else {
      // If there is not any startupMessage, exiting by timeout is ok (start and wait)
      cb(null, server.pid, stdout, stderr);
    }
  }, timeout);

  server.on('error', function(err) {
    clearTimeout(timeoutId);
    server.removeAllListeners();
    server.stdout.removeAllListeners('data');
    server.stderr.removeAllListeners('data');
    cb(err);
  });
  server.on('exit', function(code, signal) {
    clearTimeout(timeoutId);
    server.removeAllListeners();
    server.stdout.removeAllListeners('data');
    server.stderr.removeAllListeners('data');
    if (serverOpts.startupMessages) {
      // If there is some startupMessage and the process exits before finding such messages, it is an error
      var err = new Error('Server finished with exit code "' + code + '" and signal "' + signal + '"');
      err.stdout = stdout;
      err.stderr = stderr;
      cb(err);
    } else {
      // If there is not any startupMessage and the process exits, it is ok
      cb(null, null, stdout, stderr, code, signal);
    }
  });

  function _checkStartupMessages() {
    serverOpts.startupMessages.forEach(function(startupMsg, index) {
      if (stdout.indexOf(startupMsg) !== -1 ||
        stderr.indexOf(startupMsg) !== -1) {
        startupMessagesFound[index] = true;
      }
    });
    if (startupMessagesFound.reduce(function(previousValue, currentValue) { return previousValue && currentValue; }, true)) {
      // When all startupMessages have been found
      clearTimeout(timeoutId);
      server.removeAllListeners();
      server.stdout.removeAllListeners('data');
      server.stderr.removeAllListeners('data');
      cb(null, server.pid, stdout, stderr);
    }
  }
  server.stderr.on('data', function(chunk) {
    stderr += chunk.toString();
    if (serverOpts.startupMessages) {
      _checkStartupMessages();
    }
  });
  server.stdout.on('data', function(chunk) {
    stdout += chunk.toString();
    if (serverOpts.startupMessages) {
      _checkStartupMessages();
    }
  });
};

var stopServer = function stopServer(pid) {
  try {
    if (pid) {
      process.kill(pid);
    }
  } catch(e) {
    // Already killed
  }
};

/**
 * Kill all processes that are listening to the ports passed as arguments.
 *
 * @param ports
 * @param cb
 */
var killServersByTpcPort = function killServersByTpcPort(ports, cb) {
  if (!(ports instanceof Array)) {
    ports = [ ports ];
  }

  // Use netstat command to get listening ports
  var cmd = null;
  switch(utils.getOS()) {
    case 'redhat':
      cmd = 'sudo netstat --listening --numeric --program --notrim -t';
      break;
    case 'ubuntu':
      cmd = 'netstat --listening --numeric --program --wide -t';
      break;
    case 'osx':
      throw Error ('Non supported Operating System');
      break;
  }

  cp.exec(cmd, function(err, stdout, stderr) {
    if (err) {
      return cb(err);
    }
    var killed = [];

    // Parse netstat output to get protocol, port number and pid
    var lines = stdout.split('\n').slice(2);
    lines.forEach(function(line) {
      var matches = line.match(/^(\w+)\s+\d+\s+\d+\s+([\d\.:]+)\s+[\d\.:\*]+\s+\w+\s+(.+)$/);
      if (matches) {
        var protocol = matches[1],
            port = parseInt(matches[2].substring(matches[2].lastIndexOf(':') + 1)),
            pid = matches[3].startsWith('-') ? null : parseInt(matches[3].substring(0, matches[3].indexOf('/')));

        // Kill processes listening to ports passed as parameter
        if (protocol === 'tcp' && ports.indexOf(port) !== -1) {
          if (!pid) {
            return cb(new Error('No PID available for port ' + port));
          }
          // Only kill process that have not been already killed
          // (one server listening to several ports will be listed several times by netstat)
          if (killed.indexOf(pid) === -1) {
            process.kill(pid);
            killed.push(pid);
          }
        }
      }
    });
    cb();
  });
};


module.exports = {
  renderConfigFile: renderConfigFile,
  startApiMockServer: startApiMockServer,
  stopApiMockServer: stopApiMockServer,
  startServer: startServer,
  stopServer: stopServer,
  killServersByTpcPort: killServersByTpcPort
};
