// 設定: Google Apps ScriptのWebアプリURL
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbyeuFnAbLogFMUVnEMsRjeZKDbRoMCk3xYpv8Y3oI791Nmnt_iPGLPvQ7WIZN8h91S_Xw/exec'; 

document.addEventListener('DOMContentLoaded', () => {
    loadFormData();
    setupEventListeners();
    
    // 排他制御
    setupExclusiveNone('insurance', 'なし');
    setupExclusiveValues('qualification', ['普通免許（AT可）', '普通免許（AT不可）', '免許不要']);
    setupExclusiveNone('workNoGo', '特になし');
});

function setupEventListeners() {
    // 職種「その他」
    const jobTypeSelect = document.getElementById('jobType');
    if (jobTypeSelect) {
        jobTypeSelect.addEventListener('change', (e) => {
            const otherInput = document.getElementById('jobTypeOther');
            otherInput.style.display = e.target.value === 'その他' ? 'block' : 'none';
        });
    }

    // 保険条件トグル
    const insuranceToggle = document.getElementById('insuranceConditionToggle');
    if (insuranceToggle) {
        insuranceToggle.addEventListener('change', (e) => {
            toggleInsuranceCondition(e.target.checked);
            saveFormData();
        });
    }

    // 契約期間トグル
    const contractRadios = document.querySelectorAll('input[name="contractType"]');
    contractRadios.forEach(r => r.addEventListener('change', (e) => {
        toggleContract(e.target.value === '有期', {save: true});
    }));

    // 固定残業代トグル
    const overtimeRadios = document.querySelectorAll('input[name="fixedOvertime"]');
    overtimeRadios.forEach(r => r.addEventListener('change', (e) => {
        toggleFixedOvertime(e.target.value === 'あり', {save: true});
    }));

    // 郵送警告
    const mailSelect = document.getElementById('gbpMailReceivable');
    if (mailSelect) {
        mailSelect.addEventListener('change', (e) => {
            const warn = document.getElementById('mailWarning');
            if(warn) warn.style.display = e.target.value === '届かない' ? 'block' : 'none';
        });
    }

    // 保存・送信イベント
    const form = document.getElementById('hiringForm');
    form.addEventListener('change', saveFormData);
    form.addEventListener('input', saveFormData);
    form.addEventListener('submit', handleSubmit);
}

// UI制御関数群
function toggleInsuranceCondition(isChecked) {
    const input = document.getElementById('insuranceCondition');
    input.style.display = isChecked ? 'block' : 'none';
    if (isChecked) { input.setAttribute('required', 'true'); } 
    else { input.removeAttribute('required'); input.value = ''; }
}

window.toggleProbation = function(isYes, opts = { save: true }) {
    const wrap = document.getElementById('probationDetails');
    const period = document.querySelector('input[name="probationPeriod"]');
    const cond = document.querySelector('input[name="probationCondition"]');
    wrap.style.display = isYes ? 'block' : 'none';
    if (isYes) {
        period.setAttribute('required', 'true');
        cond.setAttribute('required', 'true');
    } else {
        period.removeAttribute('required');
        cond.removeAttribute('required');
        period.value = ''; cond.value = '';
    }
    if (opts.save) saveFormData();
};

window.toggleContract = function(isLimited, opts = { save: true }) {
    const wrap = document.getElementById('contractDetails');
    const start = document.querySelector('input[name="contractStartDate"]');
    const end = document.querySelector('input[name="contractEndDate"]');
    
    wrap.style.display = isLimited ? 'block' : 'none';
    
    if (isLimited) {
        start.setAttribute('required', 'true');
        end.setAttribute('required', 'true');
    } else {
        start.removeAttribute('required');
        end.removeAttribute('required');
        start.value = '';
        end.value = '';
    }
    if (opts.save) saveFormData();
};

window.toggleFixedOvertime = function(has, opts = { save: true }) {
    const wrap = document.getElementById('overtimeDetails');
    const hours = document.querySelector('input[name="fixedOvertimeHours"]');
    const amount = document.querySelector('input[name="fixedOvertimeAmount"]');
    const note = document.querySelector('input[name="fixedOvertimeNote"]');
    
    wrap.style.display = has ? 'block' : 'none';
    
    if (has) {
        hours.setAttribute('required', 'true');
        amount.setAttribute('required', 'true');
    } else {
        hours.removeAttribute('required');
        amount.removeAttribute('required');
        hours.value = ''; 
        amount.value = '';
        if(note) note.value = '';
    }
    if (opts.save) saveFormData();
};

// 修正：GBP存在チェック（ゴミデータ残留防止版）
window.toggleGbpInput = function(exists, opts = { save: true }) {
    const wrap = document.getElementById('gbpExistingDetails');
    if (wrap) wrap.style.display = exists ? 'block' : 'none';

    const urlInput = document.querySelector('input[name="gbpMapUrl"]');
    if (!urlInput) return;

    if (exists) {
        urlInput.setAttribute('required', 'true');
    } else {
        urlInput.removeAttribute('required');
        // 既存じゃないなら値は常に焼却（ゴミデータ残留をゼロにする）
        urlInput.value = '';
    }

    if (opts.save) saveFormData();
};

// 排他制御
function setupExclusiveValues(groupName, exclusiveValues) {
    const boxes = [...document.querySelectorAll(`input[name="${groupName}"]`)];
    const set = new Set(exclusiveValues);
    boxes.forEach(b => {
        b.addEventListener('change', () => {
            if (!set.has(b.value) || !b.checked) return;
            boxes.forEach(x => {
                if (x !== b && set.has(x.value)) x.checked = false;
            });
            saveFormData();
        });
    });
}
function setupExclusiveNone(groupName, noneValue='なし') {
    const boxes = [...document.querySelectorAll(`input[name="${groupName}"]`)];
    const noneBox = boxes.find(b => b.value === noneValue);
    if (!noneBox) return;
    boxes.forEach(b => {
        b.addEventListener('change', () => {
            if (b === noneBox && noneBox.checked) {
                boxes.filter(x => x !== noneBox).forEach(x => x.checked = false);
            }
            if (b !== noneBox && b.checked) noneBox.checked = false;
            saveFormData();
        });
    });
}

// ステップ管理
window.nextStep = function(stepNum) {
    if (!validateStep(stepNum - 1)) return;
    showStep(stepNum);
    window.scrollTo(0, 0);
};
window.prevStep = function(stepNum) {
    showStep(stepNum);
    window.scrollTo(0, 0);
};
function showStep(stepNum) {
    document.querySelectorAll('.form-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`section-${stepNum}`).classList.add('active');
    document.querySelectorAll('.step').forEach((el, index) => {
        if (index + 1 === stepNum) el.classList.add('active');
        else el.classList.remove('active');
    });
}

// バリデーション
function validateStep(currentStep) {
    const section = document.getElementById(`section-${currentStep}`);
    const inputs = section.querySelectorAll('input, select, textarea');
    let isValid = true;
    inputs.forEach(input => {
        if (input.hasAttribute('required') && !input.checkValidity()) {
            input.reportValidity();
            isValid = false;
            return;
        }
    });
    if (!isValid) return false;

    // 給与チェック (Step 2)
    if (currentStep === 2) {
        const min = document.getElementById('salaryMin');
        const max = document.getElementById('salaryMax');
        if (min && max && parseInt(min.value) > parseInt(max.value)) {
            alert('給与の最低額が最高額を上回っています。');
            return false;
        }
    }
    // NG作業チェック (Step 3)
    if (currentStep === 3) {
        if (!requireAtLeastOne('workNoGo', '「絶対にやらない作業」を選択してください。なければ「特になし」を選んでください。')) return false;
    }
    // 社保・資格チェック (Step 4)
    if (currentStep === 4) {
        if (!requireAtLeastOne('insurance', '社会保険を選択してください。')) return false;
        if (!requireAtLeastOne('qualification', '応募資格を選択してください。')) return false;
    }
    return isValid;
}
function requireAtLeastOne(name, msg) {
    const checked = document.querySelectorAll(`input[name="${name}"]:checked`).length;
    if (checked === 0) { alert(msg); return false; }
    return true;
}

// 保存・復元
function saveFormData() {
    const form = document.getElementById('hiringForm');
    const data = {};
    [...form.elements].forEach(el => {
        if (!el.name) return;
        if (el.type === 'checkbox') {
            if (!data[el.name]) data[el.name] = [];
            if (el.checked) data[el.name].push(el.value);
            return;
        }
        if (el.type === 'radio') {
            if (el.checked) data[el.name] = el.value;
            return;
        }
        data[el.name] = el.value;
    });
    localStorage.setItem('hiringFormData', JSON.stringify(data));
}

function loadFormData() {
    const dataStr = localStorage.getItem('hiringFormData');
    if (!dataStr) return;
    const data = JSON.parse(dataStr);
    const form = document.getElementById('hiringForm');

    Object.entries(data).forEach(([name, value]) => {
        const els = form.querySelectorAll(`[name="${name}"]`);
        if (!els.length) return;

        if (Array.isArray(value)) { 
            els.forEach(el => { el.checked = value.includes(el.value); });
            return;
        }
        if (els[0].type === 'radio') {
            els.forEach(el => { el.checked = (el.value === value); });
            return;
        }
        if (els[0]) els[0].value = value;
    });

    // その他UI復元
    const jobType = document.getElementById('jobType');
    if (jobType && jobType.value === 'その他') document.getElementById('jobTypeOther').style.display = 'block';

    const mailSelect = document.getElementById('gbpMailReceivable');
    if (mailSelect && mailSelect.value === '届かない') {
        const warn = document.getElementById('mailWarning');
        if(warn) warn.style.display = 'block';
    }

    // UI強制同期（ゴミ掃除）
    const insToggle = document.getElementById('insuranceConditionToggle');
    if (insToggle) toggleInsuranceCondition(insToggle.checked);

    const probChecked = document.querySelector('input[name="probation"]:checked');
    if (probChecked) toggleProbation(probChecked.value === 'あり', { save: false });

    const contractChecked = document.querySelector('input[name="contractType"]:checked');
    if (contractChecked) toggleContract(contractChecked.value === '有期', { save: false });

    const overtimeChecked = document.querySelector('input[name="fixedOvertime"]:checked');
    if (overtimeChecked) toggleFixedOvertime(overtimeChecked.value === 'あり', { save: false });

    const gbpChecked = document.querySelector('input[name="gbpExists"]:checked');
    if (gbpChecked) toggleGbpInput(gbpChecked.value === 'はい', { save: false });

    normalizeFormData();
    saveFormData();
}

function normalizeFormData() {
    const insNone = document.querySelector('input[name="insurance"][value="なし"]');
    if (insNone && insNone.checked) {
        document.querySelectorAll('input[name="insurance"]').forEach(el => { if (el !== insNone) el.checked = false; });
    }
    const licTypes = new Set(['普通免許（AT可）', '普通免許（AT不可）', '免許不要']);
    const checkedLics = [...document.querySelectorAll('input[name="qualification"]:checked')].filter(el => licTypes.has(el.value));
    if (checkedLics.length > 1) {
        const keep = checkedLics.pop();
        checkedLics.forEach(el => el.checked = false);
    }
    const nogoNone = document.querySelector('input[name="workNoGo"][value="特になし"]');
    if (nogoNone && nogoNone.checked) {
        document.querySelectorAll('input[name="workNoGo"]').forEach(el => { if (el !== nogoNone) el.checked = false; });
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    if (!validateStep(5)) return;

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '送信中...';

    const formData = new FormData(e.target);
    const jsonData = {};
    for (let [key, value] of formData.entries()) {
        if (jsonData[key]) {
            if (!Array.isArray(jsonData[key])) jsonData[key] = [jsonData[key]];
            jsonData[key].push(value);
        } else { jsonData[key] = value; }
    }

    try {
        await fetch(SUBMIT_URL, {
            method: 'POST',
            body: JSON.stringify(jsonData),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8' 
            },
            mode: 'no-cors',
            keepalive: true
        });
        localStorage.removeItem('hiringFormData');
        window.location.href = 'thanks.html';
    } catch (error) {
        alert('送信エラーです。お電話でご連絡ください。');
        btn.disabled = false;
    }
}