const SUPABASE_URL = 'https://yuahkgrpeentflbhroka.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nG8jFBAGLCde85QoljciTA_Izdd-9Ac';
const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allSemesters = [];
let currentSemesterObj = null;
let locations = [];
let bodyParts = [];
let accidents = [];
let symptoms = [];
let treatments = [];
let rawRecords = [];
let allClassObjects = [];
let allSemesterStudents = [];

function sortStudentsCanonical(a, b, classMap) {
  const cA = classMap ? (classMap.get(a.class_id) || '') : (a.className || '');
  const cB = classMap ? (classMap.get(b.class_id) || '') : (b.className || '');
  const classDiff = cA.localeCompare(cB, 'zh-Hant', { numeric: true });
  if (classDiff !== 0) return classDiff;
  const seatDiff = (parseInt(a.seat_no) || 0) - (parseInt(b.seat_no) || 0);
  if (seatDiff !== 0) return seatDiff;
  return (a.name || '').localeCompare(b.name || '', 'zh-Hant');
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return dateStr;
}

function closeModal() {
  document.getElementById('commonModal').classList.add('hidden');
  document.getElementById('modalBody').innerHTML = '';
  const confirmBtn = document.getElementById('modalConfirmBtn');
  const clone = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(clone, confirmBtn);
}

function openModal(title, bodyHtml, confirmCallback) {
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  const confirmBtn = document.getElementById('modalConfirmBtn');
  const clone = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(clone, confirmBtn);
  clone.onclick = async () => {
    await confirmCallback();
  };
  document.getElementById('commonModal').classList.remove('hidden');
}

function getTimePeriod(timeStr) {
  const h = parseInt(timeStr?.slice(0, 2) || 0);
  if (h < 12) return '上午';
  if (h < 14) return '中午';
  return '下午';
}

function handleHashRouting() {
  const hash = window.location.hash.toLowerCase();
  const viewRegister = document.getElementById('view-register');
  const viewReports = document.getElementById('view-reports');
  const viewSettings = document.getElementById('view-settings');
  const btnRegister = document.getElementById('tabBtn-register');
  const btnReports = document.getElementById('tabBtn-reports');
  const btnSettings = document.getElementById('tabBtn-settings');

  viewRegister.classList.add('hidden');
  viewReports.classList.add('hidden');
  viewSettings.classList.add('hidden');

  btnRegister.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 hover:text-slate-900';
  btnReports.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 hover:text-slate-900';
  btnSettings.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 hover:text-slate-900';

  if (hash === '#settings') {
    viewSettings.classList.remove('hidden');
    btnSettings.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition bg-white text-teal-800 shadow-sm';
    loadSettingsViewData();
  } else if (hash === '#reports') {
    viewReports.classList.remove('hidden');
    btnReports.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition bg-white text-teal-800 shadow-sm';
    updateReportOverviewStats();
  } else {
    if (hash !== '#register') {
      window.location.hash = 'register';
      return;
    }
    viewRegister.classList.remove('hidden');
    btnRegister.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition bg-white text-teal-800 shadow-sm';
  }
}
window.addEventListener('hashchange', handleHashRouting);

async function loadSettingsViewData() {
  await loadSemesters(false);
  await initClasses();
  await loadSystemSettings();
  await loadAllSemesterStudents();
}

function renderLocationSelect() {
  const locBox = document.getElementById('locationContainer');
  if (!locBox) return;

  if (locations.length > 0) {
    locBox.innerHTML = `
      <select id="location_field" class="w-full p-2 border rounded-lg bg-white text-xs md:text-sm font-medium">
        <option value="">-- 選取地點 --</option>
        ${locations.map(l => `<option value="${l}">${l}</option>`).join('')}
      </select>`;
  } else {
    locBox.innerHTML = `<input type="text" id="location_field" placeholder="可直接填寫或由設定新增" class="w-full p-2 border rounded-lg bg-white text-xs md:text-sm">`;
  }
}

function renderBodyPartsCheckboxes() {
  const container = document.getElementById('bodyPartGroup');
  if (!container) return;
  if (bodyParts.length === 0) {
    container.innerHTML = '<span class="text-slate-400 text-xs col-span-full">尚未建立部位項目，請至系統設定新增</span>';
    return;
  }
  container.innerHTML = bodyParts.map(bp => `
    <label class="flex items-center space-x-1 p-1 rounded border bg-white cursor-pointer hover:border-teal-500 text-xs">
      <input type="checkbox" name="body_parts" value="${bp}" onchange="checkBodyPartSelection()" class="rounded text-teal-600">
      <span class="select-none truncate">${bp}</span>
    </label>
  `).join('');
}

function checkBodyPartSelection() {
  const checkedParts = Array.from(document.querySelectorAll('input[name="body_parts"]:checked')).map(c => c.value);
  const otherInput = document.getElementById('body_part_other');
  const otherInputVal = otherInput.value.trim();
  const isOtherChecked = checkedParts.includes('其他');

  const sideNotice = document.getElementById('sideNotice');
  const sideBtns = document.querySelectorAll('.side-btn');

  if (isOtherChecked) {
    if (!otherInputVal) {
      otherInput.className = 'flex-1 max-w-sm p-1.5 border-2 border-rose-500 rounded-lg text-xs bg-rose-50/50 outline-none ring-2 ring-rose-200';
      sideNotice.className = 'text-[11px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md';
      sideNotice.innerText = '⚠️ 已勾選「其他」，請務必填寫補充說明';
      
      sideBtns.forEach(b => {
        b.disabled = true;
        b.className = 'side-btn p-2 border rounded-lg bg-slate-100 text-slate-400 text-xs cursor-not-allowed';
      });
      return;
    } else {
      otherInput.className = 'flex-1 max-w-sm p-1.5 border border-teal-500 rounded-lg text-xs bg-white';
    }
  } else {
    otherInput.className = 'flex-1 max-w-sm p-1.5 border rounded-lg text-xs bg-white';
  }

  const hasPart = checkedParts.length > 0 || otherInputVal.length > 0;

  if (hasPart) {
    sideNotice.className = 'text-[11px] text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md';
    sideNotice.innerText = '✓ 請選擇側別';
    sideBtns.forEach(b => {
      b.disabled = false;
      b.classList.remove('cursor-not-allowed', 'bg-slate-100', 'text-slate-400');
      if (document.getElementById('side').value === b.getAttribute('data-side')) {
        b.className = 'side-btn p-2 border rounded-lg bg-teal-600 text-white text-xs font-bold';
      } else {
        b.className = 'side-btn p-2 border rounded-lg bg-white text-xs hover:bg-slate-50';
      }
    });
  } else {
    sideNotice.className = 'text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md';
    sideNotice.innerText = '⚠️ 請先於上方勾選受傷部位';
    document.getElementById('side').value = '';
    sideBtns.forEach(b => {
      b.disabled = true;
      b.className = 'side-btn p-2 border rounded-lg bg-slate-100 text-slate-400 text-xs cursor-not-allowed';
    });
  }
}

function setSide(btn, val) {
  if (btn.disabled) return;
  document.getElementById('side').value = val;
  document.querySelectorAll('.side-btn').forEach(b => {
    b.className = 'side-btn p-2 border rounded-lg bg-white text-xs hover:bg-slate-50';
  });
  btn.className = 'side-btn p-2 border rounded-lg bg-teal-600 text-white font-bold text-xs';
}

function getSelectedBodyParts() {
  const checked = Array.from(document.querySelectorAll('input[name="body_parts"]:checked')).map(c => c.value);
  const otherVal = document.getElementById('body_part_other').value.trim();
  const result = checked.filter(c => c !== '其他');
  if (checked.includes('其他') && otherVal) {
    result.push(`其他(${otherVal})`);
  } else if (checked.includes('其他')) {
    result.push('其他');
  } else if (otherVal) {
    result.push(`其他(${otherVal})`);
  }
  return result.join('、');
}

function setSelectedBodyParts(str) {
  document.querySelectorAll('input[name="body_parts"]').forEach(c => c.checked = false);
  document.getElementById('body_part_other').value = '';
  if (!str) {
    checkBodyPartSelection();
    return;
  }
  const items = str.split('、');
  items.forEach(item => {
    if (item.startsWith('其他(') && item.endsWith(')')) {
      const chk = document.querySelector('input[name="body_parts"][value="其他"]');
      if (chk) chk.checked = true;
      document.getElementById('body_part_other').value = item.slice(3, -1);
    } else if (item === '其他') {
      const chk = document.querySelector('input[name="body_parts"][value="其他"]');
      if (chk) chk.checked = true;
    } else {
      const chk = document.querySelector(`input[name="body_parts"][value="${item}"]`);
      if (chk) chk.checked = true;
    }
  });
  checkBodyPartSelection();
}

function updateCareFormStudentSelect() {
  const classSelect = document.getElementById('class_select');
  const stuSelect = document.getElementById('student_select');
  if (!classSelect || !stuSelect) return;

  const selectedClassId = classSelect.value;
  if (!selectedClassId) {
    stuSelect.disabled = true;
    stuSelect.innerHTML = '<option value="">請先選取班級</option>';
    hideStudentHistoryCard();
    return;
  }

  const studentsInClass = allSemesterStudents.filter(s => s.class_id === selectedClassId);
  if (studentsInClass.length === 0) {
    stuSelect.disabled = true;
    stuSelect.innerHTML = '<option value="">該班尚無學生名冊</option>';
    hideStudentHistoryCard();
    return;
  }

  stuSelect.disabled = false;
  stuSelect.innerHTML = '<option value="">-- 選取學生 --</option>' + 
    studentsInClass.map(s => `<option value="${s.id}">${s.seat_no}號 ${s.name}</option>`).join('');
  hideStudentHistoryCard();
}

function hideStudentHistoryCard() {
  const card = document.getElementById('studentHistoryCard');
  if (card) card.classList.add('hidden');
}

async function onStudentSelectChange(studentId) {
  const card = document.getElementById('studentHistoryCard');
  const historyList = document.getElementById('studentHistoryList');
  const nameElem = document.getElementById('historyStudentName');
  const badgeElem = document.getElementById('historyBadgeCount');
  const totalMinutesElem = document.getElementById('historyTotalMinutes');

  if (!studentId) {
    hideStudentHistoryCard();
    return;
  }

  const selectedStudent = allSemesterStudents.find(s => s.id === studentId);
  const studentName = selectedStudent ? selectedStudent.name : '該生';
  nameElem.innerText = studentName;
  card.classList.remove('hidden');
  historyList.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs">查詢歷年紀錄中...</div>';

  const { data: records, error } = await dbClient
    .from('nursing_records')
    .select('id, semester, record_date, record_time, location, body_part, side, body_temperature, rest_minutes, accident_types, symptom_types, treatments, note, classes(name)')
    .eq('student_id', studentId)
    .order('record_date', { ascending: false })
    .order('record_time', { ascending: false });

  if (error || !records || records.length === 0) {
    badgeElem.innerText = '0 次';
    totalMinutesElem.innerText = '0';
    historyList.innerHTML = '<div class="p-6 text-center text-slate-400 font-medium text-xs bg-white rounded-xl border border-dashed border-teal-200">該生尚無過往就診紀錄（初次到訪）</div>';
    return;
  }

  badgeElem.innerText = `${records.length} 次`;
  const totalMins = records.reduce((sum, r) => sum + (parseInt(r.rest_minutes) || 0), 0);
  totalMinutesElem.innerText = totalMins;

  const rowsHtml = records.map(r => {
    const tempText = r.body_temperature ? `${r.body_temperature}°` : '';
    const restText = r.rest_minutes ? `${r.rest_minutes}分` : '';
    const vitalText = [tempText, restText].filter(Boolean).join('/') || '-';
    const siteText = (r.side ? r.side + ' ' : '') + (r.body_part || '-');
    const categoriesText = [...(r.accident_types || []), ...(r.symptom_types || [])].join(',') || '-';
    const treatmentsText = (r.treatments || []).join(',') || '-';
    const semClassText = `[${r.semester || ''}] ${r.classes?.name || ''}`;

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="p-1.5 border-r font-medium text-slate-800 break-words">${formatShortDate(r.record_date)}</td>
        <td class="p-1.5 border-r text-slate-500 break-words">${r.record_time ? r.record_time.slice(0, 5) : '-'}</td>
        <td class="p-1.5 border-r text-teal-800 font-semibold break-words">${semClassText}</td>
        <td class="p-1.5 border-r break-words">${r.location || '-'}</td>
        <td class="p-1.5 border-r text-slate-700 break-words">${siteText}</td>
        <td class="p-1.5 border-r text-teal-700 font-medium break-words">${vitalText}</td>
        <td class="p-1.5 border-r text-slate-600 break-words">${categoriesText}</td>
        <td class="p-1.5 border-r text-slate-600 break-words">${treatmentsText}</td>
        <td class="p-1.5 break-words text-slate-500">${r.note || '-'}</td>
      </tr>
    `;
  }).join('');

  historyList.innerHTML = `
    <div class="w-full border border-teal-200/80 rounded-xl bg-white overflow-hidden">
      <table class="w-full table-fixed text-[11px] text-left border-collapse">
        <thead class="bg-teal-50/80 text-teal-900 border-b border-teal-200">
          <tr>
            <th class="w-[10%] p-1.5 border-r font-semibold">日期</th>
            <th class="w-[9%] p-1.5 border-r font-semibold">時間</th>
            <th class="w-[17%] p-1.5 border-r font-semibold">學期/班級</th>
            <th class="w-[10%] p-1.5 border-r font-semibold">地點</th>
            <th class="w-[11%] p-1.5 border-r font-semibold">部位</th>
            <th class="w-[11%] p-1.5 border-r font-semibold">體溫/休息</th>
            <th class="w-[15%] p-1.5 border-r font-semibold">傷病類別</th>
            <th class="w-[11%] p-1.5 border-r font-semibold">處理方式</th>
            <th class="w-[6%] p-1.5 font-semibold">備註</th>
          </tr>
        </thead>
        <tbody class="divide-y text-slate-700">
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

document.getElementById('class_select').addEventListener('change', updateCareFormStudentSelect);

document.getElementById('careForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const classId = document.getElementById('class_select').value;
  const studentId = document.getElementById('student_select').value;
  if (!classId || !studentId) return alert('請先選取班級與學生！');

  const checkedParts = Array.from(document.querySelectorAll('input[name="body_parts"]:checked')).map(c => c.value);
  const otherVal = document.getElementById('body_part_other').value.trim();
  if (checkedParts.includes('其他') && !otherVal) {
    alert('已勾選「其他」部位，請務必填寫「其他部位補充」說明！');
    document.getElementById('body_part_other').focus();
    checkBodyPartSelection();
    return;
  }

  const editRecordId = document.getElementById('edit_record_id').value;
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerText = '處理中...';

  const getChecked = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(c => c.value);
  const restMinVal = document.getElementById('rest_minutes').value.trim();
  const tempVal = document.getElementById('body_temperature').value.trim();

  const payload = {
    semester: currentSemesterObj ? currentSemesterObj.id : '',
    record_date: document.getElementById('record_date').value,
    record_time: document.getElementById('record_time').value,
    class_id: classId,
    student_id: studentId,
    location: document.getElementById('location_field').value,
    body_part: getSelectedBodyParts(),
    side: document.getElementById('side').value,
    body_temperature: tempVal ? parseFloat(tempVal) : null,
    rest_minutes: restMinVal ? parseInt(restMinVal) : null,
    accident_types: getChecked('accidents'),
    symptom_types: getChecked('symptoms'),
    treatments: getChecked('treatments'),
    note: document.getElementById('note').value
  };

  let query;
  if (editRecordId) {
    query = dbClient.from('nursing_records').update(payload).eq('id', editRecordId);
  } else {
    query = dbClient.from('nursing_records').insert([payload]);
  }

  const { error } = await query;
  if (error) {
    alert('儲存失敗：' + error.message);
  } else {
    alert(editRecordId ? '登記紀錄已成功修改！' : '登記成功！');
    cancelEditRecord();
    fetchRecords();
  }
  btn.disabled = false;
});

async function editRecord(id) {
  const rec = rawRecords.find(r => r.id === id);
  if (!rec) return;

  document.getElementById('edit_record_id').value = rec.id;
  document.getElementById('formModeTitle').innerText = '編輯修改傷病登記';
  document.getElementById('submitBtn').innerText = '儲存修改';
  document.getElementById('cancelEditBtn').classList.remove('hidden');

  document.getElementById('record_date').value = rec.record_date;
  document.getElementById('record_time').value = rec.record_time?.slice(0, 5);
  
  setSelectedBodyParts(rec.body_part || '');
  document.getElementById('body_temperature').value = rec.body_temperature !== null && rec.body_temperature !== undefined ? rec.body_temperature : '';
  document.getElementById('rest_minutes').value = rec.rest_minutes !== null && rec.rest_minutes !== undefined ? rec.rest_minutes : '';
  document.getElementById('note').value = rec.note || '';

  const sideBtns = document.querySelectorAll('.side-btn');
  sideBtns.forEach(b => {
    if (b.innerText === (rec.side || '無')) {
      setSide(b, rec.side || '');
    }
  });

  const locField = document.getElementById('location_field');
  if (locField) {
    if (locField.tagName === 'SELECT') {
      if (rec.location && !Array.from(locField.options).some(o => o.value === rec.location)) {
        locField.innerHTML += `<option value="${rec.location}">${rec.location}</option>`;
      }
    }
    locField.value = rec.location || '';
  }

  document.querySelectorAll('input[type="checkbox"]').forEach(c => {
    if (c.name !== 'body_parts') c.checked = false;
  });

  (rec.accident_types || []).forEach(val => {
    const chk = document.querySelector(`input[name="accidents"][value="${val}"]`);
    if (chk) chk.checked = true;
  });
  (rec.symptom_types || []).forEach(val => {
    const chk = document.querySelector(`input[name="symptoms"][value="${val}"]`);
    if (chk) chk.checked = true;
  });
  (rec.treatments || []).forEach(val => {
    const chk = document.querySelector(`input[name="treatments"][value="${val}"]`);
    if (chk) chk.checked = true;
  });

  document.getElementById('class_select').value = rec.class_id;
  updateCareFormStudentSelect();
  document.getElementById('student_select').value = rec.student_id;
  await onStudentSelectChange(rec.student_id);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditRecord() {
  document.getElementById('edit_record_id').value = '';
  document.getElementById('formModeTitle').innerText = '新增傷病登記';
  document.getElementById('submitBtn').innerText = '送出登記紀錄';
  document.getElementById('cancelEditBtn').classList.add('hidden');

  document.getElementById('student_select').value = '';
  setSelectedBodyParts('');
  document.getElementById('body_temperature').value = '';
  document.getElementById('rest_minutes').value = '';
  document.getElementById('note').value = '';
  document.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);

  checkBodyPartSelection();
  hideStudentHistoryCard();
}

function setRecordDateFilterToday() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('filterRecordDateStart').value = today;
  document.getElementById('filterRecordDateEnd').value = today;
  renderFilteredRecordsTable();
}

function clearRecordDateFilter() {
  document.getElementById('filterRecordDateStart').value = '';
  document.getElementById('filterRecordDateEnd').value = '';
  renderFilteredRecordsTable();
}

function renderFilteredRecordsTable() {
  const tbody = document.getElementById('recordsTable');
  if (!tbody) return;

  const startDate = document.getElementById('filterRecordDateStart').value;
  const endDate = document.getElementById('filterRecordDateEnd').value;

  let filtered = rawRecords;

  if (startDate) {
    filtered = filtered.filter(r => r.record_date >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter(r => r.record_date <= endDate);
  }

  if (filtered.length === 0) {
    let rangeText = '';
    if (startDate && endDate && startDate === endDate) {
      rangeText = `在指定日期 (${startDate}) `;
    } else if (startDate || endDate) {
      rangeText = `在指定日期區間 (${startDate || '起'} ~ ${endDate || '訖'}) `;
    }

    tbody.innerHTML = `<tr><td colspan="12" class="text-center p-4 text-slate-400">${rangeText}查無登記紀錄</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const tempText = r.body_temperature ? `${r.body_temperature}°` : '';
    const restText = r.rest_minutes ? `${r.rest_minutes}分` : '';
    const vitalText = [tempText, restText].filter(Boolean).join('/') || '-';

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="p-2 border-r break-words font-medium text-slate-800">${formatShortDate(r.record_date)}</td>
        <td class="p-2 border-r break-words text-slate-500">${r.record_time?.slice(0,5)}</td>
        <td class="p-2 border-r break-words font-medium text-slate-800">${r.classes?.name || ''}</td>
        <td class="p-2 border-r break-words text-center font-bold text-teal-800">${r.students ? r.students.seat_no : '-'}</td>
        <td class="p-2 border-r break-words font-medium text-slate-800">${r.students ? r.students.name : '-'}</td>
        <td class="p-2 border-r break-words">${r.location || '-'}</td>
        <td class="p-2 border-r break-words text-slate-700">${(r.side ? r.side + ' ' : '') + (r.body_part || '-')}</td>
        <td class="p-2 border-r break-words text-teal-700 font-medium">${vitalText}</td>
        <td class="p-2 border-r break-words text-slate-600">${[...(r.accident_types || []), ...(r.symptom_types || [])].join(',') || '-'}</td>
        <td class="p-2 border-r break-words text-slate-600">${(r.treatments || []).join(',') || '-'}</td>
        <td class="p-2 border-r break-words text-slate-500">${r.note || '-'}</td>
        <td class="p-2 text-center break-words">
          <button onclick="editRecord('${r.id}')" class="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-1">修改</button>
          <button onclick="deleteRecord('${r.id}')" class="text-rose-600 hover:text-rose-800 text-xs font-semibold">刪除</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function fetchRecords() {
  if (!currentSemesterObj) {
    rawRecords = [];
    renderFilteredRecordsTable();
    updateReportOverviewStats();
    return;
  }
  const sem = currentSemesterObj.id;
  const { data } = await dbClient
    .from('nursing_records')
    .select(`id, semester, record_date, record_time, location, body_part, side, body_temperature, rest_minutes, accident_types, symptom_types, treatments, note, class_id, student_id, classes(name), students(seat_no, name, gender)`)
    .eq('semester', sem)
    .order('record_date', { ascending: false })
    .order('record_time', { ascending: false });

  rawRecords = data || [];
  updateReportOverviewStats();
  renderFilteredRecordsTable();
}

function updateReportOverviewStats() {
  const repTotal = document.getElementById('repStatTotal');
  if (!repTotal) return;
  repTotal.innerText = rawRecords.length;
  let male = 0, female = 0, mins = 0;
  rawRecords.forEach(r => {
    const g = r.students?.gender || '女';
    if (g === '男') male++; else female++;
    if (r.rest_minutes) mins += parseInt(r.rest_minutes);
  });
  document.getElementById('repStatMale').innerText = male;
  document.getElementById('repStatFemale').innerText = female;
  document.getElementById('repStatMinutes').innerText = mins;
}

async function deleteRecord(id) {
  if (!confirm('確定刪除這筆護理紀錄嗎？')) return;
  await dbClient.from('nursing_records').delete().eq('id', id);
  fetchRecords();
}

function exportClassBasedList() {
  if (!currentSemesterObj) return alert('尚未設定或選擇學期！');
  const sem = currentSemesterObj.id;
  if (rawRecords.length === 0) return alert(`[${sem}] 目前無紀錄可匯出！`);

  const wb = XLSX.utils.book_new();
  const grouped = {};

  rawRecords.forEach(r => {
    const cName = r.classes?.name || '其他班級';
    if (!grouped[cName]) grouped[cName] = [];
    grouped[cName].push(r);
  });

  const sortedClasses = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'zh-Hant', { numeric: true }));

  const indexData = [['大明高中 傷病清單(分班) - 分頁索引'], ['']];
  sortedClasses.forEach(cName => indexData.push([cName]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(indexData), '索引頁');

  sortedClasses.forEach(cName => {
    const list = grouped[cName];
    const sheetData = [
      [cName],
      [],
      ['年', '班級', '座號', '姓名', '性別', '時段', '地點', '日期時間', '情形']
    ];

    list.sort((a, b) => {
      const seatDiff = (parseInt(a.students?.seat_no) || 0) - (parseInt(b.students?.seat_no) || 0);
      if (seatDiff !== 0) return seatDiff;
      const nameDiff = (a.students?.name || '').localeCompare(b.students?.name || '', 'zh-Hant');
      if (nameDiff !== 0) return nameDiff;
      return (a.record_date + a.record_time).localeCompare(b.record_date + b.record_time);
    });

    list.forEach(r => {
      const detail = [
        ...(r.accident_types || []),
        ...(r.symptom_types || []),
        ...(r.treatments || []),
        (r.side ? r.side + '側' : '') + (r.body_part || ''),
        r.note
      ].filter(Boolean).join(',');

      sheetData.push([
        cName.replace(/[^0-9]/g, '').slice(0, 1) || '',
        cName.replace(/[^0-9]/g, '').slice(1) || '1',
        r.students?.seat_no || '',
        r.students?.name || '',
        r.students?.gender || '女',
        getTimePeriod(r.record_time),
        r.location || '',
        `${r.record_date.replace(/-/g, '/')} ${r.record_time?.slice(0, 5)}`,
        detail
      ]);
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), cName);
  });

  XLSX.writeFile(wb, `潭子區-私立大明高中_${sem}_傷病清單(分班).xlsx`);
}

function exportMonthBasedList() {
  if (!currentSemesterObj) return alert('尚未設定或選擇學期！');
  const sem = currentSemesterObj.id;
  if (rawRecords.length === 0) return alert(`[${sem}] 目前無紀錄可匯出！`);

  const wb = XLSX.utils.book_new();
  const grouped = {};

  rawRecords.forEach(r => {
    const m = parseInt(r.record_date.split('-')[1]) + '月';
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(r);
  });

  const indexData = [['大明高中 傷病清單(分月) - 分頁索引'], ['']];
  Object.keys(grouped).forEach(m => indexData.push([m]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(indexData), '索引頁');

  for (const [m, list] of Object.entries(grouped)) {
    const sheetData = [
      [m],
      [],
      ['年', '班級', '座號', '姓名', '性別', '時段', '地點', '日期時間', '情形']
    ];

    list.sort((a, b) => {
      const cDiff = (a.classes?.name || '').localeCompare(b.classes?.name || '', 'zh-Hant', { numeric: true });
      if (cDiff !== 0) return cDiff;
      const seatDiff = (parseInt(a.students?.seat_no) || 0) - (parseInt(b.students?.seat_no) || 0);
      if (seatDiff !== 0) return seatDiff;
      return (a.students?.name || '').localeCompare(b.students?.name || '', 'zh-Hant');
    });

    list.forEach(r => {
      const cName = r.classes?.name || '';
      const detail = [
        ...(r.accident_types || []),
        ...(r.symptom_types || []),
        ...(r.treatments || []),
        (r.side ? r.side + '側' : '') + (r.body_part || ''),
        r.note
      ].filter(Boolean).join(',');

      sheetData.push([
        cName.replace(/[^0-9]/g, '').slice(0, 1) || '',
        cName.replace(/[^0-9]/g, '').slice(1) || '1',
        r.students?.seat_no || '',
        r.students?.name || '',
        r.students?.gender || '女',
        getTimePeriod(r.record_time),
        r.location || '',
        `${r.record_date.replace(/-/g, '/')} ${r.record_time?.slice(0, 5)}`,
        detail
      ]);
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), m);
  }

  XLSX.writeFile(wb, `潭子區-私立大明高中_${sem}_傷病清單(分月).xlsx`);
}

function exportMonthAnalysisReport() {
  if (!currentSemesterObj) return alert('尚未設定或選擇學期！');
  const sem = currentSemesterObj.id;
  const targetMonth = parseInt(document.getElementById('reportMonthSelect').value);
  const filtered = rawRecords.filter(r => parseInt(r.record_date.split('-')[1]) === targetMonth);

  if (filtered.length === 0) {
    return alert(`在 [${sem}] 學期中查無 ${targetMonth} 月份的登記紀錄！`);
  }

  const locItems = locations;
  const accItems = accidents;
  const symItems = symptoms;
  const treatItems = treatments;
  const bpItems = bodyParts.filter(b => b !== '其他');

  const rows = [
    ['性別', '', '', '男', '女', '合計']
  ];

  function countItem(fn) {
    let m = 0, f = 0;
    filtered.forEach(r => {
      if (fn(r)) {
        if ((r.students?.gender || '女') === '男') m++; else f++;
      }
    });
    return [m, f, m + f];
  }

  rows.push(['時間', '上午', '', ...countItem(r => getTimePeriod(r.record_time) === '上午')]);
  rows.push(['', '中午', '', ...countItem(r => getTimePeriod(r.record_time) === '中午')]);
  rows.push(['', '下午', '', ...countItem(r => getTimePeriod(r.record_time) === '下午')]);

  locItems.forEach((loc, idx) => {
    const tag = idx === 0 ? '地點' : '';
    rows.push([tag, loc, '', ...countItem(r => (r.location || '') === loc)]);
  });

  bpItems.forEach((bp, idx) => {
    const tag = idx === 0 ? '受傷部位' : '';
    rows.push([tag, bp, '', ...countItem(r => (r.body_part || '').includes(bp))]);
  });

  accItems.forEach((acc, idx) => {
    const tag1 = idx === 0 ? '受傷種類' : '';
    const tag2 = idx === 0 ? '意外傷害' : '';
    rows.push([tag1, tag2, acc, ...countItem(r => (r.accident_types || []).includes(acc))]);
  });

  symItems.forEach((sym, idx) => {
    const tag2 = idx === 0 ? '症狀' : '';
    rows.push(['', tag2, sym, ...countItem(r => (r.symptom_types || []).includes(sym))]);
  });

  treatItems.forEach((tr, idx) => {
    const tag = idx === 0 ? '處理方式' : '';
    rows.push([tag, tr, '', ...countItem(r => (r.treatments || []).includes(tr))]);
  });

  let minM = 0, minF = 0;
  filtered.forEach(r => {
    const mins = parseInt(r.rest_minutes || 0);
    if ((r.students?.gender || '女') === '男') minM += mins; else minF += mins;
  });
  rows.push(['觀察時間-分', '', '', minM, minF, minM + minF]);
  rows.push(['承辦人:             組長:             主任:             校長:', '', '', '', '', '']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '學年報表');
  XLSX.writeFile(wb, `潭子區-私立大明高中_${sem}_${targetMonth}月學生傷病分析.xlsx`);
}

function exportYearAnalysisReport() {
  if (!currentSemesterObj) return alert('尚未設定或選擇學期！');
  const sem = currentSemesterObj.id;
  if (rawRecords.length === 0) return alert(`[${sem}] 目前無紀錄可匯出！`);

  const locItems = locations;
  const bpItems = bodyParts.filter(b => b !== '其他');
  const accItems = accidents;
  const symItems = symptoms;
  const treatItems = treatments;

  const locStart = 8;
  const bpStart = locStart + locItems.length;
  const accStart = bpStart + bpItems.length;
  const symStart = accStart + accItems.length;
  const treatStart = symStart + symItems.length;
  const restCol = treatStart + treatItems.length;
  const totalCols = restCol + 1;

  const row0 = Array(totalCols).fill('');
  row0[0] = `潭子區-私立大明高中_${sem}_學生傷病統計分析`;

  const row1 = Array(totalCols).fill('');
  row1[0] = '項/學期'; row1[1] = '月份'; row1[2] = '性別'; row1[5] = '時間';
  if (locItems.length > 0) row1[locStart] = '地點';
  if (bpItems.length > 0) row1[bpStart] = '部位';
  if (accItems.length > 0 || symItems.length > 0) row1[accStart] = '受傷種類';
  if (treatItems.length > 0) row1[treatStart] = '處理方式';
  row1[restCol] = '觀察時間．分';

  const row2 = Array(totalCols).fill('');
  row2[2] = '合計'; row2[3] = '男'; row2[4] = '女'; row2[5] = '上午'; row2[6] = '中午'; row2[7] = '下午';
  locItems.forEach((l, i) => row2[locStart + i] = l);
  bpItems.forEach((bp, i) => row2[bpStart + i] = bp);
  if (accItems.length > 0) row2[accStart] = '意外傷害';
  if (symItems.length > 0) row2[symStart] = '症狀';
  treatItems.forEach((tr, i) => row2[treatStart + i] = tr);

  const row3 = Array(totalCols).fill('');
  accItems.forEach((a, i) => row3[accStart + i] = a);
  symItems.forEach((s, i) => row3[symStart + i] = s);

  const monthList = sem.includes('1') ? [8, 9, 10, 11, 12, 1] : [2, 3, 4, 5, 6, 7];
  const dataRows = [];
  const semName = sem.includes('1') ? '上學期' : '下學期';

  monthList.forEach((m, mIdx) => {
    const mRecords = rawRecords.filter(r => parseInt(r.record_date.split('-')[1]) === m);
    const rRow = Array(totalCols).fill(0);
    rRow[0] = mIdx === 0 ? semName : '';
    rRow[1] = m;

    let mM = 0, mF = 0, mTotalMins = 0;
    let am = 0, noon = 0, pm = 0;

    mRecords.forEach(r => {
      const g = r.students?.gender || '女';
      if (g === '男') mM++; else mF++;
      mTotalMins += parseInt(r.rest_minutes || 0);

      const tp = getTimePeriod(r.record_time);
      if (tp === '上午') am++; else if (tp === '中午') noon++; else pm++;

      locItems.forEach((loc, idx) => { if ((r.location || '') === loc) rRow[locStart + idx]++; });
      bpItems.forEach((bp, idx) => { if ((r.body_part || '').includes(bp)) rRow[bpStart + idx]++; });
      accItems.forEach((acc, idx) => { if ((r.accident_types || []).includes(acc)) rRow[accStart + idx]++; });
      symItems.forEach((sym, idx) => { if ((r.symptom_types || []).includes(sym)) rRow[symStart + idx]++; });
      treatItems.forEach((tr, idx) => { if ((r.treatments || []).includes(tr)) rRow[treatStart + idx]++; });
    });

    rRow[2] = mM + mF;
    rRow[3] = mM;
    rRow[4] = mF;
    rRow[5] = am;
    rRow[6] = noon;
    rRow[7] = pm;
    rRow[restCol] = mTotalMins;

    dataRows.push(rRow);
  });

  const totalRow = Array(totalCols).fill(0);
  totalRow[0] = '總計';
  totalRow[1] = '合計';
  for (let c = 2; c < totalCols; c++) {
    totalRow[c] = dataRows.reduce((sum, r) => sum + (parseInt(r[c]) || 0), 0);
  }
  dataRows.push(totalRow);

  const signRow = ['承辦人:             組長:             主任:             校長:'];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([row0, row1, row2, row3, ...dataRows, signRow]);
  XLSX.utils.book_append_sheet(wb, ws, '學年報表');
  XLSX.writeFile(wb, `潭子區-私立大明高中_${sem}_學生傷病統計分析.xlsx`);
}

async function loadSemesters(autoSelectByDate = true) {
  const { data, error } = await dbClient.from('semesters').select('*');
  const select = document.getElementById('globalSemesterSelect');

  if (error || !data || data.length === 0) {
    allSemesters = [];
    currentSemesterObj = null;
    select.innerHTML = '<option value="">請先至系統設定新增學期</option>';
    document.querySelectorAll('.currentSemText').forEach(el => el.innerText = '--');
    document.getElementById('labelSemesterRange').innerText = '-';
    renderSemestersTable();
    return;
  }

  allSemesters = data.sort((a, b) => a.id.localeCompare(b.id, 'zh-Hant', { numeric: true }));

  const today = new Date().toISOString().split('T')[0];
  const matchedByDate = allSemesters.find(s => today >= s.start_date && today <= s.end_date);

  if (autoSelectByDate || !currentSemesterObj) {
    currentSemesterObj = matchedByDate || allSemesters[allSemesters.length - 1];
  } else {
    const stillExists = allSemesters.find(s => s.id === currentSemesterObj.id);
    currentSemesterObj = stillExists || matchedByDate || allSemesters[allSemesters.length - 1];
  }

  select.innerHTML = allSemesters.map(s => {
    const isCurrentActive = (today >= s.start_date && today <= s.end_date);
    const labelSuffix = isCurrentActive ? ' (當前學期)' : '';
    return `
      <option value="${s.id}" ${s.id === currentSemesterObj.id ? 'selected' : ''}>
        ${s.id}${labelSuffix}
      </option>
    `;
  }).join('');

  renderSemestersTable();
  updateSemesterDisplay();
}

function onSemesterChange() {
  const semId = document.getElementById('globalSemesterSelect').value;
  currentSemesterObj = allSemesters.find(s => s.id === semId) || null;
  updateSemesterDisplay();
  initClasses();
  fetchRecords();
  hideStudentHistoryCard();
  if (window.location.hash.toLowerCase() === '#settings') {
    loadSettingsViewData();
  }
}

function updateSemesterDisplay() {
  if (!currentSemesterObj) return;
  document.querySelectorAll('.currentSemText').forEach(el => el.innerText = currentSemesterObj.id);
  document.getElementById('labelSemesterRange').innerText = `${currentSemesterObj.start_date} ~ ${currentSemesterObj.end_date}`;
  
  const recordDateInput = document.getElementById('record_date');
  recordDateInput.min = currentSemesterObj.start_date;
  recordDateInput.max = currentSemesterObj.end_date;

  const today = new Date().toISOString().split('T')[0];
  if (today >= currentSemesterObj.start_date && today <= currentSemesterObj.end_date) {
    recordDateInput.value = today;
  } else {
    recordDateInput.value = currentSemesterObj.start_date;
  }
}

function renderSemestersTable() {
  const tbody = document.getElementById('semestersTableBody');
  if (!tbody) return;

  if (allSemesters.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-3 text-slate-400">目前尚無學期資料，請點擊上方按鈕新增。</td></tr>';
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  tbody.innerHTML = allSemesters.map(s => {
    let statusBadge = '';
    if (today >= s.start_date && today <= s.end_date) {
      statusBadge = '<span class="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">● 進行中 (當前)</span>';
    } else if (today < s.start_date) {
      statusBadge = '<span class="bg-blue-100 text-blue-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">尚未開始</span>';
    } else {
      statusBadge = '<span class="bg-slate-100 text-slate-500 text-[10px] px-2.5 py-0.5 rounded-full font-bold">已結束</span>';
    }

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-2.5 font-bold text-teal-800 break-words">${s.id}</td>
        <td class="p-2.5 break-words">${s.start_date}</td>
        <td class="p-2.5 break-words">${s.end_date}</td>
        <td class="p-2.5 text-center">${statusBadge}</td>
        <td class="p-2.5 text-center">
          <button onclick="editSemester('${s.id}')" class="text-blue-600 hover:underline mr-2">編輯</button>
          <button onclick="deleteSemester('${s.id}')" class="text-rose-600 hover:underline">刪除</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddSemesterModal() {
  const bodyHtml = `
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">學期代碼 (如 115-1, 115-2) *</label>
        <input type="text" id="modalSemId" placeholder="115-1" class="w-full p-2 border rounded-lg text-xs bg-white font-medium">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">開始日期 *</label>
          <input type="date" id="modalSemStart" class="w-full p-2 border rounded-lg text-xs bg-white font-medium">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">結束日期 *</label>
          <input type="date" id="modalSemEnd" class="w-full p-2 border rounded-lg text-xs bg-white font-medium">
        </div>
      </div>
      <p class="text-[11px] text-slate-400">系統將依日期區間自動判斷當前學期，無須手動指定預設。</p>
    </div>
  `;
  openModal('新增學期', bodyHtml, async () => {
    const id = document.getElementById('modalSemId').value.trim();
    const start_date = document.getElementById('modalSemStart').value;
    const end_date = document.getElementById('modalSemEnd').value;

    if (!id || !start_date || !end_date) return alert('請完整填寫學期代碼與起訖日期！');
    if (start_date > end_date) return alert('開始日期不能晚於結束日期！');

    const { error } = await dbClient.from('semesters').upsert({ id, start_date, end_date });
    if (error) {
      alert('儲存失敗：' + error.message);
    } else {
      closeModal();
      await loadSemesters(true);
      await initClasses();
      fetchRecords();
    }
  });
}

function editSemester(id) {
  const s = allSemesters.find(item => item.id === id);
  if (!s) return;
  const bodyHtml = `
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">學期代碼</label>
        <input type="text" id="modalEditSemId" value="${s.id}" disabled class="w-full p-2 border rounded-lg text-xs bg-slate-100 font-bold">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">開始日期 *</label>
          <input type="date" id="modalEditSemStart" value="${s.start_date}" class="w-full p-2 border rounded-lg text-xs bg-white font-medium">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">結束日期 *</label>
          <input type="date" id="modalEditSemEnd" value="${s.end_date}" class="w-full p-2 border rounded-lg text-xs bg-white font-medium">
        </div>
      </div>
    </div>
  `;
  openModal('編輯學期設定', bodyHtml, async () => {
    const start_date = document.getElementById('modalEditSemStart').value;
    const end_date = document.getElementById('modalEditSemEnd').value;

    if (!start_date || !end_date) return alert('請完整填寫起訖日期！');
    if (start_date > end_date) return alert('開始日期不能晚於結束日期！');

    const { error } = await dbClient.from('semesters').update({ start_date, end_date }).eq('id', s.id);
    if (error) {
      alert('修改失敗：' + error.message);
    } else {
      closeModal();
      await loadSemesters(false);
      updateSemesterDisplay();
    }
  });
}

async function deleteSemester(id) {
  if (!confirm(`確定刪除學期 [${id}] 嗎？注意：該學期的班級與紀錄將保留，但無法從此處選取。`)) return;
  await dbClient.from('semesters').delete().eq('id', id);
  await loadSemesters(true);
  await initClasses();
  fetchRecords();
}

async function initClasses() {
  const classSelect = document.getElementById('class_select');
  const manageClassSelect = document.getElementById('manageClassSelect');
  const stuSelect = document.getElementById('student_select');

  if (stuSelect) {
    stuSelect.innerHTML = '<option value="">請先選取班級</option>';
    stuSelect.disabled = true;
  }

  if (!currentSemesterObj) {
    allClassObjects = [];
    if (classSelect) classSelect.innerHTML = '<option value="">尚未選擇學期</option>';
    if (manageClassSelect) manageClassSelect.innerHTML = '<option value="">尚未選擇學期</option>';
    renderClassManagementTable();
    await loadAllSemesterStudents();
    return;
  }

  const sem = currentSemesterObj.id;
  const { data: classList } = await dbClient.from('classes').select('id, name').eq('semester', sem);
  allClassObjects = (classList || []).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant', { numeric: true }));

  const currentSelectedManageVal = manageClassSelect ? manageClassSelect.value : '';

  if (allClassObjects.length > 0) {
    const optionsHtml = '<option value="">-- 請選取班級 --</option>' + allClassObjects.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (classSelect) classSelect.innerHTML = optionsHtml;
    if (manageClassSelect) {
      manageClassSelect.innerHTML = '<option value="">-- 全部班級 --</option>' + allClassObjects.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      if (currentSelectedManageVal && allClassObjects.some(c => c.id === currentSelectedManageVal)) {
        manageClassSelect.value = currentSelectedManageVal;
      }
    }
  } else {
    if (classSelect) classSelect.innerHTML = `<option value="">[${sem}] 尚未建立班級</option>`;
    if (manageClassSelect) manageClassSelect.innerHTML = `<option value="">[${sem}] 尚未建立班級</option>`;
    const tbody = document.getElementById('studentManageTbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-slate-400">[${sem}] 學期目前無班級與學生，請新增或匯入。</td></tr>`;
  }

  renderClassManagementTable();
  await loadAllSemesterStudents();
}

function renderClassManagementTable() {
  const tbody = document.getElementById('classManageTableTbody');
  if (!tbody) return;

  if (allClassObjects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-slate-400">目前尚無班級資料，請點擊上方按鈕新增，或直接至學生管理匯入名冊自動建立。</td></tr>';
    return;
  }

  tbody.innerHTML = allClassObjects.map((c, idx) => `
    <tr class="hover:bg-slate-50 transition">
      <td class="p-2.5 font-bold text-teal-800 break-words">${idx + 1}</td>
      <td class="p-2.5 font-bold text-slate-800 break-words">${c.name}</td>
      <td class="p-2.5 text-center">
        <button onclick="openEditClassModalById('${c.id}', '${c.name}')" class="text-blue-600 hover:text-blue-800 mr-2.5 font-medium">編輯</button>
        <button onclick="deleteClassById('${c.id}', '${c.name}')" class="text-rose-600 hover:text-rose-800 font-medium">刪除</button>
      </td>
    </tr>
  `).join('');
}

function openAddClassModal() {
  if (!currentSemesterObj) return alert('請先建立並選取學期！');
  const sem = currentSemesterObj.id;
  const bodyHtml = `
    <div>
      <label class="block text-xs font-semibold text-slate-600 mb-1">班級名稱（一行一個，支援單班或多班複製貼上）：</label>
      <textarea id="modalClassNamesTextarea" rows="6" class="w-full p-2 border rounded-lg text-xs bg-white font-medium" placeholder="701國一1&#10;702國一2&#10;1001廣一1&#10;1002美一1"></textarea>
      <p class="text-[11px] text-slate-400 mt-1">※ 若該學期已存在相同名稱的班級，系統將自動跳過避免重複。</p>
    </div>
  `;
  openModal(`新增班級 (${sem} 學期)`, bodyHtml, async () => {
    const text = document.getElementById('modalClassNamesTextarea').value.trim();
    if (!text) return alert('請輸入班級名稱！');

    const inputLines = [...new Set(text.split('\n').map(l => l.trim()).filter(Boolean))];
    if (inputLines.length === 0) return alert('請輸入有效班級名稱！');

    const existingNames = new Set(allClassObjects.map(c => c.name));
    const newClassNames = inputLines.filter(name => !existingNames.has(name));

    if (newClassNames.length === 0) {
      alert('輸入的所有班級皆已存在於目前學期中！');
      closeModal();
      return;
    }

    const payload = newClassNames.map(name => ({
      semester: sem,
      name: name
    }));

    const { error } = await dbClient.from('classes').insert(payload);
    if (error) {
      alert('新增班級失敗：' + error.message);
    } else {
      closeModal();
      await initClasses();
      alert(`成功為 [${sem}] 學期新增 ${newClassNames.length} 個班級！`);
    }
  });
}

function openEditClassModalById(classId, oldName) {
  const bodyHtml = `
    <div>
      <label class="block text-xs font-semibold text-slate-600 mb-1">新班級名稱：</label>
      <input type="text" id="modalEditClassNameInput" value="${oldName}" class="w-full p-2 border rounded-lg text-xs bg-white">
    </div>
  `;
  openModal(`修改班級名稱`, bodyHtml, async () => {
    const newName = document.getElementById('modalEditClassNameInput').value.trim();
    if (!newName || newName === oldName) return closeModal();

    const { error } = await dbClient.from('classes').update({ name: newName }).eq('id', classId);
    if (error) {
      alert('修改失敗：' + error.message);
    } else {
      closeModal();
      await initClasses();
    }
  });
}

async function deleteClassById(classId, className) {
  if (!confirm(`警告：確定要刪除「${className}」嗎？\n這將一併刪除該班級底下的所有學生名冊！`)) return;
  const { error } = await dbClient.from('classes').delete().eq('id', classId);
  if (error) {
    alert('刪除失敗：' + error.message);
  } else {
    await initClasses();
  }
}

async function loadAllSemesterStudents() {
  if (!currentSemesterObj || allClassObjects.length === 0) {
    const tbody = document.getElementById('studentManageTbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-slate-400">目前尚無班級與學生資料。</td></tr>';
    allSemesterStudents = [];
    filterStudentTable();
    updateCareFormStudentSelect();
    return;
  }

  const classIds = allClassObjects.map(c => c.id);
  const classMap = new Map(allClassObjects.map(c => [c.id, c.name]));

  const { data: students, error } = await dbClient
    .from('students')
    .select('id, seat_no, name, gender, class_id')
    .in('class_id', classIds);

  if (error || !students) {
    allSemesterStudents = [];
  } else {
    allSemesterStudents = students.sort((a, b) => sortStudentsCanonical(a, b, classMap));
  }
  filterStudentTable();
  updateCareFormStudentSelect();
}

function filterStudentTable() {
  const manageSelect = document.getElementById('manageClassSelect');
  const selectedClassId = manageSelect ? manageClassSelect.value : '';
  const searchInput = document.getElementById('searchStudentInput');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let list = allSemesterStudents;
  if (selectedClassId) {
    list = list.filter(s => s.class_id === selectedClassId);
  }

  if (q) {
    list = list.filter(s => 
      String(s.seat_no).includes(q) || s.name.toLowerCase().includes(q)
    );
  }

  renderStudentManageTable(list);
}

function renderStudentManageTable(list) {
  const tbody = document.getElementById('studentManageTbody');
  if (!tbody) return;
  const classMap = new Map(allClassObjects.map(c => [c.id, c.name]));

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-slate-400">查無相符學生。</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(s => {
    const cName = classMap.get(s.class_id) || '';
    return `
      <tr class="hover:bg-slate-50 transition border-b">
        <td class="p-2.5 font-bold text-teal-800 break-words">${cName}</td>
        <td class="p-2.5 font-bold text-teal-800 break-words">${s.seat_no}</td>
        <td class="p-2.5 font-medium text-slate-800 break-words">${s.name}</td>
        <td class="p-2.5 text-slate-600 break-words">${s.gender || '女'}</td>
        <td class="p-2.5 text-center">
          <button onclick="openEditStudentModal('${s.id}', '${s.class_id}', ${s.seat_no}, '${s.name}', '${s.gender || '女'}')" class="text-blue-600 hover:text-blue-800 mr-2 font-medium">編輯</button>
          <button onclick="deleteStudent('${s.id}', '${s.name}')" class="text-rose-600 hover:text-rose-800 font-medium">刪除</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddStudentModal() {
  if (allClassObjects.length === 0) return alert('請先建立班級後才能新增學生！');
  
  const manageSelect = document.getElementById('manageClassSelect');
  const defaultClassId = (manageSelect && manageSelect.value) ? manageSelect.value : allClassObjects[0].id;

  const classOptions = allClassObjects.map(c => `
    <option value="${c.id}" ${c.id === defaultClassId ? 'selected' : ''}>${c.name}</option>
  `).join('');

  const bodyHtml = `
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">班級 *</label>
        <select id="modalStudentClass" class="w-full p-2 border rounded-lg text-xs bg-white font-bold text-teal-800">${classOptions}</select>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">座號 *</label>
          <input type="number" id="modalStudentSeat" min="1" class="w-full p-2 border rounded-lg text-xs bg-white" placeholder="座號(數字)">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">性別</label>
          <select id="modalStudentGender" class="w-full p-2 border rounded-lg text-xs bg-white">
            <option value="女">女</option>
            <option value="男">男</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">學生姓名 *</label>
        <input type="text" id="modalStudentName" class="w-full p-2 border rounded-lg text-xs bg-white" placeholder="請輸入姓名">
      </div>
    </div>
  `;

  openModal('新增學生', bodyHtml, async () => {
    const classId = document.getElementById('modalStudentClass').value;
    const seat = parseInt(document.getElementById('modalStudentSeat').value);
    const name = document.getElementById('modalStudentName').value.trim();
    const gender = document.getElementById('modalStudentGender').value;

    if (!seat || seat <= 0) return alert('請輸入有效座號！');
    if (!name) return alert('學生姓名不能為空！');

    const { error } = await dbClient.from('students').upsert([{
      class_id: classId,
      seat_no: seat,
      name: name,
      gender: gender
    }], { onConflict: 'class_id,seat_no' });

    if (error) {
      alert('儲存失敗：' + error.message);
    } else {
      closeModal();
      await loadAllSemesterStudents();
    }
  });
}

function openEditStudentModal(id, classId, seat, name, gender) {
  const classOptions = allClassObjects.map(c => `
    <option value="${c.id}" ${c.id === classId ? 'selected' : ''}>${c.name}</option>
  `).join('');

  const bodyHtml = `
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">班級</label>
        <select id="modalEditStudentClass" class="w-full p-2 border rounded-lg text-xs bg-white font-bold text-teal-800">${classOptions}</select>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">座號</label>
          <input type="number" id="modalEditStudentSeat" value="${seat}" min="1" class="w-full p-2 border rounded-lg text-xs bg-white">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">性別</label>
          <select id="modalEditStudentGender" class="w-full p-2 border rounded-lg text-xs bg-white">
            <option value="女" ${gender === '女' ? 'selected' : ''}>女</option>
            <option value="男" ${gender === '男' ? 'selected' : ''}>男</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">學生姓名</label>
        <input type="text" id="modalEditStudentName" value="${name}" class="w-full p-2 border rounded-lg text-xs bg-white">
      </div>
    </div>
  `;

  openModal('編輯學生資訊', bodyHtml, async () => {
    const newClassId = document.getElementById('modalEditStudentClass').value;
    const newSeat = parseInt(document.getElementById('modalEditStudentSeat').value);
    const newName = document.getElementById('modalEditStudentName').value.trim();
    const newGender = document.getElementById('modalEditStudentGender').value;

    if (!newSeat || newSeat <= 0) return alert('請輸入有效座號！');
    if (!newName) return alert('姓名不能為空！');

    const { error } = await dbClient
      .from('students')
      .update({ class_id: newClassId, seat_no: newSeat, name: newName, gender: newGender })
      .eq('id', id);

    if (error) {
      alert('修改失敗：' + error.message);
    } else {
      closeModal();
      await loadAllSemesterStudents();
    }
  });
}

async function deleteStudent(id, name) {
  if (!confirm(`確定要刪除學生「${name}」嗎？該學生的過往護理紀錄將一併受到關聯處理。`)) return;
  const { error } = await dbClient.from('students').delete().eq('id', id);
  if (error) {
    alert('刪除失敗：' + error.message);
  } else {
    await loadAllSemesterStudents();
  }
}

function downloadStudentTemplate() {
  const headerOnly = [['班級', '座號', '姓名', '性別']];
  const ws = XLSX.utils.aoa_to_sheet(headerOnly);
  ws['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '學生名冊');
  XLSX.writeFile(wb, '學生名冊.xlsx');
}

async function handleStudentImport() {
  const fileInput = document.getElementById('studentFileInput');
  if (!fileInput.files || fileInput.files.length === 0) return alert('請選取要匯入的檔案！');
  if (!currentSemesterObj) return alert('請先選取學期！');

  const sem = currentSemesterObj.id;
  const btn = document.getElementById('doImportStudentBtn');
  btn.disabled = true;
  btn.innerText = '匯入中...';

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      if (!rows || rows.length === 0) throw new Error('檔案中無任何資料！');

      const { data: existingClasses } = await dbClient.from('classes').select('id, name').eq('semester', sem);
      const classMap = new Map();
      (existingClasses || []).forEach(c => classMap.set(c.name, c.id));

      const distinctClasses = [...new Set(rows.map(r => String(r['班級'] || r['class'] || '').trim()).filter(Boolean))];
      for (const cName of distinctClasses) {
        if (!classMap.has(cName)) {
          const { data: newC } = await dbClient.from('classes').insert([{ semester: sem, name: cName }]).select().single();
          if (newC) classMap.set(cName, newC.id);
        }
      }

      const targetClassIds = Array.from(classMap.values());
      const { data: existingStudents } = await dbClient
        .from('students')
        .select('id, class_id, seat_no')
        .in('class_id', targetClassIds);

      const studentKeyMap = new Set();
      (existingStudents || []).forEach(s => studentKeyMap.add(`${s.class_id}_${s.seat_no}`));

      const studentsToUpsert = [];
      let insertCount = 0;
      let updateCount = 0;

      for (const r of rows) {
        const cName = String(r['班級'] || r['class'] || '').trim();
        const seat = parseInt(r['座號'] || r['seat_no'] || 0);
        const name = String(r['姓名'] || r['name'] || '').trim();
        const rawGender = String(r['性別'] || r['gender'] || '女').trim();
        const gender = (rawGender === '男') ? '男' : '女';
        const classId = classMap.get(cName);

        if (classId && name && seat > 0) {
          const key = `${classId}_${seat}`;
          if (studentKeyMap.has(key)) {
            updateCount++;
          } else {
            insertCount++;
            studentKeyMap.add(key);
          }

          studentsToUpsert.push({ 
            class_id: classId, 
            seat_no: seat, 
            name: name,
            gender: gender
          });
        }
      }

      if (studentsToUpsert.length === 0) throw new Error('未找到包含「班級、座號、姓名」的有效資料！');

      const { error: upsertErr } = await dbClient
        .from('students')
        .upsert(studentsToUpsert, { onConflict: 'class_id,seat_no' });

      if (upsertErr) throw upsertErr;

      alert(`名冊處理完成！\n【新增學生】：${insertCount} 位\n【更新修改】：${updateCount} 位\n共處理 ${studentsToUpsert.length} 筆資料。`);
      fileInput.value = '';
      await initClasses();
      await loadAllSemesterStudents();
    } catch (err) {
      alert('匯入發生錯誤：' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = '匯入';
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
}

async function loadSystemSettings() {
  const { data } = await dbClient.from('system_settings').select('*').order('sort_order');
  const allItems = data || [];
  
  locations = allItems.filter(d => d.category === 'location').map(d => d.item_name);
  bodyParts = allItems.filter(d => d.category === 'body_part').map(d => d.item_name);
  accidents = allItems.filter(d => d.category === 'accident').map(d => d.item_name);
  symptoms = allItems.filter(d => d.category === 'symptom').map(d => d.item_name);
  treatments = allItems.filter(d => d.category === 'treatment').map(d => d.item_name);

  renderLocationSelect();
  renderBodyPartsCheckboxes();
  renderCheckboxes('accidentGroup', accidents, 'accidents');
  renderCheckboxes('symptomGroup', symptoms, 'symptoms');
  renderCheckboxes('treatmentGroup', treatments, 'treatments');

  renderCategoryManageTable('locationsManageTbody', locations, 'location', 'badgeCountLocation');
  renderCategoryManageTable('bodyPartManageTbody', bodyParts, 'body_part', 'badgeCountBodyPart');
  renderCategoryManageTable('accidentManageTbody', accidents, 'accident', 'badgeCountAccident');
  renderCategoryManageTable('symptomManageTbody', symptoms, 'symptom', 'badgeCountSymptom');
  renderCategoryManageTable('treatmentManageTbody', treatments, 'treatment', 'badgeCountTreatment');
}

function renderCategoryManageTable(tbodyId, list, category, badgeId) {
  const tbody = document.getElementById(tbodyId);
  const badge = document.getElementById(badgeId);
  if (badge) badge.innerText = `${list.length} 項`;
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="text-center p-3 text-slate-400">目前無項目，請點擊上方按鈕新增</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(item => `
    <tr class="hover:bg-slate-50 transition border-b">
      <td class="p-2 font-medium text-slate-800 break-words">${item}</td>
      <td class="p-2 text-center">
        <button onclick="editCustomItemPrompt('${category}', '${item}')" class="text-blue-600 hover:text-blue-800 mr-2 font-medium">編輯</button>
        <button onclick="removeCustomItem('${category}', '${item}')" class="text-rose-600 hover:text-rose-800 font-medium">刪除</button>
      </td>
    </tr>
  `).join('');
}

function openAddCategoryLinesModal(category, categoryLabel) {
  const bodyHtml = `
    <div>
      <label class="block text-xs font-semibold text-slate-600 mb-1">新增「${categoryLabel}」項目（一行一項，支援單項或多項）：</label>
      <textarea id="modalAddCategoryLines" rows="5" class="w-full p-2 border rounded-lg text-xs bg-white font-medium" placeholder="項目一&#10;項目二"></textarea>
    </div>
  `;
  openModal(`新增${categoryLabel}項目`, bodyHtml, async () => {
    const text = document.getElementById('modalAddCategoryLines').value.trim();
    if (!text) return alert('請輸入項目名稱！');

    const lines = [...new Set(text.split('\n').map(l => l.trim()).filter(Boolean))];
    if (lines.length === 0) return alert('請輸入有效內容！');

    const currentList = 
      category === 'location' ? locations :
      category === 'body_part' ? bodyParts :
      category === 'accident' ? accidents :
      category === 'symptom' ? symptoms : treatments;

    const existingSet = new Set(currentList);
    const newPayload = lines.filter(name => !existingSet.has(name)).map((name, idx) => ({ category, item_name: name, sort_order: 99 + idx }));

    if (newPayload.length === 0) {
      alert('輸入的項目皆已存在！');
      closeModal();
      return;
    }

    const { error } = await dbClient.from('system_settings').insert(newPayload);
    if (error) {
      alert('儲存失敗：' + error.message);
    } else {
      closeModal();
      await loadSystemSettings();
    }
  });
}

function editCustomItemPrompt(category, oldName) {
  const bodyHtml = `
    <div>
      <label class="block text-xs font-semibold text-slate-600 mb-1">新項目名稱：</label>
      <input type="text" id="modalEditCustomName" value="${oldName}" class="w-full p-2 border rounded-lg text-xs bg-white">
    </div>
  `;
  openModal(`修改細項名稱`, bodyHtml, async () => {
    const newName = document.getElementById('modalEditCustomName').value.trim();
    if (!newName || newName === oldName) return closeModal();

    const { error: delErr } = await dbClient.from('system_settings').delete().match({ category, item_name: oldName });
    if (!delErr) {
      await dbClient.from('system_settings').insert([{ category, item_name: newName, sort_order: 99 }]);
      closeModal();
      await loadSystemSettings();
    } else {
      alert('修改失敗：' + delErr.message);
    }
  });
}

async function removeCustomItem(category, item_name) {
  if (!confirm(`確定移除「${item_name}」項目嗎？`)) return;
  await dbClient.from('system_settings').delete().match({ category, item_name });
  await loadSystemSettings();
}

function renderCheckboxes(containerId, list, name) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (list.length === 0) {
    el.innerHTML = '<span class="text-slate-400 text-xs col-span-full">尚未建立項目，請至系統設定新增</span>';
    return;
  }
  el.innerHTML = list.map(item => `
    <label class="flex items-center space-x-1 p-1 rounded border bg-white cursor-pointer hover:border-teal-500 text-xs">
      <input type="checkbox" name="${name}" value="${item}" class="rounded text-teal-600">
      <span class="select-none truncate">${item}</span>
    </label>
  `).join('');
}

(async function init() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('record_time').value = `${hh}:${mm}`;

  const today = now.toISOString().split('T')[0];
  const fStart = document.getElementById('filterRecordDateStart');
  const fEnd = document.getElementById('filterRecordDateEnd');
  if (fStart && fEnd) {
    fStart.value = today;
    fEnd.value = today;
  }

  handleHashRouting();
  await loadSemesters(true);
  await loadSystemSettings();
  await initClasses();
  await fetchRecords();
})();