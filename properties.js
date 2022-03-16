const { convertArrayToCSV } = require("convert-array-to-csv");
const fs = require("fs");
const util = require('util');
const converter = require("convert-array-to-csv");
const hubspot = require("@hubspot/api-client");
const apiKey = "";
const hubspotClient = new hubspot.Client({
  apiKey: apiKey,
});

var contacts_storage = [];

async function getProperties() {
  return await hubspotClient.apiRequest({
    method: "GET",
    path: `/crm/v3/properties/contact?archived=false&hapikey=${apiKey}`,
  });
}

async function cleanProperties() {
  const properties = await getProperties();
  return properties.results.map((result) => {
    return {
      name: result.name,
      label: result.label,
      createdAt: result.createdAt,
      type: result.type,
      fieldType: result.fieldType,
      description: result.description,
      groupName: result.groupName,
    };
  });
}



cleanProperties().then((properties) => {
  //console.log(util.inspect(properties, {showHidden: false, depth: null, colors: true}));

  const csv = convertArrayToCSV(properties)
  try {
    fs.writeFileSync(
      "/home/enriquearranz/eden/hubspot/properties.csv",
      csv,
      {
        flag: "w+",
      },
      (err) => {}
    );
    //file written successfully
  } catch (err) {
    console.error(err);
  }
});
