const { convertArrayToCSV } = require("convert-array-to-csv");
const fs = require("fs");
const util = require("util");
const converter = require("convert-array-to-csv");
const hubspot = require("@hubspot/api-client");

var https = require("https");
var http = require("http");
https.globalAgent.maxSockets = 5;
http.globalAgent.maxSockets = 5;

// CONFIGURATION
const apiKey = "";
const exportPath = "";
const importPath = "";
var totalFiles = 22;
const startingFile = 8;
const batch = false;

function getExportPath(i) {
  return exportPath + i + ".csv";
}

function getImportPath(i) {
  return importPath + i + ".csv";
}

const hubspotClient = new hubspot.Client({
  apiKey: apiKey,
});

async function getContacts() {
  const limit = 10;
  return await await hubspotClient.apiRequest({
    method: "GET",
    path: `/crm/v3/objects/contacts?limit=${limit}&associations=notes%2Ccalls%2Cemails&archived=false&hapikey=${apiKey}`,
  });
}

function wait(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

/*
 Wrapper to avoid the API limits
*/
async function hubspotRequest(request) {
  var response = await hubspotClient.apiRequest(request);
  while (!!response.status && response.status == "error") {
    console.log("¡¡ALERT!! Waiting...");
    await wait(20000);
    response = await hubspotClient.apiRequest(request);
  }
  return response;
}

async function readContact(contact_id) {
  if (contact_id === "") return false;

  return await hubspotRequest({
    method: "GET",
    path: `/crm/v3/objects/contacts/${contact_id}?associations=notes%2Ccalls%2Cemails%2Ctasks%2Cmeetings&archived=false&hapikey=${apiKey}`,
  });
}

async function readCall(call_id) {
  if (call_id === "") return false;

  return await hubspotRequest({
    method: "GET",
    path: `/crm/v3/objects/calls/${call_id}?archived=false&hapikey=${apiKey}`,
  });
}

async function readNote(note_id) {
  if (note_id === "") return false;

  return await hubspotRequest({
    method: "GET",
    path: `/crm/v3/objects/notes/${note_id}?properties=hs_note_body&archived=false&hapikey=${apiKey}`,
  });
}

async function readEmail(email_id) {
  if (email_id === "") return false;

  return await hubspotRequest({
    method: "GET",
    path: `/crm/v3/objects/emails/${email_id}?properties=hs_email_text&archived=false&hapikey=${apiKey}`,
  });
}

async function readTask(task_id) {
  if (task_id === "") return false;

  return await hubspotRequest({
    method: "GET",
    path: `/crm/v3/objects/tasks/${task_id}?properties=hs_task_body%2Chs_task_subject%2Chs_task_status%2Chs_task_priority&archived=false&hapikey=${apiKey}`,
  });
}

async function readMeeting(meeting_id) {
  if (meeting_id === "") return false;

  return await hubspotRequest({
    method: "GET",
    path: `/crm/v3/objects/meetings/${meeting_id}?properties=hs_meeting_title%2Chs_meeting_body&archived=false&hapikey=${apiKey}`,
  });
}

/*
  Receives the array of Notes Simple Object and return the array of Full Notes.
  Notes Simple: [{id: '', property: ''}]
 */
async function getNotes(notes) {
  const promises = notes.map(async (note) => {
    const result = await readNote(note.id);
    result.separator = "|";
    delete result.archived;
    delete result.properties.hs_createdate;
    delete result.properties.hs_lastmodifieddate;
    delete result.properties.hs_object_id;
    return result;
  });
  return Promise.all(promises);
}

/*
  Receives the array of Calls Simple Object and return the array of Full Calls.
  Calls Simple: [{id: '', property: ''}]
 */
async function getCalls(calls) {
  const promises = calls.map(async (call) => {
    const result = await readCall(call.id);
    result.separator = "|";
    delete result.archived;
    delete result.properties;
    return result;
  });
  return Promise.all(promises);
}

/*
  Receives the array of Emails Simple Object and return the array of Full Emails.
  Emails Simple: [{id: '', property: ''}]
 */
async function getEmails(emails) {
  const promises = emails.map(async (email) => {
    const result = await readEmail(email.id);
    result.separator = "|";
    delete result.archived;
    delete result.properties.hs_createdate;
    delete result.properties.hs_lastmodifieddate;
    delete result.properties.hs_object_id;
    return result;
  });
  return Promise.all(promises);
}

/*
  Receives the array of Tasks Simple Object and return the array of Full Tasks.
  Tasks Simple: [{id: '', property: ''}]
 */
async function getTasks(tasks) {
  const promises = tasks.map(async (task) => {
    const result = await readTask(task.id);
    result.separator = "|";
    delete result.archived;
    delete result.properties.hs_createdate;
    delete result.properties.hs_lastmodifieddate;
    delete result.properties.hs_object_id;
    return result;
  });
  return Promise.all(promises);
}

/*
  Receives the array of Meetings Simple Object and return the array of Full Meetings.
  Meetings Simple: [{id: '', property: ''}]
 */
async function getMeetings(meetings) {
  const promises = meetings.map(async (meeting) => {
    const result = await readMeeting(meeting.id);
    result.separator = "|";
    delete result.archived;
    delete result.properties.hs_createdate;
    delete result.properties.hs_lastmodifieddate;
    delete result.properties.hs_object_id;
    return result;
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

function readCsv(index) {
  console.log("Leyendo CSV");
  try {
    const data = fs.readFileSync(getImportPath(index), "utf8");
    console.log("Leido!");
    return data.split("\n");
  } catch (err) {
    console.error("error:", err);
  }
}

async function fillUpContacts(index) {
  const contacts = readCsv(index);
  console.log("Recibo CSV");
  const promises = contacts
    .filter((e) => e != "")
    .map(async (id) => {
      var result = await readContact(id);
      if (result) {
        console.log(id);
        console.log(result);
        // Associations
        if (!!result.associations && !!result.associations.notes) {
          result.separator_notes = "Notes:";
          result.notes = await getNotes(result.associations.notes.results);
        }
        if (!!result.associations && !!result.associations.calls) {
          result.separator_calls = "Calls:";
          result.calls = await getCalls(result.associations.calls.results);
        }
        if (!!result.associations && !!result.associations.emails) {
          result.separator_emails = "Emails:";
          result.emails = await getEmails(result.associations.emails.results);
        }
        if (!!result.associations && !!result.associations.tasks) {
          result.separator_tasks = "Tasks:";
          result.tasks = await getTasks(result.associations.tasks.results);
        }
        // if (!!result.associations && !!result.associations.meetings) {
        //   result.separator_meetings = "Meetings:";
        //   result.meetings = await getMeetings(result.associations.meetings.results);
        // }

        // // Remove unused keys
        delete result.properties.createdate;
        delete result.properties.lastmodifieddate;
        delete result.properties.hs_object_id;
        delete result.associations;
        delete result.archived;

        return flattenObject(result);
      }
    });

  return Promise.all(promises);
}

/* END OF FUNCTIONS */

const start = async (_) => {
  // With this, the loop is limited to 1 iteration
  if (!batch) totalFiles = startingFile;

  for (var index = startingFile; index <= totalFiles; index++) {
    const contacts = await fillUpContacts(index);

    console.log("Writing CSV...");
    console.log(getExportPath(index));
    console.log(
      util.inspect(contacts, { showHidden: false, depth: null, colors: true })
    );

    const csv = convertArrayToCSV(contacts);
    try {
          fs.writeFileSync(
            getExportPath(index),
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
  }
};

start();
