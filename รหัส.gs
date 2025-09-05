// ==== Code.gs (แก้ไขแล้ว - รวมและแก้ไข) ====
const SS_ID = '1LW4J9GuP0IQbdYWOD45g1vQltVEnzrTh1vweRfHVm7E';
const USERS_SHEET_NAME = 'ลงทะเบียนหน้าเว็บ'; // Sheet for user data
const REPAIRS_SHEET_NAME = 'การตอบแบบฟอร์ม 1'; // Sheet for repair request data
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
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Opens the Web App, handling page routing based on login status and URL parameters.
 */
function doGet(e) {
  const cache = CacheService.getUserCache();
  const loggedInUser = cache.get(LOGIN_STATUS_KEY);

  if (loggedInUser) {
    const page = e.parameter.page;
    if (page === 'Status') {
      return HtmlService
        .createTemplateFromFile('status')
        .evaluate()
        .setTitle('สถานะ & จัดการแจ้งซ่อม');
    } else if (page === 'ReportRepair') {
      return HtmlService
        .createTemplateFromFile('report_repair')
        .evaluate()
        .setTitle('แจ้งซ่อมใหม่');
    } else {
      return HtmlService
        .createTemplateFromFile('Dashboard')
        .evaluate()
        .setTitle('Dashboard');
    }
  } else {
    return HtmlService
      .createTemplateFromFile('index')
      .evaluate()
      .setTitle('เข้าสู่ระบบ');
  }
}

/**
 * Returns the HTML content for the registration page.
 */
function getRegistrationPage() {
  return HtmlService.createTemplateFromFile('registration').evaluate().getContent();
}

/**
 * Returns the HTML content for the login page and clears login status from cache.
 */
function getLoginPage() {
  const cache = CacheService.getUserCache();
  cache.remove(LOGIN_STATUS_KEY);
  return HtmlService.createTemplateFromFile('index').evaluate().getContent();
}

/**
 * Returns the HTML content for the dashboard (menu) page, checking login status.
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
  return /^[0-9]{10,12}$/.test(phone.replace(/[-\s]/g, ''));
}

function validateEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCitizenId(id) {
  if (!id) return true;
  return /^[0-9]{13}$/.test(id);
}

/**
 * Checks username and password against the user data sheet.
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

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const usernameColIndex = headers.indexOf('Username');
  const passwordColIndex = headers.indexOf('Password');

  if (usernameColIndex === -1 || passwordColIndex === -1) {
    throw new Error('ไม่พบข้อมูลคอลัมน์ชื่อผู้ใช้หรือรหัสผ่านในชีท');
  }
  
  const allData = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const hashedPassword = hashPassword(password);

  const isAuthenticated = allData.some(r => {
    const storedUsername = String(r[usernameColIndex]).trim();
    const storedPassword = String(r[passwordColIndex]).trim();

    return storedUsername === username &&
           (storedPassword === password || storedPassword === hashedPassword);
  });

  if (isAuthenticated) {
    const cache = CacheService.getUserCache();
    cache.put(LOGIN_STATUS_KEY, username, 21600); // 6 hours
  }
  return isAuthenticated;
}

/**
 * Registers a new user with improved validation and password hashing
 */
function registerNewUser(fullname, phone, email, username, password, position) {
  if (![fullname, phone, username, password, position].every(v => v && v.toString().trim() !== '')) {
    throw new Error('กรุณากรอกข้อมูลที่จำเป็นให้ครบ: ชื่อเต็ม, เบอร์โทร, ชื่อผู้ใช้, รหัสผ่าน, ตำแหน่ง');
  }

  if (!validatePhoneNumber(phone)) {
    throw new Error('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็นตัวเลข 10-12 หลัก)');
  }

  if (email && !validateEmail(email)) {
    throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
  }

  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(USERS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    sheet.appendRow(['FullName', 'Phone', 'Email', 'Username', 'Password', 'Position']);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const usernameColIndex = headers.indexOf('Username');

  if (usernameColIndex === -1) {
    throw new Error('ไม่พบหัวข้อคอลัมน์ "Username" ในชีทผู้ใช้งาน');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const existingUsernames = sheet.getRange(2, usernameColIndex + 1, lastRow - 1, 1).getValues().flat();
    if (existingUsernames.includes(username)) {
      throw new Error('Username นี้มีในระบบแล้ว');
    }
  }

  const hashedPassword = hashPassword(password);
  sheet.appendRow([fullname, phone, email || '', username, hashedPassword, position]);
  return true;
}

/**
 * Logs out the current user by clearing the login status from cache.
 */
function doLogout() {
  const cache = CacheService.getUserCache();
  cache.remove(LOGIN_STATUS_KEY);
  return getLoginPage();
}

/**
 * ✅ แก้ไข: Function to save new repair request data - ปรับให้เข้ากับโครงสร้างชีทจริง
 */
function submitNewRepair(formData) {
  try {
    if (!formData.reporterName || !formData.phoneNumber || !formData.location || !formData.repairType || !formData.repairDesc) {
      throw new Error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
    }

    if (!validatePhoneNumber(formData.phoneNumber)) {
      throw new Error('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง');
    }

    if (formData.citizenID && !validateCitizenId(formData.citizenID)) {
      throw new Error('หมายเลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก');
    }

    const ss = SpreadsheetApp.openById(SS_ID);
    let sheet = ss.getSheetByName(REPAIRS_SHEET_NAME);

    if (!sheet) {
      throw new Error('ไม่พบชีท "การตอบแบบฟอร์ม 1" กรุณาตรวจสอบ');
    }

    const now = new Date();
    
    const rowData = [
      now, // A: ประทับเวลา
      formData.email || '', // B: ที่อยู่อีเมล
      formData.reporterName || '', // C: ชื่อ-นามสกุล
      '', // D: อายุ
      formData.citizenID || '', // E: เลขประจำตัวประชาชน
      formData.location || '', // F: ที่อยู่/สถานที่เกิดเหตุ
      formData.repairType || '', // G: ประเภทการแจ้งซ่อม
      formData.repairDesc || '', // H: รายละเอียดของปัญหา
      formData.photoUrl || '', // I: รูปภาพ
      formData.geoStamp || '', // J: GeoStamp
      formData.geoCode || '', // K: GeoCode
      formData.geoAddress || '', // L: GeoAddress
      'ถนน', // M: สถานะ
      '' // N: ผู้รับผิดชอบ
    ];

    sheet.appendRow(rowData);

    const cache = CacheService.getUserCache();
    cache.remove('dashboard_summary_cache');
    cache.remove('repair_data_cache');

    console.log('✅ บันทึกข้อมูลสำเร็จ:', {
      name: formData.reporterName,
      type: formData.repairType,
      location: formData.location
    });

    return true;
  } catch (error) {
    console.error('❌ Error in submitNewRepair:', error);
    throw new Error(`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${error.message}`);
  }
}

/**
 * ✅ แก้ไข: Function to retrieve repair data - ปรับให้เข้ากับโครงสร้างชีทจริง
 */
function getRepairData() {
  try {
    const cache = CacheService.getUserCache();
    if (!cache.get(LOGIN_STATUS_KEY)) {
      throw new Error('กรุณาเข้าสู่ระบบก่อน');
    }

    const cachedData = cache.get('repair_data_cache');
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const ss = SpreadsheetApp.openById(SS_ID);
    const sheet = ss.getSheetByName(REPAIRS_SHEET_NAME);
    
    if (!sheet) {
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    console.log('🔍 Headers found:', headers);
    console.log('📊 Data rows count:', data.length);

    const repairData = data.map((row, index) => {
      const item = {
        'รหัสแจ้งซ่อม': `REP-${index + 1}`.padStart(10, '0'),
        'ประทับเวลา': formatDateForDisplay(row[0]), // A
        'ที่อยู่อีเมล': row[1] || '', // B
        'ชื่อผู้แจ้ง': row[2] || '', // C
        'อายุ': row[3] || '', // D
        'เลขประจำตัวประชาชน': row[4] || '', // E
        'สถานที่เกิดเหตุ': row[5] || '', // F
        'ประเภทการแจ้งซ่อม': row[6] || '', // G
        'รายละเอียดปัญหา': row[7] || '', // H
        'รูปภาพ': row[8] || '', // I
        'GeoStamp': row[9] || '', // J
        'GeoCode': row[10] || '', // K
        'GeoAddress': row[11] || '', // L
        'สถานะ': row[12] || 'ถนน', // M
        'ผู้รับผิดชอบ': row[13] || '' // N
      };
      return item;
    });

    console.log('✅ Processed repair data:', repairData.length, 'items');

    cache.put('repair_data_cache', JSON.stringify(repairData), 300);
    
    return repairData.reverse();
  } catch (error) {
    console.error('❌ Error in getRepairData:', error);

    if (error.message.includes('เข้าสู่ระบบ')) {
      throw error;
    }

    return [];
  }
}

/**
 * ✅ เพิ่ม: Function to get repair data for web display
 */
function getRepairDataForWeb() {
  try {
    const repairData = getRepairData();
    
    const webData = repairData.map((item, index) => ({
      id: item['รหัสแจ้งซ่อม'] || `REP-${index + 1}`.padStart(10, '0'),
      timestamp: item['ประทับเวลา'] || '',
      email: item['ที่อยู่อีเมล'] || '',
      name: item['ชื่อผู้แจ้ง'] || '',
      age: item['อายุ'] || '',
      citizenID: item['เลขประจำตัวประชาชน'] || '',
      location: item['สถานที่เกิดเหตุ'] || '',
      type: item['ประเภทการแจ้งซ่อม'] || '',
      details: item['รายละเอียดปัญหา'] || '',
      imageUrl: item['รูปภาพ'] || '',
      geoStamp: item['GeoStamp'] || '',
      geoCode: item['GeoCode'] || '',
      geoAddress: item['GeoAddress'] || '',
      status: item['สถานะ'] || 'ถนน',
      assignee: item['ผู้รับผิดชอบ'] || '',
      phone: '', // ไม่มีในชีทปัจจุบัน
      department: '' // ไม่มีในชีทปัจจุบัน
    }));
    
    console.log('🌐 Web data prepared:', webData.length, 'items');
    return webData;
  } catch (error) {
    console.error('❌ Error in getRepairDataForWeb:', error);
    throw new Error('เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับเว็บ: ' + error.message);
  }
}

/**
 * ✅ แก้ไข: Retrieves summary data for dashboard
 */
function getDashboardSummary() {
  try {
    const cache = CacheService.getUserCache();
    if (!cache.get(LOGIN_STATUS_KEY)) {
      throw new Error('กรุณาเข้าสู่ระบบก่อน');
    }

    const cachedSummary = cache.get('dashboard_summary_cache');
    if (cachedSummary) {
      console.log('📊 Returning cached dashboard summary');
      return JSON.parse(cachedSummary);
    }

    const ss = SpreadsheetApp.openById(SS_ID);
    const sheet = ss.getSheetByName(REPAIRS_SHEET_NAME);
    
    if (!sheet) {
      const emptySummary = { total: 0, reported: 0, inProgress: 0, completed: 0, cancelled: 0 };
      cache.put('dashboard_summary_cache', JSON.stringify(emptySummary), 300);
      return emptySummary;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      const emptySummary = { total: 0, reported: 0, inProgress: 0, completed: 0, cancelled: 0 };
      cache.put('dashboard_summary_cache', JSON.stringify(emptySummary), 300);
      return emptySummary;
    }

    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    console.log('📊 Data rows:', data.length);

    let total = data.length;
    let reported = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;

    data.forEach((row, index) => {
      const status = String(row[12] || '').trim(); // คอลัมน์ M = สถานะ
      console.log(`📝 Row ${index + 1} status:`, status);

      switch (status.toLowerCase()) {
        case 'ถนน':
        case 'รอซ่อม':
        case 'แจ้งซ่อมแล้ว':
          reported++;
          break;
        case 'กำลังดำเนินการ':
        case 'กำลังซ่อม':
        case 'ดำเนินการ':
          inProgress++;
          break;
        case 'เสร็จเรียบร้อย':
        case 'เสร็จสิ้น':
        case 'สำเร็จ':
          completed++;
          break;
        case 'ยกเลิก':
        case 'ปิด':
        case 'ไม่อนุมัติ':
          cancelled++;
          break;
        default:
          console.log('❓ Unknown status found:', status);
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

    console.log('📈 Dashboard summary calculated:', summary);

    cache.put('dashboard_summary_cache', JSON.stringify(summary), 300);

    return summary;
  } catch (error) {
    console.error('❌ Error in getDashboardSummary:', error);

    if (error.message.includes('เข้าสู่ระบบ')) {
      throw error;
    }

    return { total: 0, reported: 0, inProgress: 0, completed: 0, cancelled: 0 };
  }
}

/**
 * Helper function สำหรับการจัดรูปแบบวันที่
 */
function formatDateForDisplay(dateValue) {
  if (!dateValue) return '';
  
  let date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === 'string') {
    date = new Date(dateValue);
  } else {
    return dateValue.toString();
  }
  
  if (isNaN(date.getTime())) {
    return dateValue.toString();
  }
  
  return Utilities.formatDate(date, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');
}

/**
 * ฟังก์ชันสำหรับประมวลผลการเข้าสู่ระบบจาก Frontend
 */
function processLogin(username, password) {
  Logger.log("Attempting login for username: " + username);
  try {
    const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET_NAME);
    if (!userSheet) {
      Logger.log('Error: "' + USERS_SHEET_NAME + '" sheet not found for login.');
      return { success: false, message: 'ไม่พบฐานข้อมูลผู้ใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
    }

    const data = userSheet.getDataRange().getValues();
    if (data.length < 2) {
      return { success: false, message: 'ไม่พบผู้ใช้งานในระบบ' };
    }

    const headers = data[0];
    const usernameColIndex = headers.indexOf('Username');
    const passwordColIndex = headers.indexOf('Password');

    if (usernameColIndex === -1 || passwordColIndex === -1) {
      Logger.log('Error: Missing "Username" or "Password" columns in "' + USERS_SHEET_NAME + '" sheet.');
      return { success: false, message: 'โครงสร้างฐานข้อมูลผู้ใช้งานไม่ถูกต้อง' };
    }

    const hashedPassword = hashPassword(password);

    for (let i = 1; i < data.length; i++) {
      const rowUsername = String(data[i][usernameColIndex]).trim();
      const rowStoredPassword = String(data[i][passwordColIndex]).trim();

      if (rowUsername === username && (rowStoredPassword === password || rowStoredPassword === hashedPassword)) {
        Logger.log("Login successful for username: " + username);
        const cache = CacheService.getUserCache();
        cache.put(LOGIN_STATUS_KEY, username, 21600);
        return { success: true, message: 'เข้าสู่ระบบสำเร็จ' };
      }
    }

    Logger.log("Login failed for username: " + username + " - Invalid credentials.");
    return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };

  } catch (e) {
    Logger.log("Error in processLogin: " + e.message);
    return { success: false, message: 'เกิดข้อผิดพลาดขณะเข้าสู่ระบบ กรุณาลองใหม่: ' + e.message };
  }
}

/**
 * ฟังก์ชันสำหรับประมวลผลการลงทะเบียนผู้ใช้ใหม่จาก Frontend
 */
function processRegistration(formData) {
  Logger.log("Attempting registration for username: " + formData.username);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let userSheet = ss.getSheetByName(USERS_SHEET_NAME);

    if (!userSheet) {
      Logger.log('Creating new "' + USERS_SHEET_NAME + '" sheet.');
      userSheet = ss.insertSheet(USERS_SHEET_NAME);
      userSheet.appendRow(['FullName', 'Phone', 'Email', 'Username', 'Password', 'Position', 'RegistrationDate']);
    }

    const lastRow = userSheet.getLastRow();
    if (lastRow > 1) {
      const headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0];
      const usernameColIndex = headers.indexOf('Username');
      if (usernameColIndex === -1) {
        throw new Error('ไม่พบหัวข้อคอลัมน์ "Username" ในชีทผู้ใช้งาน');
      }

      const existingUsernames = userSheet.getRange(2, usernameColIndex + 1, lastRow - 1, 1).getValues().flat();
      if (existingUsernames.includes(formData.username)) {
        Logger.log("Registration failed: Username already exists.");
        return { success: false, message: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว' };
      }
    }

    const hashedPassword = hashPassword(formData.password);

    userSheet.appendRow([
      formData.fullName,
      formData.phone,
      formData.email,
      formData.username,
      hashedPassword,
      formData.position,
      new Date()
    ]);

    Logger.log("Registration successful for username: " + formData.username);
    return { success: true, message: 'ลงทะเบียนสำเร็จ' };

  } catch (e) {
    Logger.log("Error in processRegistration: " + e.message);
    return { success: false, message: 'เกิดข้อผิดพลาดขณะลงทะเบียน กรุณาลองใหม่: ' + e.message };
  }
}

// ✅ เพิ่ม: Navigation Functions - ฟังก์ชันการนำทาง

/**
 * Get Dashboard Page - ไปหน้าหลัก
 */
function getDashboardPage() {
  const cache = CacheService.getUserCache();
  const loggedInUser = cache.get(LOGIN_STATUS_KEY);
  if (loggedInUser) {
    return HtmlService.createTemplateFromFile('Dashboard').evaluate().getContent();
  } else {
    throw new Error('กรุณาเข้าสู่ระบบก่อน');
  }
}

/**
 * Navigate to Dashboard - ไปหน้าหลัก
 */
function navigateToDashboard() {
  try {
    const cache = CacheService.getUserCache();
    if (!cache.get(LOGIN_STATUS_KEY)) {
      throw new Error('กรุณาเข้าสู่ระบบก่อน');
    }
    return HtmlService.createTemplateFromFile('Dashboard').evaluate().getContent();
  } catch (error) {
    throw new Error('เกิดข้อผิดพลาดในการโหลดหน้าหลัก: ' + error.message);
  }
}

/**
 * Navigate to Report Repair - ไปหน้าแจ้งซ่อม
 */
function navigateToReportRepair() {
  try {
    const cache = CacheService.getUserCache();
    if (!cache.get(LOGIN_STATUS_KEY)) {
      throw new Error('กรุณาเข้าสู่ระบบก่อน');
    }
    return HtmlService.createTemplateFromFile('report_repair').evaluate().getContent();
  } catch (error) {
    throw new Error('เกิดข้อผิดพลาดในการโหลดหน้าแจ้งซ่อม: ' + error.message);
  }
}

/**
 * Navigate to Status - ไปหน้าจัดการแจ้งซ่อม
 */
function navigateToStatus() {
  try {
    const cache = CacheService.getUserCache();
    if (!cache.get(LOGIN_STATUS_KEY)) {
      throw new Error('กรุณาเข้าสู่ระบบก่อน');
    }
    return HtmlService.createTemplateFromFile('status').evaluate().getContent();
  } catch (error) {
    throw new Error('เกิดข้อผิดพลาดในการโหลดหน้าจัดการแจ้งซ่อม: ' + error.message);
  }
}

/**
 * Get logged in user info for display
 */
function getLoggedInUserInfo() {
  try {
    const cache = CacheService.getUserCache();
    const loggedInUser = cache.get(LOGIN_STATUS_KEY);
    
    if (!loggedInUser) {
      return null;
    }

    const ss = SpreadsheetApp.openById(SS_ID);
    const userSheet = ss.getSheetByName(USERS_SHEET_NAME);
    
    if (!userSheet) {
      return { username: loggedInUser, fullname: loggedInUser, position: 'ผู้ใช้งาน' };
    }

    const headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0];
    const data = userSheet.getRange(2, 1, userSheet.getLastRow() - 1, userSheet.getLastColumn()).getValues();
    
    const usernameColIndex = headers.indexOf('Username');
    const fullnameColIndex = headers.indexOf('FullName');
    const positionColIndex = headers.indexOf('Position');

    if (usernameColIndex === -1) {
      return { username: loggedInUser, fullname: loggedInUser, position: 'ผู้ใช้งาน' };
    }

    const userRow = data.find(row => String(row[usernameColIndex]).trim() === loggedInUser);
    
    if (userRow) {
      return {
        username: loggedInUser,
        fullname: userRow[fullnameColIndex] || loggedInUser,
        position: userRow[positionColIndex] || 'ผู้ใช้งาน'
      };
    }

    return { username: loggedInUser, fullname: loggedInUser, position: 'ผู้ใช้งาน' };
  } catch (error) {
    console.error('Error getting user info:', error);
    return { username: 'ผู้ใช้งาน', fullname: 'ผู้ใช้งาน', position: 'ผู้ใช้งาน' };
  }
}
