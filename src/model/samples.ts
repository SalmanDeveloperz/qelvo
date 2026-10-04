// Reference documents transcribed from the three resumes the templates were
// calibrated against. They double as the gallery previews and as regression
// fixtures for scripts/calibrate.ts.
import { contact, entry, item, section, skill } from "./factory";
import type { Resume } from "./types";

const PHONE = "+92 300 0000000";
const EMAIL = "you@example.com";
const LI = "https://linkedin.com/in/msalman199";
const GH = "https://github.com/SalmanDeveloperz";

const SKILLS_TWO_COL = () => [
  skill("Languages", "Python, JavaScript, TypeScript, C++"),
  skill("Backend", "FastAPI, Node.js, Express.js, REST API Design, JWT, Socket.io, Git"),
  skill("Frontend", "React, Tailwind CSS, HTML, CSS"),
  skill("Databases", "MongoDB, PostgreSQL, MySQL, Redis"),
  skill("Infrastructure", "Docker, Kubernetes, Microservices, Jenkins, Linux, GitHub Actions, Kustomize"),
  skill("Testing & QA", "Manual & Regression Testing, JMeter, Postman, SQL Validation, Bug Tracking"),
  skill("AI & RAG", "OpenAI API, LangChain, Embeddings, Prompt Engineering"),
];

const AWARDS = () =>
  section("awards", {
    entries: [
      entry({ title: "Linux Foundation LiFT Scholar", subtitle: "Full scholarship, Kubernetes (LFD259) certification and exam", date: "Jul 2025" }),
      entry({ title: "Google Summer of Code 2025", subtitle: "Selected globally, sub-5% acceptance rate", date: "Mar 2025" }),
      entry({ title: "Byte & Battle Hackathon", subtitle: "1st place university-wide, 3rd place district-level", date: "Mar 2025" }),
      entry({ title: "PEEF Scholarship", subtitle: "80% fee scholarship, Government of Punjab", date: "Jul 2022 – 2026" }),
    ],
  });

const SUMMARY_2COL =
  "Backend Software Engineer specializing in Python and FastAPI, shipping REST APIs and cloud-native services. Google Summer of Code 2025 contributor at FOSSology, where he rebuilt the backend as a Docker/Kubernetes microservices system, and a merged contributor to Jenkins core, the CI/CD platform used by engineering teams worldwide.";

/** Salman_Resume 2.pdf: Poppins, two columns. */
export function sampleModern(): Resume {
  return {
    version: 1,
    template: "modern",
    pages: 1,
    paper: "letter",
    name: "Muhammad Salman",
    headline: "",
    contacts: [
      contact("phone", PHONE),
      contact("email", EMAIL, `mailto:${EMAIL}`),
      contact("linkedin", "in/msalman199", LI),
      contact("github", "SalmanDeveloperz", GH),
      contact("location", "Lahore, Pakistan"),
    ],
    sections: [
      section("summary", { text: SUMMARY_2COL }),
      section("experience", {
        entries: [
          entry({
            title: "9D Technologies", subtitle: "Backend Software Engineer", date: "Aug 2026 – Present", location: "Lahore, Pakistan",
            bullets: [
              "Built an authentication service in FastAPI, covering request validation, error handling, and secure endpoint design.",
              "Developed REST API endpoints for a task management platform's reporting module, structuring data flows to automate report generation.",
              "Automated testing and deployment for backend services with CI/CD pipelines in GitHub Actions.",
            ],
          }),
          entry({
            title: "Google Summer of Code 2025", subtitle: "Software Engineer (Open Source)", date: "Feb 2025 – Sep 2025", location: "Remote",
            bullets: [
              "Rebuilt FOSSology's backend as a 10+ service Docker/Kubernetes microservices architecture, replacing a single monolithic deployment.",
              "Migrated the build system from Make to CMake, cutting build time 40% and unblocking a CI pipeline that had been failing for the team.",
              "Root-caused and resolved a scheduler crash loop in the project's core service, tracing the issue through PostgreSQL schema limits, container networking, and init ordering.",
            ],
          }),
          entry({
            title: "Hywiz Technologies", subtitle: "Software Engineer Intern", date: "May 2023 – Sep 2023",
            bullets: [
              "Shipped full-stack product modules and REST APIs with React, Node.js, and Express.js, replacing manual daily data exports with MongoDB aggregation pipelines.",
            ],
          }),
        ],
      }),
      section("opensource", {
        entries: [
          entry({
            title: "Jenkins", subtitle: "Contributor", meta: "jenkinsci/jenkins, jenkinsci/docker, jenkinsci/theme-manager-plugin",
            bullets: [[
              "5+ PRs merged covering accessibility, keyboard navigation, and Docker environment-variable substitution for Linux and Windows containers.",
              "https://github.com/search?q=author%3ASalmanDeveloperz+org%3Ajenkinsci&type=pullrequests",
            ]],
          }),
          entry({
            title: "FOSSology", subtitle: "Contributor", meta: "fossology/fossology, fossology/gsoc",
            bullets: [[
              "22+ PRs merged across the GSoC 2025 microservices infrastructure and the copyright, nomos, and cp2foss agents.",
              "https://github.com/search?q=author%3ASalmanDeveloperz+org%3Afossology&type=pullrequests",
            ]],
          }),
          entry({
            title: "OWASP Foundation", subtitle: "Collaborator", meta: "OWASP/Nest", date: "Jan 2026 – Present",
            bullets: ["Earned Collaborator access after identifying and helping resolve accessibility issues in keyboard focus indicators."],
          }),
        ],
      }),
      section("projects", {
        entries: [
          entry({
            title: "Ezvor", meta: "React, TypeScript, Supabase, Gen AI, RAG", link: "https://github.com/ezvor/ezvor",
            bullets: ["Built a full-stack SSR platform pairing a 3,977-problem auto-graded DSA arena with a Readiness Engine that converts verified coding activity into a recruiter-shareable proof score."],
          }),
          entry({
            title: "OpenTelemetry Pipeline for Jenkins CI", meta: "OpenTelemetry, Python, Jenkins, Jaeger, Prometheus", link: "https://github.com/SalmanDeveloperz/PoS-Otel",
            bullets: ["Built a 3-tier distributed telemetry pipeline with tail-based sampling, cutting observability data volume 81% while unifying Jenkins CI traces and metrics in Jaeger/Prometheus."],
          }),
        ],
      }),
      section("skills", { skills: SKILLS_TWO_COL() }),
      section("education", {
        entries: [entry({ title: "UNIVERSITY OF AGRICULTURE, FAISALABAD", subtitle: "Bachelor of Computer Science", meta: "CGPA: 3.37/4.0", date: "2022 – 2026 (Graduated)" })],
      }),
      AWARDS(),
      section("coursework", {
        items: [
          "Machine Learning", "Databases", "Data Structures & Algorithms", "Application Development", "Mobile Application Development",
          "Operating Systems", "Computer Vision", "Statistics", "Linear Algebra", "Computer Networks",
        ].map((t) => item(t)),
      }),
    ],
  };
}

/** Resume 3.pdf: Latin Modern, two columns. */
export function sampleAcademic(): Resume {
  const r = sampleModern();
  r.template = "academic";
  const exp = r.sections[1].entries;
  exp[0].bullets[1].text = "Developed REST API endpoints for a task management platform’s reporting module, structuring data flows to automate report generation.";
  exp[1].title = "Google Summer of Code 2025, FOSSology";
  exp[1].bullets[0].text = "Rebuilt FOSSology’s backend as a 10+ service Docker/Kubernetes microservices architecture, replacing a single monolithic deployment.";
  exp[1].bullets[2].text = "Root-caused and resolved a scheduler crash loop in the project’s core service, tracing the issue through PostgreSQL schema limits, container networking, and init ordering.";
  const oss = r.sections[2].entries;
  oss[0].date = "2025 – Present";
  oss[0].bullets[0] = { ...oss[0].bullets[0], text: "5 merged pull requests covering accessibility, keyboard navigation, and Docker environment-variable substitution for Linux and Windows containers.", link: "" };
  oss[1].date = "2025 – Present";
  oss[1].bullets[0] = { ...oss[1].bullets[0], text: "22 pull requests across the GSoC 2025 microservices infrastructure and the copyright, nomos, and cp2foss agents.", link: "" };
  r.sections[7].items = ["Machine Learning", "Databases", "Data Structures & Algorithms", "Operating System Computer Vision", "Statistics", "Linear Algebra", "Computer Networks"].map((t) => item(t));
  return r;
}

/** Muhammad_Salman 1.pdf: Computer Modern, single column (Jake's-style). */
export function sampleClassic(): Resume {
  return {
    version: 1,
    template: "classic",
    pages: 1,
    paper: "letter",
    name: "Muhammad Salman",
    headline: "",
    contacts: [
      contact("phone", PHONE),
      contact("email", EMAIL, `mailto:${EMAIL}`),
      contact("location", "Lahore, Pakistan"),
      contact("linkedin", "in/msalman199", LI),
      contact("github", "github/SalmanDeveloperz", GH),
    ],
    sections: [
      section("summary", {
        text: "Software Engineer with 2+ years of hands-on experience across freelance, project-based work, and open source. Experienced in building and deploying cloud-native systems using Kubernetes, Docker, and CI/CD pipelines. Google Summer of Code 2025 contributor, where I developed and deployed Kubernetes-based microservices infrastructure and improved system reliability. Strong working knowledge of Kubernetes, Docker, Jenkins, AWS, and observability tools including Prometheus and Grafana.",
      }),
      section("experience", {
        entries: [
          entry({
            title: "Google Summer of Code 2025 @ FOSSology", subtitle: "Open Source Software Engineer", date: "Dec 2024 – Sep 2025",
            bullets: [
              "Designed and deployed complete Kubernetes microservices infrastructure for FOSSology on Minikube and Kind",
              "Migrated build system from Make to CMake, aligning infrastructure with modern DevOps practices",
              "Authored Dockerfiles and Kubernetes manifests for missing agents, completing full deployment coverage",
              "Resolved pod crashes, database connectivity failures, and 10+ build conflicts across containerized components",
              ["Structured Kustomization overlays for prod environments, improving scalability. Link", "https://summerofcode.withgoogle.com/archive/2025/projects/MjOyiOj7"],
            ],
          }),
          entry({
            title: "Freelance Software Engineer & DevOps", subtitle: "Self-Employed", date: "Aug 2023 – Present",
            bullets: [
              "Implemented CI/CD pipelines, containerized deployments, and automation workflows for multiple clients.",
              "Configured Jenkins and GitHub Actions workflows for automated build and deployment processes",
              "Built and deployed full-stack web interfaces using React and Node.js for local business clients",
              "Managed end-to-end project delivery including requirements, versioning, and client communication",
            ],
          }),
          entry({
            title: "Hywiz Technologies", subtitle: "Software Engineer Intern", date: "May 2023– Sep 2023",
            bullets: [
              "Converted UI designs into responsive interfaces using HTML, CSS, JavaScript, jQuery and Bootstrap",
              "Collaborated with QA and senior engineers in Agile sprints, tracking bugs and delivery via Jira",
              "Versioned and shipped JavaScript modules via Git, following team branching and pull request workflows",
              "Participated in code reviews, improving code quality and consistency across the codebase",
            ],
          }),
        ],
      }),
      section("projects", {
        entries: [
          entry({
            title: "OpenTelemetry Pipeline for Jenkins CI", meta: "OTel Collector, Jaeger, Prometheus, Docker", link: "https://github.com/SalmanDeveloperz/PoS-OTel",
            bullets: [
              "Built a full telemetry pipeline with tail-based sampling and CI-specific attribute enrichment",
              "Implemented intelligent routing and batch processing across distributed collector nodes",
            ],
          }),
          entry({
            title: "FOSSology Microservices Modernization", meta: "Kubernetes, Docker, CMake, PostgreSQL", link: "https://github.com/SalmanDeveloperz/GSoC-2025",
            bullets: [
              "Migrated FOSSology from monolithic architecture to production-ready microservices",
              "Improved system observability and reduced deployment friction across all environments",
            ],
          }),
        ],
      }),
      section("education", {
        entries: [entry({ title: "University of Agriculture, Faisalabad", subtitle: "Bachelors of Computer Science", meta: "CGPA: 3.35/4.0", date: "April 2022 – April 2026" })],
      }),
      section("skills", {
        skills: [
          skill("Languages", "Python, JavaScript, C++, PHP"),
          skill("Frontend & Backend", "React, Node.js, HTML, CSS"),
          skill("Infrastructure", "Kubernetes, Docker, Linux, Bash"),
          skill("DevOps", "Jenkins, GitHub Actions, Git, AWS, Azure, Prometheus, Grafana"),
          skill("Databases", "SQL, PostgreSQL, MySQL"),
        ],
      }),
      section("certifications", {
        items: [
          item("GitHub Actions for DevOps CI/CD", "https://www.coursera.org/account/accomplishments/verify/GMAKXRWN5BI1"),
          item("DevOps CI/CD: Multi-Project Pipelines", "https://www.udemy.com/certificate/UC-1c7793fb-4719-458e-8dbc-a8dad5f4b599/"),
          item("Kubernetes for Developers (LFD259)", "https://training.linuxfoundation.org/training/kubernetes-for-developers/"),
          item("Microsoft Azure AI Solutions", "https://learn.microsoft.com/en-gb/users/chsalman-8447/achievements/nzwnscaf"),
        ],
      }),
    ],
  };
}

/** Template 4.pdf: the Jane Doe original Blueprint was calibrated against (A4). */
export function sampleBlueprintRef(): Resume {
  return {
    version: 1, template: "blueprint", pages: 1, paper: "a4",
    name: "Jane Doe",
    headline: "",
    contacts: [
      contact("website", "jane-doe.com", "https://jane-doe.com"),
      contact("linkedin", "LinkedIn", "https://linkedin.com/in/jane-doe"),
      contact("github", "GitHub", "https://github.com/jane-doe"),
      contact("website", "Leetcode", "https://leetcode.com/jane-doe"),
      contact("location", "Anycity, Anystate, Anycountry"),
      contact("email", "jane.doe@anymail.com", "mailto:jane.doe@anymail.com"),
      contact("phone", "5555555555"),
    ],
    sections: [
      section("summary", { title: "Full Stack Developer", text: "I am a highly skilled web developer with over **3 years of experience** in **HTML, CSS, JavaScript, and PHP**. I have knowledge of popular frameworks such as **React, Angular, and Vue.js** and experience with REST APIs and MVC frameworks." }),
      section("skills", { title: "Technical Skills", skills: [
        skill("Languages", "JavaScript, PHP, Java, HTML, CSS"),
        skill("Frameworks", "React.js, Angular, Express, Node.js"),
        skill("Libraries", "Material, Redux, React Router"),
        skill("Databases", "MongoDB, PostgreSQL"),
        skill("Dev Tools", "Visual Studio Code, Git, Gitlab"),
      ] }),
      section("experience", { entries: [
        entry({ title: "Anycompany", subtitle: "Web Developer", date: "Apr 2022 – Present", location: "Remote – AnyCity, Anystate, Anycountry", bullets: [
          "Designed and developed dynamic and responsive websites using **HTML, CSS, JavaScript, and PHP**",
          "Worked with **REST APIs** to retrieve and display data from databases",
          "Improved **website performance** and speed through optimization techniques by **55%**",
        ] }),
        entry({ title: "Anycompany", subtitle: "Backend Developer", date: "Aug 2021 – Nov 2022", location: "Anycity, Anystate, Anycountry", bullets: [
          "Worked with **MVC frameworks** to develop robust and scalable backends",
          "Troubleshot and **fixed bugs** and issues in the backend to ensure **smooth operation** of the applications",
        ] }),
        entry({ subtitle: "Backend Developer Intern", date: "Jan 2021 – Aug 2021", bullets: [
          "Assisted senior web developers in the design and development of websites using **HTML, CSS, and JavaScript**",
        ] }),
      ] }),
      section("education", { entries: [
        entry({ title: "University of Anystate", subtitle: "Bachelor of Science in Computer Science", date: "Jan 2016 – Dec 2020", location: "Anycity, Anystate, Anycountry" }),
      ] }),
      section("projects", { entries: [
        entry({ title: "Project 1", meta: "React.js, Redux, PHP, MySQL Git", link: "https://proect1.com/source-code/", bullets: [
          "Designed and developed a clean and modern website using **HTML, CSS, and JavaScript**",
          "Optimized website for **speed and user experience**",
          "Utilized **responsive design** to ensure compatibility across all devices",
          "Deployed on GitHub pages via GitHub Actions",
        ] }),
        entry({ title: "Project 2", meta: "Node.js, Express, JavaScript, Git", link: "https://project2.com/source-code", bullets: [
          "A **CRUD application** exposed using a RESTful API made with Node.js",
          "Exposed POST, GET, PATCH and DELETE HTTP methods using **Express**",
        ] }),
      ] }),
      section("certifications", { items: [
        item("Certified Web Developer by the W3C", "https://dummy-certification.com"),
        item("Microsoft Certified: Azure Developer Associate", "https://dummy-certification.com"),
        item("AWS Certified Developer - Associate", "https://dummy-certification.com"),
      ] }),
    ],
  };
}

/** The originals each template was calibrated against (fidelity tests, import ground truth). */
export const REFERENCE = { classic: sampleClassic, academic: sampleAcademic, modern: sampleModern, blueprint: sampleBlueprintRef } as const;

// ── Showcase: what people see in the gallery and "Open the sample" ─────
// Salman's own resume in every layout, with phone and email left out and the
// portfolio (salman-ch.netlify.app) shown as "salman-ch".
const WEBSITE = () => contact("website", "salman-ch", "https://salman-ch.netlify.app");
const showContacts = (githubText: string) => [
  contact("linkedin", "in/msalman199", LI),
  contact("github", githubText, GH),
  WEBSITE(),
  contact("location", "Lahore, Pakistan"),
];

function showcaseBlueprint(): Resume {
  const m = sampleModern();
  const [summary, exp, , projects, skills, education] = m.sections;
  return {
    ...m,
    template: "blueprint",
    paper: "letter",
    contacts: [WEBSITE(), contact("linkedin", "in/msalman199", LI), contact("github", "SalmanDeveloperz", GH), contact("location", "Lahore, Pakistan")],
    sections: [
      { ...summary, title: "Backend Software Engineer" },
      { ...skills, title: "Technical Skills" },
      exp,
      projects,
      { ...education, entries: education.entries.map((e) => ({ ...e, title: "University of Agriculture, Faisalabad", location: "Faisalabad, Pakistan" })) },
    ],
  };
}

export const SAMPLES = {
  classic: () => ({ ...sampleClassic(), contacts: showContacts("github/SalmanDeveloperz") }),
  academic: () => ({ ...sampleAcademic(), contacts: showContacts("SalmanDeveloperz") }),
  modern: () => ({ ...sampleModern(), contacts: showContacts("SalmanDeveloperz") }),
  blueprint: showcaseBlueprint,
} satisfies Record<string, () => Resume>;
