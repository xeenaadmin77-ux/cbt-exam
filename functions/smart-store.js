/**
 * Smart Dual-Mode Database Store
 * 
 * Provides transparent fallback to an in-memory/JSON store when Cloud Firestore
 * API is not enabled in the current GCP project (SERVICE_DISABLED / PERMISSION_DENIED)
 * or when running offline in college computer labs or on mobile devices (Termux/Acode).
 */

class MockDocSnapshot {
  constructor(id, data) {
    this.id = id;
    this._data = data ? JSON.parse(JSON.stringify(data)) : null;
    this.exists = this._data !== null && this._data !== undefined;
  }
  data() {
    return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
  }
}

class MockQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }
  forEach(cb) {
    this.docs.forEach(cb);
  }
}

class MockCollectionRef {
  constructor(store, path) {
    this.store = store;
    this.path = path;
  }

  doc(id) {
    const docId = id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    return new MockDocRef(this.store, `${this.path}/${docId}`, docId);
  }

  async add(data) {
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const docRef = new MockDocRef(this.store, `${this.path}/${docId}`, docId);
    await docRef.set(data);
    return { id: docId };
  }

  where(field, op, val) {
    return new MockQuery(this.store, this.path, [{ field, op, val }], [], null);
  }

  orderBy(field, dir = 'asc') {
    return new MockQuery(this.store, this.path, [], [{ field, dir }], null);
  }

  limit(count) {
    return new MockQuery(this.store, this.path, [], [], count);
  }

  async get() {
    return new MockQuery(this.store, this.path, [], [], null).get();
  }
}

class MockQuery {
  constructor(store, path, filters, orders, limitCount) {
    this.store = store;
    this.path = path;
    this.filters = filters || [];
    this.orders = orders || [];
    this.limitCount = limitCount;
  }

  where(field, op, val) {
    return new MockQuery(
      this.store,
      this.path,
      [...this.filters, { field, op, val }],
      this.orders,
      this.limitCount
    );
  }

  orderBy(field, dir = 'asc') {
    return new MockQuery(
      this.store,
      this.path,
      this.filters,
      [...this.orders, { field, dir }],
      this.limitCount
    );
  }

  limit(count) {
    return new MockQuery(this.store, this.path, this.filters, this.orders, count);
  }

  async get() {
    let items = this.store.getCollection(this.path);

    // Apply filters
    for (const f of this.filters) {
      items = items.filter(item => {
        const val = item.data[f.field];
        if (f.op === '==' || f.op === '===') {
          return val === f.val || (typeof val === 'string' && typeof f.val === 'string' && val.toLowerCase() === f.val.toLowerCase());
        }
        if (f.op === 'in') {
          return Array.isArray(f.val) && f.val.includes(val);
        }
        if (f.op === '>') return val > f.val;
        if (f.op === '>=') return val >= f.val;
        if (f.op === '<') return val < f.val;
        if (f.op === '<=') return val <= f.val;
        if (f.op === '!=') return val !== f.val;
        return true;
      });
    }

    // Apply orders
    for (const o of this.orders) {
      items.sort((a, b) => {
        const va = a.data[o.field];
        const vb = b.data[o.field];
        if (va < vb) return o.dir === 'desc' ? 1 : -1;
        if (va > vb) return o.dir === 'desc' ? -1 : 1;
        return 0;
      });
    }

    // Apply limit
    if (this.limitCount && this.limitCount > 0) {
      items = items.slice(0, this.limitCount);
    }

    const docs = items.map(item => new MockDocSnapshot(item.id, item.data));
    return new MockQuerySnapshot(docs);
  }
}

class MockDocRef {
  constructor(store, fullPath, id) {
    this.store = store;
    this.fullPath = fullPath;
    this.id = id;
  }

  collection(subCollectionName) {
    return new MockCollectionRef(this.store, `${this.fullPath}/${subCollectionName}`);
  }

  async get() {
    const data = this.store.getDoc(this.fullPath);
    return new MockDocSnapshot(this.id, data);
  }

  async set(data, options = {}) {
    if (options.merge) {
      const existing = this.store.getDoc(this.fullPath) || {};
      this.store.setDoc(this.fullPath, { ...existing, ...data });
    } else {
      this.store.setDoc(this.fullPath, data);
    }
  }

  async update(data) {
    const existing = this.store.getDoc(this.fullPath) || {};
    this.store.setDoc(this.fullPath, { ...existing, ...data });
  }

  async delete() {
    this.store.deleteDoc(this.fullPath);
  }
}

class LocalStore {
  constructor() {
    this.data = new Map();
    this.seedInitialData();
  }

  seedInitialData() {
    // 1. Settings
    this.setDoc('settings/college_config', {
      collegeName: 'XEENA INSTITUTE OF SKILL DEVELOPMENT',
      tagline: 'Centre of Excellence in Vocational & Technical Training',
      labName: 'Main Computer Examination Lab Room 1'
    });

    this.setDoc('settings/private_config', {
      exitPassword: 'admin'
    });

    // 2. Teachers / Faculty
    const teacherId = 'teacher_001';
    this.setDoc(`teachers/${teacherId}`, {
      uid: teacherId,
      name: 'Prof. S. Sengupta (Faculty In-Charge)',
      email: 'teacher@xeena.edu',
      role: 'teacher',
      active: true,
      createdAt: new Date().toISOString()
    });
    this.setDoc(`users/${teacherId}`, {
      uid: teacherId,
      name: 'Prof. S. Sengupta (Faculty In-Charge)',
      email: 'teacher@xeena.edu',
      role: 'teacher',
      createdAt: new Date().toISOString()
    });

    // Also support admin login email: admin@xeena.edu
    const adminId = 'admin_001';
    this.setDoc(`teachers/${adminId}`, {
      uid: adminId,
      name: 'XEENA CBT Lab Administrator',
      email: 'admin@xeena.edu',
      role: 'teacher',
      active: true,
      createdAt: new Date().toISOString()
    });
    this.setDoc(`users/${adminId}`, {
      uid: adminId,
      name: 'XEENA CBT Lab Administrator',
      email: 'admin@xeena.edu',
      role: 'teacher',
      createdAt: new Date().toISOString()
    });

    // 3. Students
    const students = [
      {
        uid: 'student_ranit',
        name: 'Ranit Biswas',
        username: 'ranit.biswas',
        admissionNumber: 'XEENA2025001',
        trade: 'COPA',
        batch: '2024-2026',
        rollNumber: 'COP-01',
        role: 'student',
        active: true
      },
      {
        uid: 'student_subham',
        name: 'Subham Mondal',
        username: 'subham.mondal',
        admissionNumber: 'XEENA2025002',
        trade: 'Electrician',
        batch: '2024-2026',
        rollNumber: 'ELC-02',
        role: 'student',
        active: true
      },
      {
        uid: 'student_priyanka',
        name: 'Priyanka Das',
        username: 'priyanka.das',
        admissionNumber: 'XEENA2025003',
        trade: 'Fitter',
        batch: '2024-2026',
        rollNumber: 'FIT-03',
        role: 'student',
        active: true
      }
    ];

    for (const s of students) {
      this.setDoc(`students/${s.uid}`, { ...s, createdAt: new Date().toISOString() });
      this.setDoc(`users/${s.uid}`, { uid: s.uid, name: s.name, email: `${s.username}@xeena.edu`, role: 'student', createdAt: new Date().toISOString() });
    }

    // 4. Sample Exams
    const copaExamId = 'exam_copa_01';
    this.setDoc(`exams/${copaExamId}`, {
      examId: copaExamId,
      title: 'COPA Trade Semester 1 Computer Based Examination',
      description: 'Comprehensive evaluation of ITI Computer Operator & Programming Assistant trade fundamentals.',
      trade: 'COPA',
      month: 'September 2026',
      durationMinutes: 30,
      enablePerQuestionTimer: false,
      perQuestionTimerSeconds: 60,
      totalQuestions: 5,
      totalMarks: 50,
      passPercentage: 40,
      published: true,
      showResultImmediately: true,
      resultsPublished: true,
      createdBy: teacherId,
      createdAt: Date.now() - 3600000
    });

    const copaQuestions = [
      {
        questionId: 'q_copa_01',
        examId: copaExamId,
        questionText: 'Which of the following is considered the central processing brain of a computer system?',
        optionA: 'Arithmetic Logic Unit (ALU)',
        optionB: 'Central Processing Unit (CPU)',
        optionC: 'Random Access Memory (RAM)',
        optionD: 'Hard Disk Drive (HDD)',
        correctAnswer: 'B',
        marks: 10,
        timeLimitSeconds: 60
      },
      {
        questionId: 'q_copa_02',
        examId: copaExamId,
        questionText: 'What type of memory is volatile and loses its contents when power is switched off?',
        optionA: 'ROM',
        optionB: 'Flash Drive',
        optionC: 'RAM',
        optionD: 'Optical DVD',
        correctAnswer: 'C',
        marks: 10,
        timeLimitSeconds: 60
      },
      {
        questionId: 'q_copa_03',
        examId: copaExamId,
        questionText: 'In Windows command line (CMD), which command is used to test reachability of a network host?',
        optionA: 'ipconfig',
        optionB: 'ping',
        optionC: 'netstat',
        optionD: 'tracert',
        correctAnswer: 'B',
        marks: 10,
        timeLimitSeconds: 60
      },
      {
        questionId: 'q_copa_04',
        examId: copaExamId,
        questionText: 'In Microsoft Excel spreadsheets, every mathematical formula must strictly begin with which symbol?',
        optionA: '#',
        optionB: '$',
        optionC: '=',
        optionD: '@',
        correctAnswer: 'C',
        marks: 10,
        timeLimitSeconds: 60
      },
      {
        questionId: 'q_copa_05',
        examId: copaExamId,
        questionText: 'Which standard keyboard shortcut key is universally used to undo the last editing action in Windows applications?',
        optionA: 'Ctrl + Y',
        optionB: 'Ctrl + Z',
        optionC: 'Ctrl + X',
        optionD: 'Ctrl + U',
        correctAnswer: 'B',
        marks: 10,
        timeLimitSeconds: 60
      }
    ];

    for (const q of copaQuestions) {
      this.setDoc(`exams/${copaExamId}/questions/${q.questionId}`, q);
    }

    // Electrician Exam
    const elecExamId = 'exam_elec_01';
    this.setDoc(`exams/${elecExamId}`, {
      examId: elecExamId,
      title: 'Electrician Trade Semester 1 CBT',
      description: 'Standard technical examination on Ohm law, circuit safety, and electrical wiring concepts.',
      trade: 'Electrician',
      month: 'September 2026',
      durationMinutes: 30,
      enablePerQuestionTimer: false,
      perQuestionTimerSeconds: 60,
      totalQuestions: 3,
      totalMarks: 30,
      passPercentage: 40,
      published: true,
      showResultImmediately: true,
      resultsPublished: true,
      createdBy: teacherId,
      createdAt: Date.now() - 7200000
    });

    const elecQuestions = [
      {
        questionId: 'q_elec_01',
        examId: elecExamId,
        questionText: 'What is the standard SI unit of electrical resistance?',
        optionA: 'Volt',
        optionB: 'Ampere',
        optionC: 'Ohm',
        optionD: 'Watt',
        correctAnswer: 'C',
        marks: 10,
        timeLimitSeconds: 60
      },
      {
        questionId: 'q_elec_02',
        examId: elecExamId,
        questionText: 'Which electrical testing instrument is connected in series to measure electric current in a circuit?',
        optionA: 'Voltmeter',
        optionB: 'Ammeter',
        optionC: 'Wattmeter',
        optionD: 'Multimeter in parallel mode',
        correctAnswer: 'B',
        marks: 10,
        timeLimitSeconds: 60
      },
      {
        questionId: 'q_elec_03',
        examId: elecExamId,
        questionText: 'According to standard Indian Electrical Code (BIS), what color wire is used for Earth/Ground connection?',
        optionA: 'Red',
        optionB: 'Black',
        optionC: 'Green / Yellow-Green',
        optionD: 'Blue',
        correctAnswer: 'C',
        marks: 10,
        timeLimitSeconds: 60
      }
    ];

    for (const q of elecQuestions) {
      this.setDoc(`exams/${elecExamId}/questions/${q.questionId}`, q);
    }
  }

  setDoc(path, data) {
    this.data.set(path, JSON.parse(JSON.stringify(data)));
  }

  getDoc(path) {
    const d = this.data.get(path);
    return d ? JSON.parse(JSON.stringify(d)) : null;
  }

  deleteDoc(path) {
    this.data.delete(path);
    // Also delete any subcollection items
    const prefix = `${path}/`;
    for (const k of this.data.keys()) {
      if (k.startsWith(prefix)) {
        this.data.delete(k);
      }
    }
  }

  getCollection(collPath) {
    const results = [];
    const prefix = `${collPath}/`;
    for (const [key, val] of this.data.entries()) {
      if (key.startsWith(prefix)) {
        const remaining = key.substring(prefix.length);
        if (!remaining.includes('/')) {
          results.push({ id: remaining, data: JSON.parse(JSON.stringify(val)) });
        }
      }
    }
    return results;
  }
}

/**
 * Smart Database Wrapper that automatically falls back to LocalStore if Firestore
 * throws a SERVICE_DISABLED, PERMISSION_DENIED or network error.
 */
function createSmartDb(realFirestoreDb) {
  const localStore = new LocalStore();
  let useLocal = !realFirestoreDb;

  return {
    collection(collName) {
      if (useLocal) {
        return new MockCollectionRef(localStore, collName);
      }

      const realCol = realFirestoreDb.collection(collName);
      const mockCol = new MockCollectionRef(localStore, collName);

      return {
        doc(id) {
          if (useLocal) return mockCol.doc(id);
          const realDoc = realCol.doc(id);
          const mockDoc = mockCol.doc(id);

          return {
            collection(subName) {
              if (useLocal) return mockDoc.collection(subName);
              const realSub = realDoc.collection(subName);
              const mockSub = mockDoc.collection(subName);
              return {
                doc(subId) {
                  if (useLocal) return mockSub.doc(subId);
                  const realSubDoc = realSub.doc(subId);
                  const mockSubDoc = mockSub.doc(subId);
                  return {
                    async get() {
                      try {
                        return await realSubDoc.get();
                      } catch (err) {
                        useLocal = true;
                        return await mockSubDoc.get();
                      }
                    },
                    async set(data, opts) {
                      mockSubDoc.set(data, opts);
                      try {
                        return await realSubDoc.set(data, opts);
                      } catch (err) {
                        useLocal = true;
                      }
                    },
                    async update(data) {
                      mockSubDoc.update(data);
                      try {
                        return await realSubDoc.update(data);
                      } catch (err) {
                        useLocal = true;
                      }
                    },
                    async delete() {
                      mockSubDoc.delete();
                      try {
                        return await realSubDoc.delete();
                      } catch (err) {
                        useLocal = true;
                      }
                    }
                  };
                },
                async get() {
                  try {
                    return await realSub.get();
                  } catch (err) {
                    useLocal = true;
                    return await mockSub.get();
                  }
                }
              };
            },
            async get() {
              try {
                return await realDoc.get();
              } catch (err) {
                useLocal = true;
                return await mockDoc.get();
              }
            },
            async set(data, opts) {
              mockDoc.set(data, opts);
              try {
                return await realDoc.set(data, opts);
              } catch (err) {
                useLocal = true;
              }
            },
            async update(data) {
              mockDoc.update(data);
              try {
                return await realDoc.update(data);
              } catch (err) {
                useLocal = true;
              }
            },
            async delete() {
              mockDoc.delete();
              try {
                return await realDoc.delete();
              } catch (err) {
                useLocal = true;
              }
            }
          };
        },
        where(field, op, val) {
          if (useLocal) return mockCol.where(field, op, val);
          return wrapQuery(realCol.where(field, op, val), mockCol.where(field, op, val), () => (useLocal = true));
        },
        orderBy(field, dir) {
          if (useLocal) return mockCol.orderBy(field, dir);
          return wrapQuery(realCol.orderBy(field, dir), mockCol.orderBy(field, dir), () => (useLocal = true));
        },
        limit(count) {
          if (useLocal) return mockCol.limit(count);
          return wrapQuery(realCol.limit(count), mockCol.limit(count), () => (useLocal = true));
        },
        async add(data) {
          const res = await mockCol.add(data);
          try {
            if (!useLocal) await realCol.add(data);
          } catch (err) {
            useLocal = true;
          }
          return res;
        },
        async get() {
          if (useLocal) return await mockCol.get();
          try {
            return await realCol.get();
          } catch (err) {
            useLocal = true;
            return await mockCol.get();
          }
        }
      };
    },

    async runTransaction(updateFn) {
      if (useLocal) {
        const fakeTx = {
          async get(docRef) {
            return await docRef.get();
          },
          set(docRef, data, opts) {
            return docRef.set(data, opts);
          },
          update(docRef, data) {
            return docRef.update(data);
          },
          delete(docRef) {
            return docRef.delete();
          }
        };
        return await updateFn(fakeTx);
      }

      try {
        return await realFirestoreDb.runTransaction(updateFn);
      } catch (err) {
        useLocal = true;
        const fakeTx = {
          async get(docRef) {
            return await docRef.get();
          },
          set(docRef, data, opts) {
            return docRef.set(data, opts);
          },
          update(docRef, data) {
            return docRef.update(data);
          },
          delete(docRef) {
            return docRef.delete();
          }
        };
        return await updateFn(fakeTx);
      }
    }
  };
}

function wrapQuery(realQuery, mockQuery, onFallback) {
  return {
    where(field, op, val) {
      return wrapQuery(realQuery.where(field, op, val), mockQuery.where(field, op, val), onFallback);
    },
    orderBy(field, dir) {
      return wrapQuery(realQuery.orderBy(field, dir), mockQuery.orderBy(field, dir), onFallback);
    },
    limit(count) {
      return wrapQuery(realQuery.limit(count), mockQuery.limit(count), onFallback);
    },
    async get() {
      try {
        return await realQuery.get();
      } catch (err) {
        onFallback();
        return await mockQuery.get();
      }
    }
  };
}

module.exports = {
  createSmartDb
};
