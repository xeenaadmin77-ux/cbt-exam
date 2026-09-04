/**
 * ITI College CBT Examination System - Core Exam Engine
 * High-security client logic with server-authoritative timer,
 * randomized question ordering, auto-saving, and anti-cheating controls.
 */

(function() {
  let examData = null;
  let sessionData = null;
  let questions = [];
  let currentIndex = 0;
  let userAnswers = {};      // Map: questionId -> selectedOption ('A'|'B'|'C'|'D')
  let markedForReview = new Set();
  let timerInterval = null;
  let questionTimerInterval = null;
  let questionTimeRemaining = 0;
  let clockOffsetMs = 0;
  let currentUser = null;
  let isSubmitting = false;

  document.addEventListener('DOMContentLoaded', async () => {
    currentUser = requireAuth('student');
    if (!currentUser) return;

    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    if (!examId) {
      alert('Invalid or missing examination identifier.');
      window.location.href = 'student-dashboard.html';
      return;
    }

    setupNetworkListeners();
    await initExamSession(examId);
    bindUIEvents();
  });

  // 1. Initialize or Resume Session (Server Authoritative)
  async function initExamSession(examId) {
    showLoadingOverlay(true, 'Connecting to Examination Server & Initializing Secure Session...');

    try {
      // Server creates session if not existing, or returns existing session
      // Crucially, questions array returned by server NEVER includes correct answers!
      const res = await apiFetch('/start-session', {
        method: 'POST',
        body: JSON.stringify({ examId })
      });

      if (!res.success) {
        throw new Error(res.message || 'Failed to start examination session.');
      }

      examData = res.exam;
      sessionData = res.session;
      questions = res.questions || [];
      userAnswers = sessionData.answers || {};

      if (sessionData.markedQuestions && Array.isArray(sessionData.markedQuestions)) {
        markedForReview = new Set(sessionData.markedQuestions);
      }

      // CHANGE 11: Calculate clock offset between client device and server
      const clientNow = Date.now();
      const serverNow = res.serverTimeNow || clientNow;
      clockOffsetMs = serverNow - clientNow;

      // Update Header Information
      document.getElementById('headerExamTitle').textContent = examData.title;
      document.getElementById('headerStudentName').textContent = currentUser.name;
      document.getElementById('headerAdmissionNumber').textContent = `Adm: ${currentUser.admissionNumber}`;
      document.getElementById('totalQuestionsBadge').textContent = questions.length;

      // Initialize anti-cheating security hooks
      ExamSecurity.initSecurity(sessionData.sessionId, currentUser.uid, examId);
      ExamSecurity.requestFullscreenMode();

      // Start Server-Authoritative Timer
      startServerTimer(sessionData.expiryTime);

      // Render Question Palette
      renderQuestionPalette();

      // Display First Question
      renderQuestion(0);

      showLoadingOverlay(false);
    } catch (err) {
      showLoadingOverlay(false);
      console.error(err);
      alert(`Session Initialization Error: ${err.message}\nRedirecting to Dashboard.`);
      window.location.href = 'student-dashboard.html';
    }
  }

  // 2. Server-Authoritative Countdown Timer (CHANGE 11)
  function startServerTimer(expiryTime) {
    if (timerInterval) clearInterval(timerInterval);

    const timerBox = document.getElementById('examTimerBox');
    const timerDisplay = document.getElementById('examTimerDisplay');

    function tick() {
      // Authoritative remaining time: server expiryTime minus current normalized time
      const currentServerTime = Date.now() + clockOffsetMs;
      const remainingMs = expiryTime - currentServerTime;

      if (remainingMs <= 0) {
        clearInterval(timerInterval);
        timerDisplay.textContent = "00:00:00";
        timerBox.className = "exam-timer-box timer-critical";
        handleTimeExpiredAutoSubmit();
        return;
      }

      const totalSeconds = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const formatted = 
        (hours > 0 ? String(hours).padStart(2, '0') + ':' : '') +
        String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0');

      timerDisplay.textContent = formatted;

      // Visual warning triggers
      if (totalSeconds < 300) { // Under 5 mins
        timerBox.className = "exam-timer-box timer-critical";
      } else if (totalSeconds < 600) { // Under 10 mins
        timerBox.className = "exam-timer-box timer-warning";
      } else {
        timerBox.className = "exam-timer-box";
      }
    }

    tick();
    timerInterval = setInterval(tick, 1000);
  }

  // 3. Render Current Question
  function renderQuestion(index) {
    if (index < 0 || index >= questions.length) return;
    currentIndex = index;
    const q = questions[currentIndex];

    document.getElementById('currentQuestionNum').textContent = `Question ${currentIndex + 1} of ${questions.length}`;
    document.getElementById('currentQuestionMarks').textContent = `Marks: ${q.marks || 1}`;
    document.getElementById('questionText').textContent = q.questionText;

    // Update Question Set badge
    const setEl = document.getElementById('currentQuestionSet');
    if (setEl) {
      if (q.questionSet) {
        setEl.style.display = 'inline-block';
        setEl.textContent = q.questionSet;
      } else {
        setEl.style.display = 'none';
      }
    }

    // Manage Per-Question Timer if configured
    if (questionTimerInterval) {
      clearInterval(questionTimerInterval);
      questionTimerInterval = null;
    }
    const qTimerBox = document.getElementById('questionTimerBox');
    const qTimerCount = document.getElementById('questionTimerCount');
    
    const timeLimit = q.timeLimitSeconds || (examData && examData.enablePerQuestionTimer ? examData.perQuestionTimerSeconds : 0) || 0;
    if (timeLimit > 0 && qTimerBox && qTimerCount) {
      qTimerBox.style.display = 'inline-block';
      questionTimeRemaining = timeLimit;
      qTimerCount.textContent = questionTimeRemaining;
      
      qTimerBox.style.background = '#fef3c7';
      qTimerBox.style.color = '#92400e';
      qTimerBox.style.borderColor = '#fcd34d';

      questionTimerInterval = setInterval(() => {
        questionTimeRemaining--;
        if (qTimerCount) qTimerCount.textContent = Math.max(0, questionTimeRemaining);
        
        if (questionTimeRemaining <= 10) {
          qTimerBox.style.background = '#fee2e2';
          qTimerBox.style.color = '#b91c1c';
          qTimerBox.style.borderColor = '#fca5a5';
        }

        if (questionTimeRemaining <= 0) {
          clearInterval(questionTimerInterval);
          questionTimerInterval = null;
          if (currentIndex < questions.length - 1) {
            renderQuestion(currentIndex + 1);
          } else {
            promptSubmitExam();
          }
        }
      }, 1000);
    } else if (qTimerBox) {
      qTimerBox.style.display = 'none';
    }

    // Render Options
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';

    const selectedOption = userAnswers[q.questionId];
    const optionsList = [
      { key: 'A', text: q.optionA },
      { key: 'B', text: q.optionB },
      { key: 'C', text: q.optionC },
      { key: 'D', text: q.optionD }
    ];

    optionsList.forEach(opt => {
      const isSelected = selectedOption === opt.key;
      const optEl = document.createElement('div');
      optEl.className = `option-item ${isSelected ? 'selected' : ''}`;
      optEl.innerHTML = `
        <div class="option-letter">${opt.key}</div>
        <div class="option-label-text">${escapeHtml(opt.text)}</div>
      `;
      optEl.addEventListener('click', () => {
        selectAnswer(q.questionId, opt.key);
      });
      optionsContainer.appendChild(optEl);
    });

    // Update Navigation buttons
    document.getElementById('prevQuestionBtn').disabled = (currentIndex === 0);
    const nextBtn = document.getElementById('nextQuestionBtn');
    if (currentIndex === questions.length - 1) {
      nextBtn.textContent = 'Review & Submit';
    } else {
      nextBtn.textContent = 'Next Question ➔';
    }

    // Update Mark for Review button state
    const markBtn = document.getElementById('markReviewBtn');
    if (markedForReview.has(q.questionId)) {
      markBtn.className = 'btn btn-warning';
      markBtn.textContent = '★ Marked for Review';
    } else {
      markBtn.className = 'btn btn-secondary';
      markBtn.textContent = '☆ Mark for Review';
    }

    // Refresh palette active state
    updatePaletteActiveState();
  }

  // 4. Select Answer & Secure Auto-save (CHANGE 12)
  async function selectAnswer(questionId, optionKey) {
    if (isSubmitting) return;

    userAnswers[questionId] = optionKey;
    renderQuestion(currentIndex);
    updatePaletteButton(questionId);

    showAutoSaveStatus('Saving answer...');

    try {
      await apiFetch('/save-answer', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          questionId,
          selectedOption: optionKey
        })
      });
      showAutoSaveStatus('✓ Answer saved');
    } catch (err) {
      showAutoSaveStatus('⚠️ Save pending (network retry)');
      console.warn('Auto-save error:', err);
    }
  }

  // 5. Toggle Mark for Review
  function toggleMarkForReview() {
    const q = questions[currentIndex];
    if (markedForReview.has(q.questionId)) {
      markedForReview.delete(q.questionId);
    } else {
      markedForReview.add(q.questionId);
    }
    renderQuestion(currentIndex);
    updatePaletteButton(q.questionId);
  }

  // Clear Answer
  function clearCurrentAnswer() {
    const q = questions[currentIndex];
    if (userAnswers[q.questionId]) {
      delete userAnswers[q.questionId];
      renderQuestion(currentIndex);
      updatePaletteButton(q.questionId);
      selectAnswer(q.questionId, null);
    }
  }

  // 6. Question Navigation Palette
  function renderQuestionPalette() {
    const grid = document.getElementById('paletteGrid');
    if (!grid) return;
    grid.innerHTML = '';

    questions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.id = `palette-btn-${q.questionId}`;
      btn.className = getPaletteButtonClass(q.questionId, idx);
      btn.textContent = idx + 1;
      btn.title = `Question ${idx + 1}`;
      btn.type = 'button';
      btn.addEventListener('click', () => {
        renderQuestion(idx);
      });
      grid.appendChild(btn);
    });

    updateSummaryCounts();
  }

  function getPaletteButtonClass(questionId, idx) {
    const isCurrent = (idx === currentIndex);
    const hasAnswer = Boolean(userAnswers[questionId]);
    const isMarked = markedForReview.has(questionId);

    let status = 'status-not-answered';
    if (hasAnswer && isMarked) {
      status = 'status-marked-answered';
    } else if (hasAnswer) {
      status = 'status-answered';
    } else if (isMarked) {
      status = 'status-marked';
    }

    return `palette-btn ${status} ${isCurrent ? 'is-active' : ''}`;
  }

  function updatePaletteButton(questionId) {
    const btn = document.getElementById(`palette-btn-${questionId}`);
    const idx = questions.findIndex(q => q.questionId === questionId);
    if (btn && idx !== -1) {
      btn.className = getPaletteButtonClass(questionId, idx);
    }
    updateSummaryCounts();
  }

  function updatePaletteActiveState() {
    questions.forEach((q, idx) => {
      const btn = document.getElementById(`palette-btn-${q.questionId}`);
      if (btn) {
        btn.className = getPaletteButtonClass(q.questionId, idx);
      }
    });
  }

  function updateSummaryCounts() {
    let answered = 0;
    let marked = 0;
    let notAnswered = 0;

    questions.forEach(q => {
      const hasAns = Boolean(userAnswers[q.questionId]);
      if (hasAns) answered++;
      else notAnswered++;
      if (markedForReview.has(q.questionId)) marked++;
    });

    const ansBadge = document.getElementById('countAnswered');
    const notAnsBadge = document.getElementById('countNotAnswered');
    const markedBadge = document.getElementById('countMarked');

    if (ansBadge) ansBadge.textContent = answered;
    if (notAnsBadge) notAnsBadge.textContent = notAnswered;
    if (markedBadge) markedBadge.textContent = marked;
  }

  // 7. Exam Submission Flow (CHANGE 9, 13)
  function promptSubmitExam() {
    const total = questions.length;
    const answeredCount = Object.keys(userAnswers).length;
    const unansweredCount = total - answeredCount;

    let modal = document.getElementById('submitConfirmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'submitConfirmModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Confirm Final Exam Submission</h3>
        </div>
        <div class="modal-body">
          <p style="font-size: 15px; margin-bottom: 16px; color: #1e293b;">
            Are you sure you want to finish and submit your examination?
          </p>
          <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Total Questions:</span>
              <strong>${total}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: var(--success);">
              <span>Answered:</span>
              <strong>${answeredCount}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; color: ${unansweredCount > 0 ? 'var(--danger)' : 'var(--text-muted)'};">
              <span>Unanswered:</span>
              <strong>${unansweredCount}</strong>
            </div>
          </div>
          ${unansweredCount > 0 ? `
            <div class="alert alert-warning" style="margin-bottom: 0;">
              ⚠️ Notice: You still have <strong>${unansweredCount} unanswered questions</strong>. Once submitted, you cannot change your answers.
            </div>
          ` : `
            <div class="alert alert-success" style="margin-bottom: 0;">
              ✓ You have attempted all questions. Ready for final evaluation.
            </div>
          `}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeSubmitConfirmModal()">Return to Exam</button>
          <button type="button" class="btn btn-primary" id="confirmFinalSubmitBtn">Confirm & Submit Exam</button>
        </div>
      </div>
    `;

    document.getElementById('confirmFinalSubmitBtn').onclick = () => {
      closeSubmitConfirmModal();
      performSubmission();
    };

    modal.style.display = 'flex';
  }

  window.closeSubmitConfirmModal = function() {
    const modal = document.getElementById('submitConfirmModal');
    if (modal) modal.style.display = 'none';
  };

  async function performSubmission(isAutoExpired = false) {
    if (isSubmitting) return;
    isSubmitting = true;
    ExamSecurity.setExiting(true);

    if (timerInterval) clearInterval(timerInterval);
    if (questionTimerInterval) clearInterval(questionTimerInterval);

    showLoadingOverlay(true, isAutoExpired ? 'Time Expired. Locking Session & Calculating Score...' : 'Submitting Exam to Secure Evaluator...');

    try {
      const res = await apiFetch('/submit-exam', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          answers: userAnswers,
          isAutoExpired
        })
      });

      if (res.success && res.result) {
        window.location.href = `result.html?resultId=${encodeURIComponent(res.result.resultId)}&examId=${encodeURIComponent(examData.examId)}`;
      } else {
        throw new Error(res.message || 'Submission evaluation failed.');
      }
    } catch (err) {
      showLoadingOverlay(false);
      isSubmitting = false;
      ExamSecurity.setExiting(false);
      alert(`Submission error: ${err.message}. Contact your lab invigilator immediately.`);
    }
  }

  function handleTimeExpiredAutoSubmit() {
    alert('Time limit reached! The examination is now being automatically submitted for evaluation.');
    performSubmission(true);
  }

  // 8. Custom Close / Early Exit Exam Dialog with Teacher Authorization Password (CHANGE 14)
  function promptEarlyExit() {
    let modal = document.getElementById('teacherExitModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'teacherExitModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-dialog" style="border-top: 4px solid var(--danger);">
        <div class="modal-header">
          <h3 style="color: var(--danger);">Early Exit Examination</h3>
        </div>
        <div class="modal-body">
          <p style="font-weight: 600; color: #1e293b; margin-bottom: 8px;">
            Are you sure you want to exit the examination?
          </p>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">
            In order to terminate or exit this session prematurely, an authorized <strong>Teacher / Invigilator Password</strong> must be entered. This incident is audit-logged.
          </p>
          <div class="form-group">
            <label class="form-label">Teacher Authorization Password</label>
            <input type="password" id="teacherExitPasswordInput" class="form-control" placeholder="Invigilator password" autocomplete="off" />
          </div>
          <div class="form-group">
            <label class="form-label">Reason for Early Exit</label>
            <select id="teacherExitReason" class="form-control">
              <option value="student_illness">Student Illness / Medical Emergency</option>
              <option value="hardware_malfunction">Computer Terminal Malfunction</option>
              <option value="disciplinary_action">Invigilator Disciplinary Termination</option>
              <option value="other_authorized">Other Teacher-Authorized Reason</option>
            </select>
          </div>
          <div id="exitPassAlert" class="alert alert-danger" style="display: none; font-size: 13px;"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeEarlyExitModal()">Cancel / Continue Exam</button>
          <button type="button" class="btn btn-danger" id="submitTeacherExitBtn">Authorize & Close Exam</button>
        </div>
      </div>
    `;

    document.getElementById('submitTeacherExitBtn').onclick = handleTeacherExitSubmit;
    modal.style.display = 'flex';
  }

  window.closeEarlyExitModal = function() {
    const modal = document.getElementById('teacherExitModal');
    if (modal) modal.style.display = 'none';
  };

  async function handleTeacherExitSubmit() {
    const passwordInput = document.getElementById('teacherExitPasswordInput');
    const reasonInput = document.getElementById('teacherExitReason');
    const alertBox = document.getElementById('exitPassAlert');
    const btn = document.getElementById('submitTeacherExitBtn');

    const password = passwordInput ? passwordInput.value : '';
    const reason = reasonInput ? reasonInput.value : 'other';

    if (!password) {
      alertBox.textContent = 'Please enter the teacher exit password.';
      alertBox.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Verifying with Server...';

    try {
      const res = await apiFetch('/verify-exit', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          exitPassword: password,
          reason
        })
      });

      if (res.success) {
        ExamSecurity.setExiting(true);
        alert('Early exit authorized by Invigilator. Session terminated.');
        window.location.href = 'student-dashboard.html';
      } else {
        alertBox.textContent = res.message || 'Incorrect Teacher Password. Access Denied.';
        alertBox.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Authorize & Close Exam';
      }
    } catch (err) {
      alertBox.textContent = 'Verification error. Contact lab teacher.';
      alertBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Authorize & Close Exam';
    }
  }

  // 9. Bind UI Controls
  function bindUIEvents() {
    document.getElementById('prevQuestionBtn').onclick = () => {
      if (currentIndex > 0) renderQuestion(currentIndex - 1);
    };
    document.getElementById('nextQuestionBtn').onclick = () => {
      if (currentIndex < questions.length - 1) {
        renderQuestion(currentIndex + 1);
      } else {
        promptSubmitExam();
      }
    };
    document.getElementById('markReviewBtn').onclick = toggleMarkForReview;
    document.getElementById('clearAnswerBtn').onclick = clearCurrentAnswer;
    document.getElementById('submitExamFooterBtn').onclick = promptSubmitExam;
    document.getElementById('closeExamBtn').onclick = promptEarlyExit;

    const fsBtn = document.getElementById('reEnterFullscreenBtn');
    if (fsBtn) {
      fsBtn.onclick = () => {
        ExamSecurity.requestFullscreenMode();
        ExamSecurity.hideFullscreenPrompt();
      };
    }
  }

  // 10. Network Status Helpers
  function setupNetworkListeners() {
    const banner = document.getElementById('offlineStatusBanner');
    window.addEventListener('online', () => {
      if (banner) banner.style.display = 'none';
      showAutoSaveStatus('✓ Reconnected to network');
    });
    window.addEventListener('offline', () => {
      if (banner) banner.style.display = 'flex';
      showAutoSaveStatus('⚠️ Terminal offline - check LAN cable');
    });
  }

  function showAutoSaveStatus(msg) {
    const el = document.getElementById('autoSaveStatusText');
    if (el) el.textContent = msg;
  }

  function showLoadingOverlay(show, text = 'Loading...') {
    let overlay = document.getElementById('examLoadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'examLoadingOverlay';
      overlay.className = 'modal-overlay';
      overlay.style.background = 'rgba(15, 23, 42, 0.85)';
      overlay.innerHTML = `
        <div style="background: white; padding: 28px 36px; border-radius: 12px; text-align: center; box-shadow: var(--shadow-lg);">
          <div style="font-size: 32px; margin-bottom: 12px;">⏳</div>
          <div id="examLoadingText" style="font-weight: 700; color: #1e293b; font-size: 16px;"></div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    const textEl = document.getElementById('examLoadingText');
    if (textEl) textEl.textContent = text;
    overlay.style.display = show ? 'flex' : 'none';
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
})();
