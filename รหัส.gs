// ==== Code.gs (แก้ไขแล้ว) ====
const SS_ID = '1LGbi8jQsritWZ5MrCtZV8Uh1xR9k05EvrwULIg4kKo4';
const USERS_SHEET_NAME = 'ชีต1'; // Sheet for user data
const REPAIRS_SHEET_NAME = 'Repairs'; // New sheet for repair request data
const LOGIN_STATUS_KEY = 'loggedInUser'; // Key for login status in Cache

// ✅ เพิ่ม: Standard Status Values
const VALID_STATUSES = {
  REPORTED: 'แจ้งซ่อมแล้ว',
  IN_PROGRESS: 'กำลังดำเนินการ', 
  COMPLETED: 'เสร็จเรียบร้อย',
  CANCELLED: 'ยกเลิก'
};

/**
 * Includes HTML/CSS files from style.html.
 * @param {string} filename The name of the file to include.
 * @returns {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Opens the Web App, handling page routing based on login status and URL parameters.
 * @param {Object} e The event object containing URL parameters.
 * @returns {HtmlOutput} The HTML service output for the requested page.
 */
function doGet(e) {
  const cache = CacheService.getUserCache();
  const loggedInUser = cache.get(LOGIN_STATUS_KEY); // Check login status

  if (loggedInUser) {
    // If logged in, check 'page' parameter
    const page = e.parameter.page;
    if (page === 'Status') {
      return HtmlService
        .createTemplateFromFile('status')
        .evaluate()
        .setTitle('สถานะ & จัดการแจ้งซ่อม'); // Updated title
    } else if (page === 'ReportRepair') {
      return HtmlService
        .createTemplateFromFile('report_repair')
        .evaluate()
        .setTitle('แจ้งซ่อมใหม่');
    } else {
      // If no 'page' parameter or invalid value, go to Dashboard
      return HtmlService
        .createTemplateFromFile('Dashboard')
        .evaluate()
        .setTitle('Dashboard');
    }
  } else {
    // If not logged in, go to Login page (index.html)
    return HtmlService
      .createTemplateFromFile('index')
      .evaluate()
      .setTitle('เข้าสู่ระบบ');
  }
}

/**
 * Returns the HTML content for the registration page.
 * @returns {string} HTML content for registration.
 */
function getRegistrationPage() {
  return HtmlService.createTemplateFromFile('registration').evaluate().getContent();
}

/**
 * Returns the HTML content for the login page and clears login status from cache.
 * @returns {string} HTML content for login.
 */
function getLoginPage() {
  const cache = CacheService.getUserCache();
  cache.remove(LOGIN_STATUS_KEY); // Clear login status when navigating to login page
  return HtmlService.createTemplateFromFile('index').evaluate().getContent();
}

/**
 * Returns the HTML content for the dashboard (menu) page, checking login status.
 * @returns {string} HTML content for dashboard.
 * @throws {Error} If the user is not logged in.
 */
function getMenuPage() {
  const cache = CacheService.getUserCache();
  const loggedInUser = cache.get(LOGIN_STATUS_KEY);
  if (loggedInUser) {
    return HtmlService.createTemplateFromFile('Dashboard').evaluate().getContent();
  } else {
    throw new Error('กรุณาเข้าสู่ระบบก่อน');
  }
}

/**
 * Returns the HTML content for the repair status page, checking login status.
 * @returns {string} HTML content for repair status.
 * @throws {Error} If the user is not logged in.
 */
function getStatusPage() {
  const cache = CacheService.getUserCache();
  const loggedInUser = cache.get(LOGIN_STATUS_KEY);
  if (loggedInUser) {
    return HtmlService.createTemplateFromFile('status').evaluate().getContent();
  } else {
    throw new Error('กรุณาเข้าสู่ระบบก่อน');
  }
}

/**
 * Returns the HTML content for the new repair request page, checking login status.
 * @returns {string} HTML content for new repair request.
 * @throws {Error} If the user is not logged in.
 */
function getReportRepairPage() {
  const cache = CacheService.getUserCache();
  const loggedInUser = cache.get(LOGIN_STATUS_KEY);
  if (loggedInUser) {
    return HtmlService.createTemplateFromFile('report_repair').evaluate().getContent();
  } else {
    throw new Error('กรุณาเข้าสู่ระบบก่อน');
  }
}

// ✅ เพิ่ม: Password hashing function
function hashPassword(password) {
  if (!password) return '';
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password)
    .map(byte => (byte + 256).toString(16).slice(-2))
    .join('');
}

// ✅ เพิ่ม: Data validation functions
function validatePhoneNumber(phone) {
  if (!phone) return false;
  // Accept both formats: 0812345678 or 16299006464
  return /^[0-9]{10,12}$/.test(phone.replace(/[-\s]/g, ''));
}

function validateEmail(email) {
  if (!email) return true; // Email is optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCitizenId(id) {
  if (!id) return true; // Citizen ID is optional
  return /^[0-9]{13}$/.test(id);
}

/**
 * ✅ แก้ไข: Checks username and password against the user data sheet (columns D/E).
 * @param {string} username The username to check.
 * @param {string} password The password to check.
 * @returns {boolean} True if authentication is successful, false otherwise.
 * @throws {Error} If username/password are missing or sheet is not found/empty.
 */
function checkLogin(username, password) {
  if (!username || !password) {
    throw new Error('กรุณากรอก ชื่อผู้ใช้ และ รหัสผ่าน');
  }
  const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    throw new Error('ไม่พบชีทข้อมูลผู้ใช้');
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ');
  }

  // Get only columns D and E
  const creds = sheet.getRange(2, 4, lastRow - 1, 2).getValues();
  
  // ✅ เพิ่ม: Support both hashed and plain text passwords (for backward compatibility)
  const hashedPassword = hashPassword(password);
  
  const isAuthenticated = creds.some(r => {
    const storedUsername = String(r[0]).trim();
    const storedPassword = String(r[1]).trim();
    
    return storedUsername === username && 
           (storedPassword === password || storedPassword === hashedPassword);
  });

  if (isAuthenticated) {
    // If login is successful, store login status in CacheService
    const cache = CacheService.getUserCache();
    cache.put(LOGIN_STATUS_KEY, username, 21600); // ✅ เพิ่มเป็น 6 ชั่วโมง (21600 วินาที)
  }
  return isAuthenticated;
}

/**
 * ✅ แก้ไข: Registers a new user with improved validation and password hashing
 * @param {string} fullname User's full name.
 * @param {string} phone User's phone number.
 * @param {string} email User's email address.
 * @param {string} username User's chosen username.
 * @param {string} password User's chosen password.
 * @param {string} position User's position.
 * @returns {boolean} True if registration is successful.
 * @throws {Error} If any field is missing or validation fails.
 */
function registerNewUser(fullname, phone, email, username, password, position) {
  // ✅ เพิ่ม: Enhanced validation
  if (![fullname, phone, username, password, position].every(v => v && v.toString().trim() !== '')) {
    throw new Error('กรุณากรอกข้อมูลที่จำเป็นให้ครบ: ชื่อเต็ม, เบอร์โทร, ชื่อผู้ใช้, รหัสผ่าน, ตำแหน่ง');
  }
  
  // Validate phone number
  if (!validatePhoneNumber(phone)) {
    throw new Error('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็นตัวเลข 10-12 หลัก)');
  }
  
  // Validate email if provided
  if (email && !validateEmail(email)) {
    throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
  }

  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(USERS_SHEET_NAME);
  
  // Create sheet + header if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    sheet.appendRow(['FullName','Phone','Email','Username','Password','Position']);
  }
  
  // Check for duplicate username
  const existing = sheet.getRange(2, 4, Math.max(1, sheet.getLastRow() - 1), 1)
                        .getValues()
                        .flat();
  if (existing.includes(username)) {
    throw new Error('Username นี้มีในระบบแล้ว');
  }
  
  // ✅ แก้ไข: Hash password before saving
  const hashedPassword = hashPassword(password);
  
  // Save new data
  sheet.appendRow([fullname, phone, email || '', username, hashedPassword, position]);
  return true;
}

/**
 * Logs out the current user by clearing the login status from cache.
 * @returns {string} The HTML content for the login page after logout.
 */
function doLogout() {
  const cache = CacheService.getUserCache();
  cache.remove(LOGIN_STATUS_KEY);
  return getLoginPage(); // Return to Login page after logout
}

/**
 * Calls Gemini API to enhance repair description.
 * @param {string} initialDescription The initial description provided by the user.
 * @returns {string} The enhanced description from AI.
 * @throws {Error} If there's an issue with the API call or response.
 */
async function enhanceRepairDescription(initialDescription) {
  const apiKey = ""; // API Key will be provided by Canvas at runtime
  const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;

  // Prompt for Gemini
  const prompt = `คุณได้รับคำแจ้งซ่อมเบื้องต้นดังนี้: "${initialDescription}" กรุณาขยายความหรืออธิบายรายละเอียดของปัญหาให้ครบถ้วนและชัดเจนยิ่งขึ้น โดยเน้นข้อมูลที่จำเป็นสำหรับการซ่อมแซม เช่น ตำแหน่งที่แน่นอน ลักษณะความเสียหาย อาการที่พบ และข้อมูลอื่นๆ ที่ช่างอาจต้องการ ไม่ต้องสรุป ให้เขียนเป็นรายละเอียดเพิ่มเติม`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      return result.candidates[0].content.parts[0].text;
    } else {
      console.error("Gemini API response structure unexpected:", result);
      throw new Error("ไม่สามารถปรับปรุงรายละเอียดได้: โครงสร้างการตอบกลับจาก AI ไม่ถูกต้อง");
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("ไม่สามารถเชื่อมต่อกับ AI ได้ในขณะนี้: " + error.message);
  }
}

/**
 * ✅ แก้ไข: Function to save new repair request data with proper RepairId generation
 * @param {Object} formData Form data from the repair request.
 * @returns {boolean} True if saved successfully.
 */
function submitNewRepair(formData) {
  try {
    // ✅ เพิ่ม: Validate form data
    if (!formData.reporterName || !formData.phoneNumber || !formData.location || !formData.repairType || !formData.repairDesc) {
      throw new Error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
    }
    
    // Validate phone number
    if (!validatePhoneNumber(formData.phoneNumber)) {
      throw new Error('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง');
    }
    
    // Validate citizen ID if provided
    if (formData.citizenID && !validateCitizenId(formData.citizenID)) {
      throw new Error('หมายเลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก');
    }

    const ss = SpreadsheetApp.openById(SS_ID);
    let sheet = ss.getSheetByName(REPAIRS_SHEET_NAME);

    // Create Repairs sheet and Header if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(REPAIRS_SHEET_NAME);
      sheet.appendRow([
        'ประทับเวลา',
        'รหัสแจ้งซ่อม', 
        'ชื่อผู้แจ้ง',
        'หน่วยงาน',
        'สถานที่เกิดเหตุ',
        'เบอร์โทรศัพท์',
        'หมายเลขประจำตัวประชาชน',
        'ประเภทการแจ้งซ่อม',
        'รายละเอียดปัญหา',
        'PhotoUrl',
        'GeoStamp',
        'GeoCode',
        'GeoAddress',
        'สถานะ',
        'ผู้รับผิดชอบ'
      ]);
    }

    // ✅ แก้ไข: Generate RepairId properly
    const now = new Date();
    const timestamp = Utilities.formatDate(now, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyyMMdd-HHmmss');
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const repairId = `R-${timestamp}-${randomSuffix}`;

    // ✅ แก้ไข: Ensure data is appended correctly
    const rowData = [
      now, // Timestamp
      repairId, // ✅ RepairId - This was the main issue!
      formData.reporterName || '',
      formData.department || 'ไม่ระบุ', // ✅ Default value
      formData.location || '',
      formData.phoneNumber || '',
      formData.citizenID || '',
      formData.repairType || '',
      formData.repairDesc || '',
      formData.photoUrl || '',
      formData.geoStamp || '',
      formData.geoCode || '',
      formData.geoAddress || '',
      VALID_STATUSES.REPORTED, // ✅ Use standard status
      '' // Assignee (empty initially)
    ];

    // ✅ เพิ่ม: Logging for debugging
    console.log('Saving repair data:', {
      repairId: repairId,
      reporterName: formData.reporterName,
      status: VALID_STATUSES.REPORTED
    });

    sheet.appendRow(rowData);
    
    // ✅ เพิ่ม: Clear cache to refresh dashboard
    const cache = CacheService.getUserCache();
    cache.remove('dashboard_summary_cache');
    
    return true;
    
  } catch (error) {
    console.error('Error in submitNewRepair:', error);
    throw new Error(`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${error.message}`);
  }
}

/**
 * ✅ แก้ไข: Function to retrieve repair request data with better error handling
 * Returns properties with exact header names (Thai headers).
 * @returns {Array<Object>} An array of repair data objects.
 * @throws {Error} If the user is not logged in.
 */
function getRepairData() {
  try {
    const cache = CacheService.getUserCache();
    if (!cache.get(LOGIN_STATUS_KEY)) {
      throw new Error('กรุณาเข้าสู่ระบบก่อน');
    }

    const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(REPAIRS_SHEET_NAME);
    if (!sheet) {
      console.log('Repairs sheet not found');
      return []; // Return empty array instead of null
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      console.log('No data in repairs sheet');
      return []; // Return empty array instead of null
    }

    const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    const values = range.getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    console.log('Headers found:', headers);
    console.log('Data rows count:', values.length);

    // ✅ แก้ไข: Map values using Thai headers and handle null values
    const data = values.map((row, index) => {
      const item = {};
      headers.forEach((header, colIndex) => {
        if (header === 'ประทับเวลา' && row[colIndex] instanceof Date) {
          // Format Timestamp for display
          item[header] = Utilities.formatDate(row[colIndex], SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm');
        } else {
          // Handle null/undefined values
          item[header] = row[colIndex] != null ? row[colIndex] : '';
        }
      });
      
      // ✅ เพิ่ม: Generate RepairId if missing
      if (!item['รหัสแจ้งซ่อม'] || item['รหัสแจ้งซ่อม'] === '') {
        const timestamp = new Date();
        const timestampStr = Utilities.formatDate(timestamp, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyyMMdd-HHmmss');
        item['รหัสแจ้งซ่อม'] = `R-${timestampStr}-${(index + 1).toString().padStart(3, '0')}`;
        
        // ✅ อัปเดต RepairId กลับไปในชีท
        const repairIdColIndex = headers.indexOf('รหัสแจ้งซ่อม');
        if (repairIdColIndex !== -1) {
          sheet.getRange(index + 2, repairIdColIndex + 1).setValue(item['รหัสแจ้งซ่อม']);
        }
      }
      
      return item;
    });

    console.log('Processed data:', data.length, 'items');
    return data.reverse(); // Display latest data first
    
  } catch (error) {
    console.error('Error in getRepairData:', error);
    
    // ถ้าเป็น login error ให้ throw ต่อไป
    if (error.message.includes('เข้าสู่ระบบ')) {
      throw error;
    }
    
    // Error อื่นๆ ให้ return empty array
    return [];
  }
}

/**
 * ✅ แก้ไข: Function to retrieve detailed repair information by RepairId
 * @param {string} repairId The ID of the repair request.
 * @returns {Object|null} The repair detail object, or null if not found.
 * @throws {Error} If the user is not logged in or no repair data is found.
 */
function getRepairDetails(repairId) {
  const cache = CacheService.getUserCache();
  if (!cache.get(LOGIN_STATUS_KEY)) {
    throw new Error('กรุณาเข้าสู่ระบบก่อน');
  }

  const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(REPAIRS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('ไม่พบข้อมูลการแจ้งซ่อม');
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    // ✅ แก้ไข: Find RepairId column using Thai header
    const repairIdColIndex = headers.indexOf('รหัสแจ้งซ่อม');
    if (repairIdColIndex !== -1 && row[repairIdColIndex] === repairId) {
      const detail = {};
      headers.forEach((header, index) => {
        detail[header] = row[index] || '';
      });
      // Format timestamp for display
      if (detail['ประทับเวลา'] instanceof Date) {
        detail['ประทับเวลา'] = Utilities.formatDate(detail['ประทับเวลา'], SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm');
      }
      return detail;
    }
  }
  return null; // Not found
}

/**
 * ✅ แก้ไข: Updates a specific repair record in the sheet
 * @param {string} repairId The ID of the repair to update.
 * @param {Object} updatedData The data object containing fields to update.
 * @returns {boolean} True if update is successful.
 * @throws {Error} If user not logged in, sheet not found, or repairId not found.
 */
function updateRepair(repairId, updatedData) {
  const cache = CacheService.getUserCache();
  if (!cache.get(LOGIN_STATUS_KEY)) {
    throw new Error('กรุณาเข้าสู่ระบบก่อน');
  }

  const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(REPAIRS_SHEET_NAME);
  if (!sheet) {
    throw new Error('ไม่พบชีทแจ้งซ่อม');
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  let rowIndex = -1;
  const repairIdColIndex = headers.indexOf('รหัสแจ้งซ่อม'); // ✅ Use Thai header

  if (repairIdColIndex === -1) {
    throw new Error('ไม่พบคอลัมน์รหัสแจ้งซ่อมในชีท');
  }

  // Find the row index of the repairId
  for (let i = 0; i < data.length; i++) {
    if (data[i][repairIdColIndex] === repairId) {
      rowIndex = i + 2; // +2 because sheet data starts from row 2
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error('ไม่พบรายการแจ้งซ่อมที่ระบุ');
  }

  // Get current row values
  const rowToUpdateRange = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn());
  const rowValues = rowToUpdateRange.getValues()[0];

  // ✅ เพิ่ม: Validate status before updating
  if (updatedData['สถานะ'] && !Object.values(VALID_STATUSES).includes(updatedData['สถานะ'])) {
    throw new Error('สถานะไม่ถูกต้อง');
  }

  // Update values
  for (const key in updatedData) {
    const headerIndex = headers.indexOf(key);
    if (headerIndex !== -1) {
      rowValues[headerIndex] = updatedData[key];
    }
  }

  sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).setValues([rowValues]);
  
  // ✅ เพิ่ม: Clear cache
  cache.remove('dashboard_summary_cache');
  
  return true;
}

/**
 * ✅ แก้ไข: Deletes a specific repair record from the sheet
 * @param {string} repairId The ID of the repair to delete.
 * @returns {boolean} True if deletion is successful.
 * @throws {Error} If user not logged in, sheet not found, or repairId not found.
 */
function deleteRepair(repairId) {
  const cache = CacheService.getUserCache();
  if (!cache.get(LOGIN_STATUS_KEY)) {
    throw new Error('กรุณาเข้าสู่ระบบก่อน');
  }

  const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(REPAIRS_SHEET_NAME);
  if (!sheet) {
    throw new Error('ไม่พบชีทแจ้งซ่อม');
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  let rowIndexToDelete = -1;
  const repairIdColIndex = headers.indexOf('รหัสแจ้งซ่อม'); // ✅ Use Thai header

  if (repairIdColIndex === -1) {
    throw new Error('ไม่พบคอลัมน์รหัสแจ้งซ่อมในชีท');
  }

  // Find the row index of the repairId
  for (let i = 0; i < data.length; i++) {
    if (data[i][repairIdColIndex] === repairId) {
      rowIndexToDelete = i + 2;
      break;
    }
  }

  if (rowIndexToDelete === -1) {
    throw new Error('ไม่พบรายการแจ้งซ่อมที่ระบุสำหรับการลบ');
  }

  sheet.deleteRow(rowIndexToDelete);
  
  // ✅ เพิ่ม: Clear cache
  cache.remove('dashboard_summary_cache');
  
  return true;
}

/**
 * ✅ แก้ไข: Retrieves summary data for the dashboard with better error handling
 * @returns {Object} An object containing total, reported, inProgress, completed, cancelled repair counts.
 * @throws {Error} If the user is not logged in.
 */
function getDashboardSummary() {
  try {
    const cache = CacheService.getUserCache();
    if (!cache.get(LOGIN_STATUS_KEY)) {
      throw new Error('กรุณาเข้าสู่ระบบก่อน');
    }

    // ✅ เพิ่ม: Check cache first
    const cachedSummary = cache.get('dashboard_summary_cache');
    if (cachedSummary) {
      console.log('Returning cached dashboard summary');
      return JSON.parse(cachedSummary);
    }

    const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(REPAIRS_SHEET_NAME);
    if (!sheet) {
      console.log('Repairs sheet not found, returning empty summary');
      const emptySummary = { total: 0, reported: 0, inProgress: 0, completed: 0, cancelled: 0 };
      cache.put('dashboard_summary_cache', JSON.stringify(emptySummary), 300);
      return emptySummary;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      console.log('No data in repairs sheet, returning empty summary');
      const emptySummary = { total: 0, reported: 0, inProgress: 0, completed: 0, cancelled: 0 };
      cache.put('dashboard_summary_cache', JSON.stringify(emptySummary), 300);
      return emptySummary;
    }

    const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    console.log('Headers found:', headers);
    console.log('Data rows:', values.length);

    // ✅ แก้ไข: Find status column more flexibly
    let statusColIndex = -1;
    const possibleStatusHeaders = ['สถานะ', 'Status', 'status'];
    
    for (let i = 0; i < headers.length; i++) {
      if (possibleStatusHeaders.includes(headers[i])) {
        statusColIndex = i;
        break;
      }
    }

    if (statusColIndex === -1) {
      console.error('Status column not found. Available headers:', headers);
      throw new Error('ไม่พบคอลัมน์สถานะในชีทแจ้งซ่อม');
    }

    console.log('Status column found at index:', statusColIndex);

    let total = values.length;
    let reported = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;

    // ✅ แก้ไข: Count statuses more flexibly
    values.forEach((row, index) => {
      const status = String(row[statusColIndex] || '').trim();
      console.log(`Row ${index + 1} status:`, status);
      
      // ปรับให้รองรับทั้งชื่อเก่าและใหม่
      switch (status) {
        case 'แจ้งซ่อมแล้ว':
        case 'รอซ่อม':
        case VALID_STATUSES.REPORTED:
          reported++;
          break;
        case 'กำลังดำเนินการ':
        case 'กำลังติดตาม':
        case VALID_STATUSES.IN_PROGRESS:
          inProgress++;
          break;
        case 'เสร็จเรียบร้อย':
        case VALID_STATUSES.COMPLETED:
          completed++;
          break;
        case 'ยกเลิก':
        case VALID_STATUSES.CANCELLED:
          cancelled++;
          break;
        default:
          console.log('Unknown status found:', status);
          // นับเป็น reported ถ้าไม่รู้จักสถานะ
          reported++;
          break;
      }
    });

    const summary = { 
      total: total, 
      reported: reported, 
      inProgress: inProgress, 
      completed: completed, 
      cancelled: cancelled 
    };
    
    console.log('Dashboard summary calculated:', summary);
    
    // ✅ เพิ่ม: Cache the result
    cache.put('dashboard_summary_cache', JSON.stringify(summary), 300); // Cache for 5 minutes
    
    return summary;
    
  } catch (error) {
    console.error('Error in getDashboardSummary:', error);
    
    // ✅ เพิ่ม: Return empty summary on error instead of throwing
    const emptySummary = { total: 0, reported: 0, inProgress: 0, completed: 0, cancelled: 0 };
    
    // ถ้าเป็น login error ให้ throw ต่อไป
    if (error.message.includes('เข้าสู่ระบบ')) {
      throw error;
    }
    
    // Error อื่นๆ ให้ return empty summary
    return emptySummary;
  }
}
