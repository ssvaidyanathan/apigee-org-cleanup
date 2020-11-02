var prompt = require("prompt");
var colors = require("colors/safe");
const rp = require("request-promise");
var util = require("util");

var schema = {
	properties: {
		org: {
			description: colors.yellow("Please provide the Apigee Edge Organization name"),
			message: colors.red("Apigee Edge Organization name cannot be empty!"),
			required: true
		},
		username: {
			description: colors.yellow("Please provide the Apigee Edge username"),
			message: colors.red("Apigee Edge username cannot be empty!"),
			required: true
		},
		password: {
			description: colors.yellow("Please provide the Apigee Edge password"),
			message: colors.red("Apigee Edge password cannot be empty!"),
			hidden: true,
			replace: '*',
			required: true
		},
		mfaToken: {
			description: colors.yellow("Please provide the Apigee Edge MFA Token"),
			message: colors.red("Apigee Edge MFA Token cannot be empty!"),
			required: true
		}
	}
};

//
// Start the prompt
//
prompt.start();

prompt.get(schema, async function (err, config) {
	let accessToken = await getAccessToken(config);
	await deleteAppsAndDevelopers(config, accessToken);
	await deleteAPIProducts(config, accessToken);
	await deleteReports(config, accessToken);
	await deleteSharedFlows(config, accessToken);
	await deleteExtensions(config, accessToken);
	await deleteAPIProxies(config, accessToken);
	await deleteAPIPortals(config, accessToken);
	await deleteSpecs(config, accessToken);
});

let mgmtURL = "https://api.enterprise.apigee.com/v1/organizations";
let mgmtOAuthURL = "https://login.apigee.com/oauth/token";

async function deleteAppsAndDevelopers(config, accessToken) {
	safeLog("** Deleting Apps");
	let developers = await getEntities(config, accessToken, "developers");
	if (developers.length == 0) {
		safeLog("Developers: NONE");
		return;
	}
	safeLog("Developers: " + developers);
	for (developer of developers) {
		safeLog("Fetching Apps for " + developer);
		let apps = await getEntities(config, accessToken, "developers/" + developer + "/apps");
		if (apps.length == 0) {
			safeLog("Apps: NONE");
			continue;
		}
		safeLog("Apps: " + apps);
		for (app of apps) {
			await deleteEntities(config, accessToken, "developers/" + developer + "/apps/" + app);
		}
		safeLog("Deleting developer: " + developer);
		await deleteEntities(config, accessToken, "developers/" + developer);
	}
}

async function deleteAPIProducts(config, accessToken) {
	safeLog("** Deleting API Products");
	let apiproducts = await getEntities(config, accessToken, "apiproducts");
	if (apiproducts.length == 0) {
		safeLog("API Products: NONE");
		return;
	}
	safeLog("API Products: " + apiproducts);
	for (apiproduct of apiproducts) {
		safeLog("Deleting API Product: " + apiproduct);
		await deleteEntities(config, accessToken, "apiproducts/" + apiproduct);
	}
}

async function deleteReports(config, accessToken) {
	safeLog("** Deleting Custom Reports");
	let reports = await getEntities(config, accessToken, "reports");
	if (reports.qualifier.length == 0) {
		safeLog("Reports: NONE");
		return;
	}
	for (report of reports.qualifier) {
		safeLog("Deleting Report: " + report.name);
		await deleteEntities(config, accessToken, "reports/" + report.name);
	}
}

async function deleteSharedFlows(config, accessToken) {
	safeLog("** Deleting SharedFlows");
	let sharedFlows = await getEntities(config, accessToken, "sharedflows");
	if (sharedFlows.length == 0) {
		safeLog("Sharedflows: NONE");
		return;
	}
	safeLog("Sharedflows: " + sharedFlows);
	for (sharedFlow of sharedFlows) {
		let resp = await getEntities(config, accessToken, "sharedflows/" + sharedFlow + "/deployments");
		if (resp.length == 0) {
			safeLog("Deployments: NONE");
			continue;
		}
		for (e of resp.environment) {
			//if(e.name === config.env){
			if (e == null || e.revision == null || e.revision[0] == null || e.revision[0].name == null) {
				safeLog("Failed to resolve revision.")
				continue;
			}
			let revision = e.revision[0].name;
			safeLog("Undeploying Revision:" + revision + " of sharedflow: " + sharedFlow);
			await deleteEntities(config, accessToken, "/environments/" + e.name + "/sharedflows/" + sharedFlow + "/revisions/" + revision + "/deployments");
			//}
		}
		safeLog("Deleting sharedflow: " + sharedFlow);
		await deleteEntities(config, accessToken, "sharedflows/" + sharedFlow);
	}
}

async function deleteAPIProxies(config, accessToken) {
	safeLog("** Deleting API Proxies");
	let apis = await getEntities(config, accessToken, "apis");
	let ignoreAPIs = ["oauth", "helloworld", "apigee-test_bundle"];
	apis = apis.filter(item => !ignoreAPIs.includes(item));
	if (apis.length == 0) {
		safeLog("API Proxies: NONE");
		return;
	}
	//let ignoreAPIs = ["oauth", "helloworld", "apigee-test_bundle"];
	//apis = apis.filter(item => !ignoreAPIs.includes(item));
	safeLog("API Proxies: " + apis);
	for (api of apis) {
		let resp = await getEntities(config, accessToken, "apis/" + api + "/deployments");
		if (resp.length == 0) {
			safeLog("Deployments: NONE");
			return;
		}
		for (e of resp.environment) {
			//if(e.name === config.env){
			let revision = e.revision[0].name;
			safeLog("Undeploying Revision:" + revision + " of API Proxy: " + api);
			await deleteEntities(config, accessToken, "/environments/" + e.name + "/apis/" + api + "/revisions/" + revision + "/deployments");
			//}
		}
		safeLog("Deleting API Proxy: " + api);
		await deleteEntities(config, accessToken, "apis/" + api);
	}
}

async function deleteSpecs(config, accessToken) {
	safeLog("** Deleting Specs");
	let specs = await getSpecs(config, accessToken);
	if (specs.length == 0) {
		safeLog("API Specs: NONE");
		return;
	}
	safeLog("API Specs: " + specs);
	for (spec of specs) {
		await deleteSpec(accessToken, spec)
	}
}

async function deleteAPIPortals(config, accessToken) {
	safeLog("** Deleting API Portals");
	let portals = await getPortals(config, accessToken);
	if (portals.length == 0) {
		safeLog("Portals: NONE");
		return;
	}
	safeLog(portals);
	for (portal of portals) {
		await deletePortal(config, accessToken, portal)
	}
}

async function deleteExtensions(config, accessToken) {
	safeLog("** Deleting Extensions");
	let envs = ["test", "prod", "portal"];
	for (env of envs) {
		let extensions = await getAllExtensionsInEnv(config, accessToken, env);
		if (extensions.length == 0) {
			safeLog("No extensions found in " + env);
			continue;
		}
		safeLog(extensions);
		for (extension of extensions) {
			await undeployExtension(accessToken, extension);
			await deleteExtension(accessToken, extension);
		}
	}
}

async function getSpecs(config, accessToken) {
	let options = {
		method: "GET",
		uri: "https://apigee.com/organizations/" + config.org + "/specs/folder/home",
		headers: {
			"Authorization": "Bearer " + accessToken
		},
		json: true
	};
	try {
		let parsedBody = await rp(options);
		let contents = parsedBody.contents;
		let specs = [];
		for (content of contents) {
			specs.push(content.self);
		}
		return specs;
	}
	catch (err) {
		safeLog(err);
	}
}

async function getPortals(config, accessToken) {
	let options = {
		method: "GET",
		uri: "https://api.enterprise.apigee.com/v1/portals/api/sites?orgname=" + config.org,
		headers: {
			"Authorization": "Bearer " + accessToken
		},
		json: true
	};
	try {
		let parsedBody = await rp(options);
		let contents = parsedBody.data;
		let portals = [];
		for (content of contents) {
			portals.push(content.id);
		}
		return portals;
	}
	catch (err) {
		safeLog(err);
	}
}

async function deleteSpec(accessToken, spec) {
	safeLog("Deleting spec: " + spec);
	let options = {
		method: "DELETE",
		uri: "https://apigee.com" + spec,
		headers: {
			"Authorization": "Bearer " + accessToken
		},
		json: true
	};
	try {
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch (err) {
		safeLog(err);
	}
}


async function undeployExtension(accessToken, extension) {
	safeLog("Undeploying extensions in " + env + " environment");
	let options = {
		method: "PATCH",
		uri: extension,
		headers: {
			"Authorization": "Bearer " + accessToken
		},
		body: {
			state: "UNDEPLOYED"
		},
		json: true
	};
	try {
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch (err) {
		safeLog(err);
	}
}

async function getAllExtensionsInEnv(config, accessToken, env) {
	let options = {
		method: "GET",
		uri: "https://api.enterprise.apigee.com/v1/organizations/" + config.org + "/environments/" + env + "/extensions",
		headers: {
			"Authorization": "Bearer " + accessToken
		},
		json: true
	};
	try {
		let parsedBody = await rp(options);
		let contents = parsedBody.contents;
		let extensions = [];
		for (content of contents) {
			extensions.push(content.self);
		}
		return extensions;
	}
	catch (err) {
		safeLog(err);
	}
}

async function deleteExtension(accessToken, extension) {
	let options = {
		method: "DELETE",
		uri: extension,
		headers: {
			"Authorization": "Bearer " + accessToken
		},
		json: true
	};
	try {
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch (err) {
		safeLog(err);
	}
}

async function deletePortal(config, accessToken, portal) {
	safeLog("Deleting API Portal: " + portal);
	let options = {
		method: "POST",
		uri: "https://apigee.com/portals/api/sites/" + portal + "/trash",
		headers: {
			"Authorization": "Bearer " + accessToken,
			"X-Org-Name": config.org
		},
		json: true
	};
	try {
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch (err) {
		safeLog(err);
	}
}


async function getEntities(config, accessToken, entity) {
	safeLog("Fetching " + entity + " from Apigee org: " + config.org);
	let options = {
		method: "GET",
		uri: mgmtURL + "/" + config.org + "/" + entity,
		headers: {
			"Authorization": "Bearer " + accessToken
		},
		json: true
	};
	try {
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch (err) {
		safeLog(err);
		return null;
	}
}

async function deleteEntities(config, accessToken, entity) {
	safeLog("Deleting " + entity + " from Apigee org: " + config.org);
	let options = {
		method: "DELETE",
		uri: mgmtURL + "/" + config.org + "/" + entity,
		headers: {
			"Authorization": "Bearer " + accessToken
		},
		json: true
	};
	try {
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch (err) {
		safeLog(err);
	}
}

async function getAccessToken(config) {
	safeLog("Getting OAuth Access token");
	let options = {
		method: "POST",
		uri: mgmtOAuthURL + "?mfa_token=" + config.mfaToken,
		form: {
			grant_type: "password",
			username: config.username,
			password: config.password,
			client_id: "edgecli",
			client_secret: "edgeclisecret"
		},
		json: true
	};
	try {
		let parsedBody = await rp(options);
		let accessToken = parsedBody.access_token;
		return accessToken;
	}
	catch (err) {
		safeLog(err);
	}
}

// strip Basic auth from logging
function safeLog(obj) {
	let str = util.inspect(obj);
	console.log(str.replace(/Basic [+/A-Za-z0-9]+/g, 'Basic ******'));
}

