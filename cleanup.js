var prompt = require("prompt");
var colors = require("colors/safe");
const rp = require("request-promise");

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
  //await deleteExtensions(config);
  await deleteAPIProxies(config);
  await deleteAPIPortals(config);
  await deleteSpecs(config);
});

let mgmtURL = "https://api.enterprise.apigee.com/v1/organizations";
let mgmtOAuthURL = "https://login.apigee.com/oauth/token";

async function deleteAppsAndDevelopers(config){
	console.log("Deleting Apps");
	let developers = await getEntities(config, "developers");
	console.log("Developers: "+developers);
	for (developer of developers){
		console.log("Fetching Apps for "+developer);
	  	let apps = await getEntities(config, "developers/"+developer+"/apps");
	  	console.log("Apps: "+apps);
	  	for (app of apps){
	  		await deleteEntities(config, "developers/"+developer+"/apps/"+app);
	  	}
	  	console.log("Deleting developer: "+developer);
	  	await deleteEntities(config, "developers/"+developer);
	}
}

async function deleteAPIProducts(config){
	console.log("Deleting API Products");
	let apiproducts = await getEntities(config, "apiproducts");
	console.log("API Products: "+apiproducts);
	for (apiproduct of apiproducts){
	  	console.log("Deleting API Product: "+apiproduct);
	  	await deleteEntities(config, "apiproducts/"+apiproduct);
	}
}

async function deleteReports(config){
	console.log("Deleting Custom Reports");
	let reports = await getEntities(config, "reports");
	for (report of reports.qualifier){
	  	console.log("Deleting Report: "+report.name);
	  	await deleteEntities(config, "reports/"+report.name);
	}
}

async function deleteSharedFlows(config){
	console.log("Deleting SharedFlows");
	let sharedFlows = await getEntities(config, "sharedflows");
	console.log("Sharedflows: "+sharedFlows);
	for (sharedFlow of sharedFlows){
	  	let resp = await getEntities(config, "sharedflows/"+sharedFlow+"/deployments");
	  	for (e of resp.environment){
	  		//if(e.name === config.env){
	  			let revision = e.revision[0].name;
	  			console.log("Undeploying Revision:"+revision+" of sharedflow: "+sharedFlow);
	  			await deleteEntities(config, "/environments/"+e.name+"/sharedflows/"+sharedFlow+"/revisions/"+revision+"/deployments");
	  		//}
	  	}
	  	console.log("Deleting sharedflow: "+sharedFlow);
	  	await deleteEntities(config, "sharedflows/"+sharedFlow);
	}
}

async function deleteAPIProxies(config){
	console.log("Deleting API Proxies");
	let apis = await getEntities(config, "apis");
	let ignoreAPIs = ["oauth", "helloworld", "apigee-test_bundle"];
	apis = apis.filter(item => !ignoreAPIs.includes(item));
	console.log("API Proxies: "+apis);
	for (api of apis){
	  	let resp = await getEntities(config, "apis/"+api+"/deployments");
	  	for (e of resp.environment){
	  		//if(e.name === config.env){
	  			let revision = e.revision[0].name;
	  			console.log("Undeploying Revision:"+revision+" of API Proxy: "+api);
	  			await deleteEntities(config, "/environments/"+e.name+"/apis/"+api+"/revisions/"+revision+"/deployments");
	  		//}
	  	}
	  	console.log("Deleting API Proxy: "+api);
	  	await deleteEntities(config, "apis/"+api);
	}
}

async function deleteSpecs(config){
	console.log("Deleting Specs");
	let accessToken = await getAccessToken(config);
	let specs = await getSpecs(config, accessToken);
	console.log(specs);
	for (spec of specs){
		await deleteSpec(config, accessToken, spec)
	}
}

async function deleteAPIPortals(config){
	console.log("Deleting API Portals");
	let accessToken = await getAccessToken(config);
	let portals = await getPortals(config, accessToken);
	console.log(portals);
	for (portal of portals){
		await deletePortal(config, accessToken, portal)
	}
}

async function deleteExtensions(config){
	console.log("Deleting Extensions on "+env);
	let accessToken = await getAccessToken(config);
	let envs = ["test", "prod"];
	for (env of envs){
		await deleteAllExtensionsInEnv(config, accessToken, env)
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
		console.log(err);
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
		console.log(err);
	}
}

async function deleteSpec(config, accessToken, spec){
	console.log("Deleting spec: "+spec);
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
		console.log(err);
	}
}

async function deleteAllExtensionsInEnv(config, accessToken, env){
	let options = {
	    method: "DELETE",
	    uri: "https://api.enterprise.apigee.com/v1/organizations/"+config.org+"/environments/"+env+"/extensions",
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
		console.log(err);
	}
}

async function deletePortal(config, accessToken, portal){
	console.log("Deleting API Portal: "+portal);
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
		console.log(err);
	}
}


async function getEntities(config, entity){
	//console.log("Fetching "+entity+" from Apigee org: "+config.org);
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
		console.log(err);
	}
}

async function deleteEntities(config, entity){
	console.log("Deleting "+entity+" from Apigee org: "+config.org);
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
		console.log(err);
	}
}

async function getAccessToken(config){
	console.log("Getting OAuth Access token");
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
		console.log(err);
	}
}


