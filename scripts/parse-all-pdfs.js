const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const SOURCE_DIR = process.argv[2];
const EXAMS_DIR = path.join(__dirname, "..", "data", "exams");
const INDEX_PATH = path.join(__dirname, "..", "data", "exams-index.json");

if (!SOURCE_DIR) {
  console.error("사용법: npm run parse:all -- \"<pdf 폴더 경로>\"");
  process.exit(1);
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`폴더를 찾을 수 없습니다: ${SOURCE_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(EXAMS_DIR, { recursive: true });
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => name.toLowerCase().endsWith(".pdf"));

  if (files.length === 0) {
    console.error("PDF 파일이 없습니다.");
    process.exit(1);
  }

  const index = [];
  let success = 0;

  for (const name of files) {
    const sourcePath = path.join(SOURCE_DIR, name);
    const slug = path.basename(name, ".pdf").replace(/[^\w\-가-힣]+/g, "_");
    const outputPath = path.join(EXAMS_DIR, `${slug}.json`);

    const run = spawnSync(
      process.execPath,
      [path.join(__dirname, "parse-pdf.js"), sourcePath, outputPath],
      { stdio: "pipe", encoding: "utf8" }
    );

    if (run.status !== 0) {
      console.error(`[실패] ${name}`);
      if (run.stderr) console.error(run.stderr.trim());
      continue;
    }

    const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    index.push({
      id: `${slug}.json`,
      title: parsed.title || name,
      total: parsed.total || 0
    });
    success += 1;
    console.log(`[완료] ${name} -> ${slug}.json (${parsed.total || 0}문항)`);
  }

  fs.writeFileSync(INDEX_PATH, JSON.stringify({ total: success, exams: index }, null, 2), "utf8");
  console.log(`인덱스 생성: ${INDEX_PATH}`);
  console.log(`성공: ${success} / 전체: ${files.length}`);
}

main();
