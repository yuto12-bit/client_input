// 設定: Google Apps ScriptのWebアプリURL
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbyeuFnAbLogFMUVnEMsRjeZKDbRoMCk3xYpv8Y3oI791Nmnt_iPGLPvQ7WIZN8h91S_Xw/exec'; 

// グローバル変数
let pendingStep = null;

document.addEventListener('DOMContentLoaded', () => {
    loadFormData();
    setupEventListeners();
    updateProgress();
    
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

    // 保存・進捗更新イベント
    const form = document.getElementById('hiringForm');
    form.addEventListener('change', () => { saveFormData(); updateProgress(); });
    form.addEventListener('input', () => { saveFormData(); updateProgress(); });
    form.addEventListener('submit', handleSubmit);
}

// UI制御関数群
function toggleInsuranceCondition(isChecked) {
    const input = document.getElementById('insuranceCondition');
    input.style.display = isChecked ? 'block' : 'none';
    if (!isChecked) input.value = '';
}

window.toggleProbation = function(isYes, opts = { save: true }) {
    const wrap = document.getElementById('probationDetails');
    wrap.style.display = isYes ? 'block' : 'none';
    if (!isYes) {
        const period = document.querySelector('input[name="probationPeriod"]');
        const cond = document.querySelector('input[name="probationCondition"]');
        if(period) period.value = ''; 
        if(cond) cond.value = '';
    }
    if (opts.save) saveFormData();
    updateProgress();
};

window.toggleContract = function(isLimited, opts = { save: true }) {
    const wrap = document.getElementById('contractDetails');
    wrap.style.display = isLimited ? 'block' : 'none';
    if (!isLimited) {
        const start = document.querySelector('input[name="contractStartDate"]');
        const end = document.querySelector('input[name="contractEndDate"]');
        if(start) start.value = '';
        if(end) end.value = '';
    }
    if (opts.save) saveFormData();
    updateProgress();
};

window.toggleFixedOvertime = function(has, opts = { save: true }) {
    const wrap = document.getElementById('overtimeDetails');
    wrap.style.display = has ? 'block' : 'none';
    if (!has) {
        const hours = document.querySelector('input[name="fixedOvertimeHours"]');
        const amount = document.querySelector('input[name="fixedOvertimeAmount"]');
        if(hours) hours.value = ''; 
        if(amount) amount.value = '';
    }
    if (opts.save) saveFormData();
    updateProgress();
};

// GBP条件分岐
window.toggleGbpInput = function(exists, opts = { save: true }) {
    const wrap = document.getElementById('gbpExistingDetails');
    if (wrap) wrap.style.display = exists ? 'block' : 'none';

    const urlInput = document.querySelector('input[name="gbpMapUrl"]');
    if (!exists && urlInput) {
        urlInput.value = '';
    }
    if (opts.save) saveFormData();
    updateProgress();
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
            updateProgress();
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
            updateProgress();
        });
    });
}

// 進捗計算（%表示）
function updateProgress() {
    const activeSection = document.querySelector('.form-section.active');
    if (!activeSection) return;

    // 現在表示されている入力項目を収集
    const inputs = [...activeSection.querySelectorAll('input, select, textarea')].filter(el => {
        // 非表示の親要素を持つ場合は除外
        return el.offsetParent !== null && el.type !== 'hidden';
    });

    if (inputs.length === 0) return;

    let filledCount = 0;
    const uniqueNames = new Set(inputs.map(i => i.name));
    
    uniqueNames.forEach(name => {
        const els = document.querySelectorAll(`[name="${name}"]`);
        // 可視状態のものだけチェック
        const visibleEls = [...els].filter(el => el.offsetParent !== null);
        if (visibleEls.length === 0) return;

        let isFilled = false;
        const type = visibleEls[0].type;

        if (type === 'radio' || type === 'checkbox') {
            isFilled = visibleEls.some(el => el.checked);
        } else {
            isFilled = visibleEls.some(el => el.value.trim() !== '');
        }

        if (isFilled) filledCount++;
    });

    const percent = Math.round((filledCount / uniqueNames.size) * 100);
    document.getElementById('progressPercent').textContent = `${percent}%`;
    document.getElementById('progressFill').style.width = `${percent}%`;
}

// ステップ移動（ソフトバリデーション付き）
window.tryNextStep = function(targetStep) {
    const currentStep = targetStep - 1;
    const emptyFields = getEmptyFields(currentStep);

    if (emptyFields.length > 0) {
        // モーダル表示
        showModal(emptyFields, targetStep);
    } else {
        // そのまま進む
        goToStep(targetStep);
    }
};

window.prevStep = function(stepNum) {
    goToStep(stepNum);
};

function goToStep(stepNum) {
    document.querySelectorAll('.form-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`section-${stepNum}`).classList.add('active');
    document.querySelectorAll('.step').forEach((el, index) => {
        if (index + 1 === stepNum) el.classList.add('active');
        else el.classList.remove('active');
    });
    window.scrollTo(0, 0);
    updateProgress();
}

// 未入力項目の検出
function getEmptyFields(stepNum) {
    const section = document.getElementById(`section-${stepNum}`);
    const inputs = [...section.querySelectorAll('input, select, textarea')].filter(el => el.offsetParent !== null && el.type !== 'hidden');
    const uniqueNames = new Set(inputs.map(i => i.name));
    const emptyList = [];

    uniqueNames.forEach(name => {
        const els = [...document.querySelectorAll(`[name="${name}"]`)].filter(el => el.offsetParent !== null);
        if (els.length === 0) return;

        let isFilled = false;
        if (els[0].type === 'radio' || els[0].type === 'checkbox') {
            isFilled = els.some(el => el.checked);
        } else {
            isFilled = els.some(el => el.value.trim() !== '');
        }

        if (!isFilled) {
            // ラベル取得
            let label = "不明な項目";
            const parent = els[0].closest('.form-group');
            if (parent) {
                const labelEl = parent.querySelector('label');
                if (labelEl) label = labelEl.childNodes[0].textContent.trim();
            }
            emptyList.push(label);
        }
    });
    return emptyList;
}

// モーダル制御
function showModal(fields, targetStepNum) {
    const modal = document.getElementById('confirmModal');
    const list = document.getElementById('modalList');
    list.innerHTML = fields.map(f => `<div>• ${f}</div>`).join('');
    pendingStep = targetStepNum;
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('confirmModal').style.display = 'none';
    pendingStep = null;
}

function confirmNext() {
    if (pendingStep) {
        goToStep(pendingStep);
        closeModal();
    }
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

    // UI状態復元
    const jobType = document.getElementById('jobType');
    if (jobType && jobType.value === 'その他') document.getElementById('jobTypeOther').style.display = 'block';

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
}

async function handleSubmit(e) {
    e.preventDefault();
    
    // 最終ステップの未入力チェック
    const emptyFields = getEmptyFields(5);
    
    // 重要項目の最終チェック
    const form = e.target;
    const criticals = form.querySelectorAll('[data-critical="true"]');
    let criticalError = false;
    criticals.forEach(el => {
        if (!el.value.trim()) criticalError = true;
    });

    if (criticalError) {
        alert('【重要】連絡先などの必須項目が未入力です。確認してください。');
        return;
    }

    // 未入力でも許可して送信
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '送信中...';

    const formData = new FormData(e.target);
    const jsonData = {};
    
    // データ整形：未入力は自動で「不明」にする
    for (let [key, value] of formData.entries()) {
        if (jsonData[key]) {
            if (!Array.isArray(jsonData[key])) jsonData[key] = [jsonData[key]];
            jsonData[key].push(value);
        } else { 
            jsonData[key] = value; 
        }
    }

    // ★重要改修: 配列データをカンマ区切りの文字列に変換
    // これにより、複数選択チェックボックスの値をGASが正しく受け取れるようになります
    Object.keys(jsonData).forEach(key => {
        if (Array.isArray(jsonData[key])) {
            jsonData[key] = jsonData[key].join(', ');
        }
    });

    // 全フィールドをチェックして空なら補完
    [...form.elements].forEach(el => {
        if (el.name && !jsonData[el.name] && el.type !== 'submit' && el.type !== 'button') {
            if (el.offsetParent !== null) {
                jsonData[el.name] = "【不明・後で確認】";
            } else {
                jsonData[el.name] = "";
            }
        }
    });

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
        btn.textContent = 'すべて送信する';
    }
}