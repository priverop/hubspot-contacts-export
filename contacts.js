const { convertArrayToCSV } = require("convert-array-to-csv");
const fs = require("fs");
const util = require("util");
const converter = require("convert-array-to-csv");
const hubspot = require("@hubspot/api-client");

// MODIFY
const apiKey = "";
const exportPath = "";

const hubspotClient = new hubspot.Client({
  apiKey: apiKey,
});

async function getContacts() {
  const limit = 10;
  return await hubspotClient.apiRequest({
    method: "GET",
    path: `/crm/v3/objects/contacts?limit=${limit}&associations=notes%2Ccalls%2Cemails&archived=false&hapikey=${apiKey}`,
  });
}

async function readCall(callID) {
  return await hubspotClient.apiRequest({
    method: "GET",
    path: `/crm/v3/objects/calls/${callID}?archived=false&hapikey=${apiKey}`,
  });
}

async function readNote(noteID) {
  return await hubspotClient.apiRequest({
    method: "GET",
    path: `/crm/v3/objects/notes/${noteID}?properties=hs_note_body&archived=false&hapikey=${apiKey}`,
  });
}

async function readEmail(emailID) {
  return await hubspotClient.apiRequest({
    method: "GET",
    path: `/crm/v3/objects/emails/${emailID}?properties=hs_email_text&archived=false&hapikey=${apiKey}`,
  });
}

/*
  Receives the array of Notes Simple Object and return the array of Full Notes.
  Notes Simple: [{id: '', property: ''}]
 */
async function getNotes(notes) {
  const promises = notes.map(async (note) => {
    return await readNote(note.id);
  });
  return Promise.all(promises);
}

/*
  Receives the array of Calls Simple Object and return the array of Full Calls.
  Calls Simple: [{id: '', property: ''}]
 */
async function getCalls(calls) {
  const promises = calls.map(async (call) => {
    return await readCall(call.id);
  });
  return Promise.all(promises);
}

/*
  Receives the array of Emails Simple Object and return the array of Full Emails.
  Emails Simple: [{id: '', property: ''}]
 */
async function getEmails(emails) {
  const promises = emails.map(async (email) => {
    return await readEmail(email.id);
  });
  return Promise.all(promises);
}

// https://stackoverflow.com/questions/44134212/best-way-to-flatten-js-object-keys-and-values-to-a-single-depth-array
// by Muthukrishnan
function flattenObject(ob) {
  var toReturn = {};

  for (var i in ob) {
    if (!ob.hasOwnProperty(i)) continue;

    if (typeof ob[i] == "object" && ob[i] !== null) {
      var flatObject = flattenObject(ob[i]);
      for (var x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;

        toReturn[i + "." + x] = flatObject[x];
      }
    } else {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
}

async function fillUpContacts() {
  const contacts = await getContacts();
  const promises = contacts.results.map(async (result) => {
    // Associations
    if (!!result.associations && !!result.associations.notes) {
      result.notes = await getNotes(result.associations.notes.results);
    }
    if (!!result.associations && !!result.associations.calls) {
      result.calls = await getCalls(result.associations.calls.results);
    }
    if (!!result.associations && !!result.associations.emails) {
      result.emails = await getEmails(result.associations.emails.results);
    }

    // Remove unused keys
    delete result.properties.createdate;
    delete result.properties.lastmodifieddate;
    delete result.properties.hs_object_id;
    delete result.associations;
    delete result.archived;

    return flattenObject(result);
  });
  return Promise.all(promises);
}

fillUpContacts().then((contacts) => {
  console.log(
    util.inspect(contacts, { showHidden: false, depth: null, colors: true })
  );

  const csv = convertArrayToCSV(contacts);
  try {
    fs.writeFileSync(
      exportPath,
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
