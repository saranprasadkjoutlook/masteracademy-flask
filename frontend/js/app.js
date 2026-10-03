const USERS = [
  { username: 'admin', password: 'admin35', name: 'Admin', role: 'admin' },
  { username: 'student', password: 'student28', name: 'Student', role: 'student' },
  { username: 'student2', password: 'student28', name: 'Alex Morgan', role: 'student' }
];

const SEED_COURSES = [
  { id: 'course-os', title: 'Operating Systems', description: 'Learn the basics of operating systems, processes, memory, and file management.', icon: '💻', tone: 'lilac', instructor: 'Master Academy', lessons: [{ title: 'Course introduction', type: 'Text', content: 'Welcome to Operating Systems.' }], students: ['student'] },
  { id: 'course-ai', title: 'Artificial Intelligence', description: 'Explore machine learning, intelligent systems, and practical AI concepts.', icon: '🧠', tone: 'pink', instructor: 'Master Academy', lessons: [], students: [] },
  { id: 'course-software', title: 'Software Engineering', description: 'Build a foundation in software design, development, and testing.', icon: '🧩', tone: 'mint', instructor: 'Master Academy', lessons: [], students: [] }
];

const app = document.querySelector('#app');
let activeUser = null;
let activeSection = 'all';
let courses = loadCourses();

function loadCourses() {
  try {
    const saved = JSON.parse(localStorage.getItem('learnspace-courses'));
    return Array.isArray(saved) ? saved : structuredClone(SEED_COURSES);
  } catch { return structuredClone(SEED_COURSES); }
}

function saveCourses() {
  localStorage.setItem('learnspace-courses', JSON.stringify(courses));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderLogin() {
  app.innerHTML = `
    <section class="login-page">
      <div class="login-art">
        <div class="brand"><span class="brand-mark">✦</span>learnspace</div>
        <div class="art-copy"><h1>Learn something<br>new today.</h1><p>Your courses, lessons, and learning journey in one welcoming place.</p></div>
        <div class="art-note">A little progress each day adds up.</div>
      </div>
      <div class="login-side">
        <form class="login-card" id="login-form">
          <h2>Welcome back</h2><p>Sign in to continue learning.</p>
          <div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required placeholder="Enter your username"></div>
          <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required placeholder="Enter your password"></div>
          <button class="primary-button login-submit" type="submit">Sign in <span aria-hidden="true">→</span></button>
          <p class="login-error" id="login-error" role="alert"></p>
          <div class="demo-hint"><strong>Demo accounts</strong><br>Admin: admin / admin35<br>Students: student or student2 / student28</div>
        </form>
      </div>
    </section>`;
  document.querySelector('#login-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const user = USERS.find(item => item.username === form.get('username').trim() && item.password === form.get('password'));
    if (!user) { document.querySelector('#login-error').textContent = 'That username and password do not match.'; return; }
    activeUser = user;
    activeSection = user.role === 'admin' ? 'all' : 'all';
    renderDashboard();
  });
}

function renderDashboard() {
  const isAdmin = activeUser.role === 'admin';
  const nav = isAdmin
    ? [['all', '▦', 'Courses'], ['students', '♙', 'Students']]
    : [['all', '▦', 'All courses'], ['mine', '▣', 'My courses']];
  const title = activeSection === 'mine' ? 'My courses' : activeSection === 'students' ? 'Students' : 'All courses';
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">✦</span>learnspace</div>
        <div class="side-label">Workspace</div>
        <nav class="nav-list" aria-label="Main navigation">
          ${nav.map(([key, icon, label]) => `<button class="nav-button ${activeSection === key ? 'active' : ''}" data-section="${key}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}
          <button class="nav-button" id="sign-out"><span class="nav-icon">↪</span>Sign out</button>
        </nav>
        <div class="sidebar-bottom">Keep learning, one lesson at a time.</div>
      </aside>
      <section class="content">
        <header class="topbar"><div><div class="eyebrow">${isAdmin ? 'Administration' : 'Your learning space'}</div><h1>${title}</h1></div><div class="user-chip"><span>${escapeHtml(activeUser.name)}</span><span class="avatar">${escapeHtml(activeUser.name.charAt(0).toUpperCase())}</span></div></header>
        ${activeSection === 'students' ? renderStudents() : renderCourses(isAdmin)}
      </section>
    </div>`;
  document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => { activeSection = button.dataset.section; renderDashboard(); }));
  document.querySelector('#sign-out').addEventListener('click', () => { activeUser = null; renderLogin(); });
  document.querySelectorAll('[data-enroll]').forEach(button => button.addEventListener('click', () => enroll(button.dataset.enroll)));
  document.querySelectorAll('[data-add-lesson]').forEach(button => button.addEventListener('click', () => {
    const course = courses.find(item => item.id === button.dataset.addLesson);
    if (course) showLessonModal(course);
  }));
  document.querySelector('#create-course')?.addEventListener('click', showCourseModal);
  document.querySelectorAll('[data-enroll-student]').forEach(select => select.addEventListener('change', () => {
    const course = courses.find(item => item.id === select.dataset.enrollStudent);
    if (select.value && course && !course.students.includes(select.value)) { course.students.push(select.value); saveCourses(); renderDashboard(); }
  }));
}

function renderCourses(isAdmin) {
  const visible = activeSection === 'mine'
    ? courses.filter(course => course.students.includes(activeUser.username))
    : courses;
  const countLabel = activeSection === 'mine' ? `${visible.length} enrolled` : `${courses.length} courses`;
  return `<div class="layout">
    <div>
      <div class="section-heading"><div><h2>${activeSection === 'mine' ? 'Continue learning' : isAdmin ? 'Course library' : 'Explore courses'}</h2><p>${countLabel} · curated for your learning journey</p></div>${isAdmin ? '<div class="admin-tools"><button class="primary-button" id="create-course">＋ Create course</button></div>' : ''}</div>
      <div class="course-grid">${visible.length ? visible.map(course => courseCard(course, isAdmin)).join('') : '<div class="empty-state"><strong>No courses here yet</strong>Explore all courses to find your next subject.</div>'}</div>
    </div>
    <aside class="right-column">
      <div class="panel"><h2>${isAdmin ? 'Learning overview' : 'Your progress'}</h2><p>${isAdmin ? 'A quick look at the course library.' : 'Your learning journey at a glance.'}</p>
        <div class="stat-row"><span>Total courses</span><span class="stat-value">${courses.length}</span></div>
        ${isAdmin ? `<div class="stat-row"><span>Enrolled learners</span><span class="stat-value">${new Set(courses.flatMap(course => course.students)).size}</span></div>` : `<div class="stat-row"><span>My courses</span><span class="stat-value">${courses.filter(course => course.students.includes(activeUser.username)).length}</span></div>`}
      </div>
      <div class="panel"><h2>${isAdmin ? 'Learners' : 'Your courses'}</h2><p>${isAdmin ? 'Students available to enroll.' : 'Pick up where you left off.'}</p><div class="course-list">${(isAdmin ? USERS.filter(user => user.role === 'student').map(user => `<div class="mini-course"><span class="avatar">${user.name.charAt(0)}</span><span>${escapeHtml(user.name)}</span></div>`) : courses.filter(course => course.students.includes(activeUser.username)).slice(0, 3).map(course => `<div class="mini-course"><span class="course-art ${course.tone}">${escapeHtml(course.icon)}</span><span>${escapeHtml(course.title)}</span></div>`).join('') || '<p style="margin-top:14px">No enrollments yet.</p>')}</div></div>
    </aside>
  </div>`;
}

function courseCard(course, isAdmin) {
  const enrolled = course.students.includes(activeUser.username);
  const lessons = course.lessons || [];
  const actions = isAdmin
    ? `<div class="admin-card-actions"><button class="secondary-button add-lesson-button" data-add-lesson="${escapeHtml(course.id)}">＋ Lesson</button><select class="admin-select" data-enroll-student="${escapeHtml(course.id)}"><option value="">＋ Enroll student</option>${USERS.filter(user => user.role === 'student' && !course.students.includes(user.username)).map(user => `<option value="${escapeHtml(user.username)}">${escapeHtml(user.name)}</option>`).join('')}</select></div>`
    : enrolled ? '<button class="course-action enrolled" title="Enrolled" aria-label="Enrolled">✓</button>' : `<button class="course-action" data-enroll="${escapeHtml(course.id)}" title="Enroll" aria-label="Enroll">→</button>`;
  return `<article class="course-card"><div class="course-art ${escapeHtml(course.tone || 'lilac')}">${escapeHtml(course.icon || '📘')}</div><div class="course-info"><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description)}</p><div class="course-meta">${lessons.length} ${lessons.length === 1 ? 'lesson' : 'lessons'} · ${escapeHtml(course.instructor || 'Master Academy')}</div>${lessons.length ? `<div class="lesson-list">${lessons.map(lesson => `<span class="lesson-chip">${escapeHtml(lesson.title)} · ${escapeHtml(lesson.type)}</span>`).join('')}</div>` : ''}</div>${actions}</article>`;
}

function renderStudents() {
  const students = USERS.filter(user => user.role === 'student');
  return `<div class="layout"><div><div class="section-heading"><div><h2>Student accounts</h2><p>Enroll learners from any course card.</p></div></div><div class="course-grid">${students.map(user => {
    const enrolled = courses.filter(course => course.students.includes(user.username));
    return `<article class="course-card"><span class="avatar">${user.name.charAt(0)}</span><div class="course-info"><h3>${escapeHtml(user.name)}</h3><p>@${escapeHtml(user.username)} · Student</p><div class="course-meta">${enrolled.length} enrolled ${enrolled.length === 1 ? 'course' : 'courses'}</div></div></article>`;
  }).join('')}</div></div><aside class="right-column"><div class="panel"><h2>Enrollment</h2><p>Open Courses to add a student to a course. Their enrollment appears in My courses after sign in.</p></div></aside></div>`;
}

function enroll(courseId) {
  const course = courses.find(item => item.id === courseId);
  if (!course || course.students.includes(activeUser.username)) return;
  course.students.push(activeUser.username);
  saveCourses();
  renderDashboard();
}

function showCourseModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<form class="modal" id="course-form"><div class="modal-header"><h2>Create a course</h2><button type="button" class="modal-close" aria-label="Close">×</button></div><div class="field"><label for="course-title">Course name</label><input id="course-title" name="title" required maxlength="70" placeholder="e.g. Web Development"></div><div class="field"><label for="course-description">Description</label><textarea id="course-description" name="description" required maxlength="180" placeholder="What will students learn?"></textarea></div><div class="field"><label for="course-icon">Course icon</label><select id="course-icon" name="icon"><option value="📘">📘 Book</option><option value="💻">💻 Computer</option><option value="🧠">🧠 Brain</option><option value="🎨">🎨 Art</option><option value="🧪">🧪 Science</option></select></div><div class="form-actions"><button type="button" class="quiet-button modal-cancel">Cancel</button><button class="primary-button" type="submit">Create course</button></div></form>`;
  document.body.append(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.querySelector('.modal-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  backdrop.querySelector('#course-form').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    courses.unshift({ id: `course-${Date.now()}`, title: data.get('title').trim(), description: data.get('description').trim(), icon: data.get('icon'), tone: ['lilac', 'pink', 'mint', 'yellow'][courses.length % 4], instructor: activeUser.name, lessons: [], students: [] });
    saveCourses(); close(); renderDashboard(); showLessonModal(courses[0]);
  });
}

function showLessonModal(course) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<form class="modal" id="lesson-form"><div class="modal-header"><h2>Add curriculum</h2><button type="button" class="modal-close" aria-label="Close">×</button></div><p style="color:var(--muted);font-size:13px;margin:-8px 0 18px">Add the first lesson to ${escapeHtml(course.title)}.</p><div class="field"><label for="lesson-title">Lesson title</label><input id="lesson-title" name="title" required maxlength="70" placeholder="e.g. Getting started"></div><div class="field"><label for="lesson-type">Content type</label><select id="lesson-type" name="type"><option>Text</option><option>Image</option><option>Audio</option><option>Video</option><option>PDF</option></select></div><div class="field" id="lesson-content-field"><label for="lesson-content">Lesson text</label><textarea id="lesson-content" name="content" placeholder="Write lesson content"></textarea></div><div class="field" id="lesson-file-field" hidden><label for="lesson-file">Upload content</label><input id="lesson-file" name="file" type="file" accept="image/*,audio/*,video/*,.pdf,application/pdf"><span class="file-help">Choose an image, audio, video, or PDF file (up to 2 MB).</span></div><div class="form-actions"><button type="button" class="quiet-button modal-cancel">Skip for now</button><button class="primary-button" type="submit">Save lesson</button></div></form>`;
  document.body.append(backdrop);
  const close = () => backdrop.remove();
  const type = backdrop.querySelector('#lesson-type');
  const syncType = () => {
    const isText = type.value === 'Text';
    backdrop.querySelector('#lesson-content-field').hidden = !isText;
    backdrop.querySelector('#lesson-file-field').hidden = isText;
    backdrop.querySelector('#lesson-file').required = !isText;
  };
  type.addEventListener('change', syncType);
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.querySelector('.modal-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  backdrop.querySelector('#lesson-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const lesson = { title: formData.get('title').trim(), type: type.value };
    if (type.value === 'Text') lesson.content = formData.get('content').trim();
    else {
      const file = formData.get('file');
      if (file.size > 2 * 1024 * 1024) { alert('Please choose a file smaller than 2 MB.'); return; }
      lesson.fileName = file.name;
      lesson.content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }
    course.lessons.push(lesson);
    try { saveCourses(); } catch { alert('Browser storage is full. Try a smaller file.'); return; }
    close(); renderDashboard();
  });
}

renderLogin();
