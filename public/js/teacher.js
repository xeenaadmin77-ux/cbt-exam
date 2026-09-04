/**
 * ITI College CBT Examination System - Teacher & Admin Portal Controller
 * Complete management for exams, questions, results, student roster, and lab settings.
 */

document.addEventListener('DOMContentLoaded', () => {
  const teacher = requireAuth('teacher');
  if (!teacher) return;

  renderTeacherHeader(teacher);

  const path = window.location.pathname;
  if (path.includes('teacher-dashboard.html')) {
    initDashboardOverview();
  } else if (path.includes('exam-create.html')) {
    initExamCreator();
  } else if (path.includes('question-manager.html')) {
    initQuestionManager();
  } else if (path.includes('results.html')) {
    initResultsManager();
  } else if (path.includes('students-manager.html')) {
    initStudentsManager();
  } else if (path.includes('settings.html')) {
    initSettingsManager();
  }

  const logoutBtn = document.getElementById('teacherLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

function renderTeacherHeader(teacher) {
  const nameEl = document.getElementById('teacherDisplayName');
  if (nameEl) nameEl.textContent = teacher.name || teacher.email || 'Faculty Invigilator';
}

// ----------------------------------------------------
// 1. Dashboard Overview
// ----------------------------------------------------
async function initDashboardOverview() {
  try {
    const [examsRes, resultsRes, studentsRes] = await Promise.all([
      apiFetch('/teacher/exams'),
      apiFetch('/teacher/results'),
      apiFetch('/teacher/students')
    ]);

    const exams = examsRes.exams || [];
    const results = resultsRes.results || [];
    const students = studentsRes.students || [];

    const activeCount = exams.filter(e => e.published).length;
    const totalSubmissions = results.length;

    // Update Stats
    document.getElementById('statActiveExams').textContent = activeCount;
    document.getElementById('statTotalStudents').textContent = students.length;
    document.getElementById('statSubmissions').textContent = totalSubmissions;
    
    const passRate = totalSubmissions > 0
      ? Math.round((results.filter(r => r.passed).length / totalSubmissions) * 100)
      : 0;
    document.getElementById('statPassRate').textContent = `${passRate}%`;

    // Render Recent Exams Table
    renderExamsTable(exams, 'dashboardExamsTable');

    // Render Recent Results Table
    renderRecentResultsTable(results.slice(0, 5), 'dashboardResultsTable');

  } catch (err) {
    console.error('Failed to load dashboard overview:', err);
  }
}

function renderExamsTable(exams, tableId) {
  const tbody = document.getElementById(tableId);
  if (!tbody) return;

  if (exams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">No exams created yet. Click "+ Create Exam" to get started.</td></tr>';
    return;
  }

  tbody.innerHTML = exams.map(e => `
    <tr>
      <td>
        <strong>${escapeHtml(e.title)}</strong>
        <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(e.trade || 'All Trades')}</div>
      </td>
      <td>${e.durationMinutes} mins</td>
      <td>${e.totalQuestions || 0}</td>
      <td>${e.totalMarks || 0} pts</td>
      <td>
        <span class="badge ${e.published ? 'badge-success' : 'badge-warning'}">
          ${e.published ? 'Published (Live)' : 'Draft (Unpublished)'}
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 6px;">
          <a href="question-manager.html?examId=${encodeURIComponent(e.examId)}" class="btn btn-sm btn-secondary" title="Manage Questions">
            Questions (${e.totalQuestions || 0})
          </a>
          <button class="btn btn-sm ${e.published ? 'btn-warning' : 'btn-success'}" onclick="togglePublishExam('${e.examId}', ${!e.published})">
            ${e.published ? 'Unpublish' : 'Publish'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteExam('${e.examId}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderRecentResultsTable(results, tableId) {
  const tbody = document.getElementById(tableId);
  if (!tbody) return;

  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">No student submissions recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = results.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.studentName)}</strong></td>
      <td><code>${escapeHtml(r.admissionNumber)}</code></td>
      <td>${escapeHtml(r.examTitle || 'Exam')}</td>
      <td><strong>${r.score}</strong> / ${r.totalMarks}</td>
      <td>
        <span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">
          ${r.percentage}% (${r.passed ? 'PASSED' : 'FAILED'})
        </span>
      </td>
      <td>${new Date(r.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
    </tr>
  `).join('');
}

// ----------------------------------------------------
// 2. Exam Creator & Editor
// ----------------------------------------------------
function initExamCreator() {
  const form = document.getElementById('createExamForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('saveExamBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving Exam...';

    const payload = {
      title: document.getElementById('examTitle').value.trim(),
      description: document.getElementById('examDescription').value.trim(),
      trade: document.getElementById('examTrade').value.trim(),
      month: document.getElementById('examMonth') ? document.getElementById('examMonth').value : 'September 2026',
      durationMinutes: parseInt(document.getElementById('examDuration').value, 10),
      passPercentage: parseInt(document.getElementById('examPassMark').value, 10),
      showResultImmediately: document.getElementById('showResultImmediately').checked,
      enablePerQuestionTimer: document.getElementById('enablePerQuestionTimer') ? document.getElementById('enablePerQuestionTimer').checked : false,
      perQuestionTimerSeconds: document.getElementById('perQuestionTimerSeconds') ? parseInt(document.getElementById('perQuestionTimerSeconds').value, 10) : 60,
      published: document.getElementById('examPublished').checked
    };

    try {
      const res = await apiFetch('/teacher/exams', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success && res.exam) {
        alert('Exam created successfully! Proceeding to add questions.');
        window.location.href = `question-manager.html?examId=${encodeURIComponent(res.exam.examId)}`;
      }
    } catch (err) {
      alert(`Failed to save exam: ${err.message}`);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Exam & Add Questions';
    }
  });
}

// ----------------------------------------------------
// 3. Question Manager (Form: Q, A, B, C, D, Answer, Marks)
// ----------------------------------------------------
let currentExamForQuestions = null;

async function initQuestionManager() {
  const urlParams = new URLSearchParams(window.location.search);
  const examId = urlParams.get('examId');

  // Load Exam Select dropdown
  try {
    const examsRes = await apiFetch('/teacher/exams');
    const exams = examsRes.exams || [];
    const select = document.getElementById('examSelector');
    select.innerHTML = exams.map(e => `
      <option value="${e.examId}" ${e.examId === examId ? 'selected' : ''}>
        ${escapeHtml(e.title)} (${e.trade || 'All Trades'})
      </option>
    `).join('');

    select.onchange = () => {
      window.location.href = `question-manager.html?examId=${encodeURIComponent(select.value)}`;
    };

    const targetExamId = examId || (exams[0] ? exams[0].examId : null);
    if (targetExamId) {
      loadExamQuestions(targetExamId);
    } else {
      document.getElementById('questionListContainer').innerHTML = '<div class="alert alert-info">Please create an exam first.</div>';
    }
  } catch (err) {
    console.error(err);
  }

  // Bind Add Question Form
  const form = document.getElementById('addQuestionForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const examSelect = document.getElementById('examSelector');
      const selectedExamId = examSelect ? examSelect.value : null;

      if (!selectedExamId) {
        alert('Please select an exam first.');
        return;
      }

      const addBtn = document.getElementById('addQuestionBtn');
      addBtn.disabled = true;
      addBtn.textContent = 'Adding Question...';

      const questionText = document.getElementById('questionText').value.trim();
      const optionA = document.getElementById('optionA').value.trim();
      const optionB = document.getElementById('optionB').value.trim();
      const optionC = document.getElementById('optionC').value.trim();
      const optionD = document.getElementById('optionD').value.trim();
      const correctAnswer = document.getElementById('correctAnswer').value;
      const marks = parseInt(document.getElementById('questionMarks').value, 10) || 2;
      const questionSet = document.getElementById('questionSet') ? document.getElementById('questionSet').value : 'Set A';
      const timeLimitSeconds = document.getElementById('timeLimitSeconds') ? parseInt(document.getElementById('timeLimitSeconds').value, 10) : 0;

      try {
        await apiFetch(`/teacher/exams/${selectedExamId}/questions`, {
          method: 'POST',
          body: JSON.stringify({
            questionText,
            optionA,
            optionB,
            optionC,
            optionD,
            correctAnswer,
            marks,
            questionSet,
            timeLimitSeconds
          })
        });

        // Reset form inputs
        document.getElementById('questionText').value = '';
        document.getElementById('optionA').value = '';
        document.getElementById('optionB').value = '';
        document.getElementById('optionC').value = '';
        document.getElementById('optionD').value = '';
        document.getElementById('questionText').focus();

        // Reload questions list
        await loadExamQuestions(selectedExamId);
      } catch (err) {
        alert(`Failed to add question: ${err.message}`);
      } finally {
        addBtn.disabled = false;
        addBtn.textContent = 'Add Question to Exam';
      }
    });
  }
}

async function loadExamQuestions(examId) {
  const container = document.getElementById('questionListContainer');
  const countBadge = document.getElementById('totalQuestionsCountBadge');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding: 20px;">Loading questions...</div>';

  try {
    const res = await apiFetch(`/teacher/exams/${examId}/questions`);
    const questions = res.questions || [];
    currentExamForQuestions = res.exam;

    if (countBadge) countBadge.textContent = `${questions.length} Questions (Total Marks: ${res.exam?.totalMarks || 0})`;

    if (questions.length === 0) {
      container.innerHTML = '<div class="alert alert-info">No questions added yet. Use the form above to add questions.</div>';
      return;
    }

    container.innerHTML = questions.map((q, idx) => `
      <div class="question-card" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
            <span class="badge badge-primary">Q${idx + 1}</span>
            <span class="badge" style="background: #e0e7ff; color: #3730a3; font-weight: 700;">🏷️ ${escapeHtml(q.questionSet || 'Set A')}</span>
            <span class="badge badge-success" style="font-weight: 700;">🎯 ${q.marks || 1} Marks</span>
            <span class="badge badge-warning" style="font-weight: 700;">⏱️ ${q.timeLimitSeconds > 0 ? q.timeLimitSeconds + 's Timer' : 'Exam Timer'}</span>
          </div>
          <button class="btn btn-sm btn-danger" onclick="deleteQuestion('${examId}', '${q.questionId}')">Delete</button>
        </div>
        <div style="font-weight: 600; font-size: 15px; margin-bottom: 12px; color: #1e293b;">
          ${escapeHtml(q.questionText)}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 10px;">
          <div style="padding: 6px 10px; border-radius: 4px; ${q.correctAnswer === 'A' ? 'background: var(--success-light); font-weight: 700; color: var(--success); border: 1px solid var(--success);' : 'background: #f8fafc;'}">
            A) ${escapeHtml(q.optionA)} ${q.correctAnswer === 'A' ? '✓ (Correct)' : ''}
          </div>
          <div style="padding: 6px 10px; border-radius: 4px; ${q.correctAnswer === 'B' ? 'background: var(--success-light); font-weight: 700; color: var(--success); border: 1px solid var(--success);' : 'background: #f8fafc;'}">
            B) ${escapeHtml(q.optionB)} ${q.correctAnswer === 'B' ? '✓ (Correct)' : ''}
          </div>
          <div style="padding: 6px 10px; border-radius: 4px; ${q.correctAnswer === 'C' ? 'background: var(--success-light); font-weight: 700; color: var(--success); border: 1px solid var(--success);' : 'background: #f8fafc;'}">
            C) ${escapeHtml(q.optionC)} ${q.correctAnswer === 'C' ? '✓ (Correct)' : ''}
          </div>
          <div style="padding: 6px 10px; border-radius: 4px; ${q.correctAnswer === 'D' ? 'background: var(--success-light); font-weight: 700; color: var(--success); border: 1px solid var(--success);' : 'background: #f8fafc;'}">
            D) ${escapeHtml(q.optionD)} ${q.correctAnswer === 'D' ? '✓ (Correct)' : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">Error loading questions: ${err.message}</div>`;
  }
}

window.deleteQuestion = async function(examId, questionId) {
  if (!confirm('Are you sure you want to delete this question?')) return;
  try {
    await apiFetch(`/teacher/exams/${examId}/questions/${questionId}`, { method: 'DELETE' });
    loadExamQuestions(examId);
  } catch (err) {
    alert(`Failed to delete question: ${err.message}`);
  }
};

window.togglePublishExam = async function(examId, publish) {
  try {
    await apiFetch(`/teacher/exams/${examId}`, {
      method: 'PUT',
      body: JSON.stringify({ published: publish })
    });
    const path = window.location.pathname;
    if (path.includes('teacher-dashboard.html')) initDashboardOverview();
  } catch (err) {
    alert(`Failed to update exam status: ${err.message}`);
  }
};

window.deleteExam = async function(examId) {
  if (!confirm('Warning: Deleting this exam will remove all questions and session history. Are you sure?')) return;
  try {
    await apiFetch(`/teacher/exams/${examId}`, { method: 'DELETE' });
    initDashboardOverview();
  } catch (err) {
    alert(`Failed to delete exam: ${err.message}`);
  }
};

// ----------------------------------------------------
// 4. Results Manager
// ----------------------------------------------------
let allLoadedResults = [];

async function initResultsManager() {
  const tbody = document.getElementById('resultsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px;">Loading examination results...</td></tr>';

  try {
    loadExamReleaseControls();
    const res = await apiFetch('/teacher/results');
    allLoadedResults = res.results || [];
    
    applyResultsFilters();

    // Search and filter listeners
    const searchInput = document.getElementById('searchResultInput');
    const monthSelect = document.getElementById('monthFilterSelect');
    const tradeSelect = document.getElementById('tradeFilterSelect');

    if (searchInput) searchInput.oninput = applyResultsFilters;
    if (monthSelect) monthSelect.onchange = applyResultsFilters;
    if (tradeSelect) tradeSelect.onchange = applyResultsFilters;

    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
      exportBtn.onclick = exportResultsToCsv;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="alert alert-danger">${err.message}</td></tr>`;
  }
}

function applyResultsFilters() {
  const searchInput = document.getElementById('searchResultInput');
  const monthSelect = document.getElementById('monthFilterSelect');
  const tradeSelect = document.getElementById('tradeFilterSelect');

  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selMonth = monthSelect ? monthSelect.value : 'ALL';
  const selTrade = tradeSelect ? tradeSelect.value : 'ALL';

  const filtered = allLoadedResults.filter(r => {
    const matchesQuery = !q || 
      (r.studentName && r.studentName.toLowerCase().includes(q)) || 
      (r.admissionNumber && r.admissionNumber.toLowerCase().includes(q)) ||
      (r.examTitle && r.examTitle.toLowerCase().includes(q));

    const matchesMonth = (selMonth === 'ALL') || 
      (r.month && r.month.toLowerCase() === selMonth.toLowerCase()) ||
      (r.examTitle && r.examTitle.toLowerCase().includes(selMonth.toLowerCase()));

    const matchesTrade = (selTrade === 'ALL') || 
      (r.trade && r.trade.toLowerCase().includes(selTrade.toLowerCase())) ||
      (r.examTitle && r.examTitle.toLowerCase().includes(selTrade.toLowerCase()));

    return matchesQuery && matchesMonth && matchesTrade;
  });

  updateKpiSummary(filtered);
  renderResultsList(filtered);
}

function updateKpiSummary(results) {
  const totalSubmissionsEl = document.getElementById('kpiTotalSubmissions');
  const passedCountEl = document.getElementById('kpiPassedCount');
  const passRateEl = document.getElementById('kpiPassRate');
  const avgScoreEl = document.getElementById('kpiAvgScore');
  const topScorerEl = document.getElementById('kpiTopScorer');
  const countBadge = document.getElementById('resultsCountBadge');

  if (!totalSubmissionsEl) return;

  const total = results.length;
  totalSubmissionsEl.textContent = total;
  if (countBadge) {
    countBadge.textContent = `${total} Candidate Submissions`;
  }

  if (total === 0) {
    if (passedCountEl) passedCountEl.textContent = '0';
    if (passRateEl) passRateEl.textContent = 'Pass Rate: 0%';
    if (avgScoreEl) avgScoreEl.textContent = '0';
    if (topScorerEl) topScorerEl.textContent = 'No Submissions';
    return;
  }

  const passed = results.filter(r => r.passed);
  const passRate = Math.round((passed.length / total) * 100);
  const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
  const avgScore = (totalScore / total).toFixed(1);

  const top = [...results].sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  if (passedCountEl) passedCountEl.textContent = passed.length;
  if (passRateEl) passRateEl.textContent = `Pass Rate: ${passRate}% (${passed.length}/${total})`;
  if (avgScoreEl) avgScoreEl.textContent = `${avgScore} marks`;
  if (topScorerEl && top) {
    topScorerEl.textContent = `${top.studentName} (${top.score}/${top.totalMarks})`;
  }
}

async function loadExamReleaseControls() {
  const container = document.getElementById('examReleaseToggles');
  if (!container) return;

  try {
    const res = await apiFetch('/teacher/exams');
    const exams = res.exams || [];

    if (exams.length === 0) {
      container.innerHTML = '<span style="font-size: 13px; color: var(--text-muted);">No exams available.</span>';
      return;
    }

    container.innerHTML = exams.map(e => {
      const isPublished = Boolean(e.resultsPublished);
      return `
        <div style="display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 6px 12px; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <div style="font-size: 12px;">
            <strong>${escapeHtml(e.title)}:</strong>
            <span class="badge ${isPublished ? 'badge-success' : 'badge-warning'}" style="margin-left: 4px;">
              ${isPublished ? '✓ Released to Students' : '🔒 Hidden from Students'}
            </span>
          </div>
          <button 
            type="button" 
            class="btn btn-sm ${isPublished ? 'btn-secondary' : 'btn-primary'}" 
            onclick="toggleExamResultsRelease('${e.examId}')"
            style="padding: 4px 10px; font-size: 11px;"
          >
            ${isPublished ? '🔒 Hide Results' : '📢 Publish to Students'}
          </button>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<span style="font-size: 12px; color: var(--danger);">${err.message}</span>`;
  }
}

window.toggleExamResultsRelease = async function(examId) {
  try {
    const res = await apiFetch(`/teacher/exams/${examId}/toggle-results-publish`, { method: 'POST' });
    if (res.success) {
      alert(res.message || 'Results publication status updated.');
      loadExamReleaseControls();
    }
  } catch (err) {
    alert(`Failed to update result release: ${err.message}`);
  }
};

function renderResultsList(results) {
  const tbody = document.getElementById('resultsTableBody');
  if (!tbody) return;

  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">No student records match criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = results.map(r => `
    <tr>
      <td>
        <strong style="color: var(--text-main); font-size: 14px;">${escapeHtml(r.studentName)}</strong>
      </td>
      <td>
        <code style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-weight: 700; color: #1e293b;">${escapeHtml(r.admissionNumber)}</code>
      </td>
      <td>
        <div><strong>${escapeHtml(r.examTitle || 'Exam')}</strong></div>
        <small style="color: var(--text-muted); font-size: 12px;">📅 ${escapeHtml(r.month || 'September 2026')} | ⚙️ ${escapeHtml(r.trade || 'General')}</small>
      </td>
      <td>
        <span style="font-size: 16px; font-weight: 800; color: #1e293b;">${r.score}</span> / <span style="color: var(--text-muted); font-weight: 600;">${r.totalMarks}</span>
      </td>
      <td>
        <span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}" style="font-weight: 700; padding: 4px 10px;">
          ${r.percentage}% (${r.passed ? 'PASS' : 'FAIL'})
        </span>
      </td>
      <td style="font-size: 12px; color: var(--text-muted);">
        ${new Date(r.submittedAt).toLocaleString()}
      </td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewDetailedScorecard('${r.resultId}')">
          View Detail
        </button>
      </td>
    </tr>
  `).join('');
}

window.viewDetailedScorecard = function(resultId) {
  const item = allLoadedResults.find(r => r.resultId === resultId);
  if (!item) return;

  let modal = document.getElementById('resultDetailModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'resultDetailModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const breakdownRows = (item.breakdown || []).map((b, idx) => `
    <tr>
      <td>Q${idx + 1}</td>
      <td><code>${b.selectedOption || 'Not Attempted'}</code></td>
      <td><code>${b.correctAnswer}</code></td>
      <td>${b.isCorrect ? '<span style="color: var(--success); font-weight: 700;">✓ Correct</span>' : '<span style="color: var(--danger);">✗ Incorrect</span>'}</td>
      <td>${b.marksAwarded}</td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div class="modal-dialog" style="max-width: 680px;">
      <div class="modal-header">
        <h3>Student Examination Scorecard (Faculty Audit)</h3>
      </div>
      <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
          <div>Student: <strong>${escapeHtml(item.studentName)}</strong></div>
          <div>Admission Form No: <strong>${escapeHtml(item.admissionNumber)}</strong></div>
          <div>Exam: <strong>${escapeHtml(item.examTitle)}</strong></div>
          <div>Session Month: <strong>${escapeHtml(item.month || 'September 2026')}</strong></div>
          <div>Score: <strong style="color: ${item.passed ? 'var(--success)' : 'var(--danger)'}; font-size: 16px;">${item.score} / ${item.totalMarks} (${item.percentage}%)</strong></div>
          <div>Result Status: <strong style="color: ${item.passed ? 'var(--success)' : 'var(--danger)'};">${item.passed ? 'PASS' : 'FAIL'}</strong></div>
        </div>
        <h4 style="font-size: 14px; margin-bottom: 8px;">Question-by-Question Evaluation Breakdown:</h4>
        <table class="custom-table" style="font-size: 13px;">
          <thead>
            <tr>
              <th>#</th>
              <th>Selected</th>
              <th>Correct</th>
              <th>Status</th>
              <th>Marks</th>
            </tr>
          </thead>
          <tbody>
            ${breakdownRows || '<tr><td colspan="5">No question breakdown logged.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('resultDetailModal').style.display='none'">Close</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
};

function exportResultsToCsv() {
  if (allLoadedResults.length === 0) {
    alert('No results available to export.');
    return;
  }

  const searchInput = document.getElementById('searchResultInput');
  const monthSelect = document.getElementById('monthFilterSelect');
  const tradeSelect = document.getElementById('tradeFilterSelect');

  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selMonth = monthSelect ? monthSelect.value : 'ALL';
  const selTrade = tradeSelect ? tradeSelect.value : 'ALL';

  const dataToExport = allLoadedResults.filter(r => {
    const matchesQuery = !q || 
      (r.studentName && r.studentName.toLowerCase().includes(q)) || 
      (r.admissionNumber && r.admissionNumber.toLowerCase().includes(q)) ||
      (r.examTitle && r.examTitle.toLowerCase().includes(q));

    const matchesMonth = (selMonth === 'ALL') || 
      (r.month && r.month.toLowerCase() === selMonth.toLowerCase()) ||
      (r.examTitle && r.examTitle.toLowerCase().includes(selMonth.toLowerCase()));

    const matchesTrade = (selTrade === 'ALL') || 
      (r.trade && r.trade.toLowerCase().includes(selTrade.toLowerCase())) ||
      (r.examTitle && r.examTitle.toLowerCase().includes(selTrade.toLowerCase()));

    return matchesQuery && matchesMonth && matchesTrade;
  });

  if (dataToExport.length === 0) {
    alert('No results matching your filters to export.');
    return;
  }

  const headers = [
    "Student Name",
    "Admission Form Number",
    "Exam Title",
    "Examination Month",
    "Trade",
    "Score",
    "Total Marks",
    "Percentage",
    "Status",
    "Submitted At"
  ];

  const rows = dataToExport.map(r => [
    `"${(r.studentName || '').replace(/"/g, '""')}"`,
    `"${(r.admissionNumber || '').replace(/"/g, '""')}"`,
    `"${(r.examTitle || '').replace(/"/g, '""')}"`,
    `"${(r.month || 'September 2026').replace(/"/g, '""')}"`,
    `"${(r.trade || 'General').replace(/"/g, '""')}"`,
    r.score,
    r.totalMarks,
    `"${r.percentage}%"`,
    r.passed ? 'PASS' : 'FAIL',
    `"${new Date(r.submittedAt).toLocaleString()}"`
  ]);

  const csvString = [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `XEENA_Institute_Results_Sheet_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------
// 5. Student Roster Manager (Single & Bulk Import)
// ----------------------------------------------------
let allRosterStudents = [];
let pendingBulkStudents = [];

async function initStudentsManager() {
  const tbody = document.getElementById('studentsTableBody');
  const addForm = document.getElementById('addStudentForm');

  const tabBulk = document.getElementById('tabBulkImport');
  const tabSingle = document.getElementById('tabSingleStudent');
  const sectionBulk = document.getElementById('bulkImportSection');
  const sectionSingle = document.getElementById('singleStudentSection');

  if (tabBulk && tabSingle && sectionBulk && sectionSingle) {
    tabBulk.onclick = () => {
      tabBulk.className = 'btn btn-primary';
      tabSingle.className = 'btn btn-secondary';
      sectionBulk.style.display = 'block';
      sectionSingle.style.display = 'none';
    };
    tabSingle.onclick = () => {
      tabSingle.className = 'btn btn-primary';
      tabBulk.className = 'btn btn-secondary';
      sectionSingle.style.display = 'block';
      sectionBulk.style.display = 'none';
    };
  }

  const templateBtn = document.getElementById('downloadCsvTemplateBtn');
  if (templateBtn) {
    templateBtn.onclick = downloadStudentCsvTemplate;
  }

  const exportRosterBtn = document.getElementById('exportRosterBtn');
  if (exportRosterBtn) {
    exportRosterBtn.onclick = exportRosterToCsv;
  }

  const searchInput = document.getElementById('searchStudentRosterInput');
  if (searchInput) {
    searchInput.oninput = () => {
      const q = searchInput.value.toLowerCase().trim();
      const filtered = allRosterStudents.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.username && s.username.toLowerCase().includes(q)) ||
        (s.admissionNumber && s.admissionNumber.toLowerCase().includes(q)) ||
        (s.trade && s.trade.toLowerCase().includes(q))
      );
      renderStudentRoster(filtered);
    };
  }

  const fileInput = document.getElementById('bulkCsvFileInput');
  if (fileInput) {
    fileInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const textarea = document.getElementById('bulkPasteTextarea');
        if (textarea) textarea.value = text;
        parseBulkStudentsData(text);
      };
      reader.readAsText(file);
    };
  }

  const parseBtn = document.getElementById('parseBulkDataBtn');
  if (parseBtn) {
    parseBtn.onclick = () => {
      const text = document.getElementById('bulkPasteTextarea').value;
      parseBulkStudentsData(text);
    };
  }

  const clearBtn = document.getElementById('clearBulkInputBtn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (fileInput) fileInput.value = '';
      const textarea = document.getElementById('bulkPasteTextarea');
      if (textarea) textarea.value = '';
      pendingBulkStudents = [];
      const previewCard = document.getElementById('bulkPreviewContainer');
      if (previewCard) previewCard.style.display = 'none';
    };
  }

  const confirmBtn = document.getElementById('confirmBulkImportBtn');
  if (confirmBtn) {
    confirmBtn.onclick = executeBulkStudentImport;
  }

  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('saveStudentBtn');
      btn.disabled = true;
      btn.textContent = 'Registering...';

      const name = document.getElementById('newStudentName').value.trim();
      const customUser = document.getElementById('newStudentUsername') ? document.getElementById('newStudentUsername').value.trim() : '';
      const admissionNumber = document.getElementById('newAdmissionNumber').value.trim().toUpperCase();
      const trade = document.getElementById('newStudentTrade').value.trim();
      const batch = document.getElementById('newStudentBatch').value.trim();

      try {
        await apiFetch('/teacher/students', {
          method: 'POST',
          body: JSON.stringify({ 
            name, 
            username: customUser || name.toLowerCase().replace(/\s+/g, '.'),
            admissionNumber, 
            trade, 
            batch 
          })
        });

        document.getElementById('newStudentName').value = '';
        if (document.getElementById('newStudentUsername')) document.getElementById('newStudentUsername').value = '';
        document.getElementById('newAdmissionNumber').value = '';
        loadStudentsList();
        alert(`Student '${name}' (${admissionNumber}) registered successfully.`);
      } catch (err) {
        alert(`Failed to add student: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Register Candidate';
      }
    });
  }

  loadStudentsList();
}

function downloadStudentCsvTemplate() {
  const content = "Candidate Name,Admission Form Number,Trade,Academic Batch,Username\nRanit Biswas,XEENA2025010,COPA,2024-2026,ranit.biswas\nSubham Mondal,XEENA2025011,Electrician,2024-2026,subham.mondal\nPriyanka Das,XEENA2025012,Fitter,2024-2026,priyanka.das\n";
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'XEENA_Student_Import_Template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseBulkStudentsData(rawText) {
  if (!rawText || !rawText.trim()) {
    alert('Please upload a file or paste Excel rows first.');
    return;
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    alert('No content found to parse.');
    return;
  }

  pendingBulkStudents = [];

  let startIndex = 0;
  const firstLine = lines[0].toLowerCase();
  if (firstLine.includes('name') && (firstLine.includes('admission') || firstLine.includes('roll') || firstLine.includes('trade'))) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const delimiter = line.includes('\t') ? '\t' : ',';
    const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length < 2) continue;

    const name = parts[0];
    const admissionNumber = (parts[1] || '').toUpperCase();
    const trade = parts[2] || 'General';
    const batch = parts[3] || '2024-2026';
    const username = (parts[4] && parts[4].trim()) ? parts[4].trim().toLowerCase() : name.toLowerCase().replace(/\s+/g, '.');

    if (name && admissionNumber) {
      pendingBulkStudents.push({
        name,
        admissionNumber,
        trade,
        batch,
        username,
        isValid: true
      });
    }
  }

  if (pendingBulkStudents.length === 0) {
    alert('Could not parse any valid student entries. Ensure lines have at least Name and Admission Form Number.');
    return;
  }

  const previewContainer = document.getElementById('bulkPreviewContainer');
  const countBadge = document.getElementById('parsedCountBadge');
  const tbody = document.getElementById('bulkPreviewTableBody');

  if (countBadge) countBadge.textContent = pendingBulkStudents.length;
  if (tbody) {
    tbody.innerHTML = pendingBulkStudents.map((s, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td><code style="font-weight: 700;">${escapeHtml(s.admissionNumber)}</code></td>
        <td><code>${escapeHtml(s.username)}</code></td>
        <td>${escapeHtml(s.trade)}</td>
        <td>${escapeHtml(s.batch)}</td>
        <td><span class="badge badge-success">Ready to Import</span></td>
      </tr>
    `).join('');
  }
  if (previewContainer) previewContainer.style.display = 'block';
}

async function executeBulkStudentImport() {
  if (pendingBulkStudents.length === 0) {
    alert('No student records to import.');
    return;
  }

  const confirmBtn = document.getElementById('confirmBulkImportBtn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importing to College Database...';
  }

  try {
    const res = await apiFetch('/teacher/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ students: pendingBulkStudents })
    });

    if (res.success) {
      alert(`✓ ${res.message || 'Students imported successfully!'}`);
      pendingBulkStudents = [];
      const previewContainer = document.getElementById('bulkPreviewContainer');
      if (previewContainer) previewContainer.style.display = 'none';
      const textarea = document.getElementById('bulkPasteTextarea');
      if (textarea) textarea.value = '';
      loadStudentsList();
    }
  } catch (err) {
    alert(`Bulk import error: ${err.message}`);
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm & Save Students to Portal';
    }
  }
}

async function loadStudentsList() {
  const tbody = document.getElementById('studentsTableBody');
  if (!tbody) return;

  try {
    const res = await apiFetch('/teacher/students');
    allRosterStudents = res.students || [];
    renderStudentRoster(allRosterStudents);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="alert alert-danger">${err.message}</td></tr>`;
  }
}

function renderStudentRoster(students) {
  const tbody = document.getElementById('studentsTableBody');
  const countBadge = document.getElementById('studentCountBadge');
  if (!tbody) return;

  if (countBadge) {
    countBadge.textContent = `${students.length} Students`;
  }

  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">No students registered yet.</td></tr>';
    return;
  }

  tbody.innerHTML = students.map(s => `
    <tr>
      <td>
        <strong style="color: var(--text-main); font-size: 14px;">${escapeHtml(s.name)}</strong>
      </td>
      <td>
        <code style="background: #e2e8f0; padding: 3px 8px; border-radius: 4px; font-weight: 600;">${escapeHtml(s.username || s.name.toLowerCase().replace(/\s+/g, '.'))}</code>
      </td>
      <td>
        <code style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-weight: 700; color: var(--primary);">${escapeHtml(s.admissionNumber)}</code>
      </td>
      <td>
        <span class="badge badge-primary">${escapeHtml(s.trade || 'General')}</span>
      </td>
      <td>${escapeHtml(s.batch || '2024-2026')}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteStudent('${s.uid}')" style="padding: 4px 10px; font-size: 11px;">Remove</button>
      </td>
    </tr>
  `).join('');
}

function exportRosterToCsv() {
  if (allRosterStudents.length === 0) {
    alert('No students in roster to export.');
    return;
  }

  const headers = ["Candidate Full Name", "Portal Username", "Admission Form Number", "Trade", "Academic Batch"];
  const rows = allRosterStudents.map(s => [
    `"${(s.name || '').replace(/"/g, '""')}"`,
    `"${(s.username || s.name.toLowerCase().replace(/\s+/g, '.')).replace(/"/g, '""')}"`,
    `"${(s.admissionNumber || '').replace(/"/g, '""')}"`,
    `"${(s.trade || 'General').replace(/"/g, '""')}"`,
    `"${(s.batch || '2024-2026').replace(/"/g, '""')}"`
  ]);

  const csvString = [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `XEENA_Student_Roster_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.deleteStudent = async function(uid) {
  if (!confirm('Remove this student from the roster?')) return;
  try {
    await apiFetch(`/teacher/students/${uid}`, { method: 'DELETE' });
    loadStudentsList();
  } catch (err) {
    alert(`Error removing student: ${err.message}`);
  }
};

// ----------------------------------------------------
// 6. Settings & Invigilator Configuration (CHANGE 14, 15)
// ----------------------------------------------------
async function initSettingsManager() {
  const form = document.getElementById('collegeSettingsForm');
  if (!form) return;

  try {
    const res = await apiFetch('/settings');
    const s = res.settings || {};
    document.getElementById('cfgCollegeName').value = s.collegeName || '';
    document.getElementById('cfgTagline').value = s.tagline || '';
    document.getElementById('cfgLabName').value = s.labName || '';
  } catch (err) {
    console.error(err);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveSettingsBtn');
    btn.disabled = true;

    const payload = {
      collegeName: document.getElementById('cfgCollegeName').value.trim(),
      tagline: document.getElementById('cfgTagline').value.trim(),
      labName: document.getElementById('cfgLabName').value.trim(),
      exitPassword: document.getElementById('cfgExitPassword').value.trim()
    };

    try {
      await apiFetch('/settings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert('College configuration updated successfully!');
      applyCollegeBranding();
    } catch (err) {
      alert(`Error updating settings: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  loadAuditLogs();
}

async function loadAuditLogs() {
  const tbody = document.getElementById('auditLogsTableBody');
  if (!tbody) return;

  try {
    const res = await apiFetch('/teacher/audit-logs');
    const logs = res.logs || [];

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">No security events recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td><span class="badge ${l.eventType.includes('warn') || l.eventType.includes('exit') || l.eventType.includes('FAIL') ? 'badge-danger' : 'badge-primary'}">${escapeHtml(l.eventType)}</span></td>
        <td><code>${escapeHtml(l.studentUid || 'N/A')}</code></td>
        <td><code>${escapeHtml(l.sessionId || 'N/A')}</code></td>
        <td style="max-width: 300px; word-break: break-all;">${escapeHtml(l.details || '')}</td>
        <td>${new Date(l.timestamp).toLocaleTimeString()}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5">Unable to load audit logs.</td></tr>';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
