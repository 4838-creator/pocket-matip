// Firebase SDK (Module import)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, deleteDoc, query, orderBy, limit, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD4lZOXE2j0Tb6gKK9vLN6KOdezhJbB2dI",
    authDomain: "matip-app.firebaseapp.com",
    projectId: "matip-app",
    storageBucket: "matip-app.firebasestorage.app",
    messagingSenderId: "122476775686",
    appId: "1:122476775686:web:f8aa4ed3750206196af687",
    measurementId: "G-J2HVYCL0FS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Make services available globally
window.db = db;
window.FirestoreSDK = { collection, addDoc, getDocs, getDoc, doc, deleteDoc, query, orderBy, limit, Timestamp };

console.log("Firebase initialized successfully");

// ========== 状態管理 ==========
let mediaRecorder = null;
let audioChunks = [];
let startTime = null;
let timerInterval = null;
let isPaused = false;
let pausedTime = 0;
let uploadedImages = [];

// ========== タブ切り替え ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        switchTab(tabId);
    });
});

function switchTab(tabId) {
    // タブボタンの状態更新
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

    // パネルの表示切り替え
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`${tabId}-panel`).classList.add('active');
}

// ========== 録音機能 ==========
async function toggleRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        await startRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const player = document.getElementById('audioPlayer');
            player.src = url;
            player.classList.remove('hidden');
            processAudio();
        };

        mediaRecorder.start();
        startTime = Date.now();
        isPaused = false;
        pausedTime = 0;

        updateRecordingUI(true);
        timerInterval = setInterval(updateTimer, 1000);

    } catch (err) {
        alert('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
    }
}

function pauseRecording() {
    if (mediaRecorder?.state === 'recording') {
        mediaRecorder.pause();
        isPaused = true;
        pausedTime = Date.now() - startTime;
        clearInterval(timerInterval);

        document.getElementById('recordBtn').classList.remove('recording');
        document.getElementById('recordStatus').textContent = '一時停止中';
        document.getElementById('pauseBtn').classList.add('hidden');
        document.getElementById('resumeBtn').classList.remove('hidden');
        document.getElementById('waveform').classList.add('hidden');
    }
}

function resumeRecording() {
    if (mediaRecorder?.state === 'paused') {
        mediaRecorder.resume();
        isPaused = false;
        startTime = Date.now() - pausedTime;

        document.getElementById('recordBtn').classList.add('recording');
        document.getElementById('recordStatus').textContent = '録音中...';
        document.getElementById('resumeBtn').classList.add('hidden');
        document.getElementById('pauseBtn').classList.remove('hidden');
        document.getElementById('waveform').classList.remove('hidden');

        timerInterval = setInterval(updateTimer, 1000);
    }
}

function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        clearInterval(timerInterval);
        updateRecordingUI(false);
    }
}

function updateRecordingUI(isRecording) {
    const btn = document.getElementById('recordBtn');
    const status = document.getElementById('recordStatus');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const waveform = document.getElementById('waveform');

    if (isRecording) {
        btn.classList.add('recording');
        btn.innerHTML = '🎤';
        status.textContent = '録音中...';
        pauseBtn.classList.remove('hidden');
        stopBtn.classList.remove('hidden');
        waveform.classList.remove('hidden');
    } else {
        btn.classList.remove('recording');
        btn.innerHTML = '✓';
        status.textContent = '録音完了';
        pauseBtn.classList.add('hidden');
        stopBtn.classList.add('hidden');
        document.getElementById('resumeBtn').classList.add('hidden');
        waveform.classList.add('hidden');
    }
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    document.getElementById('recordTimer').textContent =
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ========== AI処理 ==========
// APIキーはサーバーサイド（Vercel Functions）で管理

async function processAudio() {
    document.getElementById('processingCard').classList.remove('hidden');
    const processingText = document.querySelector('.processing-text');

    try {
        // 1. Whisper APIで文字起こし（サーバー経由）
        processingText.textContent = "音声を文字に変換中...";

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Chrome等はwebm
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.webm");
        formData.append("model", "whisper-1");
        formData.append("language", "ja");

        const whisperResp = await fetch("/api/transcribe", {
            method: "POST",
            body: formData
        });

        if (!whisperResp.ok) throw new Error("Whisper API Error");
        const whisperData = await whisperResp.json();
        const transcript = whisperData.text;

        console.log("Transcript:", transcript);

        // 2. GPT-4o-miniで議事録生成（サーバー経由）
        processingText.textContent = "AIが議事録を作成中...";

        const systemPrompt = `
あなたはプロの営業アシスタントです。以下の商談の文字起こしテキストから、情報を抽出してJSON形式で出力してください。
JSONのフォーマットは以下に従ってください（必ず有効なJSONのみを返してください）。

{
  "customer": "顧客名（不明な場合は空文字）",
  "contact": "担当者名（不明な場合は空文字）",
  "project": "案件名（推測できる場合）",
  "summary": "商談の要約（3行程度）",
  "decisions": ["決定事項1", "決定事項2"],
  "todos": ["タスク1", "タスク2"],
  "keywords": ["キーワード1", "キーワード2"],
  "nextSchedule": "次回予定（日時など）"
}
`;

        const gptResp = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: transcript }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!gptResp.ok) throw new Error("GPT API Error");
        const gptData = await gptResp.json();
        const result = JSON.parse(gptData.choices[0].message.content);

        generateMinutes(result);

    } catch (error) {
        console.error(error);
        alert("AI処理中にエラーが発生しました: " + error.message);
    } finally {
        document.getElementById('processingCard').classList.add('hidden');
    }
}

function generateMinutes(data) {
    // フォームに自動入力
    if (data.customer) document.getElementById('customerName').value = data.customer;
    if (data.contact) document.getElementById('contactPerson').value = data.contact;
    if (data.project) document.getElementById('projectName').value = data.project;

    const now = new Date();
    const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 決定事項リスト
    const decisionsHtml = data.decisions && data.decisions.length > 0
        ? data.decisions.map(d => `<li>${d}</li>`).join('')
        : '<li>（特になし）</li>';

    // TODOリスト
    const todosHtml = data.todos && data.todos.length > 0
        ? data.todos.map(t => `<li>${t}</li>`).join('')
        : '<li>（特になし）</li>';

    // キーワード
    const keywordsHtml = data.keywords && data.keywords.length > 0
        ? data.keywords.map(k => `<span class="tag">${k}</span>`).join('')
        : '';

    // 次回予定
    const nextScheduleHtml = data.nextSchedule
        ? `<li>${data.nextSchedule}</li>`
        : '<li>（未定）</li>';

    // 議事録HTML生成
    const htmlContent = `
        <div class="minutes-item">
            <h4>📋 商談情報</h4>
            <ul>
                <li>顧客: ${data.customer || '（未入力）'}</li>
                <li>担当者: ${data.contact || '（未入力）'}</li>
                <li>案件: ${data.project || '（未入力）'}</li>
                <li>日時: ${dateStr}</li>
            </ul>
        </div>
        <div class="minutes-item">
            <h4>💡 要約</h4>
            <p style="font-size:14px; color:var(--text-secondary); line-height:1.6;">${data.summary}</p>
        </div>
        <div class="minutes-item">
            <h4>✅ 決定事項</h4>
            <ul>${decisionsHtml}</ul>
        </div>
        <div class="minutes-item">
            <h4>📝 宿題・TODO</h4>
            <ul>${todosHtml}</ul>
        </div>
        <div class="minutes-item">
            <h4>🏷️ キーワード</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${keywordsHtml}
            </div>
        </div>
        <div class="minutes-item">
            <h4>📅 次回予定</h4>
            <ul>${nextScheduleHtml}</ul>
        </div>
    `;

    document.getElementById('minutesContent').innerHTML = htmlContent;
    document.getElementById('minutesCard').classList.remove('hidden');
}

// ========== 画像アップロード ==========
function handleImageUpload(event) {
    const files = event.target.files;
    const preview = document.getElementById('imagePreview');

    for (const file of files) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImages.push(e.target.result);
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `
                    <img src="${e.target.result}" alt="添付画像">
                    <span class="preview-remove" onclick="removeImage(this)">×</span>
                `;
                preview.appendChild(div);
            };
            reader.readAsDataURL(file);
        }
    }
}

function removeImage(el) {
    const item = el.parentElement;
    const index = Array.from(item.parentElement.children).indexOf(item);
    uploadedImages.splice(index, 1);
    item.remove();
}

function openPhotoCapture() {
    switchTab('record');
    setTimeout(() => {
        document.getElementById('imageInput').click();
    }, 300);
}

// ========== タスク管理 ==========
function toggleTask(checkbox) {
    checkbox.classList.toggle('checked');
    const item = checkbox.closest('.task-item');
    const title = item.querySelector('.task-title');

    if (checkbox.classList.contains('checked')) {
        title.style.textDecoration = 'line-through';
        item.style.opacity = '0.6';
    } else {
        title.style.textDecoration = 'none';
        item.style.opacity = '1';
    }

    updateStats(); // 統計更新
}

function addTask() {
    const input = document.getElementById('newTaskInput');
    const priority = document.getElementById('taskPriority').value;
    const dueDate = document.getElementById('taskDueDate').value;

    if (!input.value.trim()) return;

    const priorityClass = `priority-${priority}`;
    const priorityText = priority === 'high' ? '高' : priority === 'medium' ? '中' : '低';
    const dateText = dueDate ? new Date(dueDate).toLocaleDateString('ja-JP') : '未設定';

    const li = document.createElement('li');
    li.className = 'task-item';
    li.innerHTML = `
        <div class="task-checkbox" onclick="toggleTask(this)"></div>
        <div class="task-content">
            <div class="task-title">${input.value}</div>
            <div class="task-meta">
                <span>📅 ${dateText}</span>
                <span class="task-priority ${priorityClass}">${priorityText}</span>
            </div>
        </div>
    `;

    document.getElementById('allTaskList').prepend(li);
    input.value = '';

    updateStats(); // 統計更新
}

// ========== クイックメモ ==========
function openQuickMemo() {
    document.getElementById('quickMemoModal').classList.remove('hidden');
}

function closeQuickMemo() {
    document.getElementById('quickMemoModal').classList.add('hidden');
}

async function saveQuickMemo() {
    const customer = document.getElementById('memoCustomer').value;
    const content = document.getElementById('memoContent').value;

    if (!content.trim()) {
        alert('メモ内容を入力してください');
        return;
    }

    try {
        // Firestoreに保存
        await window.FirestoreSDK.addDoc(window.FirestoreSDK.collection(window.db, "records"), {
            type: 'memo',
            customer: customer || 'メモ',
            content: content,
            createdAt: window.FirestoreSDK.Timestamp.now()
        });

        closeQuickMemo();
        document.getElementById('memoCustomer').value = '';
        document.getElementById('memoContent').value = '';

        alert('メモを保存しました');
        loadRecentRecords(); // リストを更新

    } catch (e) {
        console.error("Error adding document: ", e);
        alert('保存に失敗しました: ' + e.message);
    }
}

// ========== 検索 ==========
let searchTimeout = null;

document.getElementById('searchInput')?.addEventListener('input', function () {
    const queryText = this.value.trim();

    // デバウンス処理
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performSearch(queryText);
    }, 500);
});

function searchKeyword(keyword) {
    document.getElementById('searchInput').value = keyword;
    performSearch(keyword);
}

async function performSearch(queryText) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">検索中...</div>';

    if (!queryText) {
        // クエリがない場合は最近のものを表示
        performSearchQuery(window.FirestoreSDK.query(
            window.FirestoreSDK.collection(window.db, "records"),
            window.FirestoreSDK.orderBy("createdAt", "desc"),
            window.FirestoreSDK.limit(10)
        ));
        return;
    }

    try {
        // Firestoreでの検索（顧客名での前方一致）
        // ※本来は全文検索サービスが必要だが、簡易的に顧客名検索とする
        const q = window.FirestoreSDK.query(
            window.FirestoreSDK.collection(window.db, "records"),
            window.FirestoreSDK.orderBy("customer"),
            window.FirestoreSDK.startAt(queryText),
            window.FirestoreSDK.endAt(queryText + '\uf8ff'),
            window.FirestoreSDK.limit(20)
        );

        performSearchQuery(q);

    } catch (e) {
        console.error("Search error: ", e);
        resultsDiv.innerHTML = '<div style="text-align:center; color:var(--accent-danger);">検索エラーが発生しました<br><small>インデックス作成が必要な場合があります</small></div>';
    }
}

async function performSearchQuery(q) {
    const resultsDiv = document.getElementById('searchResults');

    try {
        const querySnapshot = await window.FirestoreSDK.getDocs(q);

        if (querySnapshot.empty) {
            resultsDiv.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">該当する記録はありません</div>';
            return;
        }

        resultsDiv.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate() : new Date();
            const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

            const div = document.createElement('div');
            div.className = 'history-item';

            let summary = '';
            let tags = '';

            if (data.type === 'memo') {
                summary = data.content;
                tags = '<span class="tag">メモ</span>';
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = data.content;
                summary = tempDiv.textContent.substring(0, 60) + '...';
                tags = `<span class="tag">商談</span><span class="tag">${data.project || '案件なし'}</span>`;
            }

            div.innerHTML = `
                <div class="history-header">
                    <span class="history-customer">${data.customer || '名称なし'}</span>
                    <span class="history-date">${dateStr}</span>
                </div>
                <div class="history-summary">${summary}</div>
                <div class="history-tags">
                    ${tags}
                </div>
            `;
            div.onclick = () => viewRecord(doc.id);
            resultsDiv.appendChild(div);
        });
    } catch (e) {
        console.error("Search query error: ", e);
        resultsDiv.innerHTML = '<div style="text-align:center; color:var(--accent-danger);">データの取得に失敗しました</div>';
    }
}

async function saveAndNew() {
    const customer = document.getElementById('customerName').value;
    const contact = document.getElementById('contactPerson').value;
    const project = document.getElementById('projectName').value;
    const content = document.getElementById('minutesContent').innerHTML;

    try {
        // Firestoreに保存
        await window.FirestoreSDK.addDoc(window.FirestoreSDK.collection(window.db, "records"), {
            type: 'negotiation',
            customer: customer,
            contact: contact,
            project: project,
            content: content,
            createdAt: window.FirestoreSDK.Timestamp.now(),
            // 将来的には音声や画像のURLもここに保存
            audioUrl: null,
            imageUrls: []
        });

        alert('商談記録を保存しました！');

        // リセット
        document.getElementById('minutesCard').classList.add('hidden');
        document.getElementById('audioPlayer').classList.add('hidden');
        document.getElementById('recordBtn').classList.remove('recording');
        document.getElementById('recordBtn').innerHTML = '🎤';
        document.getElementById('recordStatus').textContent = 'タップして録音開始';
        document.getElementById('recordTimer').textContent = '00:00';
        document.getElementById('customerName').value = '';
        document.getElementById('contactPerson').value = '';
        document.getElementById('projectName').value = '';
        document.getElementById('imagePreview').innerHTML = '';
        uploadedImages = [];
        audioChunks = [];
        mediaRecorder = null;

        loadRecentRecords(); // リストを更新

    } catch (e) {
        console.error("Error adding document: ", e);
        alert('保存に失敗しました: ' + e.message);
    }
}

// ========== データ読み込み ==========
async function loadRecentRecords() {
    const recordsDiv = document.getElementById('recentRecords');
    recordsDiv.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">読み込み中...</div>';

    try {
        const q = window.FirestoreSDK.query(
            window.FirestoreSDK.collection(window.db, "records"),
            window.FirestoreSDK.orderBy("createdAt", "desc"),
            window.FirestoreSDK.limit(20)
        );

        const querySnapshot = await window.FirestoreSDK.getDocs(q);

        if (querySnapshot.empty) {
            recordsDiv.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">記録はまだありません</div>';
            return;
        }

        recordsDiv.innerHTML = ''; // クリア

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate() : new Date();
            const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

            const div = document.createElement('div');
            div.className = 'history-item';

            // タイプに応じた表示内容
            let summary = '';
            let tags = '';

            if (data.type === 'memo') {
                summary = data.content;
                tags = '<span class="tag">メモ</span>';
            } else {
                // 議事録HTMLからテキストのみを簡易抽出（または保存時にsummaryも保存すべきだが、一旦これで）
                // contentはHTMLなので、タグを除去して先頭を表示
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = data.content;
                summary = tempDiv.textContent.substring(0, 60) + '...';

                // タグ抽出（仮の実装）
                tags = `<span class="tag">商談</span>`;
            }

            div.innerHTML = `
                <div class="history-header">
                    <span class="history-customer">${data.customer || '名称なし'}</span>
                    <span class="history-date">${dateStr}</span>
                </div>
                <div class="history-summary">${summary}</div>
                <div class="history-tags">
                    ${tags}
                </div>
            `;
            div.onclick = () => viewRecord(doc.id); // IDを渡す
            recordsDiv.appendChild(div);
        });

    } catch (e) {
        console.error("Error loading documents: ", e);
        recordsDiv.innerHTML = '<div style="text-align:center; color:var(--accent-danger);">読み込みに失敗しました</div>';
    }
}

// 初期化時に読み込み
loadRecentRecords();
updateStats();

// ========== 統計更新 ==========
async function updateStats() {
    try {
        // 本日の開始時刻と今週の開始時刻を計算
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = now.getDay();
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // 月曜開始

        // Firestoreから全記録を取得
        const q = window.FirestoreSDK.query(
            window.FirestoreSDK.collection(window.db, "records"),
            window.FirestoreSDK.orderBy("createdAt", "desc"),
            window.FirestoreSDK.limit(100)
        );
        const querySnapshot = await window.FirestoreSDK.getDocs(q);

        let todayCount = 0;
        let weekCount = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.createdAt) {
                const recordDate = data.createdAt.toDate();

                // 本日の記録
                if (recordDate >= todayStart) {
                    todayCount++;
                }

                // 今週の記録
                if (recordDate >= weekStart) {
                    weekCount++;
                }
            }
        });

        // 未完了タスク数（HTMLのタスクリストからカウント）
        const taskItems = document.querySelectorAll('#allTaskList .task-item');
        const pendingCount = Array.from(taskItems).filter(item =>
            !item.querySelector('.task-checkbox.checked')
        ).length;

        // UI更新
        document.getElementById('todayMeetings').textContent = todayCount;
        document.getElementById('pendingTasks').textContent = pendingCount;
        document.getElementById('weekRecords').textContent = weekCount;

        // バッジ更新
        const badge = document.getElementById('todayTaskBadge');
        if (badge) badge.textContent = pendingCount;

    } catch (e) {
        console.error("Error updating stats:", e);
    }
}

// 日付入力のデフォルト値設定
document.getElementById('taskDueDate').valueAsDate = new Date();

// グローバル関数をwindowに公開（onclickから呼び出されるため）
window.switchTab = switchTab;
window.toggleRecording = toggleRecording;
window.pauseRecording = pauseRecording;
window.resumeRecording = resumeRecording;
window.stopRecording = stopRecording;
window.handleImageUpload = handleImageUpload;
window.removeImage = removeImage;
window.openPhotoCapture = openPhotoCapture;
window.toggleTask = toggleTask;
window.addTask = addTask;
window.openQuickMemo = openQuickMemo;
window.closeQuickMemo = closeQuickMemo;
window.saveQuickMemo = saveQuickMemo;
window.searchKeyword = searchKeyword;
window.saveAndNew = saveAndNew;
window.editMinutes = () => alert('編集機能は開発中です');
window.shareMinutes = () => alert('共有機能は開発中です');

// ========== 記録詳細表示 ==========
let currentRecordId = null;

async function viewRecord(id) {
    currentRecordId = id;
    const modal = document.getElementById('recordDetailModal');
    const content = document.getElementById('recordDetailContent');
    const title = document.getElementById('recordDetailTitle');

    content.innerHTML = '<div style="text-align:center; padding:20px;">読み込み中...</div>';
    modal.classList.remove('hidden');

    try {
        const docRef = window.FirestoreSDK.doc(window.db, "records", id);
        const docSnap = await window.FirestoreSDK.getDoc(docRef);

        if (!docSnap.exists()) {
            content.innerHTML = '<div style="text-align:center; color:var(--accent-danger);">記録が見つかりません</div>';
            return;
        }

        const data = docSnap.data();
        const date = data.createdAt ? data.createdAt.toDate() : new Date();
        const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

        if (data.type === 'memo') {
            title.textContent = '📝 メモ詳細';
            content.innerHTML = `
                <div class="minutes-section" style="padding: 0;">
                    <div class="minutes-item">
                        <h4>👤 顧客名</h4>
                        <p>${data.customer || '（未設定）'}</p>
                    </div>
                    <div class="minutes-item">
                        <h4>📅 作成日時</h4>
                        <p>${dateStr}</p>
                    </div>
                    <div class="minutes-item">
                        <h4>📋 内容</h4>
                        <p style="white-space: pre-wrap;">${data.content}</p>
                    </div>
                </div>
            `;
        } else {
            title.textContent = '📋 商談記録詳細';
            content.innerHTML = `
                <div class="minutes-section" style="padding: 0;">
                    <div class="minutes-item">
                        <h4>👤 顧客名</h4>
                        <p>${data.customer || '（未設定）'}</p>
                    </div>
                    <div class="minutes-item">
                        <h4>👔 担当者</h4>
                        <p>${data.contact || '（未設定）'}</p>
                    </div>
                    <div class="minutes-item">
                        <h4>📁 案件名</h4>
                        <p>${data.project || '（未設定）'}</p>
                    </div>
                    <div class="minutes-item">
                        <h4>📅 作成日時</h4>
                        <p>${dateStr}</p>
                    </div>
                    <div class="minutes-item">
                        <h4>📝 内容</h4>
                        <div style="font-size: 14px; line-height: 1.6;">${data.content}</div>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        console.error("Error fetching record:", e);
        content.innerHTML = '<div style="text-align:center; color:var(--accent-danger);">読み込みに失敗しました</div>';
    }
}

function closeRecordDetail() {
    document.getElementById('recordDetailModal').classList.add('hidden');
    currentRecordId = null;
}

async function deleteRecord() {
    if (!currentRecordId) return;

    if (!confirm('この記録を削除しますか？')) return;

    try {
        const docRef = window.FirestoreSDK.doc(window.db, "records", currentRecordId);
        await window.FirestoreSDK.deleteDoc(docRef);

        alert('削除しました');
        closeRecordDetail();
        loadRecentRecords();
        updateStats();
    } catch (e) {
        console.error("Error deleting record:", e);
        alert('削除に失敗しました: ' + e.message);
    }
}

window.viewRecord = viewRecord;
window.closeRecordDetail = closeRecordDetail;
window.deleteRecord = deleteRecord;
