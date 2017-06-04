process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // Allow Self Sign Certificate
var fs = require('fs');
var request = require('request');
var j = request.jar()
var request = request.defaults({jar: j})
var xmldoc = require('xmldoc');
var stringSearcher = require('string-search');

if (process.argv.length != 5) {
    throw "Usage: node filename.js hostname username password"
}

var hostname = process.argv.slice(2)[0];
var user = process.argv.slice(2)[1];
var password = process.argv.slice(2)[2];
var url = "https://" + hostname + ":8080"
var payload = "<methodCall><methodName>login</methodName><params><param><value><struct><member><name>password</name><value><string>" + password + "</string></value></member><member><name>user</name><value><string>" + user + "</string></value></member><member><name>domain</name><value><string>Firebox-DB</string></value></member><member><name>uitype</name><value><string>2</string></value></member></struct></value></param></params></methodCall>"
var options = {
    url: url + '/agent/login',
    body: payload
};

function doLogin(error, response, body) {
    if (!error && response.statusCode == 200) {
        var document = new xmldoc.XmlDocument(body);
        var sid = document.valueWithPath("params.param.value.struct.member.value");
        if (!sid) {
            throw "Login failed";
        }

        var optionsConfigPage = {
            url: url + '/auth/login',
            formData: {
                "username": user,
                "password": password,
                "domain": "Firebox-DB",
                "sid": sid,
                "privilege": "2",
                "from_page": "/"
            }
        };

        function getConfigPage(error, response, body) {
            request(url + '/system/configuration', function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    stringSearcher.find(body, 'deviceName = ')
                        .then(function(resultArr) {
                            var deviceName = resultArr[0].text.replace('var deviceName = \'', '').replace('\';', '');
                            console.log('Device Name:' + deviceName);
                            payloadFileAction = "<methodCall><methodName>/agent/file_action</methodName><params><param><value><struct><member><name>action</name><value><string>config</string></value></member></struct></value></param></params></methodCall>"
                            var optionFileAction = {
                                url: url + '/agent/file_action',
                                body: payloadFileAction
                            };
							
                            function downloadConfigFile(error, response, body) {
								var fileName = deviceName + '.xml.gz';
								var configFile = fs.createWriteStream(fileName);
								configFile.on('close', function() {
								  console.log('Configfile downloaded!');
								});
                                request(url + '/agent/download?action=config&filename=' + deviceName + '.xml.gz').pipe(configFile);
                            }
                            request.post(optionFileAction, downloadConfigFile);
                        });

                } else {
                    console.error(error)
                    throw "Error!"
                }
            });
        }
        request.post(optionsConfigPage, getConfigPage);
    } else {
        console.error(error)
        throw "Error!"
    }
}

request(url + '/auth/login', function(error, response, body) {
    if (!error && response.statusCode == 200) {
        request.post(options, doLogin);
    } else {
        throw "Firebox cannot be contacted!"
        console.error(error)
    }
});