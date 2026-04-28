const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 5173;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || "5472";
const ROOT = path.join(__dirname, "public");
const DATA_FILE = path.join(__dirname, "data", "questions.json");
const EXAMS_DIR = path.join(__dirname, "data", "exams");
const EXAMS_INDEX_FILE = path.join(__dirname, "data", "exams-index.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((acc, part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10000) {
        reject(new Error("request body too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function renderLoginPage(message = "") {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>접근 비밀번호</title>
  <style>
    body{font-family:Malgun Gothic,sans-serif;background:#f3f6fb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
    .card{background:#fff;padding:24px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);width:320px}
    h1{font-size:20px;margin:0 0 12px}
    p{color:#4b5563;font-size:14px}
    input{width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin:10px 0 12px;box-sizing:border-box}
    button{width:100%;padding:10px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer}
    .err{color:#dc2626;font-size:13px;min-height:18px}
  </style>
</head>
<body>
  <form class="card" method="POST" action="/unlock">
    <h1>비밀번호 입력</h1>
    <p>사이트 접근 비밀번호를 입력하세요.</p>
    <input type="password" name="password" placeholder="비밀번호" required />
    <button type="submit">입장</button>
    <div class="err">${message}</div>
  </form>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = req.url || "/";
  const method = req.method || "GET";
  const cookies = parseCookies(req);
  const isAuthorized = cookies.quiz_auth === "ok";

  if (url === "/unlock" && method === "POST") {
    readBody(req)
      .then((raw) => {
        const body = new URLSearchParams(raw);
        const password = body.get("password") || "";
        if (password === ACCESS_PASSWORD) {
          res.writeHead(302, {
            "Set-Cookie": "quiz_auth=ok; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax",
            Location: "/"
          });
          res.end();
          return;
        }
        send(res, 401, renderLoginPage("비밀번호가 틀렸어."), MIME[".html"]);
      })
      .catch(() => send(res, 400, "Bad Request"));
    return;
  }

  if (!isAuthorized) {
    if (url.startsWith("/api/")) {
      return send(res, 401, JSON.stringify({ error: "unauthorized" }), MIME[".json"]);
    }
    return send(res, 401, renderLoginPage(), MIME[".html"]);
  }

  if (url.startsWith("/api/questions")) {
    const reqUrl = new URL(url, `http://localhost:${PORT}`);
    const examId = reqUrl.searchParams.get("exam");
    const target = examId ? path.join(EXAMS_DIR, examId) : DATA_FILE;

    if (examId && !target.startsWith(EXAMS_DIR)) {
      return send(res, 400, JSON.stringify({ error: "잘못된 exam 파라미터입니다." }), MIME[".json"]);
    }

    if (!fs.existsSync(target)) {
      return send(
        res,
        404,
        JSON.stringify({ error: "문제 파일이 없습니다. 먼저 parse 명령을 실행하세요." }),
        MIME[".json"]
      );
    }
    return send(res, 200, fs.readFileSync(target), MIME[".json"]);
  }

  if (url === "/api/exams") {
    if (!fs.existsSync(EXAMS_INDEX_FILE)) {
      return send(
        res,
        404,
        JSON.stringify({ error: "exams-index.json이 없습니다. parse:all을 먼저 실행하세요." }),
        MIME[".json"]
      );
    }
    return send(res, 200, fs.readFileSync(EXAMS_INDEX_FILE), MIME[".json"]);
  }

  const safePath = url === "/" ? "/index.html" : url;
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, "Forbidden");
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, "Not Found");
  }

  const ext = path.extname(filePath);
  return send(res, 200, fs.readFileSync(filePath), MIME[ext] || "application/octet-stream");
});

server.listen(PORT, () => {
  console.log(`서버 실행: http://localhost:${PORT}`);
});
