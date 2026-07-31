/**
 * API Client for SGMS Google Apps Script Backend
 *
 * IMPORTANT: Before using, copy .env.example to .env and set your URL.
 *   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
 *
 * Notes on fixes applied here:
 *  - FIX: Changed process.env.REACT_APP_APPS_SCRIPT_URL → import.meta.env.VITE_APPS_SCRIPT_URL
 *         Vite uses import.meta.env and requires the VITE_ prefix (not REACT_APP_).
 *         process.env is a Node.js / CRA concept and is undefined in a Vite browser bundle.
 *  - Requests use Content-Type "text/plain" so the browser does NOT send a CORS
 *    preflight (OPTIONS). Google Apps Script Web Apps cannot answer a real
 *    preflight, so application/json would fail from a browser. Apps Script still
 *    receives the JSON body via e.postData.contents regardless of content-type.
 *  - When the backend reports an auth/session failure, the stored token is
 *    cleared so the next navigation redirects to /login.
 */

const APPS_SCRIPT_URL =
  import.meta.env.VITE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL_HERE';

/**
 * Make API request to Google Apps Script
 */
async function makeRequest(action, payload = {}, token = null) {
  try {
    const requestBody = { action, payload, token };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    // Apps Script always returns HTTP 200, so we rely on data.success.
    // If it looks like an auth/session problem, clear the token.
    if (data && data.success === false) {
      const msg = (data.message || '').toLowerCase();
      if (
        msg.includes('token') ||
        msg.includes('expired') ||
        msg.includes('unauthorized') ||
        msg.includes('disabled') ||
        msg.includes('no token')
      ) {
        removeToken();
      }
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    return {
      success: false,
      message: error.message || 'Network error',
      data: null,
    };
  }
}

// ── Token / session helpers ──────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('sgms_token');
}

function setToken(token) {
  localStorage.setItem('sgms_token', token);
}

function removeToken() {
  localStorage.removeItem('sgms_token');
  localStorage.removeItem('sgms_admin');
}

function getAdmin() {
  const adminStr = localStorage.getItem('sgms_admin');
  return adminStr ? JSON.parse(adminStr) : null;
}

function setAdmin(admin) {
  localStorage.setItem('sgms_admin', JSON.stringify(admin));
}

// ── Authentication ───────────────────────────────────────────────────────────
export const authAPI = {
  login: async (adminName, passcode) => {
    const result = await makeRequest('login', { adminName, passcode });
    if (result.success && result.data?.token) {
      setToken(result.data.token);
      setAdmin(result.data.admin);
    }
    return result;
  },

  logout: () => {
    removeToken();
    return { success: true };
  },

  changePassword: async (oldPasscode, newPasscode) => {
    return await makeRequest('changePassword', { oldPasscode, newPasscode }, getToken());
  },

  getToken,
  setToken,
  getAdmin,
  isAuthenticated: () => !!getToken(),
};

// ── Students ─────────────────────────────────────────────────────────────────
export const studentsAPI = {
  getAll: async (filters = {}) => {
    return await makeRequest('getStudents', filters, getToken());
  },
  getOne: async (studentId) => {
    return await makeRequest('getStudent', { studentId }, getToken());
  },
  create: async (studentData) => {
    return await makeRequest('createStudent', studentData, getToken());
  },
  update: async (studentId, studentData) => {
    return await makeRequest('updateStudent', { studentId, ...studentData }, getToken());
  },
  delete: async (studentId) => {
    return await makeRequest('deleteStudent', { studentId }, getToken());
  },
  search: async (query) => {
    return await makeRequest('searchStudents', { query }, getToken());
  },
};

// ── Activities ────────────────────────────────────────────────────────────────
export const activitiesAPI = {
  getAll: async (filters = {}) => {
    return await makeRequest('getActivities', filters, getToken());
  },
  getOne: async (activityId) => {
    return await makeRequest('getActivity', { activityId }, getToken());
  },
  create: async (termId, activityData) => {
    return await makeRequest('createActivity', { termId, ...activityData }, getToken());
  },
  update: async (activityId, activityData) => {
    return await makeRequest('updateActivity', { activityId, ...activityData }, getToken());
  },
  delete: async (activityId) => {
    return await makeRequest('deleteActivity', { activityId }, getToken());
  },
};

// ── Grading Terms ─────────────────────────────────────────────────────────────
export const termsAPI = {
  getAll: async () => {
    return await makeRequest('getGradingTerms', {}, getToken());
  },
  update: async (termId, termData) => {
    return await makeRequest('updateGradingTerm', { termId, ...termData }, getToken());
  },
};

// ── Scores ───────────────────────────────────────────────────────────────────
export const scoresAPI = {
  save: async (scoreData) => {
    return await makeRequest('saveScore', scoreData, getToken());
  },
  bulkSave: async (scores) => {
    return await makeRequest('bulkSaveScores', { scores }, getToken());
  },
  getByActivity: async (activityId) => {
    return await makeRequest('getScores', { activityId }, getToken());
  },
  getByStudent: async (studentId) => {
    return await makeRequest('getStudentScores', { studentId }, getToken());
  },
};

// ── Grade Calculation ─────────────────────────────────────────────────────────
export const gradesAPI = {
  calculate: async (studentId) => {
    return await makeRequest('calculateGrades', { studentId }, getToken());
  },
  getStudentGrade: async (studentId) => {
    return await makeRequest('getStudentGrade', { studentId }, getToken());
  },
};

// ── QR System ────────────────────────────────────────────────────────────────
export const qrAPI = {
  generateStudentQR: async (studentId) => {
    return await makeRequest('generateStudentQR', { studentId }, getToken());
  },
  validateQR: async (token) => {
    // Public endpoint — no auth token required
    return await makeRequest('validateQR', { token });
  },
  createSession: async (sessionData) => {
    return await makeRequest('createQRSession', sessionData, getToken());
  },
  getSession: async (sessionId) => {
    return await makeRequest('getQRSession', { sessionId }, getToken());
  },
  updateSession: async (sessionId, updates) => {
    return await makeRequest('updateQRSession', { sessionId, ...updates }, getToken());
  },
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsAPI = {
  getStudentReport: async (studentId) => {
    return await makeRequest('getStudentReport', { studentId }, getToken());
  },
  getClassReport: async (gradeLevel, sectionNumber) => {
    return await makeRequest('getClassReport', { gradeLevel, sectionNumber }, getToken());
  },
  getPassFailList: async (gradeLevel, sectionNumber, stageNumber = null) => {
    return await makeRequest(
      'getPassFailList',
      { gradeLevel, sectionNumber, stageNumber },
      getToken()
    );
  },
};

// ── Print Reports ─────────────────────────────────────────────────────────────
export const printAPI = {
  generate: async (studentIds, stage) => {
    return await makeRequest('generatePrintReport', { studentIds, stage }, getToken());
  },
};

// ── Import / Export ───────────────────────────────────────────────────────────
export const importExportAPI = {
  importStudents: async (csvData) => {
    return await makeRequest('importStudents', { csvData }, getToken());
  },
  exportStudents: async (filters = {}) => {
    return await makeRequest('exportStudents', filters, getToken());
  },
  importScores: async (csvData) => {
    return await makeRequest('importScores', { csvData }, getToken());
  },
};

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsAPI = {
  get: async () => {
    return await makeRequest('getSettings', {}, getToken());
  },
  update: async (settings) => {
    return await makeRequest('updateSettings', { settings }, getToken());
  },
  getDashboardStats: async () => {
    return await makeRequest('getDashboardStats', {}, getToken());
  },
};

// ── Admins ────────────────────────────────────────────────────────────────────
export const adminsAPI = {
  getAll: async () => {
    return await makeRequest('getAdmins', {}, getToken());
  },
  create: async (adminName, passcode) => {
    return await makeRequest('createAdmin', { adminName, passcode }, getToken());
  },
  update: async (adminId, isActive) => {
    return await makeRequest('updateAdmin', { adminId, isActive }, getToken());
  },
};

// ── Audit Log ─────────────────────────────────────────────────────────────────
export const auditAPI = {
  getLog: async (filters = {}) => {
    return await makeRequest('getAuditLog', filters, getToken());
  },
};

// ── Health check ──────────────────────────────────────────────────────────────
export const healthAPI = {
  check: async () => {
    return await makeRequest('health', {});
  },
};

export default {
  auth: authAPI,
  students: studentsAPI,
  activities: activitiesAPI,
  terms: termsAPI,
  scores: scoresAPI,
  grades: gradesAPI,
  qr: qrAPI,
  reports: reportsAPI,
  print: printAPI,
  importExport: importExportAPI,
  settings: settingsAPI,
  admins: adminsAPI,
  audit: auditAPI,
  health: healthAPI,
};
