// 設定: Google Apps ScriptのWebアプリURL
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbxOIRjnGB5xflKCq6zah8h_XjMHndrYQka4oMVJaoBuG8afypfrHXmT4bI5MPJPIoxDSw/exec'; 

document.addEventListener('DOMContentLoaded', () => {
    loadFormData(); // LocalStorageから復元
    setupEventListeners();
    
    // 排他制御（「なし」を選んだら他を消す）
    setupExclusiveNone('insurance', 'なし');
    
    // 免許系3つだけを排他制御（学歴不問などは巻き込まない）
    setupExclusiveValues('qualification', ['普通免許（AT可）', '普通免許（AT不可）', '免許不要']);
});

function setupEventListeners() {
    // 職種「その他」の表示切り替え
    const jobTypeSelect = document.getElementById('jobType');
    jobTypeSelect.addEventListener('change', (e) => {
        const otherInput = document.getElementById('jobTypeOther');
        otherInput.style.display = e.target.value === 'その他' ? 'block' : 'none';
        if (e.target.value === 'その他') otherInput.focus();
    });

    // 保険条件の表示切り替え＋必須化制御
    const insuranceToggle = document.getElementById('insuranceConditionToggle');
    insuranceToggle.addEventListener('change', (e) => {
        toggleInsuranceCondition(e.target.checked);
        saveFormData(); // 状態変化を保存
    });

    // フォーム入力時にLocalStorageへ保存
    const form = document.getElementById('hiringForm');
    form.addEventListener('change', saveFormData);
    form.addEventListener('input', saveFormData);

    // 送信処理
    form.addEventListener('submit', handleSubmit);
}

// 保険条件の表示・必須切り替えヘルパー
function toggleInsuranceCondition(isChecked) {
    const input = document.getElementById('insuranceCondition');
    input.style.display = isChecked ? 'block' : 'none';
    
    if (isChecked) {
        input.setAttribute('required', 'true');
    } else {
        input.removeAttribute('required');
        input.value = ''; // OFFにしたら値もクリア
    }
}

// 排他制御（特定のグループ内でのみ排他）
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

// 排他制御（「なし」全消し型）
function setupExclusiveNone(groupName, noneValue='なし') {
    const boxes = [...document.querySelectorAll(`input[name="${groupName}"]`)];
    const noneBox = boxes.find(b => b.value === noneValue);
    if (!noneBox) return;

    boxes.forEach(b => {
        b.addEventListener('change', () => {
            if (b === noneBox && noneBox.checked) {
                boxes.filter(x => x !== noneBox).forEach(x => x.checked = false);
            }
            if (b !== noneBox && b.checked) {
                noneBox.checked = false;
            }
            saveFormData();
        });
    });
}

// ステップ切り替え
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

// チェックボックス必須判定用関数
function requireAtLeastOne(name, message) {
    const checked = document.querySelectorAll(`input[name="${name}"]:checked`).length;
    if (checked === 0) {
        alert(message);
        return false;
    }
    return true;
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

    // 給与レンジチェック (Step 2)
    if (currentStep === 2) {
        const min = parseInt(document.getElementById('salaryMin').value);
        const max = parseInt(document.getElementById('salaryMax').value);
        if (min > max) {
            alert('給与の最低額が最高額を上回っています。');
            return false;
        }
    }

    // Step 3でのチェックボックス必須チェック
    if (currentStep === 3) {
        if (!requireAtLeastOne('insurance', '社会保険（加入状況）は最低1つ選択してください。「なし」の場合は「なし」を選択してください。')) return false;
        if (!requireAtLeastOne('qualification', '応募資格・免許は最低1つ選択してください。「免許不要」等の場合はそちらを選択してください。')) return false;
    }

    return isValid;
}

// 試用期間「あり」のとき詳細を必須化（保存フラグ付き）
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
        period.value = ''; 
        cond.value = '';
    }
    
    // 復元中は保存しない制御
    if (opts.save) saveFormData();
};

// localStorage（保存）
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

// localStorage（復元）
function loadFormData() {
    const dataStr = localStorage.getItem('hiringFormData');
    if (!dataStr) return;
    
    const data = JSON.parse(dataStr);
    const form = document.getElementById('hiringForm');

    // 1. ループで値を入れ込む（この段階では順序によりゴミが残る可能性がある）
    Object.entries(data).forEach(([name, value]) => {
        const els = form.querySelectorAll(`[name="${name}"]`);
        if (!els.length) return;

        // Checkbox
        if (Array.isArray(value)) {
            els.forEach(el => {
                el.checked = value.includes(el.value);
            });
            return;
        }

        // Radio
        if (els[0].type === 'radio') {
            els.forEach(el => {
                el.checked = (el.value === value);
            });
            return;
        }

        // Text, Select
        if (els[0]) els[0].value = value;
    });
    
    // 職種「その他」の復元
    const jobType = document.getElementById('jobType');
    if(jobType && jobType.value === 'その他') {
        const other = document.getElementById('jobTypeOther');
        if(other) other.style.display = 'block';
    }

    // 修正：復元ループ完了後に、UI状態を強制同期させてゴミデータを焼却する
    
    // A. 保険条件UIの最終確定（トグルがOFFなら値を消す）
    const insuranceToggle = document.getElementById('insuranceConditionToggle');
    if (insuranceToggle) {
        toggleInsuranceCondition(insuranceToggle.checked);
    }

    // B. 試用期間UIの最終確定（「なし」なら値を消す、復元中は保存しない）
    const probationChecked = document.querySelector('input[name="probation"]:checked');
    // ラジオボタンが未選択の場合は「なし(false)」として処理
    if (probationChecked) {
        toggleProbation(probationChecked.value === 'あり', { save: false });
    } else {
        toggleProbation(false, { save: false });
    }

    normalizeFormData();
    
    // 最後にきれいになった状態で保存同期
    saveFormData();
}

// データ整合性の強制補正
function normalizeFormData() {
    // 1. 保険：「なし」がONなら他をOFF
    const insuranceNone = document.querySelector('input[name="insurance"][value="なし"]');
    if (insuranceNone && insuranceNone.checked) {
        document.querySelectorAll('input[name="insurance"]').forEach(el => {
            if (el !== insuranceNone) el.checked = false;
        });
    }

    // 2. 資格：免許系排他グループが複数ONなら1つに絞る（最後尾優先）
    const licenseTypes = new Set(['普通免許（AT可）', '普通免許（AT不可）', '免許不要']);
    const checkedLicenses = [...document.querySelectorAll('input[name="qualification"]:checked')]
        .filter(el => licenseTypes.has(el.value));

    if (checkedLicenses.length > 1) {
        const keep = checkedLicenses.pop(); 
        checkedLicenses.forEach(el => el.checked = false);
    }
}

// 送信処理（no-cors・堅牢性重視）
async function handleSubmit(e) {
    e.preventDefault();
    
    if (!validateStep(3)) return;

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '送信中...';

    const form = e.target;
    const formData = new FormData(form);
    const jsonData = {};

    for (let [key, value] of formData.entries()) {
        if (jsonData[key]) {
            if (!Array.isArray(jsonData[key])) {
                jsonData[key] = [jsonData[key]];
            }
            jsonData[key].push(value);
        } else {
            jsonData[key] = value;
        }
    }

    try {
        await fetch(SUBMIT_URL, {
            method: 'POST',
            body: JSON.stringify(jsonData),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', 
            },
            mode: 'no-cors',
            keepalive: true
        });

        localStorage.removeItem('hiringFormData');
        window.location.href = 'thanks.html';

    } catch (error) {
        console.error(error);
        alert('送信に失敗しました。\n通信環境を確認するか、お電話でご連絡ください。');
        btn.disabled = false;
        btn.textContent = '送信する';
    }
}