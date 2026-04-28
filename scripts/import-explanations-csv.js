const fs = require("fs");
const path = require("path");

const csvPath = path.join(__dirname, "..", "data", "explanations_template.csv");
const jsonPath = path.join(__dirname, "..", "data", "questions.json");

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

function main() {
  if (!fs.existsSync(csvPath)) {
    console.error("CSV 파일이 없습니다. 먼저 export:explanations를 실행하세요.");
    process.exit(1);
  }

  if (!fs.existsSync(jsonPath)) {
    console.error("questions.json 파일이 없습니다. 먼저 parse를 실행하세요.");
    process.exit(1);
  }

  const csvRaw = fs.readFileSync(csvPath, "utf8");
  const lines = csvRaw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    console.error("CSV 데이터가 비어 있습니다.");
    process.exit(1);
  }

  const header = parseCsvLine(lines[0]).map((v) => v.trim());
  const numberIdx = header.indexOf("number");
  const explanationIdx = header.indexOf("explanation");
  if (numberIdx === -1 || explanationIdx === -1) {
    console.error("CSV 헤더에 number, explanation 컬럼이 필요합니다.");
    process.exit(1);
  }

  const explanationMap = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const num = Number(cols[numberIdx]);
    if (Number.isNaN(num)) continue;
    const explanation = (cols[explanationIdx] || "").trim();
    explanationMap.set(num, explanation);
  }

  const jsonRaw = fs.readFileSync(jsonPath, "utf8");
  const quiz = JSON.parse(jsonRaw);
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

  let updated = 0;
  for (const q of questions) {
    if (!Object.prototype.hasOwnProperty.call(q, "number")) continue;
    if (!explanationMap.has(q.number)) continue;
    q.explanation = explanationMap.get(q.number);
    updated += 1;
  }

  fs.writeFileSync(jsonPath, JSON.stringify(quiz, null, 2), "utf8");
  console.log(`완료: ${jsonPath}`);
  console.log(`업데이트 문항 수: ${updated}`);
}

main();
