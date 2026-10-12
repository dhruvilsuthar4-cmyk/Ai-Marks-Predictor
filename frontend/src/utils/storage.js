const STUDENTS_KEY = 'ai_predictor_students';
const HISTORY_KEY = 'ai_predictor_history';
const SETTINGS_KEY = 'ai_predictor_settings';

const DEFAULT_SETTINGS = Object.freeze({ riskThreshold: 50 });

function storageError(action, cause) {
  const error = new Error(`Browser storage could not ${action}. Check available storage space and browser permissions.`);
  error.cause = cause;
  return error;
}

function readCollection(key) {
  let raw;
  try {
    raw = window.localStorage.getItem(key);
  } catch (cause) {
    throw storageError('be read', cause);
  }
  if (raw === null) return [];

  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) {
      const validRecords = value.filter(record =>
        record &&
        typeof record === 'object' &&
        !Array.isArray(record) &&
        typeof record.id === 'string' &&
        typeof record.name === 'string' &&
        Number.isFinite(Number(record.predicted_marks)) &&
        Number.isFinite(new Date(record.created_at).getTime())
      );
      if (validRecords.length === value.length) return validRecords;
      writeValue(key, validRecords);
      return validRecords;
    }
  } catch {
    // A malformed value is replaced below with a clean, usable collection.
  }

  writeValue(key, []);
  return [];
}

function readSettings() {
  let raw;
  try {
    raw = window.localStorage.getItem(SETTINGS_KEY);
  } catch (cause) {
    throw storageError('be read', cause);
  }
  if (raw === null) return { ...DEFAULT_SETTINGS };

  try {
    const value = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const riskThreshold = Number(value.riskThreshold);
      if (Number.isFinite(riskThreshold) && riskThreshold >= 0 && riskThreshold <= 100) {
        return { ...DEFAULT_SETTINGS, ...value, riskThreshold };
      }
    }
  } catch {
    // Invalid settings are reset to defaults so the app can continue safely.
  }

  writeValue(SETTINGS_KEY, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

function writeValue(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (cause) {
    throw storageError('be saved', cause);
  }
}

export function generateId(prefix = 'rec') {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  return `${prefix}_${id}`;
}

export function getStudents() {
  return readCollection(STUDENTS_KEY);
}

export function getPredictions() {
  return readCollection(HISTORY_KEY);
}

export function addStudent(student) {
  const students = getStudents();
  const record = { ...student, id: student.id || generateId('student') };
  writeValue(STUDENTS_KEY, [record, ...students]);
  return record;
}

export function updateStudent(id, changes) {
  const students = getStudents();
  const index = students.findIndex(student => student.id === id);
  if (index === -1) throw new Error('This student record no longer exists.');

  const updated = { ...students[index], ...changes, id, updated_at: changes.updated_at || new Date().toISOString() };
  const nextStudents = students.map((student, currentIndex) => currentIndex === index ? updated : student);
  writeValue(STUDENTS_KEY, nextStudents);

  const history = getPredictions();
  const nextHistory = history.map(prediction => prediction.student_id === id
    ? { ...prediction, name: updated.name }
    : prediction);
  if (nextHistory.some((prediction, currentIndex) => prediction !== history[currentIndex])) {
    writeValue(HISTORY_KEY, nextHistory);
  }
  return updated;
}

export function deleteStudent(id) {
  const students = getStudents();
  writeValue(STUDENTS_KEY, students.filter(student => student.id !== id));
}

export function savePrediction(prediction) {
  const history = getPredictions();
  const record = { ...prediction, id: prediction.id || generateId('prediction') };
  writeValue(HISTORY_KEY, [record, ...history]);
  return record;
}

export function clearHistory() {
  writeValue(HISTORY_KEY, []);
}

export function getSettings() {
  return readSettings();
}

export function updateSettings(changes) {
  const next = { ...readSettings(), ...changes };
  const riskThreshold = Number(next.riskThreshold);
  if (!Number.isFinite(riskThreshold) || riskThreshold < 0 || riskThreshold > 100) {
    throw new Error('The at-risk score threshold must be between 0 and 100.');
  }
  const settings = { ...next, riskThreshold };
  writeValue(SETTINGS_KEY, settings);
  return settings;
}
