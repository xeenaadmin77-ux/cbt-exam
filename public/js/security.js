/**
 * ITI College CBT Examination System - Browser Security & Anti-Cheating Module
 * Provides browser-level protections, fullscreen management, and audit event dispatch.
 */

const ExamSecurity = (function() {
  let activeSessionId = null;
  let activeStudentUid = null;
  let activeExamId = null;
  let warningCount = 0;
  const MAX_WARNINGS = 3;
  let isSubmittingOrExiting = false;

  function initSecurity(sessionId, studentUid, examId) {
    activeSessionId = sessionId;
    activeStudentUid = studentUid;
    activeExamId = examId;

    bindContextMenuBlock();
    bindKeyboardShortcutsBlock();
    bindVisibilityChangeDetection();
    bindWindowBlurDetection();
    bindBeforeUnloadProtection();
    bindFullscreenChangeDetection();
  }

  function setExiting(state) {
    isSubmittingOrExiting = state;
  }

  // 1. Prevent Right-Click Context Menu
  function bindContextMenuBlock() {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showSecurityToast('Action disabled: Right-click is restricted during examination.');
      logAuditEvent('context_menu_blocked');
      return false;
    });
  }

  // 2. Prevent Developer Tool Shortcuts & Source Inspection
  function bindKeyboardShortcutsBlock() {
    document.addEventListener('keydown', (e) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        triggerCheatingWarning('Developer tools (F12) access is restricted.');
        return false;
      }
      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) {
        e.preventDefault();
        triggerCheatingWarning('Developer shortcut attempt detected.');
        return false;
      }
      // Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        triggerCheatingWarning('Page source viewing is restricted.');
        return false;
      }
      // Ctrl+P (Print)
      if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        showSecurityToast('Printing is disabled during the exam.');
        return false;
      }
    });
  }

  // 3. Tab Switch / Window Minimize / Visibility Change Detection
  function bindVisibilityChangeDetection() {
    document.addEventListener('visibilitychange', () => {
      if (isSubmittingOrExiting) return;
      if (document.hidden) {
        triggerCheatingWarning('Warning: You switched tabs or minimized the examination window.');
        logAuditEvent('tab_switched_or_hidden');
      }
    });
  }

  // 4. Window Blur Detection
  function bindWindowBlurDetection() {
    window.addEventListener('blur', () => {
      if (isSubmittingOrExiting) return;
      setTimeout(() => {
        if (!document.hasFocus() && !isSubmittingOrExiting) {
          triggerCheatingWarning('Warning: Exam window lost focus. Please keep the test window active.');
          logAuditEvent('window_blur');
        }
      }, 300);
    });
  }

  // 5. Unload / Accidental Refresh Protection
  function bindBeforeUnloadProtection() {
    window.addEventListener('beforeunload', (e) => {
      if (isSubmittingOrExiting) return;
      e.preventDefault();
      e.returnValue = 'An examination is currently in progress. Your progress is auto-saved, but are you sure you want to refresh?';
      return e.returnValue;
    });
  }

  // 6. Fullscreen Handling
  async function requestFullscreenMode() {
    const elem = document.documentElement;
    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      logAuditEvent('fullscreen_entered');
    } catch (err) {
      console.warn('Fullscreen request bypassed by user or browser permissions:', err);
    }
  }

  function bindFullscreenChangeDetection() {
    const handleFsChange = () => {
      if (isSubmittingOrExiting) return;
      const isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
      if (!isFs) {
        triggerCheatingWarning('Examination requires full-screen mode. Full-screen was exited.');
        logAuditEvent('fullscreen_exited');
        showFullscreenPrompt();
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
  }

  function showFullscreenPrompt() {
    const banner = document.getElementById('fullscreenWarningBanner');
    if (banner) {
      banner.style.display = 'flex';
    }
  }

  function hideFullscreenPrompt() {
    const banner = document.getElementById('fullscreenWarningBanner');
    if (banner) {
      banner.style.display = 'none';
    }
  }

  function triggerCheatingWarning(message) {
    warningCount++;
    logAuditEvent('security_warning_issued', { warningCount, message });

    let warningModal = document.getElementById('securityWarningModal');
    if (!warningModal) {
      warningModal = document.createElement('div');
      warningModal.id = 'securityWarningModal';
      warningModal.className = 'modal-overlay';
      document.body.appendChild(warningModal);
    }
    warningModal.innerHTML = `
      <div class="modal-dialog" style="border-top: 4px solid var(--danger);">
        <div class="modal-header">
          <h3 style="color: var(--danger); display: flex; align-items: center; gap: 8px;">
            ⚠️ Examination Security Alert
          </h3>
        </div>
        <div class="modal-body">
          <p style="font-weight: 600; margin-bottom: 10px; color: #1e293b;">${message}</p>
          <div class="alert alert-danger" style="margin-bottom: 12px;">
            Security Notice: All browser events, window focus losses, and tab switches are logged directly to the college invigilator dashboard with timestamps.
          </div>
          <p style="font-size: 13px; color: #64748b;">
            Incident count: <strong style="color: var(--danger);">${warningCount}</strong> / ${MAX_WARNINGS}
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" id="ackSecurityWarningBtn">I Understand & Return to Exam</button>
        </div>
      </div>
    `;
    document.getElementById('ackSecurityWarningBtn').onclick = () => {
      warningModal.style.display = 'none';
      requestFullscreenMode();
    };
    warningModal.style.display = 'flex';
  }

  function showSecurityToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // Log Audit Event to Server (CHANGE 20: No passwords logged)
  async function logAuditEvent(eventType, details = {}) {
    if (!activeSessionId) return;
    try {
      await apiFetch('/log-audit', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: activeSessionId,
          studentUid: activeStudentUid,
          examId: activeExamId,
          eventType,
          details: typeof details === 'string' ? details : JSON.stringify(details)
        })
      });
    } catch (e) {
      // Quietly ignore network blips on background logging
    }
  }

  return {
    initSecurity,
    requestFullscreenMode,
    setExiting,
    logAuditEvent,
    hideFullscreenPrompt
  };
})();
