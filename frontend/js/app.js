const API_BASE_URL = (window.LEARNSPACE_API_URL || document.querySelector('meta[name="api-base-url"]')?.content || '/api').replace(/\/$/, '');
const STUDENTS = [
  { username: 'student', name: 'Student' },
  { username: 'student2', name: 'Alex Morgan' }
];

const app = document.querySelector('#app');
let activeUser = null;
let activeSection = 'all';
let courses = [];

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error('Cannot reach the learning server. Check the API address and try again.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderLogin(message = '') {
  app.innerHTML = `
    <section class="login-page">
      <div class="login-art">
        <div class="brand"><span class="brand-mark">&#10022;</span>learnspace</div>
        <div class="art-copy"><h1>Learn something<br>new today.</h1><p>Your courses, lessons, and learning journey in one welcoming place.</p></div>
        <div class="art-note">A little progress each day adds up.</div>
      </div>
      <div class="login-side">
        <form class="login-card" id="login-form">
          <h2>Welcome back</h2><p>Sign in to continue learning.</p>
          <div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required placeholder="Enter your username"></div>
          <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required placeholder="Enter your password"></div>
          <button class="primary-button login-submit" type="submit">Sign in <span aria-hidden="true">&#8594;</span></button>
          <p class="login-error" id="login-error" role="alert">${escapeHtml(message)}</p>
          <div class="demo-hint"><strong>Demo accounts</strong><br>Admin: admin / admin35<br>Students: student or student2 / student28</div>
        </form>
      </div>
    </section>`;

  document.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const errorNode = document.querySelector('#login-error');
    const submitButton = event.currentTarget.querySelector('[type="submit"]');
    const form = new FormData(event.currentTarget);
    submitButton.disabled = true;
    errorNode.textContent = '';
    try {
      const result = await apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ username: form.get('username').trim(), password: form.get('password') })
      });
      activeUser = result.user;
      activeSection = 'all';
      await renderDashboard();
    } catch (error) {
      errorNode.textContent = error.message;
      submitButton.disabled = false;
    }
  });
}

async function renderDashboard() {
  if (!activeUser) return renderLogin();
  const isAdmin = activeUser.role === 'admin';
  const nav = isAdmin
    ? [['all', '&#9638;', 'Courses'], ['students', '&#9817;', 'Students']]
    : [['all', '&#9638;', 'All courses'], ['mine', '&#9633;', 'My courses']];
  const title = activeSection === 'mine' ? 'My courses' : activeSection === 'students' ? 'Students' : 'All courses';
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">&#10022;</span>learnspace</div>
        <div class="side-label">Workspace</div>
        <nav class="nav-list" aria-label="Main navigation">
          ${nav.map(([key, icon, label]) => `<button class="nav-button ${activeSection === key ? 'active' : ''}" data-section="${key}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}
          <button class="nav-button" id="sign-out"><span class="nav-icon">&#8618;</span>Sign out</button>
        </nav>
        <div class="sidebar-bottom">Keep learning, one lesson at a time.</div>
      </aside>
      <section class="content">
        <header class="topbar"><div><div class="eyebrow">${isAdmin ? 'Administration' : 'Your learning space'}</div><h1>${title}</h1></div><div class="user-chip"><span>${escapeHtml(activeUser.name)}</span><span class="avatar">${escapeHtml(activeUser.name.charAt(0).toUpperCase())}</span></div></header>
        <div id="dashboard-content"><div class="empty-state">Loading your courses...</div></div>
      </section>
    </div>`;

  document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', async () => {
    activeSection = button.dataset.section;
    await renderDashboard();
  }));
  document.querySelector('#sign-out').addEventListener('click', signOut);
  await refreshDashboardContent();
}

async function refreshDashboardContent() {
  const content = document.querySelector('#dashboard-content');
  if (!content) return;
  try {
    const result = await apiRequest('/courses');
    courses = result.courses || [];
    content.innerHTML = activeSection === 'students' ? renderStudents() : renderCourses(activeUser.role === 'admin');
    bindDashboardActions(content);
  } catch (error) {
    content.innerHTML = `<div class="empty-state"><strong>Could not load courses</strong>${escapeHtml(error.message)}<p><button class="secondary-button" id="retry-load">Try again</button></p></div>`;
    content.querySelector('#retry-load').addEventListener('click', refreshDashboardContent);
  }
}

function bindDashboardActions(root) {
  root.querySelectorAll('[data-enroll]').forEach(button => button.addEventListener('click', () => enroll(button.dataset.enroll)));
  root.querySelectorAll('[data-add-lesson]').forEach(button => button.addEventListener('click', () => {
    const course = courses.find(item => item.id === button.dataset.addLesson);
    if (course) showLessonModal(course);
  }));
  root.querySelectorAll('[data-open-lesson]').forEach(button => button.addEventListener('click', () => {
    const course = courses.find(item => item.id === button.dataset.courseId);
    const lesson = course?.lessons.find(item => String(item.id) === button.dataset.openLesson);
    if (lesson) showLessonContent(lesson);
  }));
  root.querySelector('#create-course')?.addEventListener('click', showCourseModal);
  root.querySelectorAll('[data-enroll-student]').forEach(select => select.addEventListener('change', async () => {
    if (!select.value) return;
    select.disabled = true;
    try {
      await apiRequest(`/courses/${encodeURIComponent(select.dataset.enrollStudent)}/enrollments`, {
        method: 'POST', body: JSON.stringify({ username: select.value })
      });
      await refreshDashboardContent();
    } catch (error) {
      alert(error.message);
      select.disabled = false;
    }
  }));
}

function renderCourses(isAdmin) {
  const visible = activeSection === 'mine'
    ? courses.filter(course => course.students.includes(activeUser.username))
    : courses;
  const countLabel = activeSection === 'mine' ? `${visible.length} enrolled` : `${courses.length} courses`;
  return `<div class="layout">
    <div>
      <div class="section-heading"><div><h2>${activeSection === 'mine' ? 'Continue learning' : isAdmin ? 'Course library' : 'Explore courses'}</h2><p>${countLabel} &middot; curated for your learning journey</p></div>${isAdmin ? '<div class="admin-tools"><button class="primary-button" id="create-course">+ Create course</button></div>' : ''}</div>
      <div class="course-grid">${visible.length ? visible.map(course => courseCard(course, isAdmin)).join('') : '<div class="empty-state"><strong>No courses here yet</strong>Explore all courses to find your next subject.</div>'}</div>
    </div>
    <aside class="right-column">
      <div class="panel"><h2>${isAdmin ? 'Learning overview' : 'Your progress'}</h2><p>${isAdmin ? 'A quick look at the course library.' : 'Your learning journey at a glance.'}</p>
        <div class="stat-row"><span>Total courses</span><span class="stat-value">${courses.length}</span></div>
        ${isAdmin ? `<div class="stat-row"><span>Enrolled learners</span><span class="stat-value">${new Set(courses.flatMap(course => course.students)).size}</span></div>` : `<div class="stat-row"><span>My courses</span><span class="stat-value">${courses.filter(course => course.students.includes(activeUser.username)).length}</span></div>`}
      </div>
      <div class="panel"><h2>${isAdmin ? 'Learners' : 'Your courses'}</h2><p>${isAdmin ? 'Students available to enroll.' : 'Pick up where you left off.'}</p><div class="course-list">${isAdmin ? STUDENTS.map(user => `<div class="mini-course"><span class="avatar">${user.name.charAt(0)}</span><span>${escapeHtml(user.name)}</span></div>`).join('') : courses.filter(course => course.students.includes(activeUser.username)).slice(0, 3).map(course => `<div class="mini-course"><span class="course-art ${escapeHtml(course.tone)}">${escapeHtml(course.icon)}</span><span>${escapeHtml(course.title)}</span></div>`).join('') || '<p style="margin-top:14px">No enrollments yet.</p>'}</div></div>
    </aside>
  </div>`;
}

function courseCard(course, isAdmin) {
  const enrolled = course.students.includes(activeUser.username);
  const lessons = course.lessons || [];
  const actions = isAdmin
    ? `<div class="admin-card-actions"><button class="secondary-button add-lesson-button" data-add-lesson="${escapeHtml(course.id)}">+ Lesson</button><select class="admin-select" data-enroll-student="${escapeHtml(course.id)}"><option value="">+ Enroll student</option>${STUDENTS.filter(user => !course.students.includes(user.username)).map(user => `<option value="${escapeHtml(user.username)}">${escapeHtml(user.name)}</option>`).join('')}</select></div>`
    : enrolled ? '<button class="course-action enrolled" title="Enrolled" aria-label="Enrolled">&#10003;</button>' : `<button class="course-action" data-enroll="${escapeHtml(course.id)}" title="Enroll" aria-label="Enroll">&#8594;</button>`;
  const lessonList = lessons.length ? `<div class="lesson-list">${lessons.map(lesson => `<button type="button" class="lesson-chip" data-course-id="${escapeHtml(course.id)}" data-open-lesson="${escapeHtml(lesson.id)}">${escapeHtml(lesson.title)} &middot; ${escapeHtml(lesson.type)}</button>`).join('')}</div>` : '';
  return `<article class="course-card"><div class="course-art ${escapeHtml(course.tone || 'lilac')}">${escapeHtml(course.icon || '&#128214;')}</div><div class="course-info"><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description)}</p><div class="course-meta">${lessons.length} ${lessons.length === 1 ? 'lesson' : 'lessons'} &middot; ${escapeHtml(course.instructor || 'Master Academy')}</div>${lessonList}</div>${actions}</article>`;
}

function renderStudents() {
  return `<div class="layout"><div><div class="section-heading"><div><h2>Student accounts</h2><p>Enroll learners from any course card.</p></div></div><div class="course-grid">${STUDENTS.map(user => {
    const enrolled = courses.filter(course => course.students.includes(user.username));
    return `<article class="course-card"><span class="avatar">${user.name.charAt(0)}</span><div class="course-info"><h3>${escapeHtml(user.name)}</h3><p>@${escapeHtml(user.username)} &middot; Student</p><div class="course-meta">${enrolled.length} enrolled ${enrolled.length === 1 ? 'course' : 'courses'}</div></div></article>`;
  }).join('')}</div></div><aside class="right-column"><div class="panel"><h2>Enrollment</h2><p>Open Courses to add a student to a course. Their enrollment appears in My courses after sign in.</p></div></aside></div>`;
}

async function enroll(courseId) {
  try {
    await apiRequest(`/courses/${encodeURIComponent(courseId)}/enrollments`, { method: 'POST', body: JSON.stringify({}) });
    await refreshDashboardContent();
  } catch (error) {
    alert(error.message);
  }
}

function showCourseModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<form class="modal" id="course-form"><div class="modal-header"><h2>Create a course</h2><button type="button" class="modal-close" aria-label="Close">&times;</button></div><div class="field"><label for="course-title">Course name</label><input id="course-title" name="title" required maxlength="70" placeholder="e.g. Web Development"></div><div class="field"><label for="course-description">Description</label><textarea id="course-description" name="description" required maxlength="180" placeholder="What will students learn?"></textarea></div><div class="field"><label for="course-icon">Course icon</label><select id="course-icon" name="icon"><option value="&#128214;">Book</option><option value="&#128187;">Computer</option><option value="&#129504;">Brain</option><option value="&#127912;">Art</option><option value="&#129514;">Science</option></select></div><p class="login-error" id="course-error" role="alert"></p><div class="form-actions"><button type="button" class="quiet-button modal-cancel">Cancel</button><button class="primary-button" type="submit">Create course</button></div></form>`;
  document.body.append(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.querySelector('.modal-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  backdrop.querySelector('#course-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    const error = form.querySelector('#course-error');
    submit.disabled = true;
    try {
      const result = await apiRequest('/courses', {
        method: 'POST',
        body: JSON.stringify({ title: data.get('title').trim(), description: data.get('description').trim(), icon: data.get('icon'), tone: ['lilac', 'pink', 'mint', 'yellow'][courses.length % 4] })
      });
      close();
      await refreshDashboardContent();
      showLessonModal(result.course);
    } catch (requestError) {
      error.textContent = requestError.message;
      submit.disabled = false;
    }
  });
}

function showLessonModal(course) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<form class="modal" id="lesson-form"><div class="modal-header"><h2>Add curriculum</h2><button type="button" class="modal-close" aria-label="Close">&times;</button></div><p style="color:var(--muted);font-size:13px;margin:-8px 0 18px">Add a lesson to ${escapeHtml(course.title)}.</p><div class="field"><label for="lesson-title">Lesson title</label><input id="lesson-title" name="title" required maxlength="70" placeholder="e.g. Getting started"></div><div class="field"><label for="lesson-type">Content type</label><select id="lesson-type" name="type"><option>Text</option><option>Image</option><option>Audio</option><option>Video</option><option>PDF</option></select></div><div class="field" id="lesson-content-field"><label for="lesson-content">Lesson text</label><textarea id="lesson-content" name="content" placeholder="Write lesson content"></textarea></div><div class="field" id="lesson-file-field" hidden><label for="lesson-file">Upload content</label><input id="lesson-file" name="file" type="file" accept="image/*,audio/*,video/*,.pdf,application/pdf"><span class="file-help">Choose an image, audio, video, or PDF file (up to 2 MB).</span></div><p class="login-error" id="lesson-error" role="alert"></p><div class="form-actions"><button type="button" class="quiet-button modal-cancel">Skip for now</button><button class="primary-button" type="submit">Save lesson</button></div></form>`;
  document.body.append(backdrop);
  const close = () => backdrop.remove();
  const type = backdrop.querySelector('#lesson-type');
  const textField = backdrop.querySelector('#lesson-content');
  const fileField = backdrop.querySelector('#lesson-file');
  const syncType = () => {
    const isText = type.value === 'Text';
    backdrop.querySelector('#lesson-content-field').hidden = !isText;
    backdrop.querySelector('#lesson-file-field').hidden = isText;
    textField.required = isText;
    fileField.required = !isText;
    fileField.accept = type.value === 'Image' ? 'image/*' : type.value === 'Audio' ? 'audio/*' : type.value === 'Video' ? 'video/*' : '.pdf,application/pdf';
  };
  syncType();
  type.addEventListener('change', syncType);
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.querySelector('.modal-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  backdrop.querySelector('#lesson-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    const error = form.querySelector('#lesson-error');
    const lesson = { title: formData.get('title').trim(), type: type.value };
    submit.disabled = true;
    error.textContent = '';
    try {
      if (type.value === 'Text') {
        lesson.content = formData.get('content').trim();
      } else {
        const file = formData.get('file');
        if (!file || !file.size) throw new Error('Choose a file to upload.');
        if (file.size > 2 * 1024 * 1024) throw new Error('Please choose a file smaller than 2 MB.');
        lesson.fileName = file.name;
        lesson.content = await readFileAsDataUrl(file);
      }
      await apiRequest(`/courses/${encodeURIComponent(course.id)}/lessons`, { method: 'POST', body: JSON.stringify(lesson) });
      close();
      await refreshDashboardContent();
    } catch (requestError) {
      error.textContent = requestError.message;
      submit.disabled = false;
    }
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

function showLessonContent(lesson) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  let content = '';
  if (lesson.type === 'Text') {
    content = `<div style="white-space:pre-wrap;line-height:1.7">${escapeHtml(lesson.content)}</div>`;
  } else if (lesson.type === 'Image') {
    content = `<img src="${escapeHtml(lesson.content)}" alt="${escapeHtml(lesson.fileName || lesson.title)}" style="max-width:100%;border-radius:10px">`;
  } else if (lesson.type === 'Audio') {
    content = `<audio controls src="${escapeHtml(lesson.content)}" style="width:100%"></audio>`;
  } else if (lesson.type === 'Video') {
    content = `<video controls src="${escapeHtml(lesson.content)}" style="max-width:100%;width:100%;border-radius:10px"></video>`;
  } else if (lesson.type === 'PDF') {
    content = `<iframe title="${escapeHtml(lesson.title)}" src="${escapeHtml(lesson.content)}" style="width:100%;height:60vh;border:0"></iframe>`;
  }
  backdrop.innerHTML = `<section class="modal"><div class="modal-header"><h2>${escapeHtml(lesson.title)}</h2><button type="button" class="modal-close" aria-label="Close">&times;</button></div>${lesson.fileName ? `<p class="file-help">${escapeHtml(lesson.fileName)}</p>` : ''}${content}</section>`;
  document.body.append(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
}

async function signOut() {
  try {
    await apiRequest('/logout', { method: 'POST' });
    activeUser = null;
    courses = [];
    renderLogin();
  } catch (error) {
    alert(error.message);
  }
}

async function startApp() {
  try {
    const result = await apiRequest('/me');
    activeUser = result.user;
    await renderDashboard();
  } catch (error) {
    renderLogin(error.status === 401 ? '' : error.message);
  }
}

startApp();
