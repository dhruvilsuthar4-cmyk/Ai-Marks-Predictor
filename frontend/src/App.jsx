import { useEffect, useState } from 'react';
import {
  Activity, AlertCircle, ArrowDownUp, BarChart3, Brain, Check,
  CheckCircle2, ChevronDown, CircleHelp, Clock3, GraduationCap,
  History, LayoutDashboard, Plus, RefreshCw, Search, Settings2,
  ShieldAlert, Sparkles, Trash2, TrendingUp, Users, X
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';
import {
  addStudent, clearHistory, deleteStudent, getPredictions, getSettings,
  getStudents, savePrediction, updateSettings, updateStudent
} from './utils/storage';
import { getPerformanceCategory, predictMarks } from './utils/prediction';

const EMPTY_FORM = {
  name: '',
  study_hours: '4',
  attendance: '75',
  previous_marks: '60',
  assignment_marks: '70'
};
const NAVIGATION = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Predict Marks', icon: Brain },
  { name: 'Students', icon: Users },
  { name: 'History', icon: History }
];
const CATEGORY_COLORS = ['#6546d7', '#9a82ed', '#c2b5f5', '#e3def4'];
const PAGE_SIZE = 8;

export default function App() {
  const [page, setPage] = useState('Dashboard');
  const [students, setStudents] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [sortBy, setSortBy] = useState('newest');
  const [pageNumber, setPageNumber] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('All categories');
  const [historySort, setHistorySort] = useState('newest');
  const [modal, setModal] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState({ riskThreshold: 50 });

  function refreshData() {
    setRefreshing(true);
    try {
      setStudents(getStudents());
      setPredictions(getPredictions());
      setSettings(getSettings());
      setError('');
    } catch (storageError) {
      setError(storageError.message || 'Your browser storage could not be read.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refreshData();
    const handleStorage = event => {
      if (!event.key || event.key.startsWith('ai_predictor_')) refreshData();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const averageMarks = students.length
    ? students.reduce((sum, student) => sum + Number(student.predicted_marks || 0), 0) / students.length
    : 0;
  const atRiskCount = students.filter(student => Number(student.predicted_marks) < settings.riskThreshold).length;
  const chartData = [...students]
    .sort((a, b) => new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at))
    .slice(-8)
    .map(student => ({ name: student.name.split(' ')[0], marks: Number(student.predicted_marks) }));
  const categoryData = ['Excellent', 'Good', 'Average', 'Needs Improvement'].map((category, index) => ({
    name: category,
    value: students.filter(student => student.category === category).length,
    color: CATEGORY_COLORS[index]
  })).filter(item => item.value);

  function showError(message) {
    setError(message);
    setSuccess('');
  }

  function showSuccess(message) {
    setSuccess(message);
    setError('');
  }

  function saveStudentAction(action, studentData) {
    try {
      if (action === 'edit') updateStudent(studentData.id, studentData);
      else addStudent(studentData);
      refreshData();
      setModal(null);
      showSuccess(action === 'edit' ? 'Student record updated.' : 'Student added to your records.');
    } catch (storageError) {
      showError(storageError.message || 'Could not save this student.');
    }
  }

  function handlePrediction(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const name = form.name.trim();
    const values = {
      study_hours: Number(form.study_hours),
      attendance: Number(form.attendance),
      previous_marks: Number(form.previous_marks),
      assignment_marks: Number(form.assignment_marks)
    };
    if (!name) return showError('Enter the student’s name to continue.');
    const ranges = [
      ['study_hours', 'Daily study hours', 0, 24],
      ['attendance', 'Attendance', 0, 100],
      ['previous_marks', 'Previous examination marks', 0, 100],
      ['assignment_marks', 'Assignment marks', 0, 100]
    ];
    for (const [key, label, min, max] of ranges) {
      if (form[key] === '' || !Number.isFinite(values[key]) || values[key] < min || values[key] > max) {
        return showError(`${label} must be a number between ${min} and ${max}.`);
      }
    }

    const score = predictMarks(values);
    const now = new Date().toISOString();
    const existing = students.find(student => student.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
    const student = {
      ...(existing || {}),
      ...values,
      name,
      predicted_marks: score,
      category: getPerformanceCategory(score),
      updated_at: now,
      created_at: existing?.created_at || now
    };

    try {
      const savedStudent = existing ? updateStudent(existing.id, student) : addStudent(student);
      const prediction = savePrediction({
        student_id: savedStudent.id,
        name,
        ...values,
        predicted_marks: score,
        category: getPerformanceCategory(score),
        created_at: now,
        model_name: 'Weighted heuristic'
      });
      setResult({ ...prediction, breakdown: getBreakdown(values) });
      setForm({ ...EMPTY_FORM, name });
      refreshData();
      showSuccess('Prediction saved on this device.');
    } catch (storageError) {
      showError(storageError.message || 'Could not save the prediction. Check your browser storage.');
    }
  }

  function handleDeleteStudent(student) {
    if (!window.confirm(`Delete ${student.name} from student records? Past predictions will remain in history.`)) return;
    try {
      deleteStudent(student.id);
      refreshData();
      showSuccess('Student record deleted.');
    } catch (storageError) {
      showError(storageError.message || 'Could not delete this student.');
    }
  }

  function handleClearHistory() {
    if (!window.confirm('Clear all prediction history? This cannot be undone.')) return;
    try {
      clearHistory();
      refreshData();
      setModal(null);
      showSuccess('Prediction history cleared.');
    } catch (storageError) {
      showError(storageError.message || 'Could not clear prediction history.');
    }
  }

  function saveSettings(nextSettings) {
    try {
      const saved = updateSettings(nextSettings);
      setSettings(saved);
      showSuccess('Settings saved on this device.');
    } catch (storageError) {
      showError(storageError.message || 'Could not save settings.');
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage('Dashboard')} aria-label="Go to dashboard">
          <span className="brand-icon"><GraduationCap size={23} /></span>
          <span><strong>Markwise</strong><small>Student analytics</small></span>
        </button>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {NAVIGATION.map(({ name, icon: Icon }) => (
            <button key={name} className={`nav-item ${page === name ? 'active' : ''}`}
              aria-current={page === name ? 'page' : undefined}
              onClick={() => { setPage(name); setError(''); setSuccess(''); }}>
              <Icon size={18} /><span>{name}</span>
              {name === 'History' && predictions.length > 0 && <span className="nav-count">{predictions.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot online" />
          <span><strong>Local Storage Active</strong><small>Data stays in this browser</small></span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">STUDENT PERFORMANCE SYSTEM</p><h1>{page}</h1></div>
          <div className="topbar-actions">
            <span className="storage-chip"><span className="status-dot online" /> Local Storage Active</span>
            <button className="icon-button" onClick={() => setModal({ type: 'settings' })} title="Dashboard settings" aria-label="Dashboard settings"><Settings2 size={18} /></button>
            <button className="icon-button" onClick={refreshData} title="Refresh data" aria-label="Refresh data" disabled={refreshing}>
              <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {error && <Notice type="error" message={error} onDismiss={() => setError('')} />}
        {success && <Notice type="success" message={success} onDismiss={() => setSuccess('')} />}

        {page === 'Dashboard' && (
          <>
            <section className="welcome-band">
              <div>
                <span className="welcome-tag"><Sparkles size={14} /> STUDENT SUCCESS, AT A GLANCE</span>
                <h2>Make every mark count.</h2>
                <p>Explore a clear, data-informed estimate of student performance and turn classroom insights into better support.</p>
                <button className="primary-button" onClick={() => setPage('Predict Marks')}>Create a prediction <Plus size={16} /></button>
              </div>
              <div className="welcome-art-wrap"><GraduationCap className="welcome-art" size={110} strokeWidth={1.1} /><span>LEARN · GROW · SUCCEED</span></div>
            </section>

            <section className="stats-grid" aria-label="Dashboard statistics">
              <Stat icon={Users} label="Registered students" value={students.length} note="Saved student profiles" />
              <Stat icon={Brain} label="Predictions generated" value={predictions.length} note="All-time activity" />
              <Stat icon={TrendingUp} label="Average predicted marks" value={`${averageMarks.toFixed(1)}%`} note="Across student records" />
              <Stat icon={ShieldAlert} label="Students at risk" value={atRiskCount} note={`Below ${settings.riskThreshold}% predicted`} tone={atRiskCount ? 'warning' : ''} />
            </section>

            <div className="dashboard-grid">
              <section className="panel chart-panel">
                <div className="panel-heading"><div><h3>Performance overview</h3><p>Predicted marks for the latest student records</p></div><span className="subtle-badge"><Activity size={14} /> Out of 100</span></div>
                {chartData.length ? <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                      <defs><linearGradient id="marksGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7354dc" stopOpacity={0.25} /><stop offset="95%" stopColor="#7354dc" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#efedf4" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#898398' }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#898398' }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={value => [`${Number(value).toFixed(1)} marks`, 'Predicted']} />
                      <Area type="monotone" dataKey="marks" stroke="#7050db" fill="url(#marksGradient)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div> : <EmptyState icon={BarChart3} title="Your chart is ready" text="Create a prediction to see student performance trends here." action="Start a prediction" onAction={() => setPage('Predict Marks')} />}
              </section>
              <section className="panel category-panel">
                <div className="panel-heading"><div><h3>Performance mix</h3><p>Students by predicted category</p></div></div>
                {categoryData.length ? <>
                  <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={57} outerRadius={82} paddingAngle={4} stroke="none">
                      {categoryData.map(item => <Cell key={item.name} fill={item.color} />)}
                    </Pie><Tooltip /></PieChart>
                  </ResponsiveContainer><div className="donut-center"><strong>{students.length}</strong><span>students</span></div></div>
                  <div className="legend-list">{categoryData.map(item => <div key={item.name}><span><i style={{ backgroundColor: item.color }} />{item.name}</span><strong>{item.value}</strong></div>)}</div>
                </> : <EmptyState icon={TrendingUp} title="No categories yet" text="Student performance categories will appear after your first record." />}
              </section>
            </div>

            <section className="panel">
              <div className="panel-heading"><div><h3>Recent student records</h3><p>Your latest saved student profiles</p></div><button className="text-button" onClick={() => setPage('Students')}>View all <ChevronDown size={14} className="rotate-left" /></button></div>
              <StudentTable students={[...students].sort(byDateNewest).slice(0, 5)} onView={student => setModal({ type: 'details', student })} onEdit={student => setModal({ type: 'student', student })} onDelete={handleDeleteStudent} />
            </section>
            <section className="panel">
              <div className="panel-heading"><div><h3>Recent prediction activity</h3><p>Latest estimates generated in this browser</p></div><button className="text-button" onClick={() => setPage('History')}>View history <ChevronDown size={14} className="rotate-left" /></button></div>
              <HistoryTable predictions={[...predictions].sort(byDateNewest).slice(0, 4)} onView={prediction => setModal({ type: 'prediction', prediction })} />
            </section>
          </>
        )}

        {page === 'Predict Marks' && (
          <div className="predict-layout">
            <section className="panel predictor-panel">
              <div className="panel-heading"><div><h3>Estimate student performance</h3><p>Enter the academic details below to calculate an estimated score.</p></div><span className="model-chip"><Sparkles size={15} /> Browser heuristic</span></div>
              <form onSubmit={handlePrediction} noValidate>
                <div className="form-grid">
                  <TextField className="full-width" name="name" label="Student name" hint="Enter the student's full name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
                  <NumberField name="study_hours" label="Daily study hours" hint="Between 0 and 24 hours" min="0" max="24" step="0.5" value={form.study_hours} onChange={event => setForm(current => ({ ...current, study_hours: event.target.value }))} />
                  <NumberField name="attendance" label="Attendance percentage" hint="Between 0% and 100%" min="0" max="100" step="0.1" value={form.attendance} onChange={event => setForm(current => ({ ...current, attendance: event.target.value }))} />
                  <NumberField name="previous_marks" label="Previous examination marks" hint="Score out of 100" min="0" max="100" step="0.1" value={form.previous_marks} onChange={event => setForm(current => ({ ...current, previous_marks: event.target.value }))} />
                  <NumberField name="assignment_marks" label="Assignment marks" hint="Score out of 100" min="0" max="100" step="0.1" value={form.assignment_marks} onChange={event => setForm(current => ({ ...current, assignment_marks: event.target.value }))} />
                </div>
                <p className="algorithm-note"><CircleHelp size={15} /> Uses a documented weighted formula: study hours 20%, attendance 25%, previous marks 30%, assignment marks 25%. This is a demonstration heuristic, not a trained machine-learning model.</p>
                <button className="primary-button submit-button"><Brain size={17} /> Calculate estimate</button>
              </form>
            </section>
            {result ? <PredictionResult result={result} /> : <section className="result-placeholder">
              <span className="placeholder-icon"><Brain size={29} /></span>
              <h3>Your estimate will appear here</h3>
              <p>Complete the student details and calculate an estimate. Every successful prediction is saved to your local history.</p>
            </section>}
          </div>
        )}

        {page === 'Students' && (
          <section className="panel">
            <div className="panel-heading records-heading"><div><h3>Student records</h3><p>Search, review, and manage student profiles stored on this device.</p></div><button className="primary-button" onClick={() => setModal({ type: 'student' })}><Plus size={16} /> Add student</button></div>
            <div className="toolbar">
              <label className="search-input"><Search size={17} /><input value={search} onChange={event => { setSearch(event.target.value); setPageNumber(1); }} placeholder="Search by student name" aria-label="Search students" /></label>
              <FilterSelect value={categoryFilter} onChange={value => { setCategoryFilter(value); setPageNumber(1); }} />
              <label className="select-wrap"><ArrowDownUp size={15} /><select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort student records"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="marks-high">Highest marks</option><option value="marks-low">Lowest marks</option><option value="name">Name A–Z</option></select></label>
            </div>
            <StudentTable students={paginate(sortRecords(filterStudents(students, search, categoryFilter), sortBy), pageNumber, PAGE_SIZE)} onView={student => setModal({ type: 'details', student })} onEdit={student => setModal({ type: 'student', student })} onDelete={handleDeleteStudent} />
            <Pagination total={filterStudents(students, search, categoryFilter).length} page={pageNumber} pageSize={PAGE_SIZE} onChange={setPageNumber} />
          </section>
        )}

        {page === 'History' && (
          <section className="panel">
            <div className="panel-heading records-heading"><div><h3>Prediction history</h3><p>A complete record of estimates created in this browser.</p></div><button className="secondary-button danger-button" onClick={handleClearHistory} disabled={!predictions.length}><Trash2 size={15} /> Clear history</button></div>
            <div className="toolbar">
              <label className="search-input"><Search size={17} /><input value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Search prediction history" aria-label="Search prediction history" /></label>
              <FilterSelect value={historyFilter} onChange={setHistoryFilter} />
              <label className="select-wrap"><ArrowDownUp size={15} /><select value={historySort} onChange={event => setHistorySort(event.target.value)} aria-label="Sort prediction history"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="marks-high">Highest marks</option><option value="marks-low">Lowest marks</option><option value="name">Name A–Z</option></select></label>
            </div>
            <HistoryTable predictions={sortRecords(filterHistory(predictions, historySearch, historyFilter), historySort)} onView={prediction => setModal({ type: 'prediction', prediction })} />
          </section>
        )}

        <footer><span>AI Student Marks Predictor</span><span>Demonstration estimates · No server or external services</span></footer>
      </main>

      {modal?.type === 'student' && <StudentModal student={modal.student} onClose={() => setModal(null)} onSave={saveStudentAction} />}
      {modal?.type === 'details' && <DetailsModal student={modal.student} onClose={() => setModal(null)} onEdit={student => setModal({ type: 'student', student })} />}
      {modal?.type === 'prediction' && <PredictionModal prediction={modal.prediction} onClose={() => setModal(null)} />}
      {modal?.type === 'settings' && <SettingsModal settings={settings} onClose={() => setModal(null)} onSave={saveSettings} />}
    </div>
  );
}

function getBreakdown(values) {
  const study = Math.min(values.study_hours / 8, 1) * 100;
  return [
    { label: 'Daily study hours', value: study, weight: 20, source: `${values.study_hours} hours/day` },
    { label: 'Attendance', value: values.attendance, weight: 25, source: `${values.attendance}%` },
    { label: 'Previous marks', value: values.previous_marks, weight: 30, source: `${values.previous_marks}/100` },
    { label: 'Assignment marks', value: values.assignment_marks, weight: 25, source: `${values.assignment_marks}/100` }
  ];
}

function byDateNewest(a, b) {
  return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
}

function filterStudents(students, query, category) {
  const normalized = query.trim().toLocaleLowerCase();
  return students.filter(student =>
    student.name.toLocaleLowerCase().includes(normalized) &&
    (category === 'All categories' || student.category === category)
  );
}

function filterHistory(items, query, category) {
  const normalized = query.trim().toLocaleLowerCase();
  return items.filter(item =>
    item.name.toLocaleLowerCase().includes(normalized) &&
    (category === 'All categories' || item.category === category)
  );
}

function sortRecords(items, sortBy) {
  return [...items].sort((a, b) => {
    if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === 'marks-high') return Number(b.predicted_marks) - Number(a.predicted_marks);
    if (sortBy === 'marks-low') return Number(a.predicted_marks) - Number(b.predicted_marks);
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return byDateNewest(a, b);
  });
}

function paginate(items, page, pageSize) {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

function Stat({ icon: Icon, label, value, note, tone = '' }) {
  return <article className={`stat-card ${tone}`}><span className="stat-icon"><Icon size={19} /></span><p>{label}</p><h2>{value}</h2><small>{note}</small></article>;
}

function TextField({ name, label, hint, className = '', ...inputProps }) {
  return <label className={`field ${className}`}><span>{label}</span><input type="text" name={name} required maxLength="120" autoComplete="name" {...inputProps} /><small>{hint}</small></label>;
}

function NumberField({ name, label, hint, ...inputProps }) {
  return <label className="field"><span>{label}</span><input type="number" name={name} required {...inputProps} /><small>{hint}</small></label>;
}

function Notice({ type, message, onDismiss }) {
  const Icon = type === 'error' ? AlertCircle : CheckCircle2;
  return <div className={`alert ${type}-alert`} role={type === 'error' ? 'alert' : 'status'}><Icon size={18} /><span>{message}</span><button onClick={onDismiss} aria-label="Dismiss message"><X size={17} /></button></div>;
}

function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><strong>{title}</strong><p>{text}</p>{action && <button className="text-button" onClick={onAction}>{action} <span aria-hidden="true">→</span></button>}</div>;
}

function StudentTable({ students, onView, onEdit, onDelete }) {
  if (!students.length) return <EmptyState icon={Users} title="No student records found" text="Add a student or create a prediction to start building your local records." />;
  return <div className="table-scroll"><table><thead><tr><th>Student</th><th>Study</th><th>Attendance</th><th>Previous</th><th>Predicted</th><th>Category</th><th>Saved</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {students.map(student => <tr key={student.id}>
      <td><button className="student-name name-link" onClick={() => onView(student)}><span className="avatar">{student.name.charAt(0).toUpperCase()}</span>{student.name}</button></td>
      <td>{Number(student.study_hours).toFixed(1)} h</td><td>{Number(student.attendance).toFixed(1)}%</td><td>{Number(student.previous_marks).toFixed(1)}</td>
      <td><span className="marks-pill">{Number(student.predicted_marks).toFixed(1)}</span></td><td><CategoryBadge category={student.category} /></td>
      <td>{formatDate(student.updated_at || student.created_at)}</td>
      <td><div className="row-actions"><button className="icon-action" onClick={() => onEdit(student)} aria-label={`Edit ${student.name}`} title="Edit record"><Settings2 size={15} /></button><button className="delete-button" onClick={() => onDelete(student)} title={`Delete ${student.name}`} aria-label={`Delete ${student.name}`}><Trash2 size={15} /></button></div></td>
    </tr>)}
  </tbody></table></div>;
}

function HistoryTable({ predictions, onView }) {
  if (!predictions.length) return <EmptyState icon={History} title="No prediction history yet" text="Predictions you generate will be saved here for easy reference." />;
  return <div className="table-scroll"><table><thead><tr><th>Student</th><th>Study</th><th>Attendance</th><th>Previous</th><th>Assignment</th><th>Predicted</th><th>Category</th><th>Date</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>
    {predictions.map(item => <tr key={item.id}>
      <td><span className="student-name"><span className="avatar">{item.name.charAt(0).toUpperCase()}</span>{item.name}</span></td>
      <td>{Number(item.study_hours).toFixed(1)} h</td><td>{Number(item.attendance).toFixed(1)}%</td><td>{Number(item.previous_marks).toFixed(1)}</td><td>{Number(item.assignment_marks).toFixed(1)}</td>
      <td><span className="marks-pill">{Number(item.predicted_marks).toFixed(1)}</span></td><td><CategoryBadge category={item.category} /></td><td>{formatDate(item.created_at)}</td>
      <td><button className="icon-action" onClick={() => onView(item)} aria-label={`View ${item.name}'s prediction details`} title="View details"><CircleHelp size={16} /></button></td>
    </tr>)}
  </tbody></table></div>;
}

function CategoryBadge({ category }) {
  const variant = category?.toLowerCase().replaceAll(' ', '-');
  return <span className={`category-badge ${variant}`}>{category || 'Uncategorized'}</span>;
}

function FilterSelect({ value, onChange }) {
  return <label className="select-wrap"><ChevronDown size={15} /><select value={value} onChange={event => onChange(event.target.value)} aria-label="Filter by performance category">
    <option>All categories</option><option>Excellent</option><option>Good</option><option>Average</option><option>Needs Improvement</option>
  </select></label>;
}

function Pagination({ total, page, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (total <= pageSize) return total ? <div className="pagination"><span>Showing {total} student{total === 1 ? '' : 's'}</span></div> : null;
  return <div className="pagination"><span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} students</span><div><button className="secondary-button" onClick={() => onChange(page - 1)} disabled={page === 1}>Previous</button><span>Page {page} of {totalPages}</span><button className="secondary-button" onClick={() => onChange(page + 1)} disabled={page === totalPages}>Next</button></div></div>;
}

function PredictionResult({ result }) {
  const score = Number(result.predicted_marks);
  const category = result.category || getPerformanceCategory(score);
  const color = score >= 85 ? '#238365' : score >= 70 ? '#6546d7' : score >= 50 ? '#ba8127' : '#c44c4c';
  return <section className="result-card result-panel">
    <div className="result-heading"><div><span className="eyebrow">PREDICTION COMPLETE</span><h3>Performance estimate</h3></div><span className="result-date"><Clock3 size={14} /> {formatDateTime(result.created_at)}</span></div>
    <div className="score-row"><div className="score-ring" style={{ '--score': `${score}%`, '--score-color': color }}><div><strong>{score.toFixed(1)}</strong><span>/ 100</span></div></div><div className="score-summary"><CategoryBadge category={category} /><h2>{result.name}</h2><p>Estimated final examination score</p></div></div>
    <div className="breakdown"><h4>Factor breakdown</h4>{result.breakdown.map(item => <div className="breakdown-item" key={item.label}><div><span>{item.label} <small>· {item.weight}% weight</small></span><strong>{item.source}</strong></div><div className="progress-track"><span style={{ width: `${item.value}%` }} /></div></div>)}</div>
    <p className="result-disclaimer"><CircleHelp size={14} /> This is a demonstration heuristic and not a trained machine-learning model or a guaranteed exam result.</p>
  </section>;
}

function StudentModal({ student, onClose, onSave }) {
  const [values, setValues] = useState(student ? {
    name: student.name,
    study_hours: String(student.study_hours),
    attendance: String(student.attendance),
    previous_marks: String(student.previous_marks),
    assignment_marks: String(student.assignment_marks)
  } : { ...EMPTY_FORM });
  const [formError, setFormError] = useState('');

  function submit(event) {
    event.preventDefault();
    const name = values.name.trim();
    const data = {
      name,
      study_hours: Number(values.study_hours),
      attendance: Number(values.attendance),
      previous_marks: Number(values.previous_marks),
      assignment_marks: Number(values.assignment_marks)
    };
    if (!name) return setFormError('Student name is required.');
    const fields = [['study_hours', 24], ['attendance', 100], ['previous_marks', 100], ['assignment_marks', 100]];
    for (const [key, max] of fields) {
      if (values[key] === '' || !Number.isFinite(data[key]) || data[key] < 0 || data[key] > max) {
        return setFormError(`${fieldLabel(key)} must be between 0 and ${max}.`);
      }
    }
    const predicted = predictMarks(data);
    const now = new Date().toISOString();
    onSave(student ? 'edit' : 'add', {
      ...student,
      ...data,
      predicted_marks: predicted,
      category: getPerformanceCategory(predicted),
      created_at: student?.created_at || now,
      updated_at: now
    });
  }

  return <Modal title={student ? 'Edit student' : 'Add student'} onClose={onClose}>
    <form onSubmit={submit} noValidate>
      {formError && <div className="inline-error"><AlertCircle size={15} /> {formError}</div>}
      <div className="form-grid modal-form">
        <TextField className="full-width" name="name" label="Student name" value={values.name} onChange={event => setValues(current => ({ ...current, name: event.target.value }))} />
        <NumberField name="study_hours" label="Daily study hours" min="0" max="24" step="0.5" value={values.study_hours} onChange={event => setValues(current => ({ ...current, study_hours: event.target.value }))} />
        <NumberField name="attendance" label="Attendance percentage" min="0" max="100" step="0.1" value={values.attendance} onChange={event => setValues(current => ({ ...current, attendance: event.target.value }))} />
        <NumberField name="previous_marks" label="Previous marks" min="0" max="100" step="0.1" value={values.previous_marks} onChange={event => setValues(current => ({ ...current, previous_marks: event.target.value }))} />
        <NumberField name="assignment_marks" label="Assignment marks" min="0" max="100" step="0.1" value={values.assignment_marks} onChange={event => setValues(current => ({ ...current, assignment_marks: event.target.value }))} />
      </div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button"><Check size={16} /> {student ? 'Save changes' : 'Add student'}</button></div>
    </form>
  </Modal>;
}

function DetailsModal({ student, onClose, onEdit }) {
  return <Modal title="Student profile" onClose={onClose}>
    <div className="profile-heading"><span className="profile-avatar">{student.name.charAt(0).toUpperCase()}</span><div><h3>{student.name}</h3><CategoryBadge category={student.category} /></div></div>
    <div className="detail-grid">{[
      ['Predicted marks', `${Number(student.predicted_marks).toFixed(1)} / 100`],
      ['Daily study', `${Number(student.study_hours).toFixed(1)} hours`],
      ['Attendance', `${Number(student.attendance).toFixed(1)}%`],
      ['Previous marks', `${Number(student.previous_marks).toFixed(1)} / 100`],
      ['Assignment marks', `${Number(student.assignment_marks).toFixed(1)} / 100`],
      ['Last updated', formatDateTime(student.updated_at || student.created_at)]
    ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Close</button><button className="primary-button" onClick={() => onEdit(student)}><Settings2 size={15} /> Edit record</button></div>
  </Modal>;
}

function PredictionModal({ prediction, onClose }) {
  return <Modal title="Prediction details" onClose={onClose}>
    <div className="prediction-detail-score"><strong>{Number(prediction.predicted_marks).toFixed(1)}</strong><span>/ 100</span><CategoryBadge category={prediction.category} /></div>
    <div className="detail-grid">{[
      ['Student', prediction.name],
      ['Daily study', `${Number(prediction.study_hours).toFixed(1)} hours`],
      ['Attendance', `${Number(prediction.attendance).toFixed(1)}%`],
      ['Previous examination', `${Number(prediction.previous_marks).toFixed(1)} / 100`],
      ['Assignment marks', `${Number(prediction.assignment_marks).toFixed(1)} / 100`],
      ['Prediction date', formatDateTime(prediction.created_at)],
      ['Prediction ID', prediction.id]
    ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <p className="result-disclaimer"><CircleHelp size={14} /> Calculated using a deterministic weighted demonstration heuristic.</p>
  </Modal>;
}

function SettingsModal({ settings, onClose, onSave }) {
  const [threshold, setThreshold] = useState(String(settings.riskThreshold));
  return <Modal title="Dashboard settings" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); if (threshold === '') return; onSave({ riskThreshold: Number(threshold) }); onClose(); }}>
      <NumberField name="riskThreshold" label="At-risk score threshold" min="0" max="100" step="1" required value={threshold} onChange={event => setThreshold(event.target.value)} hint="Students with estimates below this value are flagged." />
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button"><Check size={16} /> Save settings</button></div>
    </form>
  </Modal>;
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>{children}</section>
  </div>;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fieldLabel(key) {
  return ({
    study_hours: 'Daily study hours',
    attendance: 'Attendance',
    previous_marks: 'Previous marks',
    assignment_marks: 'Assignment marks'
  })[key] || key;
}
