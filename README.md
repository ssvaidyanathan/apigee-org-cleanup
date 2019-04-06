# apigee-org-cleanup
Clean up script for Apigee Orgs

## Pre-req
- NodeJS 8.x or later

## Steps
- Run `npm install` to install the dependencies
- Run `node cleanup.js` and provide the Apigee org, username and password
- Should remove the following:
  - Developer Apps
  - Developers
  - API Products
  - Custom Reports
  - Shared Flows
  - Extensions
  - API Proxies
  - API Portals
  - API Specs
