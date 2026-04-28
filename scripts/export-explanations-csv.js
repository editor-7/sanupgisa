const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "..", "data", "questions.json");
const outputPath = path.join(__dirname, "..", "data", "explanations_template.csv");

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error("questions.json 파일이 없습니다. 먼저 parse를 실행하세요.");
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const parsed = JSON.parse(raw);
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

  const rows = [
    ["number", "question", "answer", "explanation"].map(escapeCsv).join(",")
  ];

  for (const q of questions) {
    rows.push(
      [
        q.number,
        (q.question || "").replace(/\s+/g, " ").trim(),
        q.answer ?? "",
        q.explanation || ""
      ]
        .map(escapeCsv)
        .join(",")
    );
  }

  fs.writeFileSync(outputPath, rows.join("\n"), "utf8");
  console.log(`완료: ${outputPath}`);
  console.log(`행 수(헤더 제외): ${questions.length}`);
}

main();
