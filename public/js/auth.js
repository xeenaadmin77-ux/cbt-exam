/**
 * ITI College CBT Examination System - Authentication Module
 * Handles student login (Name + Admission Number) and teacher authentication.
 */

// Student Login Form Handler
async function handleStudentLogin(event) {
  event.preventDefault();
  const alertBox = document.getElementById('authAlert');
  const submitBtn = document.getElementById('studentLoginBtn');
  const studentNameInput = document.getElementById('studentName') || document.getElementById('studentUsername');
  const admissionNumberInput = document.getElementById('admissionNumber') || document.getElementById('admissionPassword');

  const studentName = studentNameInput ? studentNameInput.value.trim() : '';
  const admissionNumber = admissionNumberInput ? admissionNumberInput.value.trim().toUpperCase() : '';

  if (!studentName || !admissionNumber) {
    showAuthError('Please enter your Username / Student Name and College Admission Form Number.');
    return;
  }

  setButtonLoading(submitBtn, true, 'Verifying Credentials...');
  clearAuthError();

  try {
    const response = await apiFetch('/student-login', {
      method: 'POST',
      body: JSON.stringify({
        username: studentName,
        password: admissionNumber,
        studentName,
        admissionNumber
      })
    });

    if (response.success && response.user) {
      // Store session state (token is stored securely for API authorization)
      setCurrentUser(response.user);
      // Redirect to Student Dashboard
      window.location.href = 'student-dashboard.html';
    } else {
      showAuthError(response.message || 'Authentication failed. Please check your credentials.');
    }
  } catch (err) {
    showAuthError(err.message || 'Unable to connect to the examination server. Check network connection.');
  } finally {
    setButtonLoading(submitBtn, false, 'Sign In to Computer Lab CBT');
  }
}

// Teacher / Invigilator Login Handler
async function handleTeacherLogin(event) {
  event.preventDefault();
  const submitBtn = document.getElementById('teacherLoginBtn');
  const emailInput = document.getElementById('teacherEmail');
  const passwordInput = document.getElementById('teacherPassword');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!email || !password) {
    showAuthError('Please enter your Faculty Email and Secure Password.');
    return;
  }

  setButtonLoading(submitBtn, true, 'Authenticating Faculty...');
  clearAuthError();

  try {
    const response = await apiFetch('/teacher-login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password
      })
    });

    if (response.success && response.user) {
      setCurrentUser(response.user, true);
      window.location.href = 'teacher-dashboard.html';
    } else {
      showAuthError(response.message || 'Authentication failed. Unauthorized faculty account.');
    }
  } catch (err) {
    showAuthError(err.message || 'Invalid faculty credentials.');
  } finally {
    setButtonLoading(submitBtn, false, 'Sign In to Faculty Portal');
  }
}

// Logout Handler
function handleLogout() {
  clearCurrentUser();
  window.location.href = 'index.html';
}

// UI Helpers
function showAuthError(msg) {
  const alertBox = document.getElementById('authAlert');
  if (alertBox) {
    alertBox.textContent = msg;
    alertBox.style.display = 'block';
  } else {
    alert(msg);
  }
}

function clearAuthError() {
  const alertBox = document.getElementById('authAlert');
  if (alertBox) {
    alertBox.style.display = 'none';
    alertBox.textContent = '';
  }
}

function setButtonLoading(btn, isLoading, text) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = text;
}

// Page Guard: Ensure authenticated user role
function requireAuth(requiredRole = 'student') {
  const user = getCurrentUser();
  if (!user || !user.token) {
    if (requiredRole === 'teacher' || requiredRole === 'admin') {
      window.location.href = 'teacher-login.html';
    } else {
      window.location.href = 'student-login.html';
    }
    return null;
  }

  if (requiredRole === 'teacher' && user.role !== 'teacher' && user.role !== 'admin') {
    window.location.href = 'student-dashboard.html';
    return null;
  }

  return user;
}
