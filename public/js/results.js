/**
 * ITI College CBT Examination System - Student Result Viewer
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = requireAuth('student');
  if (!user) return;

  const urlParams = new URLSearchParams(window.location.search);
  const resultId = urlParams.get('resultId');
  const examId = urlParams.get('examId');

  const container = document.getElementById('resultContainer');
  if (!container) return;

  try {
    const res = await apiFetch(`/student-result?resultId=${encodeURIComponent(resultId || '')}&examId=${encodeURIComponent(examId || '')}`);
    const result = res.result;

    if (!result) {
      container.innerHTML = `
        <div class="alert alert-warning" style="text-align: center; padding: 32px;">
          <h3>Scorecard Pending or Unpublished</h3>
          <p>Your examination was received successfully. The evaluation will be released according to college schedule.</p>
          <a href="student-dashboard.html" class="btn btn-primary" style="margin-top: 16px;">Return to Dashboard</a>
        </div>
      `;
      return;
    }

    if (result.resultsPublished === false) {
      renderPendingConfirmation(result, container);
    } else {
      renderScorecard(result, container);
    }
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger" style="text-align: center; padding: 24px;">
        <h3>Unable to Load Result</h3>
        <p>${err.message}</p>
        <a href="student-dashboard.html" class="btn btn-secondary" style="margin-top: 12px;">Return to Dashboard</a>
      </div>
    `;
  }
});

function renderPendingConfirmation(result, container) {
  container.innerHTML = `
    <div class="auth-card" style="max-width: 680px; margin: 0 auto;">
      <div class="auth-card-header" style="background: #f0fdf4; border-bottom: 2px solid #22c55e;">
        <div class="auth-icon" style="background: #ffffff; color: #16a34a; font-size: 28px;">
          ✓
        </div>
        <h2 style="color: #14532d; font-size: 22px;">
          Submission Confirmed
        </h2>
        <p style="color: #166534; font-size: 13.5px;">
          Examination Successfully Submitted &amp; Recorded Server-Side
        </p>
      </div>
      <div class="auth-card-body">
        <div class="alert alert-success" style="display: flex; gap: 12px; align-items: flex-start; padding: 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: var(--radius-md);">
          <span style="font-size: 24px; line-height: 1;">📋</span>
          <div>
            <strong style="color: #065f46; font-size: 15px;">Official Notice:</strong>
            <p style="margin-top: 4px; font-size: 13px; color: #047857; line-height: 1.5;">
              Your answers have been stored and scored securely on the college server. Results are held in accordance with examination regulations and will be released upon invigilator authorization.
            </p>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; padding: 18px; border-radius: var(--radius-md); margin: 20px 0; border: 1px solid var(--border);">
          <div>
            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Student Name</span>
            <div style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-top: 2px;">${escapeHtml(result.studentName)}</div>
          </div>
          <div>
            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Admission No</span>
            <div style="font-size: 16px; font-weight: 700; margin-top: 2px;"><code>${escapeHtml(result.admissionNumber)}</code></div>
          </div>
          <div>
            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Examination</span>
            <div style="font-weight: 600; color: var(--text-main); margin-top: 2px;">${escapeHtml(result.examTitle || 'CBT Assessment')}</div>
          </div>
          <div>
            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Submission Timestamp</span>
            <div style="font-size: 13px; color: var(--text-main); font-weight: 500; margin-top: 2px;">${new Date(result.submittedAt).toLocaleString()}</div>
          </div>
        </div>
        <div style="text-align: center; padding: 16px; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: var(--radius-md); margin-bottom: 24px;">
          <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Official Submission Receipt Reference</span>
          <div style="font-size: 18px; font-weight: 800; font-family: monospace; color: var(--primary); margin-top: 4px;">
            XEENA-CBT-${(result.resultId || 'CONFIRM').toUpperCase()}
          </div>
          <div style="display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: #166534; background: #dcfce7; padding: 4px 12px; border-radius: 9999px; font-weight: 600;">
            <span>✓</span> Verified on Server
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 12px;">
          <a href="student-dashboard.html" class="btn btn-secondary">
            Return to Dashboard
          </a>
          <button type="button" class="btn btn-primary" onclick="window.print()">
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderScorecard(result, container) {
  const isPassed = result.passed;
  let breakdownHtml = '';

  if (result.breakdown && result.breakdown.length > 0) {
    const rows = result.breakdown.map((b, idx) => `
      <tr>
        <td><strong>Question ${idx + 1}</strong></td>
        <td><code>Option ${b.selectedOption || 'Not Attempted'}</code></td>
        <td><code>Option ${b.correctAnswer}</code></td>
        <td>
          ${b.isCorrect 
            ? '<span class="badge badge-success">✓ Correct</span>' 
            : '<span class="badge badge-danger">✗ Incorrect</span>'
          }
        </td>
        <td><strong>${b.marksAwarded}</strong></td>
      </tr>
    `).join('');

    breakdownHtml = `
      <div style="margin-top: 28px;">
        <h3 style="font-size: 16px; margin-bottom: 12px;">Question Review Summary</h3>
        <table class="custom-table" style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid var(--border);">
          <thead>
            <tr>
              <th>Question</th>
              <th>Your Choice</th>
              <th>Correct Option</th>
              <th>Result</th>
              <th>Marks</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="auth-card" style="max-width: 720px; margin: 0 auto;">
      <div class="auth-card-header" style="background: ${isPassed ? 'var(--success-light)' : 'var(--danger-light)'}; border-bottom: 2px solid ${isPassed ? 'var(--success)' : 'var(--danger)'};">
        <div class="auth-icon" style="background: white; color: ${isPassed ? 'var(--success)' : 'var(--danger)'};">
          ${isPassed ? '🏆' : '⚠️'}
        </div>
        <h2 style="color: ${isPassed ? '#14532d' : '#7f1d1d'};">
          ${isPassed ? 'Examination Passed' : 'Examination Completed'}
        </h2>
        <p style="color: ${isPassed ? '#166534' : '#991b1b'};">
          Official Computer Based Test Assessment Record
        </p>
      </div>
      <div class="auth-card-body">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; padding: 18px; border-radius: var(--radius-md); margin-bottom: 20px;">
          <div>
            <span style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Candidate Name</span>
            <div style="font-size: 16px; font-weight: 700;">${escapeHtml(result.studentName)}</div>
          </div>
          <div>
            <span style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Admission Form Number</span>
            <div style="font-size: 16px; font-weight: 700;"><code>${escapeHtml(result.admissionNumber)}</code></div>
          </div>
          <div>
            <span style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Examination</span>
            <div style="font-weight: 600;">${escapeHtml(result.examTitle || 'ITI Assessment')}</div>
          </div>
          <div>
            <span style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Submission Timestamp</span>
            <div style="font-size: 13px;">${new Date(result.submittedAt).toLocaleString()}</div>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; background: #ffffff; border: 2px dashed var(--border-strong); border-radius: var(--radius-lg); margin-bottom: 20px;">
          <span style="font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Final Evaluation Score</span>
          <div style="font-size: 48px; font-weight: 900; color: ${isPassed ? 'var(--success)' : 'var(--danger)'}; line-height: 1.1; margin: 8px 0;">
            ${result.score} <span style="font-size: 24px; font-weight: 500; color: var(--text-muted);">/ ${result.totalMarks}</span>
          </div>
          <div style="display: inline-block; padding: 6px 16px; border-radius: 9999px; font-weight: 700; font-size: 15px; background: ${isPassed ? 'var(--success-light)' : 'var(--danger-light)'}; color: ${isPassed ? 'var(--success)' : 'var(--danger)'};">
            ${result.percentage}% Percentage • ${isPassed ? 'QUALIFIED / PASSED' : 'NEEDS IMPROVEMENT'}
          </div>
        </div>

        ${breakdownHtml}

        <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 24px;">
          <a href="student-dashboard.html" class="btn btn-secondary">
            Return to Dashboard
          </a>
          <button type="button" class="btn btn-primary" onclick="window.print()">
            Print Scorecard
          </button>
        </div>
      </div>
    </div>
  `;
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
