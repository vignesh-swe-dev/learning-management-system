const env = require('./config/env');
const connectDB = require('./config/db');
const {
  User,
  Course,
  Module,
  Lesson,
  LessonProgress,
  Enrollment,
  Attendance,
  Assignment,
  Submission,
  Quiz,
  QuizAttempt,
  ActivityLog,
  Notification,
  Certificate,
} = require('./models');

async function run() {
  const password = process.env.SEED_PASSWORD || 'Password123';
  if (password.length < 8) {
    throw new Error('SEED_PASSWORD must be at least 8 characters');
  }
  if ((env.isProd || env.dbMode === 'atlas') && process.env.ALLOW_SEED !== 'true') {
    throw new Error('Refusing to seed a production/Atlas database: this wipes ALL data. Set ALLOW_SEED=true to override.');
  }
  await connectDB();

  console.log('Purging all existing mock and legacy data...');
  await Promise.all([
    User.deleteMany({}),
    Course.deleteMany({}),
    Module.deleteMany({}),
    Lesson.deleteMany({}),
    LessonProgress.deleteMany({}),
    Enrollment.deleteMany({}),
    Attendance.deleteMany({}),
    Assignment.deleteMany({}),
    Submission.deleteMany({}),
    Quiz.deleteMany({}),
    QuizAttempt.deleteMany({}),
    ActivityLog.deleteMany({}),
    Notification.deleteMany({}),
    Certificate.deleteMany({}),
  ]);
  console.log('Database cleared successfully.');

  console.log('Creating production-grade users...');
  const usersToCreate = [
    {
      name: 'Alex Vance',
      email: 'admin@lms.io',
      role: 'admin',
      phone: '+1 (555) 019-2831',
    },
    {
      name: 'Dr. Marcus Chen',
      email: 'marcus.chen@lms.io',
      role: 'instructor',
      phone: '+1 (555) 014-9923',
    },
    {
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@lms.io',
      role: 'instructor',
      phone: '+1 (555) 018-4412',
    },
    {
      name: 'Elena Rostova',
      email: 'elena.rostova@student.lms.io',
      role: 'student',
      phone: '+1 (555) 012-7744',
    },
    {
      name: 'David Kim',
      email: 'david.kim@student.lms.io',
      role: 'student',
      phone: '+1 (555) 013-8821',
    },
    {
      name: 'Maya Patel',
      email: 'maya.patel@student.lms.io',
      role: 'student',
      phone: '+1 (555) 015-3390',
    },
    {
      name: "Liam O'Connor",
      email: 'liam.o-connor@student.lms.io',
      role: 'student',
      phone: '+1 (555) 017-6625',
    },
    {
      name: 'Sophia Martinez',
      email: 'sophia.martinez@student.lms.io',
      role: 'student',
      phone: '+1 (555) 019-5501',
    },
    {
      name: 'Robert Martinez',
      email: 'robert.martinez@family.lms.io',
      role: 'parent',
      phone: '+1 (555) 019-5500',
    },
  ];

  const createdUsers = {};
  for (const item of usersToCreate) {
    const u = await User.create({ ...item, password });
    createdUsers[item.email] = u;
  }

  // Link Robert Martinez to his student daughter Sophia Martinez
  const parent = createdUsers['robert.martinez@family.lms.io'];
  const sophia = createdUsers['sophia.martinez@student.lms.io'];
  parent.linkedStudents = [sophia._id];
  await parent.save();

  console.log('Seeding real-world courses and curriculum...');

  const courseDefinitions = [
    {
      title: 'Enterprise Full-Stack Architecture: React, Node.js & Scalable Systems',
      category: 'Software Engineering',
      level: 'intermediate',
      durationHours: 32,
      description:
        'A comprehensive engineering program designed for modern web developers. Master modular microservices in Node.js, reactive state architectures in React 18, authenticated API gateways with JWT revocation, and event-driven architectures with WebSocket telemetry.',
      instructorEmail: 'marcus.chen@lms.io',
      modules: [
        {
          title: 'Foundations of Modern Distributed Systems',
          lessons: [
            {
              title: 'Client-Server Topology & HTTP/3 Protocol Mechanics',
              type: 'text',
              content:
                'Understanding modern network topologies: multiplexing, HTTP/2 and HTTP/3 stream handling, connection pooling, and latency minimization across edge networks. We analyze connection handshakes, TCP vs UDP-based QUIC transports, and stateless request negotiation.',
            },
            {
              title: 'Stateless Authentication: JWT Lifecycles & Server Revocation',
              type: 'text',
              content:
                'Deep dive into JSON Web Token (JWT) architecture. Learn cryptographic signing (HMAC-SHA256 vs RSA/ECDSA), payload security, refresh token rotations, and server-side blacklisting/revocation strategies to defend against token replay attacks.',
            },
            {
              title: 'Defensive API Design: Sanitization, Helmet & Rate Limiting',
              type: 'text',
              content:
                'Hardening Express and Node.js APIs against common OWASP vulnerabilities. Implement MongoDB query injection sanitizers (express-mongo-sanitize), Content Security Policies with Helmet, and token-bucket rate limiting against DDoS vectors.',
            },
          ],
        },
        {
          title: 'Reactive Frontend Engineering with React 18',
          lessons: [
            {
              title: 'Concurrent Rendering, Transitions & Reconciliation',
              type: 'text',
              content:
                'An architectural inspection of React 18 Concurrent Features: Fiber reconciliation algorithm, startTransition for non-blocking UI updates, Suspense boundaries for code splitting, and memoization patterns.',
            },
            {
              title: 'Real-Time Bi-Directional Sockets & Optimistic UI',
              type: 'text',
              content:
                'Wiring Socket.IO clients to React custom hooks. Handle heartbeat reconnects, room authorization, optimistic state updates with rollback on network failure, and debounced telemetry broadcasting.',
            },
          ],
        },
      ],
      assignment: {
        title: 'Architectural Blueprint: Secure API Gateway & Role-Based RBAC',
        description:
          'Design and document a production-ready API gateway architecture for an enterprise LMS. Include:\n1. JWT lifecycle management (access tokens, refresh tokens, instant revocation).\n2. Role-based permission matrix covering Admin, Instructor, Student, and Parent roles.\n3. Rate limiting and sanitization middleware pipeline with code examples.\n\nSubmit your technical report in PDF or Markdown format (minimum 500 words).',
        maxMarks: 100,
        allowLate: true,
        latePenaltyPercent: 10,
        dueDaysFromNow: 14,
      },
      quiz: {
        title: 'Midterm Evaluation: Distributed Sockets & Token Security',
        timeLimitMin: 20,
        maxAttempts: 2,
        questions: [
          {
            text: 'Why should sensitive user permissions be validated against a database or token version during critical operations, even with a valid JWT signature?',
            marks: 3,
            options: [
              { text: 'Because JWT claims cannot reflect real-time permission revocations until the token expires naturally.', isCorrect: true },
              { text: 'Because HMAC algorithms are computationally insecure for symmetric keys.', isCorrect: false },
              { text: 'Because browsers automatically strip the signature header on cross-origin calls.', isCorrect: false },
              { text: 'Because JSON cannot store integer user identifiers accurately.', isCorrect: false },
            ],
          },
          {
            text: 'Which React 18 hook should be utilized to mark state updates as non-urgent to avoid blocking user keystrokes in search fields?',
            marks: 3,
            options: [
              { text: 'useTransition (or startTransition)', isCorrect: true },
              { text: 'useLayoutEffect', isCorrect: false },
              { text: 'useImperativeHandle', isCorrect: false },
              { text: 'useId', isCorrect: false },
            ],
          },
          {
            text: 'Explain in 3-4 sentences how an optimistic UI update handles server-side validation rejections gracefully without corrupting client state.',
            marks: 9,
          },
        ],
      },
    },
    {
      title: 'Database Engineering & Query Optimization with MongoDB',
      category: 'Data Engineering',
      level: 'advanced',
      durationHours: 24,
      description:
        'Master high-performance document data modeling, WiredTiger engine internals, compound index optimization, aggregation pipelines, and sharded cluster scaling for multi-tenant SaaS workloads.',
      instructorEmail: 'sarah.jenkins@lms.io',
      modules: [
        {
          title: 'Document Data Modeling Patterns',
          lessons: [
            {
              title: 'Embedding vs Referencing: Balancing Write IO and Read Latency',
              type: 'text',
              content:
                'Explore the fundamental trade-offs between embedded document schemas and normalized reference patterns. We explore the 1:1, 1:N, and N:M relationship models, 16MB document limit constraints, and anti-patterns such as unbounded arrays.',
            },
            {
              title: 'Specialized Schema Patterns: Bucket, Subset & Outlier Design',
              type: 'text',
              content:
                'Real-world implementation of the Bucket Pattern for time-series and activity logs, the Subset Pattern for caching frequent top-N relationships, and the Schema Versioning pattern for zero-downtime database migrations.',
            },
          ],
        },
        {
          title: 'Indexing Mechanics & Aggregation Pipelines',
          lessons: [
            {
              title: 'Compound Indexes, Covered Queries & ESR Guideline',
              type: 'text',
              content:
                'Designing optimal compound indexes adhering to the Equality, Sort, Range (ESR) rule. Interpreting MongoDB execution plans using explain("executionStats"), detecting COLLSCAN vs IXSCAN, and achieving zero-fetch covered queries.',
            },
            {
              title: 'Multi-Stage Analytics with $facet, $bucket & $lookup',
              type: 'text',
              content:
                'Constructing powerful aggregation pipelines for operational analytics. Using $dateTrunc for date bucketing, $facet for multi-dimensional dashboards in a single round-trip, and optimizing uncorrelated $lookup stages.',
            },
          ],
        },
      ],
      assignment: {
        title: 'Query Optimization Challenge: High-Volume Analytics Pipeline',
        description:
          'Given an activity tracking collection with 10,000,000 document records, design an index strategy and an aggregation pipeline that produces daily student engagement metrics with sub-100ms response time. Submit your schema definition, index definitions, and aggregation pipeline script.',
        maxMarks: 100,
        allowLate: false,
        dueDaysFromNow: 10,
      },
      quiz: {
        title: 'Technical Certification: Index Mechanics & Query Execution',
        timeLimitMin: 25,
        maxAttempts: 1,
        questions: [
          {
            text: 'According to the ESR (Equality, Sort, Range) rule, what is the correct ordering of keys in a compound index for a query with equality filters on "status", sort on "createdAt", and range filter on "age"?',
            marks: 3,
            options: [
              { text: '{ status: 1, createdAt: -1, age: 1 }', isCorrect: true },
              { text: '{ age: 1, status: 1, createdAt: -1 }', isCorrect: false },
              { text: '{ createdAt: -1, status: 1, age: 1 }', isCorrect: false },
              { text: '{ status: 1, age: 1, createdAt: -1 }', isCorrect: false },
            ],
          },
          {
            text: 'What distinct advantage does a "Covered Query" provide during execution?',
            marks: 3,
            options: [
              { text: 'The database satisfies all filtered fields and projected fields entirely from the index without reading documents from disk.', isCorrect: true },
              { text: 'The query is wrapped in an ACID transaction across all replica set nodes.', isCorrect: false },
              { text: 'The database caches the full result set into shared client memory.', isCorrect: false },
              { text: 'It prevents schema validation errors on write operations.', isCorrect: false },
            ],
          },
          {
            text: 'Describe how the MongoDB WiredTiger storage engine uses checkpointing and write-ahead logging (journaling) to guarantee durability.',
            marks: 9,
          },
        ],
      },
    },
    {
      title: 'Cloud Infrastructure, Containers & DevOps Automation',
      category: 'Cloud & DevOps',
      level: 'beginner',
      durationHours: 20,
      description:
        'A hands-on guide to containerizing microservices, orchestrating build pipelines, provisioning infrastructure as code, and configuring observability telemetry for mission-critical deployments.',
      instructorEmail: 'sarah.jenkins@lms.io',
      modules: [
        {
          title: 'Docker Containerization & Layer Optimization',
          lessons: [
            {
              title: 'Container Primitives: Namespaces, cgroups & Layer Caching',
              type: 'text',
              content:
                'Explore the Linux kernel primitives underpinning containers: PID/Network namespaces, control groups for resource budgeting, union file systems, and structuring Dockerfiles to maximize build cache efficiency.',
            },
            {
              title: 'Multi-Stage Builds & Distroless Hardening',
              type: 'text',
              content:
                'Crafting production container images with multi-stage builds. Strip build toolchains, reduce final image attack surface with distroless base images, and enforce unprivileged non-root user execution.',
            },
          ],
        },
        {
          title: 'Continuous Integration & Observability Telemetry',
          lessons: [
            {
              title: 'Automated CI Pipelines: Unit, Integration & Lint Gates',
              type: 'text',
              content:
                'Building automated CI verification workflows. Automating automated regression test runs, code coverage thresholds, dependency vulnerability scans (npm audit / Snyk), and container image tagging.',
            },
            {
              title: 'Structured Logging, APM & Health Check Endpoints',
              type: 'text',
              content:
                'Implementing production-grade telemetry. Format logs in structured JSON, configure liveness and readiness probe endpoints, measure response percentiles (p95/p99), and monitor system memory utilization.',
            },
          ],
        },
      ],
      assignment: {
        title: 'CI/CD Pipeline & Multi-Stage Dockerfile Implementation',
        description:
          'Create a production-ready, multi-stage Dockerfile for a Node.js full-stack application and define a CI pipeline workflow configuration that runs linting, unit testing, and builds a minimal security-hardened image.',
        maxMarks: 100,
        allowLate: true,
        latePenaltyPercent: 5,
        dueDaysFromNow: 21,
      },
      quiz: {
        title: 'Core Fundamentals: Container Lifecycle & Automation',
        timeLimitMin: 15,
        maxAttempts: 3,
        questions: [
          {
            text: 'Why are multi-stage Docker builds recommended for compiled or bundled JavaScript applications?',
            marks: 3,
            options: [
              { text: 'They separate compiler tools and devDependencies from the final lean runtime container image.', isCorrect: true },
              { text: 'They allow running multiple operating systems inside one container instance.', isCorrect: false },
              { text: 'They bypass kernel-level security audits automatically.', isCorrect: false },
              { text: 'They eliminate the need for container orchestrators like Kubernetes.', isCorrect: false },
            ],
          },
          {
            text: 'In container orchestration, what is the purpose of a "Readiness Probe" versus a "Liveness Probe"?',
            marks: 7,
          },
        ],
      },
    },
  ];

  const adminUser = createdUsers['admin@lms.io'];
  const studentElena = createdUsers['elena.rostova@student.lms.io'];
  const studentDavid = createdUsers['david.kim@student.lms.io'];
  const studentSophia = createdUsers['sophia.martinez@student.lms.io'];
  const studentMaya = createdUsers['maya.patel@student.lms.io'];
  const studentLiam = createdUsers['liam.o-connor@student.lms.io'];

  const allStudents = [studentElena, studentDavid, studentSophia, studentMaya, studentLiam];

  for (const cDef of courseDefinitions) {
    const instructor = createdUsers[cDef.instructorEmail];
    const course = await Course.create({
      title: cDef.title,
      category: cDef.category,
      level: cDef.level,
      durationHours: cDef.durationHours,
      description: cDef.description,
      status: 'published',
      instructors: [instructor._id],
      createdBy: adminUser._id,
    });

    const createdLessons = [];
    for (const [mi, modDef] of cDef.modules.entries()) {
      const moduleRecord = await Module.create({
        course: course._id,
        title: modDef.title,
        order: mi,
      });

      for (const [li, lessonDef] of modDef.lessons.entries()) {
        const lesson = await Lesson.create({
          course: course._id,
          module: moduleRecord._id,
          title: lessonDef.title,
          type: lessonDef.type,
          content: lessonDef.content,
          durationSec: 900 + li * 300,
          order: li,
        });
        createdLessons.push(lesson);
      }
    }

    // Create Assignment
    const dueAt = new Date(Date.now() + (cDef.assignment.dueDaysFromNow || 14) * 24 * 3600 * 1000);
    const assignment = await Assignment.create({
      course: course._id,
      title: cDef.assignment.title,
      description: cDef.assignment.description,
      maxMarks: cDef.assignment.maxMarks,
      allowLate: cDef.assignment.allowLate,
      latePenaltyPercent: cDef.assignment.latePenaltyPercent || 0,
      dueAt,
      createdBy: instructor._id,
    });

    // Create Quiz
    const quiz = await Quiz.create({
      course: course._id,
      title: cDef.quiz.title,
      timeLimitMin: cDef.quiz.timeLimitMin,
      maxAttempts: cDef.quiz.maxAttempts,
      createdBy: instructor._id,
      questions: cDef.quiz.questions,
    });

    // Enroll students into courses
    for (const st of allStudents) {
      await Enrollment.create({
        student: st._id,
        course: course._id,
        status: 'active',
      });
    }

    // Populate realistic lesson progress for Elena and Sophia
    for (const l of createdLessons.slice(0, 2)) {
      await LessonProgress.create({
        student: studentElena._id,
        lesson: l._id,
        course: course._id,
        status: 'completed',
        watchedSec: l.durationSec,
        completedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      });

      await LessonProgress.create({
        student: studentSophia._id,
        lesson: l._id,
        course: course._id,
        status: 'completed',
        watchedSec: l.durationSec,
        completedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      });
    }

    // Create sample submission for Elena on the first course assignment
    if (cDef === courseDefinitions[0]) {
      await Submission.create({
        assignment: assignment._id,
        student: studentElena._id,
        answerText:
          'Architecture Overview:\nOur API Gateway implements token verification with RSA-256 asymmetric signing. Access tokens expire in 15 minutes, while refresh tokens are held in httpOnly secure cookies. Middleware layers execute in strict sequence: RateLimiter -> Helmet -> MongoSanitizer -> JWTVerifier -> RoleAuthorizer.',
        status: 'graded',
        marks: 96,
        finalMarks: 96,
        gradedBy: instructor._id,
        feedback: 'Outstanding architectural analysis. Clear separation of concerns and robust security considerations.',
        gradedAt: new Date(),
        submittedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      });

      // Also create a sample submission for Sophia awaiting grading
      await Submission.create({
        assignment: assignment._id,
        student: studentSophia._id,
        answerText:
          'Security Pipeline Design:\n1. Incoming requests enter through reverse proxy with TLS 1.3 termination.\n2. Express rate-limit restricts clients to 100 requests per 15-minute window.\n3. RBAC validation checks claims embedded inside authenticated bearer tokens.',
        status: 'submitted',
        submittedAt: new Date(Date.now() - 12 * 3600 * 1000),
      });
    }

    // Create sample quiz attempt
    if (cDef === courseDefinitions[0]) {
      await QuizAttempt.create({
        quiz: quiz._id,
        student: studentElena._id,
        attemptNumber: 1,
        status: 'graded',
        score: 15,
        maxScore: 15,
        answers: [
          {
            question: quiz.questions[0]._id,
            selectedOption: quiz.questions[0].options[0]._id,
            correct: true,
            marksAwarded: 3,
          },
          {
            question: quiz.questions[1]._id,
            selectedOption: quiz.questions[1].options[0]._id,
            correct: true,
            marksAwarded: 3,
          },
          {
            question: quiz.questions[2]._id,
            text:
              'Optimistic UI immediately renders the anticipated response in local state before the HTTP round-trip finishes. If the server responds with a 4xx/5xx rejection, the client catches the error, rolls back the local cache to its previous snapshot, and alerts the user.',
            marksAwarded: 9,
          },
        ],
        submittedAt: new Date(Date.now() - 48 * 3600 * 1000),
      });
    }

    // Create an active attendance session for the primary course
    if (cDef === courseDefinitions[0]) {
      await Attendance.create({
        course: course._id,
        instructor: instructor._id,
        title: 'Live Architecture Workshop: Distributed Scalability',
        status: 'open',
        openedAt: new Date(Date.now() - 25 * 60 * 1000),
        startsAt: new Date(Date.now() - 30 * 60 * 1000),
        records: [
          {
            student: studentElena._id,
            joinedAt: new Date(Date.now() - 22 * 60 * 1000),
            durationSec: 1320,
          },
          {
            student: studentSophia._id,
            joinedAt: new Date(Date.now() - 18 * 60 * 1000),
            durationSec: 1080,
          },
          {
            student: studentDavid._id,
            joinedAt: new Date(Date.now() - 15 * 60 * 1000),
            durationSec: 900,
          },
        ],
      });
    }
  }

  // Add initial notifications for students
  await Notification.create({
    user: studentElena._id,
    title: 'Assignment Graded: API Gateway Blueprint',
    body: 'Dr. Marcus Chen graded your submission with 96/100 marks: "Outstanding architectural analysis."',
    link: '/results',
    type: 'grade',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000),
  });

  await Notification.create({
    user: studentSophia._id,
    title: 'Live Session Started: Distributed Scalability Workshop',
    body: 'Dr. Marcus Chen has opened the live lecture session. Click to join attendance.',
    link: '/attendance',
    type: 'attendance',
    createdAt: new Date(Date.now() - 25 * 60 * 1000),
  });

  console.log('Seeded 9 production-grade users, 3 enterprise courses with modules, lessons, assignments, quizzes, and live activity.');
  console.log('Credentials Summary:');
  console.log('Admin:        admin@lms.io           / Password123');
  console.log('Instructor 1: marcus.chen@lms.io     / Password123');
  console.log('Instructor 2: sarah.jenkins@lms.io   / Password123');
  console.log('Student 1:    elena.rostova@student.lms.io / Password123');
  console.log('Student 2:    sophia.martinez@student.lms.io / Password123');
  console.log('Parent:       robert.martinez@family.lms.io / Password123');
  process.exit(0);
}

run().catch((e) => {
  console.error('Seeding error:', e);
  process.exit(1);
});
