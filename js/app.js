/*
 * ArcGIS Mock Exams - single-page study app.
 *
 * Data lives in data/manifest.json (list of exams) and one JSON file per exam
 * (data/exams/*.json). Routes use the URL hash:
 *   #/                              list of exams
 *   #/exam/<examId>                 list of bundles in an exam
 *   #/summary/<examId>              exam summary (when the exam JSON has a "summary" block)
 *   #/exam/<examId>/<bundleId>      run a bundle (questions and answers are always shuffled)
 *
 * Scores are kept in memory only. Reloading the page resets them.
 */
(function () {
  "use strict";

  const MANIFEST_URL = "data/manifest.json";
  const app = document.getElementById("app");
  const crumbs = document.getElementById("breadcrumbs");

  let manifest = null;
  const examCache = new Map();
  let quiz = null; // active quiz state, null when not on a quiz screen

  // ---------- helpers ----------

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") node.className = v;
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function render(...nodes) {
    app.replaceChildren(...nodes);
    window.scrollTo(0, 0);
  }

  function setCrumbs(items) {
    const parts = [];
    items.forEach((item, i) => {
      if (i > 0) parts.push(el("span", { class: "sep", "aria-hidden": "true" }, "/"));
      parts.push(item.href ? el("a", { href: item.href }, item.label) : el("span", null, item.label));
    });
    crumbs.replaceChildren(...parts);
  }

  function setTitle(text) {
    document.title = text ? `${text} – ArcGIS Mock Exams` : "ArcGIS Mock Exams";
  }

  function sourceNode(source) {
    if (!source) return null;
    const bits = [];
    if (source.section) bits.push(source.section);
    if (source.page) bits.push(`p. ${source.page}`);
    const label = source.title || source.url || "Source";
    return el(
      "p",
      { class: "source" },
      "Source: ",
      source.url ? el("a", { href: source.url, target: "_blank", rel: "noopener" }, label) : label,
      bits.length ? ` — ${bits.join(", ")}` : ""
    );
  }

  function showError(title, detail) {
    setCrumbs([{ label: "Error" }]);
    const isFile = location.protocol === "file:";
    render(
      el(
        "div",
        { class: "card error" },
        el("h1", null, title),
        el("p", null, detail),
        isFile
          ? el(
              "p",
              null,
              "Browsers block loading JSON from file:// pages. Serve the folder over HTTP instead, for example run ",
              el("code", null, "python -m http.server 8000"),
              " in the project folder and open ",
              el("code", null, "http://localhost:8000"),
              "."
            )
          : null,
        el("div", { class: "actions" }, el("a", { class: "btn secondary", href: "#/" }, "Back to exams"))
      )
    );
  }

  // ---------- data loading ----------

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
    return res.json();
  }

  async function loadManifest() {
    if (!manifest) manifest = await fetchJson(MANIFEST_URL);
    return manifest;
  }

  async function loadExam(examId) {
    if (examCache.has(examId)) return examCache.get(examId);
    const m = await loadManifest();
    const entry = m.exams.find((e) => e.id === examId);
    if (!entry) throw new Error(`No exam with id "${examId}" in the manifest.`);
    const exam = await fetchJson(entry.file);
    examCache.set(examId, exam);
    return exam;
  }

  // ---------- views ----------

  async function viewHome() {
    quiz = null;
    setTitle("");
    setCrumbs([{ label: "Exams" }]);
    const m = await loadManifest();
    const items = m.exams.map((e) =>
      el(
        "li",
        { class: "card list-item" },
        el("h2", null, el("a", { href: `#/exam/${encodeURIComponent(e.id)}` }, e.title)),
        e.description ? el("p", null, e.description) : null,
        el("a", { class: "btn", href: `#/exam/${encodeURIComponent(e.id)}` }, "Open exam")
      )
    );
    render(
      el(
        "section",
        { class: "disclaimer", role: "note", "aria-labelledby": "disclaimer-title" },
        el("h2", { id: "disclaimer-title" }, "Unofficial practice questions — please read"),
        el(
          "ul",
          null,
          el("li", null, el("strong", null, "These are NOT Esri exam questions."), " They were written independently for study practice and do not come from any Esri exam."),
          el("li", null, el("strong", null, "This site is NOT official."), " It is not produced, reviewed or endorsed by Esri."),
          el("li", null, el("strong", null, "Questions MIGHT be out of date or wrong."), " Products, versions and exam content change over time."),
          el("li", null, el("strong", null, "ALWAYS refer back to official Esri documentation"), " and the exam's official information guide before relying on any answer here.")
        )
      ),
      el("h1", null, m.title || "ArcGIS Mock Exams"),
      el("p", { class: "lede" }, m.description || "Choose an exam to see its question bundles."),
      items.length ? el("ul", { class: "list" }, items) : el("p", { class: "muted" }, "No exams in the manifest yet.")
    );
  }

  async function viewExam(examId) {
    quiz = null;
    const exam = await loadExam(examId);
    setTitle(exam.title);
    setCrumbs([{ label: "Exams", href: "#/" }, { label: exam.title }]);
    const base = `#/exam/${encodeURIComponent(exam.id)}`;
    const items = exam.bundles.map((b) => {
      const href = `${base}/${encodeURIComponent(b.id)}`;
      return el(
        "li",
        { class: "card list-item" },
        el("h2", null, el("a", { href }, b.title)),
        b.description ? el("p", null, b.description) : null,
        el("div", { class: "meta" }, `${b.questions.length} questions` + (b.weight ? ` · ${b.weight}% of the exam` : "")),
        el("div", { class: "actions" }, el("a", { class: "btn", href }, "Start"))
      );
    });
    render(
      el("h1", null, exam.title),
      el("p", { class: "lede" }, exam.description || ""),
      exam.summary ? summaryCard(exam) : null,
      el("ul", { class: "list" }, items)
    );
  }

  function summaryCard(exam) {
    const s = exam.summary;
    return el(
      "div",
      { class: "card summary-card" },
      s.details ? factList(s.details.slice(0, 4)) : null,
      el(
        "div",
        { class: "actions" },
        el("a", { class: "btn secondary", href: `#/summary/${encodeURIComponent(exam.id)}` }, "Exam summary"),
        s.communityUrl
          ? el("a", { class: "btn secondary", href: s.communityUrl, target: "_blank", rel: "noopener" }, "Esri Community page")
          : null
      )
    );
  }

  function factList(details) {
    return el(
      "dl",
      { class: "facts" },
      details.map((d) => [el("dt", null, d.label), el("dd", null, d.value)])
    );
  }

  function linkItem(link) {
    return el("li", null, el("a", { href: link.url, target: "_blank", rel: "noopener" }, link.title), link.note ? ` — ${link.note}` : "");
  }

  async function viewSummary(examId) {
    quiz = null;
    const exam = await loadExam(examId);
    const s = exam.summary;
    if (!s) throw new Error(`Exam "${exam.title}" has no summary.`);
    const examHref = `#/exam/${encodeURIComponent(exam.id)}`;
    setTitle(`${exam.title} summary`);
    setCrumbs([{ label: "Exams", href: "#/" }, { label: exam.title, href: examHref }, { label: "Summary" }]);

    const section = (title, ...body) => el("section", { class: "card summary-section" }, el("h2", null, title), ...body);
    const bullets = (items) => el("ul", { class: "bullets" }, items.map((t) => el("li", null, t)));

    const skills = (s.skills || []).map((sk) => {
      const ids = sk.bundles || (sk.bundle ? [sk.bundle] : []);
      const linked = ids.map((id) => exam.bundles.find((b) => b.id === id)).filter(Boolean);
      return el(
        "div",
        { class: "skill" },
        el(
          "div",
          { class: "skill-head" },
          el("h3", null, sk.name),
          el("span", { class: "weight" }, `${sk.weight}%`)
        ),
        el("div", { class: "weight-bar", "aria-hidden": "true" }, el("div", { style: `width:${sk.weight}%` })),
        bullets(sk.objectives || []),
        linked.length
          ? el(
              "div",
              { class: "actions" },
              linked.map((b) => el("a", { class: "btn secondary small", href: `${examHref}/${encodeURIComponent(b.id)}` }, `Practise: ${b.title}`))
            )
          : null
      );
    });

    render(
      el("h1", null, exam.title),
      el(
        "p",
        { class: "lede" },
        "Summary from Esri's exam information guide",
        s.guide ? [" (", el("a", { href: s.guide.url, target: "_blank", rel: "noopener" }, s.guide.title), ")"] : null,
        ". ",
        s.communityUrl ? el("a", { href: s.communityUrl, target: "_blank", rel: "noopener" }, "View the exam on Esri Community") : null,
        s.communityUrl ? "." : null
      ),
      el("div", { class: "summary" },
        s.details ? section("Exam details", factList(s.details)) : null,
        s.purpose ? section("Exam purpose", el("p", null, s.purpose)) : null,
        s.audience ? section("Target audience", el("p", null, s.audience)) : null,
        s.tasks ? section("A qualified candidate can", bullets(s.tasks)) : null,
        s.outOfScope ? section("Beyond the scope of the exam", bullets(s.outOfScope)) : null,
        s.familiarWith ? section("Be familiar with", bullets(s.familiarWith)) : null,
        skills.length ? section("Skills measured", el("p", { class: "muted" }, "The weight is the approximate share of the exam."), ...skills) : null,
        s.resources
          ? section(
              "Resources",
              s.resources.map((g) => [el("h3", null, g.group), el("ul", { class: "bullets" }, g.links.map(linkItem))])
            )
          : null
      ),
      el("div", { class: "actions" }, el("a", { class: "btn", href: examHref }, "Go to question bundles"))
    );
  }

  async function viewQuiz(examId, bundleId) {
    const exam = await loadExam(examId);
    const bundle = exam.bundles.find((b) => b.id === bundleId);
    if (!bundle) throw new Error(`No bundle with id "${bundleId}" in exam "${exam.title}".`);
    setTitle(bundle.title);
    setCrumbs([
      { label: "Exams", href: "#/" },
      { label: exam.title, href: `#/exam/${encodeURIComponent(exam.id)}` },
      { label: bundle.title },
    ]);
    startQuiz(exam, bundle, bundle.questions);
  }

  // ---------- quiz engine ----------

  // Question order is always shuffled, as is answer order (see prepareQuestion).
  function startQuiz(exam, bundle, questions) {
    quiz = {
      exam,
      bundle,
      sourceQuestions: questions,
      questions: shuffle(questions),
      idx: 0,
      correct: 0,
      answered: 0,
      missed: [],
      options: [],
      selected: null,
      submitted: false,
    };
    prepareQuestion();
    renderQuestion();
  }

  function prepareQuestion() {
    const q = quiz.questions[quiz.idx];
    // Shuffle answers every time a question is shown.
    quiz.options = shuffle(q.answers.map((text, i) => ({ text, isCorrect: i === q.correct })));
    quiz.selected = null;
    quiz.submitted = false;
  }

  function renderQuestion() {
    const q = quiz.questions[quiz.idx];
    const total = quiz.questions.length;
    const done = quiz.idx + (quiz.submitted ? 1 : 0);
    const isLast = quiz.idx === total - 1;

    const optionButtons = quiz.options.map((opt, i) => {
      let cls = "option";
      if (quiz.submitted) {
        if (opt.isCorrect) cls += " correct";
        else if (i === quiz.selected) cls += " wrong";
      } else if (i === quiz.selected) {
        cls += " selected";
      }
      return el(
        "li",
        null,
        el(
          "button",
          {
            type: "button",
            class: cls,
            disabled: quiz.submitted,
            "aria-pressed": String(i === quiz.selected),
            onclick: () => selectOption(i),
          },
          el("span", { class: "key", "aria-hidden": "true" }, String(i + 1)),
          el("span", null, opt.text)
        )
      );
    });

    let feedback = null;
    if (quiz.submitted) {
      const right = quiz.options[quiz.selected].isCorrect;
      feedback = el(
        "div",
        { class: `feedback ${right ? "correct" : "wrong"}`, role: "status" },
        el("p", { class: "verdict" }, right ? "Correct" : "Incorrect"),
        right ? null : el("p", null, "Correct answer: ", el("strong", null, q.answers[q.correct])),
        el("p", null, q.explanation),
        sourceNode(q.source),
        q.objective ? el("p", { class: "source" }, `Exam objective: ${q.objective}`) : null
      );
    }

    const primary = quiz.submitted
      ? el("button", { type: "button", class: "btn", onclick: next }, isLast ? "See results" : "Next")
      : el("button", { type: "button", class: "btn", disabled: quiz.selected === null, onclick: submit }, "Submit");

    app.replaceChildren(
      el(
        "div",
        { class: "quiz-bar" },
        el("span", null, `Question ${quiz.idx + 1} of ${total}`),
        el("span", null, "Score: ", el("strong", null, `${quiz.correct} / ${quiz.answered}`))
      ),
      el(
        "div",
        {
          class: "progress",
          role: "progressbar",
          "aria-valuemin": "0",
          "aria-valuemax": String(total),
          "aria-valuenow": String(done),
          "aria-label": "Progress",
        },
        el("div", { style: `width:${(done / total) * 100}%` })
      ),
      el(
        "div",
        { class: "card" },
        el("p", { class: "question" }, q.question),
        el("ol", { class: "options" }, optionButtons),
        feedback,
        el("div", { class: "actions" }, primary)
      ),
      el(
        "p",
        { class: "hint" },
        "Shortcuts: ",
        el("kbd", null, "1"),
        "–",
        el("kbd", null, "4"),
        " choose an answer, ",
        el("kbd", null, "Enter"),
        " submit or move on."
      )
    );
  }

  function selectOption(i) {
    if (!quiz || quiz.submitted || i < 0 || i >= quiz.options.length) return;
    quiz.selected = i;
    renderQuestion();
  }

  function submit() {
    if (!quiz || quiz.submitted || quiz.selected === null) return;
    const q = quiz.questions[quiz.idx];
    const chosen = quiz.options[quiz.selected];
    quiz.submitted = true;
    quiz.answered++;
    if (chosen.isCorrect) quiz.correct++;
    else quiz.missed.push({ question: q, chosen: chosen.text });
    renderQuestion();
  }

  function next() {
    if (!quiz || !quiz.submitted) return;
    if (quiz.idx < quiz.questions.length - 1) {
      quiz.idx++;
      prepareQuestion();
      renderQuestion();
      window.scrollTo(0, 0);
    } else {
      renderResults();
    }
  }

  function renderResults() {
    const { exam, bundle, questions, missed, correct } = quiz;
    const total = questions.length;
    const pct = Math.round((correct / total) * 100);
    quiz.submitted = false;
    quiz.finished = true;

    const missedItems = missed.map(({ question: q, chosen }) =>
      el(
        "li",
        { class: "card" },
        el("p", { class: "q" }, q.question),
        el(
          "dl",
          null,
          el("dt", null, "Your answer"),
          el("dd", { class: "ans-wrong" }, chosen),
          el("dt", null, "Correct answer"),
          el("dd", { class: "ans-right" }, q.answers[q.correct])
        ),
        sourceNode(q.source)
      )
    );

    const retry = (qs) => () => startQuiz(exam, bundle, qs);
    const missedQuestions = missed.map((m) => m.question);

    render(
      el(
        "div",
        { class: "card" },
        el("h1", null, `${bundle.title}: results`),
        el("p", { class: "score-big" }, `${correct} / ${total}`),
        el("p", { class: "muted" }, `${pct}% correct`),
        el(
          "div",
          { class: "actions" },
          el("button", { type: "button", class: "btn", onclick: retry(quiz.sourceQuestions) }, "Retry"),
          missed.length
            ? el("button", { type: "button", class: "btn secondary", onclick: retry(missedQuestions) }, `Retry the ${missed.length} missed`)
            : null,
          el("a", { class: "btn secondary", href: `#/exam/${encodeURIComponent(exam.id)}` }, "Back to bundles")
        )
      ),
      el("h2", { style: "margin-top:24px" }, missed.length ? "What you missed" : "Nothing missed. Well done."),
      missed.length ? el("ul", { class: "missed" }, missedItems) : null
    );
  }

  // ---------- keyboard ----------

  document.addEventListener("keydown", (e) => {
    if (!quiz || quiz.finished || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key >= "1" && e.key <= "4") {
      e.preventDefault();
      selectOption(Number(e.key) - 1);
    } else if (e.key === "Enter") {
      // Handle Enter ourselves so a focused button doesn't also fire a click.
      e.preventDefault();
      if (quiz.submitted) next();
      else submit();
    }
  });

  // ---------- router ----------

  async function route() {
    const hash = location.hash.replace(/^#\/?/, "");
    const path = hash.split("?")[0];
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (parts.length === 0) await viewHome();
      else if (parts[0] === "summary" && parts.length === 2) await viewSummary(parts[1]);
      else if (parts[0] === "exam" && parts.length === 2) await viewExam(parts[1]);
      else if (parts[0] === "exam" && parts.length === 3) await viewQuiz(parts[1], parts[2]);
      else location.hash = "#/";
    } catch (err) {
      console.error(err);
      showError("Could not load exam data", err.message);
    }
  }

  window.addEventListener("hashchange", route);
  route();
})();
