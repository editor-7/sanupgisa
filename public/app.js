let quiz = null;
let exams = [];
let selectedExamId = "";
let currentIndex = 0;
let selected = null;
let solved = 0;
let correctCount = 0;
let autoReadMode = false;
let autoReadTimer = null;

const el = {
  meta: document.getElementById("meta"),
  examSelect: document.getElementById("exam-select"),
  qNumber: document.getElementById("q-number"),
  qText: document.getElementById("q-text"),
  options: document.getElementById("options"),
  feedback: document.getElementById("feedback"),
  explanation: document.getElementById("explanation"),
  progress: document.getElementById("progress"),
  score: document.getElementById("score"),
  prevBtn: document.getElementById("prev-btn"),
  checkBtn: document.getElementById("check-btn"),
  nextBtn: document.getElementById("next-btn"),
  jumpInput: document.getElementById("jump-input"),
  jumpBtn: document.getElementById("jump-btn"),
  readBtn: document.getElementById("read-btn"),
  autoReadBtn: document.getElementById("auto-read-btn"),
  speakAnswer: document.getElementById("speak-answer"),
  readGap: document.getElementById("read-gap")
};

function clearAutoReadTimer() {
  if (!autoReadTimer) return;
  clearTimeout(autoReadTimer);
  autoReadTimer = null;
}

function setAutoReadButtonText() {
  el.autoReadBtn.textContent = autoReadMode ? "자동 듣기 중지" : "자동 듣기 시작";
}

function speakIndexLabel(index) {
  const labels = {
    1: "일번",
    2: "이번",
    3: "삼번",
    4: "사번"
  };
  return labels[index] || `${index}번`;
}

function toKoreanNumber(n) {
  const num = Number(n);
  if (!Number.isInteger(num) || num <= 0) return String(n);
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  if (num < 10) return digits[num];
  if (num < 100) {
    const t = Math.floor(num / 10);
    const o = num % 10;
    const tens = t === 1 ? "십" : `${digits[t]}십`;
    return `${tens}${digits[o]}`;
  }
  return String(num);
}

function getQuestionSpeakText(q, includeAnswer) {
  const optionsText = [...(q.options || [])]
    .sort((a, b) => a.index - b.index)
    .map((opt) => `${speakIndexLabel(opt.index)}. ${opt.text}`)
    .join(". ");
  const answerOpt = (q.options || []).find((opt) => opt.index === q.answer);
  const answerText = includeAnswer
    ? ` 정답은 ${speakIndexLabel(q.answer)}. 정답 내용은 ${answerOpt ? answerOpt.text : "없음"}.`
    : "";
  return `${toKoreanNumber(q.number)}번 문제. ${q.question}. ${optionsText}.${answerText}`;
}

function speakText(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      el.feedback.textContent = "이 브라우저는 음성 읽기를 지원하지 않아.";
      resolve(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ko-KR";
    utter.rate = 1;
    utter.onend = () => resolve(true);
    utter.onerror = () => resolve(false);
    window.speechSynthesis.speak(utter);
  });
}

async function readCurrentQuestion() {
  if (!quiz) return false;
  const q = quiz.questions[currentIndex];
  const includeAnswer = el.speakAnswer.checked;
  const text = getQuestionSpeakText(q, includeAnswer);
  return speakText(text);
}

async function runAutoReadStep() {
  if (!autoReadMode || !quiz) return;
  const ok = await readCurrentQuestion();
  if (!autoReadMode || !ok) return;
  const gapSec = Number(el.readGap.value);
  const waitMs = Math.max(1, Number.isNaN(gapSec) ? 2 : gapSec) * 1000;
  clearAutoReadTimer();
  autoReadTimer = setTimeout(() => {
    currentIndex = (currentIndex + 1) % quiz.questions.length;
    renderQuestion();
    runAutoReadStep();
  }, waitMs);
}

async function syncSpeechToCurrentQuestion() {
  if (!autoReadMode) return;
  clearAutoReadTimer();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  await runAutoReadStep();
}

function resetProgress() {
  currentIndex = 0;
  selected = null;
  solved = 0;
  correctCount = 0;
}

function updateScore() {
  el.progress.textContent = `진행: ${solved} / ${quiz.questions.length}`;
  const rate = solved === 0 ? 0 : Math.round((correctCount / solved) * 100);
  el.score.textContent = `정답: ${correctCount}개 (정답률 ${rate}%)`;
}

function renderQuestion() {
  const q = quiz.questions[currentIndex];
  selected = null;
  el.feedback.textContent = "";
  el.explanation.textContent = "";
  el.qNumber.textContent = `${q.number}번`;
  el.qText.textContent = q.question;
  el.options.innerHTML = "";

  q.options
    .sort((a, b) => a.index - b.index)
    .forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.textContent = `${opt.index}. ${opt.text}`;
      btn.addEventListener("click", () => {
        if (q._checked === true) return;
        selected = opt.index;
        for (const child of el.options.children) child.classList.remove("selected");
        btn.classList.add("selected");
        checkAnswer();
      });
      el.options.appendChild(btn);
    });

  updateScore();
}

function checkAnswer() {
  const q = quiz.questions[currentIndex];
  if (selected == null) {
    el.feedback.textContent = "보기를 먼저 선택해줘.";
    return false;
  }

  const alreadyChecked = q._checked === true;
  if (alreadyChecked) {
    el.feedback.textContent = "이미 채점한 문제야. 다음으로 넘어가.";
    return false;
  }

  q._checked = true;
  solved += 1;
  const isCorrect = selected === q.answer;
  if (isCorrect) correctCount += 1;

  [...el.options.children].forEach((btn) => {
    const value = Number(btn.textContent.split(".")[0]);
    if (value === q.answer) btn.classList.add("correct");
    if (value === selected && value !== q.answer) btn.classList.add("wrong");
  });

  el.feedback.textContent = isCorrect
    ? "정답!"
    : `오답. 정답은 ${q.answer}번`;
  if (!isCorrect) {
    const correctOption = (q.options || []).find((opt) => opt.index === q.answer);
    const fallback = correctOption
      ? `정답은 ${q.answer}번이고, 정답 보기 내용은 "${correctOption.text}" 이야.`
      : `정답은 ${q.answer}번이야.`;
    el.explanation.textContent = q.explanation?.trim()
      ? `해설: ${q.explanation}`
      : `해설: ${fallback}`;
  }

  updateScore();
  if (isCorrect) {
    setTimeout(() => {
      currentIndex = (currentIndex + 1) % quiz.questions.length;
      renderQuestion();
    }, 250);
  }
  return true;
}

el.checkBtn.addEventListener("click", () => {
  checkAnswer();
});

el.nextBtn.addEventListener("click", () => {
  if (!quiz) return;
  currentIndex = (currentIndex + 1) % quiz.questions.length;
  renderQuestion();
  syncSpeechToCurrentQuestion();
});

el.prevBtn.addEventListener("click", () => {
  if (!quiz) return;
  currentIndex = (currentIndex - 1 + quiz.questions.length) % quiz.questions.length;
  renderQuestion();
  syncSpeechToCurrentQuestion();
});

el.jumpBtn.addEventListener("click", () => {
  if (!quiz) return;
  const num = Number(el.jumpInput.value);
  if (Number.isNaN(num)) {
    el.feedback.textContent = "이동할 문제 번호를 입력해줘.";
    return;
  }
  const idx = quiz.questions.findIndex((q) => q.number === num);
  if (idx === -1) {
    el.feedback.textContent = `${num}번 문제를 찾지 못했어.`;
    return;
  }
  currentIndex = idx;
  renderQuestion();
  syncSpeechToCurrentQuestion();
});

el.readBtn.addEventListener("click", async () => {
  if (autoReadMode) {
    // 이미 연속 재생 중이면 현재 문제부터 다시 시작
    clearAutoReadTimer();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    await runAutoReadStep();
    return;
  }
  autoReadMode = true;
  setAutoReadButtonText();
  await runAutoReadStep();
});

el.autoReadBtn.addEventListener("click", async () => {
  autoReadMode = !autoReadMode;
  setAutoReadButtonText();
  if (!autoReadMode) {
    clearAutoReadTimer();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    return;
  }
  await runAutoReadStep();
});

async function loadQuiz(examId = "") {
  const query = examId ? `?exam=${encodeURIComponent(examId)}` : "";
  const res = await fetch(`/api/questions${query}`);
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg);
  }
  quiz = await res.json();
  resetProgress();
  el.meta.textContent = `${quiz.title} / 총 ${quiz.total}문항`;
  renderQuestion();
}

async function loadExams() {
  const res = await fetch("/api/exams");
  if (!res.ok) return false;
  const payload = await res.json();
  exams = Array.isArray(payload.exams) ? payload.exams : [];
  if (!exams.length) return false;

  el.examSelect.innerHTML = "";
  for (const exam of exams) {
    const opt = document.createElement("option");
    opt.value = exam.id;
    opt.textContent = `${exam.title} (${exam.total}문항)`;
    el.examSelect.appendChild(opt);
  }
  selectedExamId = exams[0].id;
  el.examSelect.value = selectedExamId;
  el.examSelect.addEventListener("change", async () => {
    selectedExamId = el.examSelect.value;
    await loadQuiz(selectedExamId);
  });
  return true;
}

async function init() {
  const hasExams = await loadExams();
  if (hasExams) {
    await loadQuiz(selectedExamId);
    return;
  }
  el.examSelect.innerHTML = "<option value=''>단일 문제셋 모드</option>";
  await loadQuiz();
}

init().catch((err) => {
  el.meta.textContent = "데이터를 불러오지 못함";
  el.qText.textContent = String(err.message || err);
});

setAutoReadButtonText();
