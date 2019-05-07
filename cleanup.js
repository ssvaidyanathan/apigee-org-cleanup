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
      }
    }
  };
 
//
// Start the prompt
//
prompt.start();

prompt.get(schema, async function (err, config) {
  await deleteAppsAndDevelopers(config);
  await deleteAPIProducts(config);
  await deleteReports(config);
  await deleteSharedFlows(config);
  await deleteExtensions(config);
  await deleteAPIProxies(config);
  await deleteAPIPortals(config);
  await deleteSpecs(config);
});

let mgmtURL = "https://api.enterprise.apigee.com/v1/organizations";
let mgmtOAuthURL = "https://login.apigee.com/oauth/token";

async function deleteAppsAndDevelopers(config){
	safeLog("Deleting Apps");
	let developers = await getEntities(config, "developers");
	if (developers == null) {
		safeLog("Developers: NONE");
		return;
	}
	safeLog("Developers: "+developers);
	for (developer of developers){
		safeLog("Fetching Apps for "+developer);
	  	let apps = await getEntities(config, "developers/"+developer+"/apps");
			if (apps == null) {
				safeLog("Apps: NONE");
				continue;
			}
	  	safeLog("Apps: "+apps);
	  	for (app of apps){
	  		await deleteEntities(config, "developers/"+developer+"/apps/"+app);
	  	}
	  	safeLog("Deleting developer: "+developer);
	  	await deleteEntities(config, "developers/"+developer);
	}
}

async function deleteAPIProducts(config){
	safeLog("Deleting API Products");
	let apiproducts = await getEntities(config, "apiproducts");
	if (apiproducts == null) {
		safeLog("API Products: NONE");
		return;
	}
	safeLog("API Products: "+apiproducts);
	for (apiproduct of apiproducts){
	  	safeLog("Deleting API Product: "+apiproduct);
	  	await deleteEntities(config, "apiproducts/"+apiproduct);
	}
}

async function deleteReports(config){
	safeLog("Deleting Custom Reports");
	let reports = await getEntities(config, "reports");
	if (reports == null) {
		safeLog("Reports: NONE");
		return;
	}
	for (report of reports.qualifier){
	  	safeLog("Deleting Report: "+report.name);
	  	await deleteEntities(config, "reports/"+report.name);
	}
}

async function deleteSharedFlows(config){
	safeLog("Deleting SharedFlows");
	let sharedFlows = await getEntities(config, "sharedflows");
	if (sharedFlows == null) {
		safeLog("Sharedflows: NONE");
		return;
	}
	safeLog("Sharedflows: "+sharedFlows);
	for (sharedFlow of sharedFlows){
	  	let resp = await getEntities(config, "sharedflows/"+sharedFlow+"/deployments");
			if (resp == null) {
				safeLog("Deployments: NONE");
				continue;
			}
	  	for (e of resp.environment){
	  		//if(e.name === config.env){
					if (e == null || e.revision == null || e.revision[0] == null || e.revision[0].name == null) {
						safeLog("Failed to resolve revision.")
						continue;
					}
	  			let revision = e.revision[0].name;
	  			safeLog("Undeploying Revision:"+revision+" of sharedflow: "+sharedFlow);
	  			await deleteEntities(config, "/environments/"+e.name+"/sharedflows/"+sharedFlow+"/revisions/"+revision+"/deployments");
	  		//}
	  	}
	  	safeLog("Deleting sharedflow: "+sharedFlow);
	  	await deleteEntities(config, "sharedflows/"+sharedFlow);
	}
}

async function deleteAPIProxies(config){
	safeLog("Deleting API Proxies");
	let apis = await getEntities(config, "apis");
	if (apis === null) {
		safeLog("API Proxies: NONE");
		return;
	}
	let ignoreAPIs = ["oauth", "helloworld", "apigee-test_bundle"];
	apis = apis.filter(item => !ignoreAPIs.includes(item));
	safeLog("API Proxies: "+apis);
	for (api of apis){
	  	let resp = await getEntities(config, "apis/"+api+"/deployments");
			if (resp === null) {
				safeLog("Deployments: NONE");
				return;
			}
	  	for (e of resp.environment){
	  		//if(e.name === config.env){
	  			let revision = e.revision[0].name;
	  			safeLog("Undeploying Revision:"+revision+" of API Proxy: "+api);
	  			await deleteEntities(config, "/environments/"+e.name+"/apis/"+api+"/revisions/"+revision+"/deployments");
	  		//}
	  	}
	  	safeLog("Deleting API Proxy: "+api);
	  	await deleteEntities(config, "apis/"+api);
	}
}

async function deleteSpecs(config){
	safeLog("Deleting Specs");
	let accessToken = await getAccessToken(config);
	let specs = await getSpecs(config, accessToken);
	safeLog(specs);
	for (spec of specs){
		await deleteSpec(config, accessToken, spec)
	}
}

async function deleteAPIPortals(config){
	safeLog("Deleting API Portals");
	let accessToken = await getAccessToken(config);
	let portals = await getPortals(config, accessToken);
	safeLog(portals);
	for (portal of portals){
		await deletePortal(config, accessToken, portal)
	}
}

async function deleteExtensions(config){
	let accessToken = await getAccessToken(config);
	let envs = ["test", "prod", "portal"];
	for (env of envs){
		let extensions = await getAllExtensionsInEnv(config, accessToken, env);
		if (extensions == null) {
			safeLog("No extensions found in "+env);
			continue;
		}
		safeLog(extensions);
		for (extension of extensions){
			await undeployExtension(accessToken, extension);
			await deleteExtension(accessToken, extension);
		}
	}
}

async function getSpecs(config, accessToken){
	let options = {
	    method: "GET",
	    uri: "https://api.enterprise.apigee.com/v1/homeFolder/contents",
	    headers: {
        	"Authorization": "Bearer "+accessToken,
        	"X-Org-Name": config.org
    	},
	    json: true
	};
	try{
		let parsedBody = await rp(options);
		let contents = parsedBody.contents;
		let specs = [];
		for (content of contents){
			specs.push(content.self);
		}
		return specs;
	}
	catch(err){
		safeLog(err);
	}
}

async function getPortals(config, accessToken){
	let options = {
	    method: "GET",
	    uri: "https://api.enterprise.apigee.com/v1/portals/api/sites?orgname="+config.org,
	    headers: {
        	"Authorization": "Bearer "+accessToken,
        	"X-Org-Name": config.org
    	},
	    json: true
	};
	try{
		let parsedBody = await rp(options);
		let contents = parsedBody.data;
		let portals = [];
		for (content of contents){
			portals.push(content.id);
		}
		return portals;
	}
	catch(err){
		safeLog(err);
	}
}

async function deleteSpec(config, accessToken, spec){
	safeLog("Deleting spec: "+spec);
	let options = {
	    method: "DELETE",
	    uri: "https://api.enterprise.apigee.com/v1"+spec,
	    headers: {
        	"Authorization": "Bearer "+accessToken,
        	"X-Org-Name": config.org
    	},
	    json: true
	};
	try{
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch(err){
		safeLog(err);
	}
}


async function undeployExtension(accessToken, extension){
	safeLog("Undeploying extensions in "+env+" environment");
	let options = {
	    method: "PATCH",
	    uri: extension,
	    headers: {
        	"Authorization": "Bearer "+accessToken
    	},
    	body: {
        	state: "UNDEPLOYED"
    	},
	    json: true
	};
	try{
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch(err){
		safeLog(err);
	}
}

async function getAllExtensionsInEnv(config, accessToken, env){
	let options = {
	    method: "GET",
	    uri: "https://api.enterprise.apigee.com/v1/organizations/"+config.org+"/environments/"+env+"/extensions",
	    headers: {
        	"Authorization": "Bearer "+accessToken
    	},
	    json: true
	};
	try{
		let parsedBody = await rp(options);
		let contents = parsedBody.contents;
		let extensions = [];
		for (content of contents){
			extensions.push(content.self);
		}
		return extensions;
	}
	catch(err){
		safeLog(err);
	}
}

async function deleteExtension(accessToken, extension){
	let options = {
	    method: "DELETE",
	    uri: extension,
	    headers: {
        	"Authorization": "Bearer "+accessToken
    	},
	    json: true
	};
	try{
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch(err){
		safeLog(err);
	}
}

async function deletePortal(config, accessToken, portal){
	safeLog("Deleting API Portal: "+portal);
	let options = {
	    method: "POST",
	    uri: "https://apigee.com/portals/api/sites/"+portal+"/trash",
	    headers: {
        	"Authorization": "Bearer "+accessToken,
        	"X-Org-Name": config.org
    	},
	    json: true
	};
	try{
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch(err){
		safeLog(err);
	}
}


async function getEntities(config, entity){
	//safeLog("Fetching "+entity+" from Apigee org: "+config.org);
	let auth = Buffer.from(config.username+":"+config.password).toString('base64')
	let options = {
	    method: "GET",
	    uri: mgmtURL+"/"+config.org+"/"+entity,
	    headers: {
        	"Authorization": "Basic "+auth
    	},
	    json: true
	};
	try{
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch(err){
		safeLog(err);
		return null;
	}
}

async function deleteEntities(config, entity){
	safeLog("Deleting "+entity+" from Apigee org: "+config.org);
	let auth = Buffer.from(config.username+":"+config.password).toString('base64')
	let options = {
	    method: "DELETE",
	    uri: mgmtURL+"/"+config.org+"/"+entity,
	    headers: {
        	"Authorization": "Basic "+auth
    	},
	    json: true
	};
	try{
		let parsedBody = await rp(options);
		return parsedBody;
	}
	catch(err){
		safeLog(err);
	}
}

async function getAccessToken(config){
	safeLog("Getting OAuth Access token");
	let options = {
	    method: "POST",
	    uri: mgmtOAuthURL,
	    form: {
	        grant_type: "password",
	        username: config.username,
	        password: config.password,
			client_id: "edgecli",
			client_secret: "edgeclisecret"
	    },
	    json: true
	};
	try{
		let parsedBody = await rp(options);
		let accessToken = parsedBody.access_token;
		return accessToken;
	}
	catch(err){
		safeLog(err);
	}
}

// strip Basic auth from logging
function safeLog(obj) {
	let str = util.inspect(obj);
	console.log(str.replace(/Basic [+/A-Za-z0-9]+/g,'Basic ******'));
}

