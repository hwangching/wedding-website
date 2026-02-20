/**
 * Google Apps Script (GAS) Backend for Admin Seat Manager
 * 
 * Deployment Instructions:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this entire code into `Code.gs`.
 * 4. Click Deploy > New deployment.
 * 5. Select type: Web App.
 * 6. Execute as: "Me".
 * 7. Who has access: "Anyone".
 * 8. Click Deploy and authorize if prompted.
 * 9. Copy the Web App URL and set it as VITE_GAS_ADMIN_URL in your .env file.
 */

const SHEET_NAME_TEMP = 'Seat(temp)';
const SHEET_NAME_CONFIRM = 'Seat(final)';

function getSpreadsheet() {
    return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheetData(sheetName) {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    // Create sheet if it doesn't exist to prevent errors
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        // Add default headers
        sheet.appendRow(['Name', 'Table', 'Seat', 'Note']);
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Empty or just headers

    const headers = data[0];
    const rows = data.slice(1);

    return rows.map(row => {
        let obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index];
        });
        return obj;
    });
}

// GET Request Handler
// Allowed actions: 'get_temp', 'get_confirm'
function doGet(e) {
    const action = e.parameter.action;

    try {
        if (action === 'get_temp') {
            const data = getSheetData(SHEET_NAME_TEMP);
            return returnSuccess(data);
        } else if (action === 'get_confirm') {
            const data = getSheetData(SHEET_NAME_CONFIRM);
            return returnSuccess(data);
        } else {
            // Default: Return both or return an error depending on your need
            return returnError("Invalid action for GET. Use ?action=get_temp or ?action=get_confirm");
        }
    } catch (error) {
        return returnError(error.toString());
    }
}

// POST Request Handler
// Allowed actions: 'update_temp_row', 'publish_to_confirm', 'sync_confirm_to_temp', 'clear_temp'
function doPost(e) {
    try {
        const postData = JSON.parse(e.postData.contents);
        const action = postData.action;

        if (action === 'update_temp_row') {
            return handleUpdateTempRow(postData);
        } else if (action === 'publish_to_confirm') {
            return handlePublishToConfirm();
        } else if (action === 'sync_confirm_to_temp') {
            return handleSyncConfirmToTemp();
        } else if (action === 'clear_temp') {
            return handleClearTemp();
        } else {
            return returnError("Invalid action for POST");
        }
    } catch (error) {
        return returnError(error.toString());
    }
}

// Updates a specific row in the temp sheet based on 'Name'
function handleUpdateTempRow(data) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME_TEMP);
    if (!sheet) return returnError("Temp sheet not found");

    const { Name, Table, Seat, Note } = data;
    if (!Name) return returnError("Name is required to update row");

    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const nameIndex = headers.indexOf('Name');

    if (nameIndex === -1) return returnError("'Name' column not found");

    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
        if (String(values[i][nameIndex]).trim() === String(Name).trim()) {
            rowIndex = i + 1; // 1-based indexing for sheets
            break;
        }
    }

    if (rowIndex > -1) {
        // Update existing row
        const tableIndex = headers.indexOf('Table') + 1;
        const seatIndex = headers.indexOf('Seat') + 1;

        if (data.hasOwnProperty('Table') && tableIndex > 0) sheet.getRange(rowIndex, tableIndex).setValue(Table);
        if (data.hasOwnProperty('Seat') && seatIndex > 0) sheet.getRange(rowIndex, seatIndex).setValue(Seat);

        return returnSuccess({ message: "Row updated successfully" });
    } else {
        // Row not found
        return returnError("Guest not found in temp sheet");
    }
}

// Publish: Copy everything from temp to confirm
function handlePublishToConfirm() {
    const ss = getSpreadsheet();
    const tempSheet = ss.getSheetByName(SHEET_NAME_TEMP);
    let confirmSheet = ss.getSheetByName(SHEET_NAME_CONFIRM);

    if (!tempSheet) return returnError("Temp sheet not found");
    if (!confirmSheet) {
        confirmSheet = ss.insertSheet(SHEET_NAME_CONFIRM);
    }

    // Clear confirm sheet
    confirmSheet.clear();

    // Get data from temp and set to confirm
    const tempDataRange = tempSheet.getDataRange();
    const tempData = tempDataRange.getValues();

    if (tempData.length > 0) {
        confirmSheet.getRange(1, 1, tempData.length, tempData[0].length).setValues(tempData);
    }

    return returnSuccess({ message: "Published to confirm sheet successfully" });
}

// Sync: Copy everything from confirm to temp (for initialization or reload)
function handleSyncConfirmToTemp() {
    const ss = getSpreadsheet();
    const confirmSheet = ss.getSheetByName(SHEET_NAME_CONFIRM);
    let tempSheet = ss.getSheetByName(SHEET_NAME_TEMP);

    if (!confirmSheet) return returnError("Confirm sheet not found");
    if (!tempSheet) {
        tempSheet = ss.insertSheet(SHEET_NAME_TEMP);
    }

    // Clear temp sheet
    tempSheet.clear();

    // Get data from confirm and set to temp
    const confirmDataRange = confirmSheet.getDataRange();
    const confirmData = confirmDataRange.getValues();

    if (confirmData.length > 0) {
        tempSheet.getRange(1, 1, confirmData.length, confirmData[0].length).setValues(confirmData);
    }

    return returnSuccess({ message: "Synced confirm data to temp sheet successfully" });
}

// Reset: Keep names from confirm, but clear Table and Seat in temp
function handleClearTemp() {
    const ss = getSpreadsheet();
    let tempSheet = ss.getSheetByName(SHEET_NAME_TEMP);
    const confirmSheet = ss.getSheetByName(SHEET_NAME_CONFIRM);

    if (!tempSheet && !confirmSheet) return returnError("Required sheets not found");

    if (!tempSheet) {
        tempSheet = ss.insertSheet(SHEET_NAME_TEMP);
    }

    // We want to reset temp. If we have a confirm sheet, copy it over but clear assignments.
    // If we don't have a confirm sheet but have temp, just clear assignments in temp.

    let sourceData = [];
    if (confirmSheet) {
        sourceData = confirmSheet.getDataRange().getValues();
    } else {
        sourceData = tempSheet.getDataRange().getValues();
    }

    if (sourceData.length <= 1) {
        return returnSuccess({ message: "No data to reset" });
    }

    const headers = sourceData[0];
    const tableIndex = headers.indexOf('Table');
    const seatIndex = headers.indexOf('Seat');

    // Clear table and seat for all rows
    for (let i = 1; i < sourceData.length; i++) {
        if (tableIndex > -1) sourceData[i][tableIndex] = '';
        if (seatIndex > -1) sourceData[i][seatIndex] = '';
    }

    tempSheet.clear();
    tempSheet.getRange(1, 1, sourceData.length, sourceData[0].length).setValues(sourceData);

    return returnSuccess({ message: "Temp sheet reset successfully" });
}

function returnSuccess(data) {
    return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: data
    })).setMimeType(ContentService.MimeType.JSON);
}

function returnError(message) {
    return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: message
    })).setMimeType(ContentService.MimeType.JSON);
}

// Helper block to allow CORS from fetch API
function doOptions(e) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
    return ContentService.createTextOutput("")
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(headers);
}
