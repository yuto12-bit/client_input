// 設定: Google Apps ScriptのWebアプリURL
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbyeuFnAbLogFMUVnEMsRjeZKDbRoMCk3xYpv8Y3oI791Nmnt_iPGLPvQ7WIZN8h91S_Xw/exec'; 

// 業界データ定義
const industryData = {
    construction: {
        jobs: ["外構工事", "足場工事", "塗装工事", "土木作業", "解体工事", "現場管理（施工管理）", "電気工事", "水道工事", "その他"],
        workNoGo: ["高所作業", "営業・勧誘", "重機運転（資格者のみ）", "特になし（何でもやる）"],
        qualifications: ["普通免許（AT可）", "普通免許（MT必須）", "準中型・中型免許", "車両系建設機械", "職長・安衛責任者", "学歴不問", "未経験歓迎", "経験者優遇"],
        gbpCategories: ["建設会社", "工務店", "塗装店", "造園業者", "解体工事業者", "リフォーム業者", "電気工事業者", "水道工事業者", "その他"]
    },
    care: {
        jobs: ["介護職（ヘルパー）", "ケアマネジャー", "看護師・准看護師", "送迎ドライバー", "生活相談員", "調理スタッフ", "理学療法士(PT)/OT", "その他"],
        workNoGo: ["夜勤", "入浴介助", "送迎業務", "調理業務", "特になし"],
        qualifications: ["初任者研修（ヘルパー2級）", "実務者研修", "介護福祉士", "社会福祉士", "普通免許（AT可）", "資格なしOK（資格取得支援あり）", "学歴不問", "未経験歓迎"],
        gbpCategories: ["介護施設", "デイサービスセンター", "訪問介護ステーション", "老人ホーム", "グループホーム", "福祉センター", "その他"]
    },
    auto: {
        jobs: ["自動車整備士", "板金塗装スタッフ", "フロント・受付", "洗車・コーティング", "営業・販売", "ロードサービス隊員", "その他"],
        workNoGo: ["接客・電話対応", "納車・引取（運転）", "重整備（エンジン脱着等）", "特になし"],
        qualifications: ["3級自動車整備士", "2級自動車整備士", "1級自動車整備士", "自動車検査員", "普通免許（AT可）", "普通免許（MT必須）", "中型免許（積載車用）", "未経験歓迎"],
        gbpCategories: ["自動車整備工場", "板金塗装店", "中古車販売店", "自動車修理・メンテナンス", "タイヤショップ", "カーコーティング店", "その他"]
    }
};

// グローバル変数
let pendingStep = null;
let pendingEmptyFieldNames = []; // モーダル表示中の未入力項目名を一時保持

document.addEventListener('DOMContentLoaded', () => {
    initIndustry(); 
    loadFormData(); 
    setupEventListeners(); 
    setupDynamicListeners(); 
    updateProgress();
});

// 初期化：業界データの反映
function initIndustry() {
    const savedData = localStorage.getItem('hiringFormData');
    let target = 'construction';
    if(savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if(parsed.targetIndustry) target = parsed.targetIndustry;
        } catch(e) {
            console.warn('Industry data parse error', e);
        }
    }
    const select = document.getElementById('targetIndustry');
    if(select) {
        select.value = target;
        updateIndustryFields();
    }
}

// 業界に合わせて選択肢を書き換える関数
function updateIndustryFields() {
    const industry = document.getElementById('targetIndustry').value;
    const data = industryData[industry];
    if (!data) return;

    // 1. 募集職種の更新
    const jobSelect = document.getElementById('jobType');
    if(jobSelect) {
        jobSelect.innerHTML = '<option value="" disabled selected>選択してください</option>';
        data.jobs.forEach(job => {
            const option = document.createElement('option');
            option.value = job;
            option.textContent = job;
            jobSelect.appendChild(option);
        });
    }

    // 2. 「やらない作業」の更新
    const noGoContainer = document.getElementById('workNoGoContainer');
    if(noGoContainer) {
        noGoContainer.innerHTML = '';
        data.workNoGo.forEach(item => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" name="workNoGo" value="${item}"> ${item}`;
            noGoContainer.appendChild(label);
        });
    }

    // 3. 応募資格の更新
    const qualContainer = document.getElementById('qualificationContainer');
    if(qualContainer) {
        qualContainer.innerHTML = '';
        data.qualifications.forEach(item => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" name="qualification" value="${item}"> ${item}`;
            qualContainer.appendChild(label);
        });
    }

    // 4. GBPカテゴリの更新
    const gbpSelect = document.getElementById('gbpPrimaryCategory');
    if(gbpSelect) {
        gbpSelect.innerHTML = '<option value="" disabled selected>選択してください</option>';
        data.gbpCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            gbpSelect.appendChild(option);
        });
    }

    const jobOtherInput = document.getElementById('jobTypeOther');
    if(jobOtherInput) jobOtherInput.style.display = 'none';
}

function setupEventListeners() {
    // 業界選択の変更監視
    const industrySelect = document.getElementById('targetIndustry');
    if (industrySelect) {
        industrySelect.addEventListener('change', () => {
            updateIndustryFields();
            setupDynamicListeners();
            saveFormData();
            updateProgress();
        });
    }

    // 職種「その他」
    const jobTypeSelect = document.getElementById('jobType');
    if (jobTypeSelect) {
        jobTypeSelect.addEventListener('change', (e) => {
            const otherInput = document.getElementById('jobTypeOther');
            if(otherInput) otherInput.style.display = e.target.value === 'その他' ? 'block' : 'none';
            saveFormData();
        });
    }

    // 保険の排他制御（固定要素なのでここで登録）
    setupExclusiveNone('insurance', 'なし');

    // その他固定要素のイベント
    const insuranceToggle = document.getElementById('insuranceConditionToggle');
    if (insuranceToggle) {
        insuranceToggle.addEventListener('change', (e) => {
            toggleInsuranceCondition(e.target.checked);
            saveFormData();
        });
    }
    document.querySelectorAll('input[name="contractType"]').forEach(r => r.addEventListener('change', (e) => {
        toggleContract(e.target.value === '有期', {save: true});
    }));
    document.querySelectorAll('input[name="fixedOvertime"]').forEach(r => r.addEventListener('change', (e) => {
        toggleFixedOvertime(e.target.value === 'あり', {save: true});
    }));
    const mailSelect = document.getElementById('gbpMailReceivable');
    if (mailSelect) {
        mailSelect.addEventListener('change', (e) => {
            const warn = document.getElementById('mailWarning');
            if(warn) warn.style.display = e.target.value === '届かない' ? 'block' : 'none';
        });
    }
    
    // Step1 GBP認証状況監視
    document.querySelectorAll('input[name="gbpVerifiedStatus"]').forEach(r => r.addEventListener('change', (e) => {
        toggleAddressArea(e.target.value === '完了済み', {save: true});
    }));

    // フォーム全体の変更監視
    const form = document.getElementById('hiringForm');
    form.addEventListener('change', () => { saveFormData(); updateProgress(); });
    form.addEventListener('input', () => { saveFormData(); updateProgress(); });
    form.addEventListener('submit', handleSubmit);
}

// 動的要素（書き換わる部分）へのイベント登録
function setupDynamicListeners() {
    // NG作業の排他制御
    setupExclusiveNone('workNoGo', '特になし');
    setupExclusiveNone('workNoGo', '特になし（何でもやる）');
}

// UI制御関数
function toggleInsuranceCondition(isChecked) {
    const input = document.getElementById('insuranceCondition');
    if(input) {
        input.style.display = isChecked ? 'block' : 'none';
        if (!isChecked) input.value = '';
    }
}
window.toggleProbation = function(isYes, opts = { save: true }) {
    const wrap = document.getElementById('probationDetails');
    if(wrap) {
        wrap.style.display = isYes ? 'block' : 'none';
        if (!isYes) {
            const p = document.querySelector('input[name="probationPeriod"]');
            const c = document.querySelector('input[name="probationCondition"]');
            if(p) p.value=''; if(c) c.value='';
        }
    }
    if (opts.save) saveFormData();
    updateProgress();
};

window.toggleContract = function(isLimited, opts = { save: true }) {
    const wrap = document.getElementById('contractDetails');
    if(wrap) {
        wrap.style.display = isLimited ? 'block' : 'none';
        
        const limitInput = document.getElementById('renewalLimit');
        if (limitInput) {
            if (isLimited) {
                limitInput.setAttribute('data-critical', 'true');
            } else {
                limitInput.removeAttribute('data-critical');
            }
        }

        if (!isLimited) {
            const s = document.querySelector('input[name="contractStartDate"]');
            const e = document.querySelector('input[name="contractEndDate"]');
            if(s) s.value=''; if(e) e.value='';
        }
    }
    if (opts.save) saveFormData();
    updateProgress();
};
window.toggleFixedOvertime = function(has, opts = { save: true }) {
    const wrap = document.getElementById('overtimeDetails');
    if(wrap) {
        wrap.style.display = has ? 'block' : 'none';
        if (!has) {
            const h = document.querySelector('input[name="fixedOvertimeHours"]');
            const a = document.querySelector('input[name="fixedOvertimeAmount"]');
            if(h) h.value=''; if(a) a.value='';
        }
    }
    if (opts.save) saveFormData();
    updateProgress();
};

// 【改修】GBP有無に応じて「動画認証」「郵送確認」も制御する
window.toggleGbpInput = function(exists, opts = { save: true }) {
    // 1. 既存マップURL入力欄
    const existingWrap = document.getElementById('gbpExistingDetails');
    if (existingWrap) existingWrap.style.display = exists ? 'block' : 'none';
    const u = document.querySelector('input[name="gbpMapUrl"]');
    if (!exists && u) u.value = '';
    
    // 2. 動画認証エリア (ID: gbpVideoArea)
    const videoArea = document.getElementById('gbpVideoArea');
    if (videoArea) videoArea.style.display = exists ? 'none' : 'block';
    
    // 3. 郵送確認エリア (ID: gbpMailArea)
    const mailArea = document.getElementById('gbpMailArea');
    const mailSelect = document.getElementById('gbpMailReceivable');
    if (mailArea) mailArea.style.display = exists ? 'none' : 'block';

    // 4. バリデーション回避用のダミー値セット/クリア
    if (exists) {
        // 既存ありの場合：動画・郵送は不要 -> ダミー値をセットして必須解除
        // 動画はラジオボタンなので選択を外す or 無視（ラジオは必須属性がないので放置でもOKだが、一応）
        const videos = document.querySelectorAll('input[name="gbpVideoVerificationPossible"]');
        videos.forEach(v => v.checked = false); // クリア
        
        // 郵送確認は必須(data-critical)なので、属性を外して値を埋める
        if (mailSelect) {
            mailSelect.removeAttribute('data-critical');
            // valueにダミーを入れておかないと、戻ったときに未選択に見えるが
            // hiddenなのでユーザーは見えない。submit時は空文字だと困る？
            // GAS側が空文字許容ならいいが、一応埋める
            // selectなので、optionにない値は入れにくいが、value強制書き換え
            // または、<option value="不要" selected> を動的追加する手もあるが
            // ここではシンプルに required 属性(data-critical)を外すだけで、値は空で送る
            // もしGAS側で必須チェックしてるなら「不明」などを選ばせる必要がある
            // 安全策：data-criticalを外せば handleSubmit でのエラーは出ない
            mailSelect.value = ""; // リセット
        }
    } else {
        // 既存なし(or不明)の場合：表示して必須化
        if (mailSelect) {
            mailSelect.setAttribute('data-critical', 'true');
        }
    }

    if (opts.save) saveFormData();
    updateProgress();
};

window.toggleAddressArea = function(isVerified, opts = { save: true }) {
    const area = document.getElementById('addressInputArea');
    const zip = document.querySelector('input[name="zipCode"]');
    const addr = document.querySelector('input[name="address"]');

    if (area) {
        area.style.display = isVerified ? 'none' : 'block';
    }

    if (isVerified) {
        if(zip) {
            zip.removeAttribute('data-critical');
            zip.value = "【認証済み】";
        }
        if(addr) {
            addr.removeAttribute('data-critical');
            addr.value = "【認証済みのため不要】";
        }
    } else {
        if(zip) {
            zip.setAttribute('data-critical', 'true');
            if(zip.value === "【認証済み】") zip.value = "";
        }
        if(addr) {
            addr.setAttribute('data-critical', 'true');
            if(addr.value === "【認証済みのため不要】") addr.value = "";
        }
    }

    if (opts.save) saveFormData();
    updateProgress();
};

// 排他制御ロジック
function setupExclusiveNone(groupName, noneValue) {
    const boxes = [...document.querySelectorAll(`input[name="${groupName}"]`)];
    if (boxes.length === 0) return;
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

// 進捗バー
function updateProgress() {
    const activeSection = document.querySelector('.form-section.active');
    if (!activeSection) return;
    const inputs = [...activeSection.querySelectorAll('input, select, textarea')].filter(el => {
        return el.offsetParent !== null && el.type !== 'hidden';
    });
    if (inputs.length === 0) return;
    let filledCount = 0;
    const uniqueNames = new Set(inputs.map(i => i.name));
    uniqueNames.forEach(name => {
        const els = document.querySelectorAll(`[name="${name}"]`);
        const visibleEls = [...els].filter(el => el.offsetParent !== null);
        if (visibleEls.length === 0) return;
        let isFilled = false;
        if (visibleEls[0].type === 'radio' || visibleEls[0].type === 'checkbox') {
            isFilled = visibleEls.some(el => el.checked);
        } else {
            isFilled = visibleEls.some(el => el.value.trim() !== '');
        }
        if (isFilled) filledCount++;
    });
    const percent = Math.round((filledCount / uniqueNames.size) * 100);
    const pText = document.getElementById('progressPercent');
    const pFill = document.getElementById('progressFill');
    if(pText) pText.textContent = `${percent}%`;
    if(pFill) pFill.style.width = `${percent}%`;
}

// ページ遷移
window.tryNextStep = function(targetStep) {
    const currentStep = targetStep - 1;
    const emptyFields = getEmptyFields(currentStep);
    if (emptyFields.length > 0) {
        showModal(emptyFields, targetStep);
    } else {
        goToStep(targetStep);
    }
};
window.prevStep = function(stepNum) { goToStep(stepNum); };

function goToStep(stepNum) {
    document.querySelectorAll('.form-section').forEach(el => el.classList.remove('active'));
    const ts = document.getElementById(`section-${stepNum}`);
    if(ts) ts.classList.add('active');
    document.querySelectorAll('.step').forEach((el, index) => {
        if (index + 1 === stepNum) el.classList.add('active');
        else el.classList.remove('active');
    });
    window.scrollTo(0, 0);
    updateProgress();
}

function getEmptyFields(stepNum) {
    const section = document.getElementById(`section-${stepNum}`);
    if(!section) return [];
    const inputs = [...section.querySelectorAll('input, select, textarea')].filter(el => el.offsetParent !== null && el.type !== 'hidden');
    const uniqueNames = new Set(inputs.map(i => i.name));
    const rawEmptyList = [];

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
            let label = "不明な項目";
            const parent = els[0].closest('.form-group');
            if (parent) {
                const labelEl = parent.querySelector('label');
                if (labelEl) label = labelEl.childNodes[0].textContent.trim();
            }
            rawEmptyList.push({ name: name, label: label });
        }
    });

    return rawEmptyList;
}

function showModal(fields, targetStepNum) {
    const modal = document.getElementById('confirmModal');
    const list = document.getElementById('modalList');
    pendingEmptyFieldNames = fields.map(f => f.name);
    const seenLabels = new Set();
    const uniqueLabels = [];
    fields.forEach(f => {
        if (!seenLabels.has(f.label)) {
            seenLabels.add(f.label);
            uniqueLabels.push(f.label);
        }
    });
    if(list) list.innerHTML = uniqueLabels.map(label => `<div>• ${label}</div>`).join('');
    pendingStep = targetStepNum;
    if(modal) modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('confirmModal');
    if(modal) modal.style.display = 'none';
    pendingStep = null;
    pendingEmptyFieldNames = [];
}

function getSafeStoredList(key) {
    try {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : [];
    } catch (e) {
        console.warn(`Error parsing ${key} from localStorage`, e);
        return [];
    }
}

function confirmNext() {
    if (pendingStep) {
        let skippedList = getSafeStoredList('hiringFormSkipped');
        skippedList = [...new Set([...skippedList, ...pendingEmptyFieldNames])];
        localStorage.setItem('hiringFormSkipped', JSON.stringify(skippedList));
        goToStep(pendingStep);
        closeModal();
    }
}

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
    try {
        const dataStr = localStorage.getItem('hiringFormData');
        if (!dataStr) return;
        const data = JSON.parse(dataStr);
        const form = document.getElementById('hiringForm');

        Object.entries(data).forEach(([name, value]) => {
            if (name === 'targetIndustry') return;
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

        const jobType = document.getElementById('jobType');
        const jobOther = document.getElementById('jobTypeOther');
        if (jobType && jobType.value === 'その他' && jobOther) jobOther.style.display = 'block';
        const insToggle = document.getElementById('insuranceConditionToggle');
        if (insToggle) toggleInsuranceCondition(insToggle.checked);
        const probChecked = document.querySelector('input[name="probation"]:checked');
        if (probChecked) toggleProbation(probChecked.value === 'あり', { save: false });
        const contractChecked = document.querySelector('input[name="contractType"]:checked');
        if (contractChecked) toggleContract(contractChecked.value === '有期', { save: false });
        const overtimeChecked = document.querySelector('input[name="fixedOvertime"]:checked');
        if (overtimeChecked) toggleFixedOvertime(overtimeChecked.value === 'あり', { save: false });
        const gbpChecked = document.querySelector('input[name="gbpExists"]:checked');
        
        // 【修正】GBP表示状態の復元
        if (gbpChecked) toggleGbpInput(gbpChecked.value === 'はい', { save: false });
        
        const verifiedChecked = document.querySelector('input[name="gbpVerifiedStatus"]:checked');
        if (verifiedChecked) toggleAddressArea(verifiedChecked.value === '完了済み', {save: false});
        
    } catch(e) {
        console.warn('Error loading form data', e);
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    // 重要項目の最終チェック
    const criticals = form.querySelectorAll('[data-critical="true"]');
    let criticalError = false;
    criticals.forEach(el => { 
        if (el.offsetParent !== null && !el.value.trim()) criticalError = true; 
    });
    if (criticalError) {
        alert('【重要】連絡先などの必須項目が未入力です。確認してください。');
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '送信中...';

    const skippedList = getSafeStoredList('hiringFormSkipped');
    const formData = new FormData(e.target);
    const jsonData = {};
    for (let [key, value] of formData.entries()) {
        if (jsonData[key]) {
            if (!Array.isArray(jsonData[key])) jsonData[key] = [jsonData[key]];
            jsonData[key].push(value);
        } else { jsonData[key] = value; }
    }
    
    Object.keys(jsonData).forEach(key => {
        if (Array.isArray(jsonData[key])) jsonData[key] = jsonData[key].join(', ');
    });

    [...form.elements].forEach(el => {
        if (el.name && !jsonData[el.name] && el.type !== 'submit' && el.type !== 'button') {
            if (skippedList.includes(el.name) || el.offsetParent !== null) {
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
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            mode: 'no-cors',
            keepalive: true
        });
        localStorage.removeItem('hiringFormData');
        localStorage.removeItem('hiringFormSkipped'); 
        window.location.href = 'thanks.html'; 
    } catch (error) {
        alert('送信エラーです。お電話でご連絡ください。');
        btn.disabled = false;
        btn.textContent = 'すべて送信する';
    }
}