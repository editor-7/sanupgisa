const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PDF_PATH = process.argv[2];
const OUTPUT_PATH = process.argv[3] || path.join(__dirname, "..", "data", "questions.json");

if (!PDF_PATH) {
  console.error("사용법: npm run parse -- \"<pdf 경로>\" [출력경로]");
  process.exit(1);
}

const circledToIndex = {
  "①": 1,
  "❶": 1,
  "②": 2,
  "❷": 2,
  "③": 3,
  "❸": 3,
  "④": 4,
  "❹": 4
};

function cleanLine(line) {
  return line
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^L\d+:/, "")
    .trim();
}

function parseQuestions(lines) {
  const normalized = lines
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !line.includes("전자문제집 CBT"))
    .filter((line) => !line.startsWith("-- "))
    .filter((line) => !line.match(/^\d+과목\s*:/));

  const questions = [];
  let current = null;
  let currentOptionIndex = -1;
  let answerSheetMode = false;
  const answerSheetLines = [];

  for (const line of normalized) {
    if (line.match(/^\d+\s+\d+\s+\d+/)) {
      answerSheetMode = true;
      answerSheetLines.push(line);
      continue;
    }

    if (answerSheetMode && line.match(/^[①②③④❶❷❸❹]/)) {
      answerSheetLines.push(line);
      continue;
    }

    if (answerSheetMode && !line.match(/^\d+\s+\d+\s+\d+/) && !line.match(/^[①②③④❶❷❸❹]/)) {
      answerSheetMode = false;
    }

    const qMatch = line.match(/^(\d+)\.\s*(.*)$/);
    if (qMatch) {
      if (current) questions.push(current);
      current = {
        number: Number(qMatch[1]),
        question: qMatch[2] || "",
        options: [],
        answer: null,
        explanation: ""
      };
      currentOptionIndex = -1;
      continue;
    }

    if (!current) continue;

    // 한 줄에 보기 여러 개가 붙은 경우를 처리
    const chunks = line
      .split(/(?=[①②③④❶❷❸❹])/)
      .map((s) => s.trim())
      .filter(Boolean);

    let consumedByOption = false;
    for (const chunk of chunks) {
      const optMatch = chunk.match(/^([①②③④❶❷❸❹])\s*(.*)$/);
      if (!optMatch) continue;
      consumedByOption = true;
      const marker = optMatch[1];
      const index = circledToIndex[marker];
      const text = (optMatch[2] || "").trim();
      current.options.push({
        index,
        text
      });
      currentOptionIndex = current.options.length - 1;
      if (marker.startsWith("❶") || marker.startsWith("❷") || marker.startsWith("❸") || marker.startsWith("❹")) {
        current.answer = index;
      }
    }

    if (consumedByOption) continue;

    // 보기 이어지는 줄
    if (currentOptionIndex >= 0 && current.options[currentOptionIndex]) {
      current.options[currentOptionIndex].text = `${current.options[currentOptionIndex].text} ${line}`.trim();
      continue;
    }

    // 문제 본문 이어지는 줄
    current.question = `${current.question} ${line}`.trim();
  }

  if (current) questions.push(current);

  // 마지막 정답표로 answer가 비어 있는 항목 보정
  const answerSheet = {};
  let pendingNumbers = [];
  for (const line of answerSheetLines) {
    if (line.match(/^\d+\s+\d+/)) {
      pendingNumbers = line
        .split(/\s+/)
        .map((v) => Number(v))
        .filter((n) => !Number.isNaN(n));
      continue;
    }

    const answers = [...line.matchAll(/[①②③④❶❷❸❹]/g)].map((m) => circledToIndex[m[0]]);
    if (pendingNumbers.length && answers.length) {
      const len = Math.min(pendingNumbers.length, answers.length);
      for (let i = 0; i < len; i++) {
        answerSheet[pendingNumbers[i]] = answers[i];
      }
      pendingNumbers = [];
    }
  }

  for (const q of questions) {
    if (!q.answer && answerSheet[q.number]) {
      q.answer = answerSheet[q.number];
    }
  }

  return questions.filter((q) => q.options.length >= 2);
}

async function main() {
  const buffer = fs.readFileSync(PDF_PATH);
  const parsed = await pdfParse(buffer);
  const lines = parsed.text.split(/\r?\n/);
  const questions = parseQuestions(lines);

  const payload = {
    title: path.basename(PDF_PATH),
    total: questions.length,
    questions
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");

  console.log(`완료: ${OUTPUT_PATH}`);
  console.log(`문항 수: ${questions.length}`);
}

main().catch((err) => {
  console.error("파싱 실패:", err.message);
  process.exit(1);
});
