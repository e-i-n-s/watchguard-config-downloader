process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // Allow Self Sign Certificate
var fs = require('fs');
var request = require('request');
var j = request.jar()
var request = request.defaults({jar: j})
var stringSearcher = require('string-search');
var parseString = require('xml2js').parseString;


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
		
		parseString(body, function (err, result) {
			members = result.methodResponse.params[0].param[0].value[0].struct[0].member;
			var sid = members[0].value[0];
			var csrf = members[1].value[0];
			
			if (!sid || !csrf) {
				throw "Login failed";
			}
						
			var optionsConfigPage = {
				url: url + '/auth/login',
				formData: {
					"username": user,
					"password": password,
					"domain": "Firebox-DB",
					"sid": sid,
					"csrf_token": csrf,
					"privilege": "1",
					"from_page": "/"
				}
			};

			function getConfigPage(error, response, body) {
				request(url + '/system/configuration', function(error, response, body) {
					if (!error && response.statusCode == 200) {
						stringSearcher.find(body, 'deviceName = ')
							.then(function(resultArr) {
								var deviceName = resultArr[0].text.replace('var deviceName = \'', '').replace('\';', '');
								payloadFileAction = "<methodCall><methodName>/agent/file_action</methodName><params><param><value><struct><member><name>action</name><value><string>config</string></value></member></struct></value></param></params></methodCall>"
								var optionFileAction = {
									url: url + '/agent/file_action',
									body: payloadFileAction,
									headers: {
										"X-CSRFToken": csrf
									}
								};
								
								function downloadConfigFile(error, response, body) {
									var fileName = deviceName + '.xml.gz';
									var configFile = fs.createWriteStream(fileName);
									configFile.on('close', function() {
									  console.log(deviceName + ': ok');
									});
									var downloadUrl = url + '/agent/download?action=config&filename=' + deviceName + '.xml.gz&csrf_token=' + csrf;	
									request(downloadUrl).pipe(configFile);						
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
		});
		
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