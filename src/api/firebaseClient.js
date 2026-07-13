/**
 * firebaseClient.js
 *
 * Drop-in replacement for the base44 SDK client.
 * Exposes the same API surface (base44.auth, base44.entities, base44.integrations, base44.functions)
 * backed by Firebase Auth + Firestore + Firebase Storage, and OpenAI for LLM calls.
 *
 * Required env vars (VITE_*):
 *   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
 *   VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
 *   VITE_OPENAI_API_KEY  (optional – LLM features disabled if absent)
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  deleteUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Entity name → Firestore collection mapping
// ─────────────────────────────────────────────────────────────────────────────
const COLLECTIONS = {
  AttackLog:        'attackLogs',
  Badge:            'badges',
  CourseEnrollment: 'courseEnrollments',
  CourseProgress:   'courseProgress',
  CustomScenario:   'customScenarios',
  Discussion:       'discussions',
  DiscussionReply:  'discussionReplies',
  DiscussionUpvote: 'discussionUpvotes',
  LearningPath:     'learningPaths',
  Quiz:             'quizzes',
  QuizAttempt:      'quizAttempts',
  QuizBookmark:     'quizBookmarks',
  Room:             'rooms',
  RoomComment:      'roomComments',
  User:             'users',
  UserBadge:        'userBadges',
  UserProgress:     'userProgress',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Parse sort string like '-created_date' into [field, direction]. */
function parseSort(sort) {
  if (!sort || typeof sort !== 'string') return null;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return [field, desc ? 'desc' : 'asc'];
}

/** Convert a Firestore snapshot to a plain object with `id`. */
function docToObj(docSnap) {
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

/** Build a Firestore query from optional filter map, sort string, and limit. */
function buildQuery(colRef, filters = {}, sort, limitN) {
  const constraints = [];
  for (const [k, v] of Object.entries(filters)) {
    if (k !== 'id') constraints.push(where(k, '==', v));
  }
  const sortParsed = parseSort(sort);
  if (sortParsed) constraints.push(orderBy(...sortParsed));
  if (limitN) constraints.push(fbLimit(limitN));
  return query(colRef, ...constraints);
}

/** Return ISO timestamp for now. */
const now = () => new Date().toISOString();

// ─────────────────────────────────────────────────────────────────────────────
// Entity proxy factory
// ─────────────────────────────────────────────────────────────────────────────
function createEntityProxy(entityName) {
  const colName = COLLECTIONS[entityName];
  if (!colName) {
    console.warn(`[firebaseClient] Unknown entity: ${entityName}`);
    return {};
  }
  const colRef = () => collection(db, colName);

  return {
    /** list(sort?, limit?) → array of docs */
    async list(sort, limitN) {
      const q = buildQuery(colRef(), {}, sort, limitN);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    /** filter(query, sort?, limit?) → array of docs */
    async filter(filters = {}, sort, limitN) {
      // Special-case: filter by id → fetch single doc
      if (filters.id) {
        const docSnap = await getDoc(doc(db, colName, filters.id));
        return docSnap.exists() ? [docToObj(docSnap)] : [];
      }
      const q = buildQuery(colRef(), filters, sort, limitN);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    /** create(data) → created doc with id */
    async create(data) {
      const payload = { ...data, created_date: now(), updated_date: now() };
      const docRef = await addDoc(colRef(), payload);
      return { id: docRef.id, ...payload };
    },

    /** update(id, data) → void */
    async update(id, data) {
      await updateDoc(doc(db, colName, id), { ...data, updated_date: now() });
    },

    /** delete(id) → void */
    async delete(id) {
      await deleteDoc(doc(db, colName, id));
    },

    /** subscribe(callback) → unsubscribe function */
    subscribe(callback) {
      return onSnapshot(colRef(), callback);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// entities proxy — auto-creates entity proxies by property name
// ─────────────────────────────────────────────────────────────────────────────
const _entityCache = {};
const entities = new Proxy({}, {
  get(_, entityName) {
    if (!_entityCache[entityName]) {
      _entityCache[entityName] = createEntityProxy(entityName);
    }
    return _entityCache[entityName];
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth — get/merge Firebase user + Firestore profile
// ─────────────────────────────────────────────────────────────────────────────

async function getUserProfile(firebaseUser) {
  if (!firebaseUser) return null;
  const profileSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
  const profile = profileSnap.exists() ? profileSnap.data() : {};
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email,
    full_name: firebaseUser.displayName || profile.full_name || '',
    avatar_url: profile.avatar_url || null,
    bio: profile.bio || '',
    links: profile.links || [],
    use_gravatar: profile.use_gravatar !== false,
    email_verified: firebaseUser.emailVerified,
    ...profile,
  };
}

const fbAuth = {
  async me() {
    const user = auth.currentUser;
    if (!user) throw Object.assign(new Error('Not authenticated'), { status: 401 });
    return getUserProfile(user);
  },

  async loginViaEmailPassword(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return getUserProfile(cred.user);
  },

  async loginWithProvider(provider, redirectPath = '/') {
    let providerObj;
    if (provider === 'google') {
      providerObj = new GoogleAuthProvider();
    } else if (provider === 'microsoft') {
      providerObj = new OAuthProvider('microsoft.com');
    } else if (provider === 'apple') {
      providerObj = new OAuthProvider('apple.com');
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    const cred = await signInWithPopup(auth, providerObj);
    // Ensure Firestore user doc exists
    await _ensureUserDoc(cred.user);
    window.location.href = redirectPath;
  },

  logout(redirectUrl) {
    signOut(auth).then(() => {
      if (redirectUrl && typeof redirectUrl === 'string') {
        window.location.href = '/login';
      }
    });
  },

  async register({ email, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Send verification email
    await sendEmailVerification(cred.user);
    // Create Firestore user doc
    await _ensureUserDoc(cred.user);
    return cred.user;
  },

  /** Firebase doesn't use OTP — just check if email is verified */
  async verifyOtp({ email, otpCode: _otpCode }) {
    // After registration, user needs to verify email.
    // We can't verify OTP client-side with Firebase — just reload auth state
    await auth.currentUser?.reload();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return { access_token: await user.getIdToken() };
  },

  async resendOtp(email) {
    const user = auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
    }
  },

  async resetPasswordRequest(email) {
    const actionCodeSettings = {
      url: `${window.location.origin}${import.meta.env.BASE_URL}reset-password`,
      handleCodeInApp: false,
    };
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
  },

  async resetPassword({ resetToken, newPassword }) {
    // resetToken here is the Firebase oobCode from the reset email URL
    await confirmPasswordReset(auth, resetToken, newPassword);
  },

  setToken(_token) {
    // No-op: Firebase manages tokens internally
  },

  redirectToLogin() {
    window.location.href = `${import.meta.env.BASE_URL}login`;
  },

  async updateMe(data) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    // Update Firebase display name if provided
    if (data.full_name !== undefined) {
      await updateProfile(user, { displayName: data.full_name });
    }
    // Merge into Firestore user doc
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { ...data, updated_date: now() }, { merge: true });
    return getUserProfile(user);
  },
};

/** Ensure a Firestore /users/{uid} document exists for a new Firebase user. */
async function _ensureUserDoc(firebaseUser) {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      email: firebaseUser.email,
      full_name: firebaseUser.displayName || '',
      avatar_url: null,
      bio: '',
      links: [],
      use_gravatar: true,
      created_date: now(),
      updated_date: now(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM — OpenAI API via VITE_OPENAI_API_KEY
// ─────────────────────────────────────────────────────────────────────────────
async function invokeLLM({ prompt, response_json_schema, add_context_from_internet: _ctx }) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[firebaseClient] VITE_OPENAI_API_KEY not set — LLM features disabled.');
    return {};
  }

  const messages = [{ role: 'user', content: prompt }];
  const body = {
    model: 'gpt-4o-mini',
    messages,
  };

  if (response_json_schema) {
    body.response_format = { type: 'json_object' };
    // Append schema hint to prompt
    body.messages = [
      { role: 'system', content: 'Respond ONLY with valid JSON matching the schema: ' + JSON.stringify(response_json_schema) },
      { role: 'user', content: prompt },
    ];
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File Upload — Firebase Storage
// ─────────────────────────────────────────────────────────────────────────────
async function uploadFile({ file }) {
  const user = auth.currentUser;
  const uid = user?.uid || 'anonymous';
  const filename = `${uid}/${Date.now()}_${file.name}`;
  const ref = storageRef(storage, filename);
  await uploadBytes(ref, file);
  const url = await getDownloadURL(ref);
  return { file_url: url };
}

// ─────────────────────────────────────────────────────────────────────────────
// Email — contact via FormSubmit (no account needed)
// ─────────────────────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, body: emailBody }) {
  // FormSubmit.co: POST to https://formsubmit.co/your@email.com
  // This is a free, no-signup service for static sites.
  const endpoint = `https://formsubmit.co/ajax/${encodeURIComponent(to)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ subject, message: emailBody }),
  });
  if (!res.ok) throw new Error('Failed to send email');
  return await res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificate generation — client-side PDF via jsPDF
// ─────────────────────────────────────────────────────────────────────────────
async function generateCertificate({ quiz_title, score, attempt_date }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Background
  doc.setFillColor(10, 10, 20);
  doc.rect(0, 0, 297, 210, 'F');

  // Border
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(2);
  doc.rect(10, 10, 277, 190, 'S');

  // Title
  doc.setTextColor(99, 102, 241);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('HackQuest', 148.5, 45, { align: 'center' });

  doc.setTextColor(220, 220, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Certificate of Completion', 148.5, 58, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(quiz_title || 'Quiz', 148.5, 90, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 255);
  doc.text(`Score: ${Math.round(score)}%`, 148.5, 108, { align: 'center' });

  const dateStr = attempt_date ? new Date(attempt_date).toLocaleDateString() : new Date().toLocaleDateString();
  doc.text(`Completed: ${dateStr}`, 148.5, 120, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 180);
  doc.text('This certificate was generated by HackQuest Cybersecurity Training Platform', 148.5, 185, { align: 'center' });

  return { data: doc.output('arraybuffer') };
}

// ─────────────────────────────────────────────────────────────────────────────
// Named function invocations (replaces base44.functions.invoke)
// ─────────────────────────────────────────────────────────────────────────────

async function invokeFunctions(name, params = {}) {
  switch (name) {
    case 'deleteUserAccount': {
      const user = auth.currentUser;
      if (user) await deleteUser(user);
      return {};
    }

    case 'generateCertificate':
      return generateCertificate(params);

    case 'getCourseRecommendations': {
      const { studentName, enrollments = [], courseProgress = [] } = params;
      const prompt = `You are a cybersecurity education advisor.
Student: ${studentName || 'learner'}
Enrollments: ${JSON.stringify(enrollments.slice(0, 5))}
Progress: ${JSON.stringify(courseProgress.slice(0, 10))}

Generate personalized learning recommendations as JSON:
{
  "summary": "brief assessment of the student",
  "recommendations": [
    {
      "title": "course/topic name",
      "type": "course|lab|quiz",
      "difficulty": "beginner|intermediate|advanced",
      "category": "linux|web_hacking|...",
      "priority": "high|medium|low",
      "reason": "why this is recommended"
    }
  ]
}`;
      const result = await invokeLLM({ prompt, response_json_schema: { type: 'object' } });
      return { data: result };
    }

    case 'generatePathMaterial':
    case 'generateLearningMaterial': {
      // These were heavy server-side batch jobs; return a stub response.
      console.info(`[firebaseClient] ${name} is a server-only function and is not available in static mode.`);
      return { data: { results: [] } };
    }

    case 'linkRoomsToPaths': {
      console.info('[firebaseClient] linkRoomsToPaths is a server-only function and is not available in static mode.');
      return { data: { results: [] } };
    }

    case 'terminalExecute': {
      // Stub — the terminal component already handles local commands
      return { data: { output: `[Remote execution not available in static mode]\n$ ${params.command || ''}` } };
    }

    default:
      console.warn(`[firebaseClient] Unknown function: ${name}`);
      return { data: {} };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — mirrors the base44 SDK surface
// ─────────────────────────────────────────────────────────────────────────────
export const base44 = {
  auth: fbAuth,
  entities,
  integrations: {
    Core: {
      InvokeLLM: invokeLLM,
      SendEmail: sendEmail,
      UploadFile: uploadFile,
    },
  },
  functions: {
    invoke: invokeFunctions,
  },
};

// Also export helpers for AuthContext
export { getUserProfile };
