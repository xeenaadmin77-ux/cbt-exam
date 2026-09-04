/**
 * ITI College CBT Examination System - Student Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth('student');
  if (!user) return;

  renderStudentProfile(user);
  loadAvailableExams(user);

  const logoutBtn = document.getElementById('studentLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

function renderStudentProfile(user) {
  const nameEl = document.getElementById('profileStudentName');
  const admEl = document.getElementById('profileAdmissionNumber');
  const tradeEl = document.getElementById('profileTrade');
  const avatarEl = document.getElementById('profileAvatar');

  if (nameEl) nameEl.textContent = user.name || 'Student';
  if (admEl) admEl.textContent = `Admission No: ${user.admissionNumber || 'N/A'}`;
  if (tradeEl) tradeEl.textContent = `Trade: ${user.trade || 'ITI General'}`;
  if (avatarEl) avatarEl.textContent = (user.name ? user.name[0] : 'S').toUpperCase();
}

async function loadAvailableExams(user) {
  const grid = document.getElementById('availableExamsGrid');
  const emptyState = document.getElementById('noExamsNotice');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Loading available examinations...</div>';

  try {
    const data = await apiFetch('/available-exams');
    const exams = data.exams || [];

    if (exams.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    grid.innerHTML = '';

    exams.forEach(exam => {
      const card = document.createElement('div');
      card.className = 'exam-card';

      const isCompleted = exam.userStatus === 'submitted' || exam.userStatus === 'expired';
      const inProgress = exam.userStatus === 'in_progress';

      let statusBadge = `<span class="badge badge-primary">Scheduled</span>`;
      let actionBtn = `
        <button class="btn btn-primary" onclick="promptStartExam('${exam.examId}', '${escapeHtml(exam.title)}', ${exam.durationMinutes}, ${exam.totalQuestions})">
          Start Examination ➔
        </button>
      `;

      if (isCompleted) {
        if (exam.resultsPublished) {
          statusBadge = `<span class="badge badge-success">✓ Result Released</span>`;
          actionBtn = `
            <a href="result.html?examId=${encodeURIComponent(exam.examId)}&sessionId=${encodeURIComponent(exam.sessionId || '')}" class="btn btn-primary">
              View Scorecard
            </a>
          `;
        } else {
          statusBadge = `<span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">✓ Submitted (Evaluation Pending)</span>`;
          actionBtn = `
            <a href="result.html?examId=${encodeURIComponent(exam.examId)}&sessionId=${encodeURIComponent(exam.sessionId || '')}" class="btn btn-secondary">
              Submission Receipt
            </a>
          `;
        }
      } else if (inProgress) {
        statusBadge = `<span class="badge badge-warning">In Progress</span>`;
        actionBtn = `
          <button class="btn btn-warning" onclick="resumeExam('${exam.examId}')">
            Resume Active Test ➔
          </button>
        `;
      }

      card.innerHTML = `
        <div class="exam-card-header">
          <div>
            <h3>${escapeHtml(exam.title)}</h3>
            <span style="font-size: 12px; color: var(--text-muted);">${escapeHtml(exam.trade || 'All ITI Trades')}</span>
          </div>
          ${statusBadge}
        </div>
        <div class="exam-card-body">
          <p>${escapeHtml(exam.description || 'Monthly assessment examination.')}</p>
          <div class="exam-specs">
            <div class="spec-item">
              <span>⏱</span>
              <div>Duration: <strong>${exam.durationMinutes} mins</strong></div>
            </div>
            <div class="spec-item">
              <span>📋</span>
              <div>Questions: <strong>${exam.totalQuestions}</strong></div>
            </div>
            <div class="spec-item">
              <span>🎯</span>
              <div>Total Marks: <strong>${exam.totalMarks}</strong></div>
            </div>
            <div class="spec-item">
              <span>🏆</span>
              <div>Pass Mark: <strong>${exam.passPercentage || 40}%</strong></div>
            </div>
          </div>
        </div>
        <div class="exam-card-footer">
          <span style="font-size: 12px; color: var(--text-muted);">Computer Lab Test</span>
          ${actionBtn}
        </div>
      `;

      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1;" class="alert alert-danger">
        Failed to load scheduled examinations: ${err.message}. Please notify the lab teacher.
      </div>
    `;
  }
}

// Confirmation modal before launching exam
function promptStartExam(examId, title, duration, totalQuestions) {
  let modal = document.getElementById('startExamModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'startExamModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Examination Instructions</h3>
      </div>
      <div class="modal-body">
        <h4 style="color: var(--primary); margin-bottom: 12px;">${escapeHtml(title)}</h4>
        <ul style="padding-left: 20px; font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 16px;">
          <li>This exam consists of <strong>${totalQuestions} questions</strong>.</li>
          <li>Total duration is <strong>${duration} minutes</strong>, timed server-side.</li>
          <li>Full-screen mode will be requested. Exiting full-screen or switching tabs will be logged.</li>
          <li>Answers are saved automatically as you select them.</li>
          <li>Do not refresh or close the browser window. If accidental refresh happens, you can resume.</li>
          <li>To exit early, an invigilator/teacher authorization password is required.</li>
        </ul>
        <div class="alert alert-warning" style="font-size: 13px;">
          ⚠️ By clicking "Begin Examination", you confirm you are at your designated lab terminal and ready to begin.
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeStartModal()">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="proceedToExam('${examId}')">Begin Examination</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

function closeStartModal() {
  const modal = document.getElementById('startExamModal');
  if (modal) modal.style.display = 'none';
}

function proceedToExam(examId) {
  window.location.href = `exam.html?examId=${encodeURIComponent(examId)}`;
}

function resumeExam(examId) {
  window.location.href = `exam.html?examId=${encodeURIComponent(examId)}`;
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
